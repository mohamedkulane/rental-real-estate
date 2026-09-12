import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PortalAuthorizationService } from './portal-authorization.service';

describe('PortalAuthorizationService', () => {
  const db = {
    propertyOwnership: { findMany: vi.fn() },
    leaseParty: { findMany: vi.fn() },
    ownerStatement: { findFirst: vi.fn() },
    ownerPayout: { findFirst: vi.fn() },
  };
  const service = new PortalAuthorizationService(db as never);

  it('requires owner principal for owner access', () => {
    expect(() =>
      service.assertOwner({
        kind: 'TENANT',
        partyId: 'party-1',
      } as never),
    ).toThrow(ForbiddenException);
  });

  it('denies owner property outside ownership', async () => {
    db.propertyOwnership.findMany.mockResolvedValue([{ propertyId: 'property-a' }]);
    await expect(
      service.assertOwnerProperty('owner-1', 'company-1', '2026-01-01', 'property-b'),
    ).rejects.toThrow(NotFoundException);
  });

  it('allows owner property within ownership', async () => {
    db.propertyOwnership.findMany.mockResolvedValue([{ propertyId: 'property-a' }]);
    await expect(
      service.assertOwnerProperty('owner-1', 'company-1', '2026-01-01', 'property-a'),
    ).resolves.toBeUndefined();
  });
});
