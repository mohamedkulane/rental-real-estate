import { ConflictException } from '@nestjs/common';
import { LeasePartyRole } from '@prisma/client';

export const SELF_RENTAL_CONFLICT_MESSAGE =
  'A property owner cannot rent their own property.';

export const LEASE_PARTY_OVERLAP_MESSAGE =
  'The Tenant and Landlord must be different parties.';

type OwnershipLookup = {
  findFirst(args: {
    where: {
      propertyId: string;
      ownerPartyId: string;
      effectiveFrom: { lte: Date };
      OR: Array<{ effectiveTo: null } | { effectiveTo: { gt: Date } }>;
    };
    select: { id: true };
  }): Promise<{ id: string } | null>;
};

export function assertDistinctLeaseParties(
  parties: ReadonlyArray<{ partyId: string; role: LeasePartyRole }>,
): void {
  const tenantIds = parties
    .filter((party) => party.role === LeasePartyRole.TENANT)
    .map((party) => party.partyId);
  const landlordIds = parties
    .filter((party) => party.role === LeasePartyRole.LANDLORD)
    .map((party) => party.partyId);
  if (tenantIds.some((partyId) => landlordIds.includes(partyId))) {
    throw new ConflictException(LEASE_PARTY_OVERLAP_MESSAGE);
  }
}

export async function assertPartyNotPropertyOwner(
  ownerships: OwnershipLookup,
  propertyId: string,
  partyId: string,
  at: Date,
): Promise<void> {
  const row = await ownerships.findFirst({
    where: {
      propertyId,
      ownerPartyId: partyId,
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
    },
    select: { id: true },
  });
  if (row) throw new ConflictException(SELF_RENTAL_CONFLICT_MESSAGE);
}

export async function assertPartiesNotPropertyOwners(
  ownerships: OwnershipLookup,
  propertyId: string,
  partyIds: readonly string[],
  at: Date,
): Promise<void> {
  for (const partyId of [...new Set(partyIds)]) {
    await assertPartyNotPropertyOwner(ownerships, propertyId, partyId, at);
  }
}
