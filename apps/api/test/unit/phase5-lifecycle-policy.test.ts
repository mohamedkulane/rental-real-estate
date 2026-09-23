import { ApplicationStatus, LeaseStatus, ListingStatus, RenewalStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { applicationTransitions, leaseTransitions, renewalTransitions } from '../../src/leasing/leasing.service';
import { listingTransitions } from '../../src/leasing/listing.service';

describe('Phase 5 lifecycle policies', () => {
  it('requires review before a Listing can be published', () => {
    expect(listingTransitions[ListingStatus.DRAFT]).toEqual([ListingStatus.PENDING_REVIEW]);
    expect(listingTransitions[ListingStatus.PENDING_REVIEW]).toContain(ListingStatus.PUBLISHED);
    expect(listingTransitions[ListingStatus.ARCHIVED]).toEqual([]);
  });

  it('requires screening review before an Application decision', () => {
    expect(applicationTransitions[ApplicationStatus.DRAFT]).not.toContain(ApplicationStatus.APPROVED);
    expect(applicationTransitions[ApplicationStatus.UNDER_REVIEW]).toContain(ApplicationStatus.APPROVED);
  });

  it('approves a lease straight into Active without Signed steps', () => {
    expect(leaseTransitions[LeaseStatus.DRAFT]).toEqual([LeaseStatus.PENDING_APPROVAL]);
    expect(leaseTransitions[LeaseStatus.PENDING_APPROVAL]).toContain(LeaseStatus.ACTIVE);
    expect(leaseTransitions[LeaseStatus.PENDING_APPROVAL]).not.toContain(LeaseStatus.APPROVED);
    expect(leaseTransitions[LeaseStatus.ACTIVE]).toEqual([
      LeaseStatus.ENDED,
      LeaseStatus.TERMINATED,
    ]);
  });

  it('creates a successor only after a signed Renewal', () => {
    expect(renewalTransitions[RenewalStatus.APPROVED]).toEqual([RenewalStatus.SIGNED, RenewalStatus.REJECTED]);
    expect(renewalTransitions[RenewalStatus.SIGNED]).toEqual([RenewalStatus.ACTIVATED]);
  });
});
