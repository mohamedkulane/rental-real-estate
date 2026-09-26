import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  ACTIVE_RESIDENTIAL_TENANCY_MESSAGE,
  assertActiveResidentialTenancyAvailable,
} from './active-tenancy';

function database(results: unknown[]) {
  return { $queryRaw: vi.fn().mockImplementation(() => Promise.resolve(results.shift())) };
}

describe('active residential tenancy invariant', () => {
  const input = {
    companyId: '00000000-0000-4000-8000-000000000001',
    rentableSpaceId: '00000000-0000-4000-8000-000000000002',
    tenantPartyIds: ['00000000-0000-4000-8000-000000000003'],
    excludeLeaseId: '00000000-0000-4000-8000-000000000004',
  };

  it('blocks a second active residential lease for the same tenant', async () => {
    const db = database([[{ residential: true }], [{ lock: null }], [{ leaseNumber: 'LEASE-0001' }]]);

    await expect(assertActiveResidentialTenancyAvailable(db, input)).rejects.toEqual(
      new ConflictException(ACTIVE_RESIDENTIAL_TENANCY_MESSAGE),
    );
    expect(db.$queryRaw).toHaveBeenCalledTimes(3);
  });

  it('allows a new residential lease after no active tenancy remains', async () => {
    const db = database([[{ residential: true }], [{ lock: null }], []]);

    await expect(assertActiveResidentialTenancyAvailable(db, input)).resolves.toBeUndefined();
  });

  it('does not constrain non-residential leases', async () => {
    const db = database([[{ residential: false }]]);

    await expect(assertActiveResidentialTenancyAvailable(db, input)).resolves.toBeUndefined();
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('does not constrain leases without a tenant party', async () => {
    const db = database([]);

    await expect(
      assertActiveResidentialTenancyAvailable(db, { ...input, tenantPartyIds: [] }),
    ).resolves.toBeUndefined();
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
});
