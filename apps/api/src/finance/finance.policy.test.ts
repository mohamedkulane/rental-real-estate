import { JournalStatus, Prisma, ServiceModel } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  assertBalancedJournal,
  assertJournalDraft,
  assertJournalPosted,
  assertManualPaymentOnly,
  assertNonNegativeMoney,
  assertRecurringBillingModel,
  assembleOwnerStatementLines,
  applyOwnershipShare,
  billingIdempotencyKey,
  computeManagementFee,
  computeOwnerShareAmounts,
  computeSaleSettlementAmounts,
  ownerStatementIdempotencyKey,
  replayIdempotentRecord,
} from './finance.policy';

describe('finance.policy recurring billing', () => {
  it('allows recurring billing only for Full Management', () => {
    expect(() => assertRecurringBillingModel(ServiceModel.FULL_MANAGEMENT)).not.toThrow();
  });

  it('blocks Rental Brokerage from recurring rent billing', () => {
    expect(() => assertRecurringBillingModel(ServiceModel.RENTAL_BROKERAGE)).toThrow(
      'Rental Brokerage engagements cannot receive recurring rent billing.',
    );
  });

  it('blocks Rent Collection Only from recurring schedule creation', () => {
    expect(() => assertRecurringBillingModel(ServiceModel.RENT_COLLECTION_ONLY)).toThrow(
      'Recurring rent billing is limited to Full Management engagements.',
    );
  });

  it('builds stable billing idempotency keys', () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const end = new Date('2026-02-01T00:00:00.000Z');
    expect(billingIdempotencyKey('schedule-1', start, end)).toBe(
      'billing:schedule-1:2026-01-01:2026-02-01',
    );
  });
});

describe('finance.policy manual payments', () => {
  it('rejects auto-capture payments', () => {
    expect(() => assertManualPaymentOnly(true)).toThrow('Only manual payment capture is supported.');
  });

  it('accepts manual capture', () => {
    expect(() => assertManualPaymentOnly(false)).not.toThrow();
    expect(() => assertManualPaymentOnly(undefined)).not.toThrow();
  });
});

describe('finance.policy journals', () => {
  it('requires draft status before posting', () => {
    expect(() => assertJournalDraft(JournalStatus.DRAFT)).not.toThrow();
    expect(() => assertJournalDraft(JournalStatus.POSTED)).toThrow(
      'Only draft journal entries may be edited or posted.',
    );
  });

  it('requires posted status before reversal', () => {
    expect(() => assertJournalPosted(JournalStatus.POSTED)).not.toThrow();
    expect(() => assertJournalPosted(JournalStatus.DRAFT)).toThrow(
      'Only posted journal entries may be reversed.',
    );
  });

  it('rejects unbalanced journals', () => {
    expect(() =>
      assertBalancedJournal([
        { signedAmount: '100.0000' },
        { signedAmount: '-50.0000' },
      ]),
    ).toThrow('Journal lines must balance to zero before posting.');
  });

  it('accepts balanced journals', () => {
    expect(() =>
      assertBalancedJournal([
        { signedAmount: '100.0000' },
        { signedAmount: '-100.0000' },
      ]),
    ).not.toThrow();
  });
});

describe('finance.policy owner payouts', () => {
  it('reads management fee percent from commercial terms input', () => {
    const fee = computeManagementFee(new Prisma.Decimal('1000'), new Prisma.Decimal('8.5'));
    expect(fee.toString()).toBe('85');
  });

  it('splits net payable by joint ownership shares', () => {
    const lines = computeOwnerShareAmounts(new Prisma.Decimal('1000'), [
      { ownerPartyId: 'owner-a', ownershipPercent: new Prisma.Decimal('60') },
      { ownerPartyId: 'owner-b', ownershipPercent: new Prisma.Decimal('40') },
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0]?.amount.toString()).toBe('600');
    expect(lines[1]?.amount.toString()).toBe('400');
  });

  it('rejects ownership totals that do not equal 100%', () => {
    expect(() =>
      computeOwnerShareAmounts(new Prisma.Decimal('1000'), [
        { ownerPartyId: 'owner-a', ownershipPercent: new Prisma.Decimal('70') },
        { ownerPartyId: 'owner-b', ownershipPercent: new Prisma.Decimal('20') },
      ]),
    ).toThrow('Configured ownership must total 100% for the payout period.');
  });

  it('rejects negative other deductions', () => {
    expect(() => assertNonNegativeMoney(new Prisma.Decimal('-1'), 'Other deductions')).toThrow(
      'Other deductions cannot be negative.',
    );
    expect(() => assertNonNegativeMoney(new Prisma.Decimal('0'), 'Other deductions')).not.toThrow();
  });
});

describe('finance.policy sale settlement', () => {
  it('does not self-commission company-owned sales', () => {
    const result = computeSaleSettlementAmounts({
      serviceModel: ServiceModel.COMPANY_OWNED,
      salePrice: new Prisma.Decimal('500000'),
      commissionPercent: new Prisma.Decimal('3'),
      approvedDeductions: new Prisma.Decimal('5000'),
    });
    expect(result.grossCommission.toString()).toBe('0');
    expect(result.sellerProceeds.toString()).toBe('0');
    expect(result.companyProceeds.toString()).toBe('495000');
  });

  it('calculates brokerage commission for sale brokerage', () => {
    const result = computeSaleSettlementAmounts({
      serviceModel: ServiceModel.SALE_BROKERAGE,
      salePrice: new Prisma.Decimal('500000'),
      commissionPercent: new Prisma.Decimal('3'),
      approvedDeductions: new Prisma.Decimal('5000'),
    });
    expect(result.grossCommission.toString()).toBe('15000');
    expect(result.companyProceeds.toString()).toBe('15000');
    expect(result.sellerProceeds.toString()).toBe('480000');
  });
});

describe('finance.policy idempotency replay', () => {
  it('replays records for the same company', () => {
    const existing = { id: 'pay-1', companyId: 'company-a' };
    expect(replayIdempotentRecord(existing, 'company-a')).toEqual(existing);
    expect(replayIdempotentRecord(null, 'company-a')).toBeNull();
  });

  it('rejects replay of another company record', () => {
    expect(() =>
      replayIdempotentRecord({ id: 'pay-1', companyId: 'company-b' }, 'company-a'),
    ).toThrow('Idempotency key is already in use.');
  });
});

describe('finance.policy owner statements', () => {
  it('applies joint ownership share before assembling totals', () => {
    const rent = applyOwnershipShare(new Prisma.Decimal('1000'), new Prisma.Decimal('60'));
    expect(rent.toString()).toBe('600');
    const assembled = assembleOwnerStatementLines({
      openingBalance: new Prisma.Decimal('100'),
      rentCollected: rent,
      managementFee: new Prisma.Decimal('60'),
      expenses: new Prisma.Decimal('40'),
      adjustments: new Prisma.Decimal('10'),
      payouts: new Prisma.Decimal('200'),
    });
    expect(assembled.closingBalance.toString()).toBe('410');
    expect(assembled.lines.map((line) => line.lineCode)).toEqual([
      'OPENING_BALANCE',
      'RENT_COLLECTED',
      'MANAGEMENT_FEE',
      'EXPENSE',
      'ADJUSTMENT',
      'PAYOUT',
      'CLOSING_BALANCE',
    ]);
    expect(assembled.lines.find((line) => line.lineCode === 'MANAGEMENT_FEE')?.amount.toString()).toBe(
      '-60',
    );
  });

  it('builds a stable owner-statement idempotency key', () => {
    expect(
      ownerStatementIdempotencyKey({
        ownerPartyId: 'owner-a',
        propertyId: null,
        periodStart: new Date('2026-01-01T00:00:00.000Z'),
        periodEnd: new Date('2026-02-01T00:00:00.000Z'),
        currency: 'usd',
      }),
    ).toBe('owner-statement:owner-a:portfolio:2026-01-01:2026-02-01:USD');
  });
});
