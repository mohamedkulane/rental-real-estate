import { ServiceEngagementStatus, ServiceModel } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  assertCompatibleModels,
  assertLifecycleTransition,
  assertServiceModelScope,
  classifyEngagementPeriod,
  resolveCapabilitySet,
  serviceModelsCompatible,
} from '../../src/commercial/service-engagement.policy';

describe('Phase 5.1 Service Engagement policy', () => {
  const at = new Date('2026-08-25T00:00:00.000Z');

  it('classifies half-open effective periods', () => {
    expect(classifyEngagementPeriod(new Date('2026-08-01'), null, at)).toBe('CURRENT');
    expect(classifyEngagementPeriod(new Date('2026-09-01'), null, at)).toBe('SCHEDULED');
    expect(classifyEngagementPeriod(new Date('2026-07-01'), new Date('2026-08-25'), at)).toBe(
      'HISTORICAL',
    );
  });

  it('uses a deny-by-default compatibility matrix', () => {
    expect(serviceModelsCompatible(ServiceModel.FULL_MANAGEMENT, ServiceModel.SALE_BROKERAGE)).toBe(
      true,
    );
    expect(
      serviceModelsCompatible(ServiceModel.RENTAL_BROKERAGE, ServiceModel.SALE_BROKERAGE),
    ).toBe(true);
    expect(
      serviceModelsCompatible(ServiceModel.FULL_MANAGEMENT, ServiceModel.RENT_COLLECTION_ONLY),
    ).toBe(false);
    expect(() =>
      assertCompatibleModels([ServiceModel.RENTAL_BROKERAGE, ServiceModel.FULL_MANAGEMENT]),
    ).toThrow(/cannot overlap/i);
  });

  it('keeps Sale Brokerage and Company Owned at Property scope', () => {
    expect(() => assertServiceModelScope(ServiceModel.SALE_BROKERAGE, 'space-id')).toThrow(
      /Property scope/i,
    );
    expect(() => assertServiceModelScope(ServiceModel.COMPANY_OWNED, 'space-id')).toThrow(
      /Property scope/i,
    );
    expect(() => assertServiceModelScope(ServiceModel.FULL_MANAGEMENT, 'space-id')).not.toThrow();
  });

  it('enforces explicit lifecycle transitions', () => {
    expect(() =>
      assertLifecycleTransition(
        ServiceEngagementStatus.DRAFT,
        ServiceEngagementStatus.ACTIVE,
        'SCHEDULED',
      ),
    ).not.toThrow();
    expect(() =>
      assertLifecycleTransition(
        ServiceEngagementStatus.ACTIVE,
        ServiceEngagementStatus.INACTIVE,
        'CURRENT',
      ),
    ).not.toThrow();
    expect(() =>
      assertLifecycleTransition(
        ServiceEngagementStatus.INACTIVE,
        ServiceEngagementStatus.ACTIVE,
        'HISTORICAL',
      ),
    ).toThrow(/cannot transition/i);
  });

  it('resolves commercial capabilities centrally without scattered model checks', () => {
    const brokerage = resolveCapabilitySet([ServiceModel.RENTAL_BROKERAGE]);
    expect(brokerage.canCreateRentalListing).toBe(true);
    expect(brokerage.canCreateLease).toBe(true);
    expect(brokerage.canCollectRent).toBe(false);
    expect(brokerage.canCreateSaleListing).toBe(false);

    const sale = resolveCapabilitySet([ServiceModel.SALE_BROKERAGE]);
    expect(sale.canCreateSaleListing).toBe(true);
    expect(sale.canReceiveBuyerLead).toBe(true);
    expect(sale.canCreateRentalListing).toBe(false);
  });

  it('uses a Space engagement as the rental-policy override while retaining Property sale policy', () => {
    const capabilities = resolveCapabilitySet(
      [ServiceModel.FULL_MANAGEMENT, ServiceModel.SALE_BROKERAGE],
      [ServiceModel.RENT_COLLECTION_ONLY],
    );
    expect(capabilities.canCreateSaleListing).toBe(true);
    expect(capabilities.canCollectRent).toBe(true);
    expect(capabilities.canCreateRentalListing).toBe(false);
    expect(capabilities.canManageMaintenance).toBe(false);
  });

  it('derives company-owned rental and sale eligibility from one approved policy source', () => {
    const capabilities = resolveCapabilitySet([ServiceModel.COMPANY_OWNED]);
    expect(capabilities.canCreateRentalListing).toBe(true);
    expect(capabilities.canCreateSaleListing).toBe(true);
    expect(capabilities.canReceiveSellerLead).toBe(false);
    expect(capabilities.canCollectRent).toBe(true);
  });

  it('does not leak Company Owned rental authority through a Space override', () => {
    const capabilities = resolveCapabilitySet(
      [ServiceModel.COMPANY_OWNED],
      [ServiceModel.RENT_COLLECTION_ONLY],
    );
    expect(capabilities.canCreateSaleListing).toBe(true);
    expect(capabilities.canCollectRent).toBe(true);
    expect(capabilities.canCreateRentalListing).toBe(false);
    expect(capabilities.canCreateLease).toBe(false);
  });
});
