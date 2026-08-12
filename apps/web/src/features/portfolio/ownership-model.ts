export type OwnershipEntitlement = {
  id?: string;
  payoutPercent: string;
  effectiveFrom: string;
  effectiveTo: string | null;
};

export type OwnershipParty = {
  id: string;
  displayName: string;
  kind: string;
  partyNumber?: string;
  owner?: { ownerNumber: string; status: string } | null;
};

export type PropertyOwnershipRecord = {
  id: string;
  propertyId: string;
  ownerPartyId: string;
  ownershipPercent: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  owner?: OwnershipParty;
  entitlements: OwnershipEntitlement[];
};

export type OwnershipShareInput = {
  ownerPartyId: string;
  ownershipPercent: string;
  payoutPercent: string;
};

export type ReplaceOwnershipInput = {
  effectiveFrom: string;
  shares: OwnershipShareInput[];
  reason: string;
};

export type OwnerOption = {
  partyId: string;
  ownerNumber: string;
  status: string;
  party: { displayName: string; kind: string; partyNumber?: string };
};

const datePart = (value: string) => value.slice(0, 10);

export function ownershipPeriod(
  record: Pick<PropertyOwnershipRecord, 'effectiveFrom' | 'effectiveTo'>,
  asOf = new Date().toISOString().slice(0, 10),
): 'CURRENT' | 'SCHEDULED' | 'HISTORICAL' {
  if (datePart(record.effectiveFrom) > asOf) return 'SCHEDULED';
  if (record.effectiveTo && datePart(record.effectiveTo) <= asOf) return 'HISTORICAL';
  return 'CURRENT';
}

export function partitionOwnership(
  records: PropertyOwnershipRecord[] = [],
  asOf = new Date().toISOString().slice(0, 10),
) {
  return {
    current: records.filter((record) => ownershipPeriod(record, asOf) === 'CURRENT'),
    scheduled: records.filter((record) => ownershipPeriod(record, asOf) === 'SCHEDULED'),
    historical: records.filter((record) => ownershipPeriod(record, asOf) === 'HISTORICAL'),
  };
}

export function effectivePayoutPercent(
  record: PropertyOwnershipRecord,
  asOf = new Date().toISOString().slice(0, 10),
): string {
  return (
    record.entitlements.find(
      (entitlement) =>
        datePart(entitlement.effectiveFrom) <= asOf &&
        (!entitlement.effectiveTo || datePart(entitlement.effectiveTo) > asOf),
    )?.payoutPercent ??
    record.entitlements[0]?.payoutPercent ??
    '0'
  );
}

export function shareTotals(shares: OwnershipShareInput[]) {
  const sum = (key: 'ownershipPercent' | 'payoutPercent') =>
    Math.round(shares.reduce((total, share) => total + (Number(share[key]) || 0), 0) * 1_000_000) /
    1_000_000;
  return { ownership: sum('ownershipPercent'), payout: sum('payoutPercent') };
}

export function ownershipReadiness(records: PropertyOwnershipRecord[] = []) {
  const current = partitionOwnership(records).current;
  const totals = shareTotals(
    current.map((record) => ({
      ownerPartyId: record.ownerPartyId,
      ownershipPercent: record.ownershipPercent,
      payoutPercent: effectivePayoutPercent(record),
    })),
  );
  const activeOwners = current.every((record) => record.owner?.owner?.status === 'ACTIVE');
  return {
    hasOwners: current.length > 0,
    ownershipComplete: totals.ownership === 100,
    payoutComplete: totals.payout === 100,
    activeOwners,
    ready: current.length > 0 && totals.ownership === 100 && totals.payout === 100 && activeOwners,
    totals,
  };
}

export function validateOwnershipInput(input: ReplaceOwnershipInput): string[] {
  const errors: string[] = [];
  if (!input.shares.length) errors.push('Add at least one owner.');
  if (input.shares.some((share) => !share.ownerPartyId))
    errors.push('Choose an owner for every row.');
  if (new Set(input.shares.map((share) => share.ownerPartyId)).size !== input.shares.length)
    errors.push('Each owner can appear only once.');
  if (
    input.shares.some(
      (share) => !(Number(share.ownershipPercent) > 0) || !(Number(share.ownershipPercent) <= 100),
    )
  )
    errors.push('Ownership percentages must be greater than 0 and no more than 100.');
  if (
    input.shares.some(
      (share) => !(Number(share.payoutPercent) >= 0) || !(Number(share.payoutPercent) <= 100),
    )
  )
    errors.push('Payout percentages must be between 0 and 100.');
  const totals = shareTotals(input.shares);
  if (totals.ownership !== 100) errors.push('Ownership must total exactly 100%.');
  if (totals.payout !== 100) errors.push('Payout allocation must total exactly 100%.');
  if (!input.effectiveFrom) errors.push('Choose an effective date.');
  if (input.reason.trim().length < 3) errors.push('Enter a reason of at least 3 characters.');
  return errors;
}
