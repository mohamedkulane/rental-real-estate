import { LeasePartyRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import {
  assertDistinctLeaseParties,
  assertPartiesNotPropertyOwners,
  assertPartyNotPropertyOwner,
  LEASE_PARTY_OVERLAP_MESSAGE,
  SELF_RENTAL_CONFLICT_MESSAGE,
} from './leasing.policy';

describe('leasing.policy self-rental guard', () => {
  const at = new Date('2026-09-13T00:00:00.000Z');
  const propertyId = 'property-1';
  const ownerPartyId = 'owner-party';
  const tenantPartyId = 'tenant-party';

  it('rejects lease parties when tenant and landlord are the same party', () => {
    expect(() =>
      assertDistinctLeaseParties([
        { partyId: ownerPartyId, role: LeasePartyRole.TENANT },
        { partyId: ownerPartyId, role: LeasePartyRole.LANDLORD },
      ]),
    ).toThrow(LEASE_PARTY_OVERLAP_MESSAGE);
  });

  it('allows distinct tenant and landlord parties', () => {
    expect(() =>
      assertDistinctLeaseParties([
        { partyId: tenantPartyId, role: LeasePartyRole.TENANT },
        { partyId: ownerPartyId, role: LeasePartyRole.LANDLORD },
      ]),
    ).not.toThrow();
  });

  it('rejects when an applicant party owns the target property', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'ownership-1' });
    await expect(
      assertPartyNotPropertyOwner({ findFirst }, propertyId, ownerPartyId, at),
    ).rejects.toThrow(SELF_RENTAL_CONFLICT_MESSAGE);
  });

  it('allows applicants who are not owners of the target property', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    await expect(
      assertPartyNotPropertyOwner({ findFirst }, propertyId, tenantPartyId, at),
    ).resolves.toBeUndefined();
  });

  it('checks every tenant party on a lease', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    await assertPartiesNotPropertyOwners({ findFirst }, propertyId, [tenantPartyId], at);
    expect(findFirst).toHaveBeenCalledTimes(1);
  });
});
