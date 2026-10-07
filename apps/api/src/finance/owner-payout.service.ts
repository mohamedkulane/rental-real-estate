import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  ExpenseResponsibility,
  ExpenseStatus,
  PaymentStatus,
  PayoutStatus,
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
  assertLifecycleTransition,
  assertNonNegativeMoney,
  computeManagementFee,
  computeOwnerShareAmounts,
  FinancePolicyService,
  payoutTransitions,
} from './finance.policy';
import type {
  CreateOwnerPayoutDto,
  OwnerPayoutQueryDto,
  OwnerPayoutTransitionDto,
} from './finance.dto';

const isoDate = (value: string): Date => new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
const OWNER_PAYOUT_APPROVAL_ACTION = 'OWNER_PAYOUT';
const OWNER_PAYOUT_TARGET = 'OwnerPayout';

const validCorrelationId = (value?: string): string | null =>
  value && /^[0-9a-f-]{36}$/i.test(value) ? value : null;

@Injectable()
export class OwnerPayoutService {
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

  async list(principal: AuthenticatedPrincipal, query: OwnerPayoutQueryDto) {
    const branchIds = this.branches(principal, 'payout.read', query.branchId);
    const where: Prisma.OwnerPayoutWhereInput = {
      companyId: principal.companyId,
      ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
      ...(query.ownerPartyId ? { ownerPartyId: query.ownerPartyId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { payoutNumber: { contains: query.search, mode: 'insensitive' } } : {}),
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    };
    const rows = await this.db.ownerPayout.findMany({
      where,
      take: query.limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { lines: true },
    });
    return cursorPage(rows, query.limit, (row) => row.id);
  }

  async create(
    principal: AuthenticatedPrincipal,
    input: CreateOwnerPayoutDto,
    correlationId?: string,
  ) {
    const periodStart = isoDate(input.periodStart);
    const periodEnd = isoDate(input.periodEnd);
    if (periodEnd <= periodStart) {
      throw new BadRequestException('Payout period end must be after period start.');
    }
    const context = await this.policy.activeEngagement(
      principal,
      input.serviceEngagementId,
      input.propertyId,
    );
    this.policy.assertCapability(context, 'canCollectRent');
    this.auth.assertBranchPermission(principal, 'payout.manage', context.branchId);
    const terms = await this.policy.commercialTermsAt(input.serviceEngagementId, periodEnd);
    const ownerships = await this.policy.ownershipAt(input.propertyId, periodEnd);
    const collectedIncome = await this.db.paymentAllocation.aggregate({
      where: {
        reversedAt: null,
        payment: {
          status: {
            in: [
              PaymentStatus.POSTED,
              PaymentStatus.PARTIALLY_ALLOCATED,
              PaymentStatus.FULLY_ALLOCATED,
            ],
          },
        },
        charge: {
          companyId: principal.companyId,
          propertyId: input.propertyId,
          serviceEngagementId: input.serviceEngagementId,
          commissionSide: null,
          businessDate: { gte: periodStart, lte: periodEnd },
        },
      },
      _sum: { amount: true },
    });
    const expenseDeductions = await this.db.expense.aggregate({
      where: {
        companyId: principal.companyId,
        propertyId: input.propertyId,
        responsibility: ExpenseResponsibility.OWNER,
        status: { in: [ExpenseStatus.POSTED, ExpenseStatus.PAID, ExpenseStatus.RECONCILED] },
        businessDate: { gte: periodStart, lte: periodEnd },
      },
      _sum: { amount: true },
    });
    const income = new Prisma.Decimal(collectedIncome._sum.amount ?? 0);
    const deductions = new Prisma.Decimal(expenseDeductions._sum.amount ?? 0);
    const otherDeductions = new Prisma.Decimal(input.otherDeductions ?? 0);
    assertNonNegativeMoney(otherDeductions, 'Other deductions');
    const managementFee = computeManagementFee(income, terms?.managementFeePercent ?? null);
    const netPayable = income.minus(deductions).minus(managementFee).minus(otherDeductions);
    if (netPayable.lt(0)) {
      throw new ConflictException('Owner payout net payable cannot be negative.');
    }
    const shareLines = computeOwnerShareAmounts(netPayable, ownerships);
    const primaryOwner = shareLines[0];
    if (!primaryOwner) throw new BadRequestException('Owner payout requires at least one owner.');
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM properties WHERE id = ${input.propertyId}::uuid FOR UPDATE`,
      );
      const overlapping = await tx.ownerPayout.findFirst({
        where: {
          companyId: principal.companyId,
          propertyId: input.propertyId,
          status: { notIn: [PayoutStatus.CANCELLED, PayoutStatus.REJECTED] },
          periodStart: { lt: periodEnd },
          periodEnd: { gt: periodStart },
        },
        select: { payoutNumber: true },
      });
      if (overlapping) {
        throw new ConflictException(
          `An active owner payout (${overlapping.payoutNumber}) already covers this property and period.`,
        );
      }
      const payout = await tx.ownerPayout.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          branchId: context.branchId,
          payoutNumber: await nextRecordNumber(tx, 'PAYOUT'),
          ownerPartyId: primaryOwner.ownerPartyId,
          propertyId: input.propertyId,
          periodStart,
          periodEnd,
          currency: input.currency.toUpperCase(),
          collectedIncome: income,
          expenseDeductions: deductions,
          managementFee,
          otherDeductions,
          netPayable,
          status: PayoutStatus.DRAFT,
          destinationSnapshot: { method: 'MANUAL', owners: shareLines.length },
          lines: {
            create: shareLines.map((line) => ({
              id: uuidv7(),
              ownerPartyId: line.ownerPartyId,
              propertyId: input.propertyId,
              sharePercent: line.sharePercent,
              amount: line.amount,
            })),
          },
        },
        include: { lines: true },
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'owner-payout.created',
        entityType: 'OwnerPayout',
        entityId: payout.id,
        branchId: payout.branchId,
        correlationId,
        after: {
          payoutNumber: payout.payoutNumber,
          netPayable: payout.netPayable.toString(),
          managementFeePercent: terms?.managementFeePercent?.toString() ?? null,
        },
      });
      return payout;
    });
  }

  async transition(
    principal: AuthenticatedPrincipal,
    payoutId: string,
    input: OwnerPayoutTransitionDto,
    correlationId?: string,
  ) {
    const current = await this.db.ownerPayout.findFirst({
      where: { id: payoutId, companyId: principal.companyId },
    });
    if (!current) throw new NotFoundException('Owner payout not found.');
    this.auth.assertBranchPermission(principal, 'payout.manage', current.branchId);
    assertLifecycleTransition(current.status, input.status, payoutTransitions);

    if (current.status === PayoutStatus.DRAFT && input.status === PayoutStatus.REVIEW) {
      this.auth.assertBranchPermission(principal, 'governance.approval.request', current.branchId);
    }
    if (
      current.status === PayoutStatus.REVIEW &&
      (input.status === PayoutStatus.APPROVED || input.status === PayoutStatus.REJECTED)
    ) {
      this.auth.assertBranchPermission(principal, 'governance.approval.decide', current.branchId);
    }

    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM owner_payouts WHERE id = ${payoutId}::uuid FOR UPDATE`,
      );
      const locked = await tx.ownerPayout.findFirst({
        where: { id: payoutId, companyId: principal.companyId },
      });
      if (!locked) throw new NotFoundException('Owner payout not found.');
      assertLifecycleTransition(locked.status, input.status, payoutTransitions);

      if (locked.status === PayoutStatus.DRAFT && input.status === PayoutStatus.REVIEW) {
        const businessDate = isoDate(principal.businessDate);
        const policy = await tx.approvalPolicy.findFirst({
          where: {
            companyId: principal.companyId,
            active: true,
            effectiveFrom: { lte: businessDate },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: businessDate } }],
            rules: { some: { actionType: OWNER_PAYOUT_APPROVAL_ACTION } },
          },
          include: {
            rules: {
              where: { actionType: OWNER_PAYOUT_APPROVAL_ACTION },
              orderBy: { sequence: 'asc' },
            },
          },
          orderBy: { effectiveFrom: 'desc' },
        });
        const applicableRules = (policy?.rules ?? []).filter(
          (rule) =>
            (!rule.currency || rule.currency === locked.currency) &&
            (!rule.minAmount || locked.netPayable.gte(rule.minAmount)) &&
            (!rule.maxAmount || locked.netPayable.lte(rule.maxAmount)),
        );
        if (!policy || !applicableRules.length) {
          throw new ConflictException(
            'Owner payout review requires an active approval policy for this amount and currency.',
          );
        }
        const approval = await tx.approvalRequest.create({
          data: {
            id: uuidv7(),
            policyId: policy.id,
            makerEmployeeId: principal.employeeId,
            branchId: locked.branchId,
            actionType: OWNER_PAYOUT_APPROVAL_ACTION,
            targetType: OWNER_PAYOUT_TARGET,
            targetId: locked.id,
            amount: locked.netPayable,
            currency: locked.currency,
            status: ApprovalStatus.PENDING,
            correlationId: validCorrelationId(correlationId),
            steps: {
              create: applicableRules.map((rule) => ({
                id: uuidv7(),
                sequence: rule.sequence,
                status: 'PENDING',
              })),
            },
          },
        });
        const row = await tx.ownerPayout.update({
          where: { id: payoutId },
          data: { status: PayoutStatus.REVIEW, approvalRequestId: approval.id },
          include: { lines: true },
        });
        await this.audit.write(tx, {
          actorUserId: principal.userId,
          action: 'governance.approval.requested',
          entityType: 'ApprovalRequest',
          entityId: approval.id,
          branchId: locked.branchId,
          correlationId,
          after: {
            actionType: OWNER_PAYOUT_APPROVAL_ACTION,
            targetType: OWNER_PAYOUT_TARGET,
            targetId: locked.id,
            amount: locked.netPayable.toString(),
          },
        });
        await this.audit.write(tx, {
          actorUserId: principal.userId,
          action: 'owner-payout.transitioned',
          entityType: OWNER_PAYOUT_TARGET,
          entityId: payoutId,
          branchId: locked.branchId,
          correlationId,
          reason: input.reason,
          before: { status: locked.status },
          after: { status: row.status, approvalRequestId: approval.id },
        });
        return row;
      }

      if (
        locked.status === PayoutStatus.REVIEW &&
        (input.status === PayoutStatus.APPROVED || input.status === PayoutStatus.REJECTED)
      ) {
        if (!locked.approvalRequestId) {
          throw new ConflictException('Owner payout review is missing its approval request.');
        }
        const approval = await tx.approvalRequest.findFirst({
          where: {
            id: locked.approvalRequestId,
            targetType: OWNER_PAYOUT_TARGET,
            targetId: locked.id,
          },
          include: {
            policy: { include: { rules: true } },
            steps: { orderBy: { sequence: 'asc' } },
          },
        });
        if (!approval || approval.status !== ApprovalStatus.PENDING) {
          throw new ConflictException('Owner payout approval request is not pending.');
        }
        const step = approval.steps.find((candidate) => candidate.status === 'PENDING');
        if (!step) throw new ConflictException('Owner payout has no pending approval step.');
        const rule = approval.policy.rules.find(
          (candidate) =>
            candidate.actionType === approval.actionType && candidate.sequence === step.sequence,
        );
        if (!rule) throw new ConflictException('Owner payout approval rule is unavailable.');
        if (rule.makerChecker && approval.makerEmployeeId === principal.employeeId) {
          throw new BadRequestException('The payout preparer cannot approve their own payout.');
        }

        const outcome = input.status === PayoutStatus.REJECTED ? 'REJECTED' : 'APPROVED';
        const decision = await tx.approvalDecision.create({
          data: {
            id: uuidv7(),
            stepId: step.id,
            approverEmployeeId: principal.employeeId,
            outcome,
            reason: input.reason,
          },
        });
        await tx.approvalStep.update({
          where: { id: step.id },
          data: { status: outcome },
        });

        const hasRemainingSteps =
          outcome === 'APPROVED' &&
          approval.steps.some(
            (candidate) => candidate.id !== step.id && candidate.status === 'PENDING',
          );
        const approvalStatus =
          outcome === 'REJECTED'
            ? ApprovalStatus.REJECTED
            : hasRemainingSteps
              ? ApprovalStatus.PENDING
              : ApprovalStatus.APPROVED;
        await tx.approvalRequest.update({
          where: { id: approval.id },
          data: { status: approvalStatus },
        });

        const nextPayoutStatus =
          outcome === 'REJECTED'
            ? PayoutStatus.REJECTED
            : hasRemainingSteps
              ? PayoutStatus.REVIEW
              : PayoutStatus.APPROVED;
        const row = await tx.ownerPayout.update({
          where: { id: payoutId },
          data: { status: nextPayoutStatus },
          include: { lines: true },
        });
        await this.audit.write(tx, {
          actorUserId: principal.userId,
          action: `governance.approval.${outcome.toLowerCase()}`,
          entityType: 'ApprovalRequest',
          entityId: approval.id,
          branchId: locked.branchId,
          correlationId,
          reason: input.reason,
          after: { decisionId: decision.id, outcome, stepSequence: step.sequence },
        });
        if (nextPayoutStatus !== locked.status) {
          await this.audit.write(tx, {
            actorUserId: principal.userId,
            action: 'owner-payout.transitioned',
            entityType: OWNER_PAYOUT_TARGET,
            entityId: payoutId,
            branchId: locked.branchId,
            correlationId,
            reason: input.reason,
            before: { status: locked.status },
            after: { status: row.status, approvalRequestId: approval.id },
          });
        }
        return row;
      }

      const row = await tx.ownerPayout.update({
        where: { id: payoutId },
        data: { status: input.status },
        include: { lines: true },
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'owner-payout.transitioned',
        entityType: 'OwnerPayout',
        entityId: payoutId,
        branchId: locked.branchId,
        correlationId,
        reason: input.reason,
        before: { status: locked.status },
        after: { status: row.status },
      });
      return row;
    });
  }

  async get(principal: AuthenticatedPrincipal, payoutId: string) {
    const payout = await this.db.ownerPayout.findFirst({
      where: { id: payoutId, companyId: principal.companyId },
      include: {
        owner: { select: { displayName: true } },
        property: { select: { name: true, propertyCode: true } },
        lines: {
          include: { owner: { select: { displayName: true } } },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!payout) throw new NotFoundException('Owner payout not found.');
    this.auth.assertBranchPermission(principal, 'payout.read', payout.branchId);
    return payout;
  }
}
