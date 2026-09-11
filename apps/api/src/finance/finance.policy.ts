import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import {
  BrokerageDealStatus,
  JournalStatus,
  PayoutStatus,
  Prisma,
  SaleOfferStatus,
  ServiceEngagementStatus,
  ServiceModel,
} from '@prisma/client';
import { resolveCapabilitySet, type CapabilityName } from '../commercial/service-engagement.policy';
import { ServiceEngagementService } from '../commercial/service-engagement.service';
import { BusinessDateService } from '../common/business-date.service';
import { DatabaseService } from '../database/database.service';
import type { AuthenticatedPrincipal } from '../security/security.types';

const isoDate = (value: string | Date): Date =>
  value instanceof Date ? value : new Date(`${value.slice(0, 10)}T00:00:00.000Z`);

export const brokerageDealTransitions: Record<
  BrokerageDealStatus,
  readonly BrokerageDealStatus[]
> = {
  DRAFT: [BrokerageDealStatus.NEGOTIATING, BrokerageDealStatus.CANCELLED],
  NEGOTIATING: [BrokerageDealStatus.CONFIRMED, BrokerageDealStatus.CANCELLED],
  CONFIRMED: [BrokerageDealStatus.CLOSED, BrokerageDealStatus.CANCELLED],
  CLOSED: [],
  CANCELLED: [],
};

export const saleOfferTransitions: Record<SaleOfferStatus, readonly SaleOfferStatus[]> = {
  DRAFT: [SaleOfferStatus.SUBMITTED, SaleOfferStatus.WITHDRAWN],
  SUBMITTED: [
    SaleOfferStatus.COUNTERED,
    SaleOfferStatus.ACCEPTED,
    SaleOfferStatus.REJECTED,
    SaleOfferStatus.WITHDRAWN,
    SaleOfferStatus.EXPIRED,
  ],
  COUNTERED: [
    SaleOfferStatus.ACCEPTED,
    SaleOfferStatus.REJECTED,
    SaleOfferStatus.WITHDRAWN,
    SaleOfferStatus.EXPIRED,
  ],
  ACCEPTED: [],
  REJECTED: [],
  WITHDRAWN: [],
  EXPIRED: [],
};

export const payoutTransitions: Record<PayoutStatus, readonly PayoutStatus[]> = {
  DRAFT: [PayoutStatus.REVIEW, PayoutStatus.CANCELLED],
  REVIEW: [PayoutStatus.APPROVED, PayoutStatus.REJECTED, PayoutStatus.CANCELLED],
  APPROVED: [PayoutStatus.QUEUED, PayoutStatus.HELD, PayoutStatus.CANCELLED],
  QUEUED: [PayoutStatus.PROCESSING, PayoutStatus.FAILED, PayoutStatus.CANCELLED],
  PROCESSING: [PayoutStatus.PAID, PayoutStatus.FAILED],
  PAID: [PayoutStatus.RECONCILED],
  RECONCILED: [],
  HELD: [PayoutStatus.REVIEW, PayoutStatus.CANCELLED],
  REJECTED: [],
  FAILED: [PayoutStatus.QUEUED, PayoutStatus.CANCELLED],
  CANCELLED: [],
};

export function assertRecurringBillingModel(serviceModel: ServiceModel): void {
  if (serviceModel === ServiceModel.RENTAL_BROKERAGE) {
    throw new ConflictException('Rental Brokerage engagements cannot receive recurring rent billing.');
  }
  if (serviceModel !== ServiceModel.FULL_MANAGEMENT) {
    throw new ConflictException('Recurring rent billing is limited to Full Management engagements.');
  }
}

export function assertManualPaymentOnly(autoCapture?: boolean): void {
  if (autoCapture) {
    throw new BadRequestException('Only manual payment capture is supported.');
  }
}

export const ownerStatementLineCodes = [
  'OPENING_BALANCE',
  'RENT_COLLECTED',
  'MANAGEMENT_FEE',
  'EXPENSE',
  'ADJUSTMENT',
  'PAYOUT',
  'CLOSING_BALANCE',
] as const;

export type OwnerStatementLineCode = (typeof ownerStatementLineCodes)[number];

export function ownerStatementIdempotencyKey(input: {
  ownerPartyId: string;
  propertyId?: string | null;
  periodStart: Date;
  periodEnd: Date;
  currency: string;
}): string {
  const propertyScope = input.propertyId ?? 'portfolio';
  return `owner-statement:${input.ownerPartyId}:${propertyScope}:${input.periodStart.toISOString().slice(0, 10)}:${input.periodEnd.toISOString().slice(0, 10)}:${input.currency.toUpperCase()}`;
}

export function assembleOwnerStatementLines(input: {
  openingBalance: Prisma.Decimal;
  rentCollected: Prisma.Decimal;
  managementFee: Prisma.Decimal;
  expenses: Prisma.Decimal;
  adjustments: Prisma.Decimal;
  payouts: Prisma.Decimal;
}): {
  lines: Array<{ lineCode: OwnerStatementLineCode; description: string; amount: Prisma.Decimal }>;
  closingBalance: Prisma.Decimal;
} {
  const closingBalance = input.openingBalance
    .plus(input.rentCollected)
    .minus(input.managementFee)
    .minus(input.expenses)
    .plus(input.adjustments)
    .minus(input.payouts);
  return {
    closingBalance,
    lines: [
      {
        lineCode: 'OPENING_BALANCE',
        description: 'Opening balance',
        amount: input.openingBalance,
      },
      {
        lineCode: 'RENT_COLLECTED',
        description: 'Rent collected',
        amount: input.rentCollected,
      },
      {
        lineCode: 'MANAGEMENT_FEE',
        description: 'Management fees',
        amount: input.managementFee.negated(),
      },
      {
        lineCode: 'EXPENSE',
        description: 'Owner expenses',
        amount: input.expenses.negated(),
      },
      {
        lineCode: 'ADJUSTMENT',
        description: 'Adjustments',
        amount: input.adjustments,
      },
      {
        lineCode: 'PAYOUT',
        description: 'Owner payouts',
        amount: input.payouts.negated(),
      },
      {
        lineCode: 'CLOSING_BALANCE',
        description: 'Closing balance',
        amount: closingBalance,
      },
    ],
  };
}

export function applyOwnershipShare(
  amount: Prisma.Decimal,
  ownershipPercent: Prisma.Decimal,
): Prisma.Decimal {
  return amount.mul(ownershipPercent).div(100);
}

export function replayIdempotentRecord<T extends { companyId: string }>(
  existing: T | null | undefined,
  companyId: string,
): T | null {
  if (!existing) return null;
  if (existing.companyId !== companyId) {
    throw new ConflictException('Idempotency key is already in use.');
  }
  return existing;
}

export function assertNonNegativeMoney(value: Prisma.Decimal, label: string): void {
  if (value.lt(0)) {
    throw new BadRequestException(`${label} cannot be negative.`);
  }
}

export function assertJournalDraft(status: JournalStatus): void {
  if (status !== JournalStatus.DRAFT) {
    throw new ConflictException('Only draft journal entries may be edited or posted.');
  }
}

export function assertJournalPosted(status: JournalStatus): void {
  if (status !== JournalStatus.POSTED) {
    throw new ConflictException('Only posted journal entries may be reversed.');
  }
}

export function assertBalancedJournal(
  lines: ReadonlyArray<{ signedAmount: Prisma.Decimal | string | number }>,
): void {
  if (lines.length < 2) {
    throw new BadRequestException('A journal entry requires at least two lines.');
  }
  const total = lines.reduce(
    (sum, line) => sum.plus(new Prisma.Decimal(line.signedAmount)),
    new Prisma.Decimal(0),
  );
  if (!total.isZero()) {
    throw new BadRequestException('Journal lines must balance to zero before posting.');
  }
}

export function billingIdempotencyKey(
  scheduleId: string,
  periodStart: Date,
  periodEnd: Date,
): string {
  return `billing:${scheduleId}:${periodStart.toISOString().slice(0, 10)}:${periodEnd.toISOString().slice(0, 10)}`;
}

export function computeOwnerShareAmounts(
  netPayable: Prisma.Decimal,
  ownerships: ReadonlyArray<{ ownerPartyId: string; ownershipPercent: Prisma.Decimal }>,
): Array<{ ownerPartyId: string; sharePercent: Prisma.Decimal; amount: Prisma.Decimal }> {
  if (!ownerships.length) {
    throw new BadRequestException('Property ownership is required before an owner payout.');
  }
  const totalPercent = ownerships.reduce(
    (sum, row) => sum.plus(row.ownershipPercent),
    new Prisma.Decimal(0),
  );
  if (!totalPercent.equals(100)) {
    throw new BadRequestException('Configured ownership must total 100% for the payout period.');
  }
  return ownerships.map((row) => ({
    ownerPartyId: row.ownerPartyId,
    sharePercent: row.ownershipPercent,
    amount: netPayable.mul(row.ownershipPercent).div(100),
  }));
}

export function computeManagementFee(
  collectedIncome: Prisma.Decimal,
  managementFeePercent: Prisma.Decimal | null | undefined,
): Prisma.Decimal {
  if (!managementFeePercent) return new Prisma.Decimal(0);
  return collectedIncome.mul(managementFeePercent).div(100);
}

export function computeSaleSettlementAmounts(input: {
  serviceModel: ServiceModel;
  salePrice: Prisma.Decimal;
  commissionPercent: Prisma.Decimal | null | undefined;
  approvedDeductions: Prisma.Decimal;
}): {
  grossCommission: Prisma.Decimal;
  sellerProceeds: Prisma.Decimal;
  companyProceeds: Prisma.Decimal;
} {
  const approvedDeductions = input.approvedDeductions;
  if (input.serviceModel === ServiceModel.COMPANY_OWNED) {
    return {
      grossCommission: new Prisma.Decimal(0),
      sellerProceeds: new Prisma.Decimal(0),
      companyProceeds: input.salePrice.minus(approvedDeductions),
    };
  }
  const percent = input.commissionPercent ?? new Prisma.Decimal(0);
  const grossCommission = input.salePrice.mul(percent).div(100);
  return {
    grossCommission,
    sellerProceeds: input.salePrice.minus(grossCommission).minus(approvedDeductions),
    companyProceeds: grossCommission,
  };
}

export function assertLifecycleTransition<T extends string>(
  current: T,
  target: T,
  transitions: Record<T, readonly T[]>,
): void {
  if (!transitions[current]?.includes(target)) {
    throw new ConflictException(`Cannot transition from ${current} to ${target}.`);
  }
}

export type ActiveEngagementContext = {
  branchId: string;
  engagement: {
    id: string;
    serviceModel: ServiceModel;
    propertyId: string;
    rentableSpaceId: string | null;
  };
  capabilities: ReturnType<typeof resolveCapabilitySet>;
};

@Injectable()
export class FinancePolicyService {
  constructor(
    private readonly database: DatabaseService,
    private readonly businessDate: BusinessDateService,
    private readonly engagements: ServiceEngagementService,
  ) {}

  async activeEngagement(
    principal: AuthenticatedPrincipal,
    engagementId: string,
    propertyId: string,
    rentableSpaceId?: string | null,
    at?: Date,
  ): Promise<ActiveEngagementContext> {
    const businessDate = at ?? isoDate(principal.businessDate);
    const engagement = await this.database.serviceEngagement.findFirst({
      where: {
        id: engagementId,
        companyId: principal.companyId,
        propertyId,
        status: ServiceEngagementStatus.ACTIVE,
        effectiveFrom: { lte: businessDate },
        AND: [
          { OR: [{ effectiveTo: null }, { effectiveTo: { gt: businessDate } }] },
          rentableSpaceId
            ? { OR: [{ rentableSpaceId: null }, { rentableSpaceId }] }
            : { rentableSpaceId: null },
        ],
      },
      select: {
        id: true,
        serviceModel: true,
        propertyId: true,
        rentableSpaceId: true,
      },
    });
    if (!engagement) {
      throw new ConflictException('An active compatible Service Engagement is required.');
    }
    const resolved = await this.engagements.resolveCapabilities(principal, {
      propertyId,
      ...(rentableSpaceId ? { rentableSpaceId } : {}),
      businessDate: businessDate.toISOString().slice(0, 10),
    });
    return {
      branchId: resolved.branchId,
      engagement,
      capabilities: resolved.capabilities,
    };
  }

  assertCapability(context: ActiveEngagementContext, capability: CapabilityName): void {
    if (!context.capabilities[capability]) {
      throw new ConflictException(`The Service Engagement does not permit ${capability}.`);
    }
  }

  async commercialTermsAt(
    engagementId: string,
    at: Date,
  ): Promise<{
    managementFeePercent: Prisma.Decimal | null;
    commissionPercent: Prisma.Decimal | null;
    billingDayOfMonth: number | null;
  } | null> {
    const terms = await this.database.serviceEngagementCommercialTerms.findFirst({
      where: {
        serviceEngagementId: engagementId,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
      },
      select: {
        managementFeePercent: true,
        commissionPercent: true,
        billingDayOfMonth: true,
      },
      orderBy: [{ effectiveFrom: 'desc' }, { id: 'desc' }],
    });
    return terms;
  }

  async ownershipAt(
    propertyId: string,
    at: Date,
  ): Promise<Array<{ ownerPartyId: string; ownershipPercent: Prisma.Decimal; propertyId: string }>> {
    const rows = await this.database.propertyOwnership.findMany({
      where: {
        propertyId,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
      },
      select: {
        ownerPartyId: true,
        ownershipPercent: true,
        propertyId: true,
      },
    });
    return rows;
  }

  async today(principal: AuthenticatedPrincipal): Promise<Date> {
    return this.businessDate.today(principal.companyId);
  }
}
