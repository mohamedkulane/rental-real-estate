import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BillingScheduleStatus,
  ChargeStatus,
  InvoiceStatus,
  LeasePartyRole,
  LeaseStatus,
  Prisma,
} from '@prisma/client';
import { uuidv7 } from '@rerms/shared';
import { cursorPage } from '../common/cursor-pagination';
import { nextRecordNumber } from '../common/record-number';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../governance/audit.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import {
  assertRecurringBillingModel,
  billingIdempotencyKey,
  FinancePolicyService,
} from './finance.policy';
import type {
  BillingScheduleQueryDto,
  ChargeQueryDto,
  CreateBillingScheduleDto,
  InvoiceQueryDto,
  IssueInvoiceDto,
  RunBillingDto,
} from './finance.dto';

const isoDate = (value: string): Date => new Date(`${value.slice(0, 10)}T00:00:00.000Z`);

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function periodForRun(runDate: Date, billingDayOfMonth: number): { start: Date; end: Date; due: Date } {
  const year = runDate.getUTCFullYear();
  const month = runDate.getUTCMonth();
  const day = Math.min(billingDayOfMonth, 28);
  const start = new Date(Date.UTC(year, month, day));
  const end = addMonths(start, 1);
  const due = end;
  return { start, end, due };
}

@Injectable()
export class BillingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auth: AuthorizationService,
    private readonly audit: AuditService,
    private readonly policy: FinancePolicyService,
  ) {}

  private branches(principal: AuthenticatedPrincipal, permission: string, branchId?: string) {
    const allowed = this.auth.authorizedBranchIds(principal, permission);
    if (allowed === null) return branchId ? [branchId] : null;
    return [...allowed].filter((id) => !branchId || id === branchId);
  }

  async listSchedules(principal: AuthenticatedPrincipal, query: BillingScheduleQueryDto) {
    const branchIds = this.branches(principal, 'billing.read', query.branchId);
    const where: Prisma.BillingScheduleWhereInput = {
      companyId: principal.companyId,
      ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
      ...(query.serviceEngagementId ? { serviceEngagementId: query.serviceEngagementId } : {}),
      ...(query.leaseId ? { leaseId: query.leaseId } : {}),
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    };
    const rows = await this.db.billingSchedule.findMany({
      where,
      take: query.limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        engagement: { select: { engagementNumber: true, serviceModel: true } },
        lease: { select: { leaseNumber: true } },
      },
    });
    return cursorPage(rows, query.limit, (row) => row.id);
  }

  async createSchedule(
    principal: AuthenticatedPrincipal,
    input: CreateBillingScheduleDto,
    correlationId?: string,
  ) {
    const lease = await this.db.lease.findFirst({
      where: {
        id: input.leaseId,
        companyId: principal.companyId,
        status: { in: [LeaseStatus.SIGNED, LeaseStatus.ACTIVE] },
      },
      include: { rentableSpace: { select: { propertyId: true } } },
    });
    if (!lease) throw new ConflictException('A signed or active Lease is required.');
    const context = await this.policy.activeEngagement(
      principal,
      input.serviceEngagementId,
      lease.rentableSpace.propertyId,
      lease.rentableSpaceId,
    );
    this.policy.assertCapability(context, 'canCollectRent');
    assertRecurringBillingModel(context.engagement.serviceModel);
    this.auth.assertBranchPermission(principal, 'billing.manage', context.branchId);
    const effectiveFrom = isoDate(input.effectiveFrom);
    const effectiveTo = input.effectiveTo ? isoDate(input.effectiveTo) : null;
    if (effectiveTo && effectiveTo <= effectiveFrom) {
      throw new BadRequestException('Effective To must be after Effective From.');
    }
    const idempotencyKey = `schedule:${input.serviceEngagementId}:${input.leaseId}:${input.chargeTypeId}:${input.effectiveFrom}`;
    return this.db.$transaction(async (tx) => {
      const existing = await tx.billingSchedule.findUnique({ where: { idempotencyKey } });
      if (existing) return existing;
      const schedule = await tx.billingSchedule.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          branchId: context.branchId,
          serviceEngagementId: input.serviceEngagementId,
          leaseId: input.leaseId,
          chargeTypeId: input.chargeTypeId,
          frequency: 'MONTHLY',
          billingDayOfMonth: input.billingDayOfMonth,
          currency: input.currency.toUpperCase(),
          amount: new Prisma.Decimal(input.amount),
          effectiveFrom,
          effectiveTo,
          nextRunOn: effectiveFrom,
          idempotencyKey,
          status: BillingScheduleStatus.ACTIVE,
        },
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'billing-schedule.created',
        entityType: 'BillingSchedule',
        entityId: schedule.id,
        branchId: schedule.branchId,
        correlationId,
        after: {
          leaseId: schedule.leaseId,
          serviceEngagementId: schedule.serviceEngagementId,
          amount: schedule.amount?.toString(),
        },
      });
      return schedule;
    });
  }

  async runBilling(principal: AuthenticatedPrincipal, input: RunBillingDto, correlationId?: string) {
    const runDate = input.runDate ? isoDate(input.runDate) : isoDate(principal.businessDate);
    const branchIds = this.branches(principal, 'billing.manage');
    const schedules = await this.db.billingSchedule.findMany({
      where: {
        companyId: principal.companyId,
        status: BillingScheduleStatus.ACTIVE,
        nextRunOn: { lte: runDate },
        ...(input.billingScheduleId ? { id: input.billingScheduleId } : {}),
        ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
      },
      include: {
        engagement: { select: { serviceModel: true } },
        lease: {
          select: {
            id: true,
            rentAmount: true,
            currency: true,
            rentableSpaceId: true,
            rentableSpace: { select: { propertyId: true } },
            parties: {
              where: { role: LeasePartyRole.TENANT },
              select: { partyId: true },
              take: 1,
            },
          },
        },
      },
    });
    const results: Array<{ scheduleId: string; chargeId: string | null; skipped: boolean }> = [];
    for (const schedule of schedules) {
      try {
        assertRecurringBillingModel(schedule.engagement.serviceModel);
        this.auth.assertBranchPermission(principal, 'billing.manage', schedule.branchId);
        if (!schedule.lease?.parties[0]) {
          results.push({ scheduleId: schedule.id, chargeId: null, skipped: true });
          continue;
        }
        const period = periodForRun(runDate, schedule.billingDayOfMonth);
        const amount = schedule.amount ?? schedule.lease.rentAmount;
        const idempotencyKey = billingIdempotencyKey(schedule.id, period.start, period.end);
        const charge = await this.db.$transaction(async (tx) => {
          const existing = await tx.charge.findUnique({ where: { idempotencyKey } });
          if (existing) return existing;
          const created = await tx.charge.create({
            data: {
              id: uuidv7(),
              companyId: principal.companyId,
              branchId: schedule.branchId,
              chargeNumber: await nextRecordNumber(tx, 'CHARGE'),
              debtorPartyId: schedule.lease!.parties[0]!.partyId,
              leaseId: schedule.leaseId,
              propertyId: schedule.lease!.rentableSpace.propertyId,
              rentableSpaceId: schedule.lease!.rentableSpaceId,
              serviceEngagementId: schedule.serviceEngagementId,
              chargeTypeId: schedule.chargeTypeId,
              billingScheduleId: schedule.id,
              businessDate: runDate,
              periodStart: period.start,
              periodEnd: period.end,
              dueDate: period.due,
              currency: schedule.currency,
              originalAmount: amount,
              outstandingAmount: amount,
              status: ChargeStatus.OPEN,
              idempotencyKey,
            },
          });
          await tx.billingSchedule.update({
            where: { id: schedule.id },
            data: {
              lastRunAt: new Date(),
              nextRunOn: addMonths(period.end, 0),
            },
          });
          await this.audit.write(tx, {
            actorUserId: principal.userId,
            action: 'billing.charge-generated',
            entityType: 'Charge',
            entityId: created.id,
            branchId: created.branchId,
            correlationId,
            after: {
              billingScheduleId: schedule.id,
              chargeNumber: created.chargeNumber,
              idempotencyKey,
            },
          });
          return created;
        });
        results.push({ scheduleId: schedule.id, chargeId: charge.id, skipped: false });
      } catch {
        results.push({ scheduleId: schedule.id, chargeId: null, skipped: true });
      }
    }
    return { runDate: runDate.toISOString().slice(0, 10), results };
  }

  async listCharges(principal: AuthenticatedPrincipal, query: ChargeQueryDto) {
    const branchIds = this.branches(principal, 'billing.read', query.branchId);
    const where: Prisma.ChargeWhereInput = {
      companyId: principal.companyId,
      ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
      ...(query.leaseId ? { leaseId: query.leaseId } : {}),
      ...(query.debtorPartyId ? { debtorPartyId: query.debtorPartyId } : {}),
      ...(query.search
        ? { chargeNumber: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    };
    const rows = await this.db.charge.findMany({
      where,
      take: query.limit + 1,
      orderBy: [{ dueDate: 'desc' }, { id: 'desc' }],
    });
    return cursorPage(rows, query.limit, (row) => row.id);
  }

  async listInvoices(principal: AuthenticatedPrincipal, query: InvoiceQueryDto) {
    const branchIds = this.branches(principal, 'invoice.read', query.branchId);
    const where: Prisma.InvoiceWhereInput = {
      companyId: principal.companyId,
      ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.debtorPartyId ? { debtorPartyId: query.debtorPartyId } : {}),
      ...(query.search
        ? { invoiceNumber: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    };
    const rows = await this.db.invoice.findMany({
      where,
      take: query.limit + 1,
      orderBy: [{ issueDate: 'desc' }, { id: 'desc' }],
      include: { lines: { include: { charge: { select: { chargeNumber: true, status: true } } } } },
    });
    return cursorPage(rows, query.limit, (row) => row.id);
  }

  async issueInvoice(
    principal: AuthenticatedPrincipal,
    input: IssueInvoiceDto,
    correlationId?: string,
  ) {
    const charges = await this.db.charge.findMany({
      where: {
        id: { in: input.chargeIds },
        companyId: principal.companyId,
        debtorPartyId: input.debtorPartyId,
        status: { in: [ChargeStatus.OPEN, ChargeStatus.PARTIALLY_PAID] },
      },
    });
    if (charges.length !== input.chargeIds.length) {
      throw new ConflictException('One or more open charges are unavailable for invoicing.');
    }
    const branchId = charges[0]!.branchId;
    this.auth.assertBranchPermission(principal, 'invoice.manage', branchId);
    if (charges.some((row) => row.branchId !== branchId || row.currency !== input.currency.toUpperCase())) {
      throw new ConflictException('All invoice charges must share branch and currency.');
    }
    return this.db.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          branchId,
          invoiceNumber: await nextRecordNumber(tx, 'INVOICE'),
          debtorPartyId: input.debtorPartyId,
          issueDate: isoDate(input.issueDate),
          dueDate: isoDate(input.dueDate),
          currency: input.currency.toUpperCase(),
          status: InvoiceStatus.ISSUED,
          lines: {
            create: charges.map((charge) => ({
              id: uuidv7(),
              chargeId: charge.id,
              displayAmount: charge.outstandingAmount,
            })),
          },
        },
        include: { lines: true },
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'invoice.issued',
        entityType: 'Invoice',
        entityId: invoice.id,
        branchId,
        correlationId,
        after: { invoiceNumber: invoice.invoiceNumber, chargeIds: input.chargeIds },
      });
      return invoice;
    });
  }

  async getInvoice(principal: AuthenticatedPrincipal, invoiceId: string) {
    const invoice = await this.db.invoice.findFirst({
      where: { id: invoiceId, companyId: principal.companyId },
      include: { lines: { include: { charge: true } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found.');
    this.auth.assertBranchPermission(principal, 'invoice.read', invoice.branchId);
    return invoice;
  }
}
