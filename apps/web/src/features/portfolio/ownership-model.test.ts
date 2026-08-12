import { describe, expect, it } from 'vitest';
import {
  ownershipPeriod,
  ownershipReadiness,
  partitionOwnership,
  shareTotals,
  validateOwnershipInput,
  type PropertyOwnershipRecord,
} from './ownership-model';

const ownership = (overrides: Partial<PropertyOwnershipRecord> = {}): PropertyOwnershipRecord => ({
  id: 'ownership-1',
  propertyId: 'property-1',
  ownerPartyId: 'owner-1',
  ownershipPercent: '100',
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  effectiveTo: null,
  owner: {
    id: 'owner-1',
    displayName: 'Amina Hassan',
    kind: 'PERSON',
    owner: { ownerNumber: 'OWN-0001', status: 'ACTIVE' },
  },
  entitlements: [
    {
      id: 'entitlement-1',
      payoutPercent: '100',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      effectiveTo: null,
    },
  ],
  ...overrides,
});

describe('ownership workflow model', () => {
  it('accepts one owner at 100% ownership and payout', () => {
    const input = {
      effectiveFrom: '2026-08-11',
      reason: 'Initial ownership agreement',
      shares: [{ ownerPartyId: 'owner-1', ownershipPercent: '100', payoutPercent: '100' }],
    };

    expect(shareTotals(input.shares)).toEqual({ ownership: 100, payout: 100 });
    expect(validateOwnershipInput(input)).toEqual([]);
  });

  it('accepts joint ownership with independent payout allocation', () => {
    const input = {
      effectiveFrom: '2026-08-11',
      reason: 'Joint ownership agreement',
      shares: [
        { ownerPartyId: 'owner-1', ownershipPercent: '60', payoutPercent: '55' },
        { ownerPartyId: 'owner-2', ownershipPercent: '40', payoutPercent: '45' },
      ],
    };

    expect(shareTotals(input.shares)).toEqual({ ownership: 100, payout: 100 });
    expect(validateOwnershipInput(input)).toEqual([]);
  });

  it('blocks invalid payout totals and duplicate owners', () => {
    const errors = validateOwnershipInput({
      effectiveFrom: '2026-08-11',
      reason: 'Invalid allocation',
      shares: [
        { ownerPartyId: 'owner-1', ownershipPercent: '50', payoutPercent: '60' },
        { ownerPartyId: 'owner-1', ownershipPercent: '50', payoutPercent: '30' },
      ],
    });

    expect(errors).toContain('Each owner can appear only once.');
    expect(errors).toContain('Payout allocation must total exactly 100%.');
  });

  it('separates current, scheduled, and historical ownership without losing records', () => {
    const current = ownership();
    const historical = ownership({
      id: 'ownership-old',
      effectiveFrom: '2025-01-01T00:00:00.000Z',
      effectiveTo: '2026-01-01T00:00:00.000Z',
    });
    const scheduled = ownership({
      id: 'ownership-next',
      effectiveFrom: '2026-10-01T00:00:00.000Z',
    });

    expect(ownershipPeriod(historical, '2026-08-11')).toBe('HISTORICAL');
    expect(partitionOwnership([current, historical, scheduled], '2026-08-11')).toEqual({
      current: [current],
      scheduled: [scheduled],
      historical: [historical],
    });
  });

  it('requires active owners and exact totals for activation readiness', () => {
    expect(ownershipReadiness([ownership()]).ready).toBe(true);
    expect(
      ownershipReadiness([
        ownership({
          owner: {
            id: 'owner-1',
            displayName: 'Amina Hassan',
            kind: 'PERSON',
            owner: { ownerNumber: 'OWN-0001', status: 'SUSPENDED' },
          },
        }),
      ]).ready,
    ).toBe(false);
  });
});
