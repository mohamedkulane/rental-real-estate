import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ExpenseResponsibility,
  ExpenseStatus,
  OwnerStatementStatus,
  PayoutStatus,
  Prisma,
  ServiceEngagementStatus,
  ServiceModel,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { uuidv7 } from '@rerms/shared';
import { cursorPage } from '../common/cursor-pagination';
import { nextRecordNumber } from '../common/record-number';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../governance/audit.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import {
  applyOwnershipShare,
  assembleOwnerStatementLines,
  computeManagementFee,
  FinancePolicyService,
  ownerStatementIdempotencyKey,
  replayIdempotentRecord,
} from './finance.policy';
import type { GenerateOwnerStatementDto, OwnerStatementQueryDto } from './finance.dto';

const isoDate = (value: string): Date => new Date(`${value.slice(0, 10)}T00:00:00.000Z`);

@Injectable()
export class OwnerStatementService {
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

  async list(principal: AuthenticatedPrincipal, query: OwnerStatementQueryDto) {
    const branchIds = this.branches(principal, 'owner-statement.read', query.branchId);
    const where: Prisma.OwnerStatementWhereInput = {
      companyId: principal.companyId,
      ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
      ...(query.ownerPartyId ? { ownerPartyId: query.ownerPartyId } : {}),
      ...(query.propertyId ? { propertyId: query.propertyId } : {}),
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    };
    const rows = await this.db.ownerStatement.findMany({
      where,
      take: query.limit + 1,
      orderBy: [{ periodStart: 'desc' }, { id: 'desc' }],
      include: { owner: { select: { displayName: true } }, property: { select: { name: true } }, lines: true },
    });
    return cursorPage(rows, query.limit, (row) => row.id);
  }

  async get(principal: AuthenticatedPrincipal, statementId: string) {
    const statement = await this.db.ownerStatement.findFirst({
      where: { id: statementId, companyId: principal.companyId },
      include: {
        owner: { select: { displayName: true } },
        property: { select: { name: true, propertyCode: true } },
        lines: { orderBy: { lineNo: 'asc' } },
      },
    });
    if (!statement) throw new NotFoundException('Owner statement not found.');
    this.auth.assertBranchPermission(principal, 'owner-statement.read', statement.branchId);
    return statement;
  }

  async generate(principal: AuthenticatedPrincipal, input: GenerateOwnerStatementDto, correlationId?: string) {
    const periodStart = isoDate(input.periodStart);
    const periodEnd = isoDate(input.periodEnd);
    if (periodEnd <= periodStart) {
      throw new BadRequestException('Statement period end must be after period start.');
    }
    this.auth.assertBranchPermission(principal, 'owner-statement.manage', input.branchId);
    const owner = await this.db.party.findFirst({
      where: { id: input.ownerPartyId, companyId: principal.companyId },
      select: { id: true },
    });
    if (!owner) throw new ConflictException('Owner party is unavailable.');
    const currency = input.currency.toUpperCase();
    const propertyIds = await this.ownedPropertyIds(
      principal.companyId,
      input.ownerPartyId,
      input.propertyId,
      periodEnd,
    );
    if (input.propertyId && !propertyIds.includes(input.propertyId)) {
      throw new ConflictException('The owner has no ownership on this property for the statement period.');
    }
    const totals = {
      rentCollected: new Prisma.Decimal(0),
      managementFee: new Prisma.Decimal(0),
      expenses: new Prisma.Decimal(0),
      adjustments: new Prisma.Decimal(0),
      payouts: new Prisma.Decimal(0),
    };
    for (const propertyId of propertyIds) {
      const share = await this.ownerShare(propertyId, input.ownerPartyId, periodEnd);
      if (share.lte(0)) continue;
      const propertyTotals = await this.propertyPeriodTotals(
        principal.companyId,
        propertyId,
        input.ownerPartyId,
        periodStart,
        periodEnd,
        currency,
      );
      totals.rentCollected = totals.rentCollected.plus(applyOwnershipShare(propertyTotals.rentCollected, share));
      totals.managementFee = totals.managementFee.plus(applyOwnershipShare(propertyTotals.managementFee, share));
      totals.expenses = totals.expenses.plus(applyOwnershipShare(propertyTotals.expenses, share));
      totals.adjustments = totals.adjustments.plus(applyOwnershipShare(propertyTotals.adjustments, share));
      totals.payouts = totals.payouts.plus(propertyTotals.payouts);
    }
    const openingBalance = await this.openingBalance(
      principal.companyId,
      input.ownerPartyId,
      input.propertyId ?? null,
      currency,
      periodStart,
    );
    const assembled = assembleOwnerStatementLines({ openingBalance, ...totals });
    const calculationHash = createHash('sha256')
      .update(
        JSON.stringify({
          ownerPartyId: input.ownerPartyId,
          propertyId: input.propertyId ?? null,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
          currency,
          totals: assembled.lines.map((line) => [line.lineCode, line.amount.toString()]),
        }),
      )
      .digest('hex');
    const idempotencyKey = ownerStatementIdempotencyKey({
      ownerPartyId: input.ownerPartyId,
      propertyId: input.propertyId ?? null,
      periodStart,
      periodEnd,
      currency,
    });
    return this.db.$transaction(async (tx) => {
      const existing = replayIdempotentRecord(
        await tx.ownerStatement.findUnique({
          where: { idempotencyKey },
          include: { lines: { orderBy: { lineNo: 'asc' } }, owner: { select: { displayName: true } } },
        }),
        principal.companyId,
      );
      if (existing) {
        if (existing.status === OwnerStatementStatus.ISSUED) return existing;
        await tx.ownerStatementLine.deleteMany({ where: { statementId: existing.id } });
        const updated = await tx.ownerStatement.update({
          where: { id: existing.id },
          data: {
            branchId: input.branchId,
            calculationHash,
            status: OwnerStatementStatus.ISSUED,
            issuedAt: new Date(),
            lines: {
              create: assembled.lines.map((line, index) => ({
                id: uuidv7(),
                lineNo: index + 1,
                lineCode: line.lineCode,
                description: line.description,
                amount: line.amount,
              })),
            },
          },
          include: { lines: { orderBy: { lineNo: 'asc' } }, owner: { select: { displayName: true } } },
        });
        await this.audit.write(tx, {
          actorUserId: principal.userId,
          action: 'owner-statement.recalculated',
          entityType: 'OwnerStatement',
          entityId: updated.id,
          branchId: updated.branchId,
          correlationId,
          after: { statementNumber: updated.statementNumber, calculationHash },
        });
        return updated;
      }
      const statement = await tx.ownerStatement.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          branchId: input.branchId,
          statementNumber: await nextRecordNumber(tx, 'STATEMENT'),
          ownerPartyId: input.ownerPartyId,
          propertyId: input.propertyId ?? null,
          periodStart,
          periodEnd,
          currency,
          status: OwnerStatementStatus.ISSUED,
          issuedAt: new Date(),
          calculationHash,
          idempotencyKey,
          lines: {
            create: assembled.lines.map((line, index) => ({
              id: uuidv7(),
              lineNo: index + 1,
              lineCode: line.lineCode,
              description: line.description,
              amount: line.amount,
            })),
          },
        },
        include: { lines: { orderBy: { lineNo: 'asc' } }, owner: { select: { displayName: true } } },
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'owner-statement.issued',
        entityType: 'OwnerStatement',
        entityId: statement.id,
        branchId: statement.branchId,
        correlationId,
        after: { statementNumber: statement.statementNumber, calculationHash },
      });
      return statement;
    });
  }

  private async ownedPropertyIds(
    companyId: string,
    ownerPartyId: string,
    propertyId: string | undefined,
    at: Date,
  ): Promise<string[]> {
    const rows = await this.db.propertyOwnership.findMany({
      where: {
        ownerPartyId,
        property: { companyId },
        ...(propertyId ? { propertyId } : {}),
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
      },
      select: { propertyId: true },
    });
    return [...new Set(rows.map((row) => row.propertyId))];
  }

  private async ownerShare(propertyId: string, ownerPartyId: string, at: Date): Promise<Prisma.Decimal> {
    const ownerships = await this.policy.ownershipAt(propertyId, at);
    const match = ownerships.find((row) => row.ownerPartyId === ownerPartyId);
    return match?.ownershipPercent ?? new Prisma.Decimal(0);
  }

  private async propertyPeriodTotals(
    companyId: string,
    propertyId: string,
    ownerPartyId: string,
    periodStart: Date,
    periodEnd: Date,
    currency: string,
  ) {
    const collected = await this.db.paymentAllocation.aggregate({
      where: {
        reversedAt: null,
        charge: {
          companyId,
          propertyId,
          currency,
          businessDate: { gte: periodStart, lte: periodEnd },
        },
      },
      _sum: { amount: true },
    });
    const expenses = await this.db.expense.aggregate({
      where: {
        companyId,
        propertyId,
        currency,
        responsibility: ExpenseResponsibility.OWNER,
        status: { in: [ExpenseStatus.POSTED, ExpenseStatus.PAID, ExpenseStatus.RECONCILED] },
        businessDate: { gte: periodStart, lte: periodEnd },
      },
      _sum: { amount: true },
    });
    const adjustments = await this.db.chargeAdjustment.aggregate({
      where: {
        companyId,
        charge: { propertyId, currency },
        createdAt: { gte: periodStart, lte: new Date(periodEnd.getTime() + 24 * 60 * 60 * 1000 - 1) },
      },
      _sum: { amount: true },
    });
    const payouts = await this.db.ownerPayoutLine.aggregate({
      where: {
        ownerPartyId: ownerPartyId,
        payout: {
          companyId,
          propertyId,
          currency,
          status: { in: [PayoutStatus.PAID, PayoutStatus.RECONCILED] },
          periodStart: { lt: periodEnd },
          periodEnd: { gt: periodStart },
        },
      },
      _sum: { amount: true },
    });
    const engagement = await this.db.serviceEngagement.findFirst({
      where: {
        companyId,
        propertyId,
        status: ServiceEngagementStatus.ACTIVE,
        serviceModel: ServiceModel.FULL_MANAGEMENT,
        effectiveFrom: { lte: periodEnd },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: periodEnd } }],
      },
      select: { id: true },
    });
    const terms = engagement ? await this.policy.commercialTermsAt(engagement.id, periodEnd) : null;
    const rentCollected = new Prisma.Decimal(collected._sum.amount ?? 0);
    return {
      rentCollected,
      managementFee: computeManagementFee(rentCollected, terms?.managementFeePercent ?? null),
      expenses: new Prisma.Decimal(expenses._sum.amount ?? 0),
      adjustments: new Prisma.Decimal(adjustments._sum.amount ?? 0),
      payouts: new Prisma.Decimal(payouts._sum.amount ?? 0),
    };
  }

  private async openingBalance(
    companyId: string,
    ownerPartyId: string,
    propertyId: string | null,
    currency: string,
    periodStart: Date,
  ): Promise<Prisma.Decimal> {
    const previous = await this.db.ownerStatement.findFirst({
      where: {
        companyId,
        ownerPartyId,
        currency,
        status: OwnerStatementStatus.ISSUED,
        periodEnd: { lte: periodStart },
        ...(propertyId ? { propertyId } : { propertyId: null }),
      },
      orderBy: [{ periodEnd: 'desc' }, { issuedAt: 'desc' }],
      include: { lines: { where: { lineCode: 'CLOSING_BALANCE' }, take: 1 } },
    });
    return previous?.lines[0]?.amount ?? new Prisma.Decimal(0);
  }
}
