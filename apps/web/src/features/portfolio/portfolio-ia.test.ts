import { describe, expect, it, vi } from 'vitest';
import {
  OWNER_DETAIL_TABS,
  PORTFOLIO_NAVIGATION,
  PROPERTY_DETAIL_TABS,
  PROPERTY_SECTION_PERMISSIONS,
  RENTABLE_SPACE_DETAIL_TABS,
  portfolioNavigationView,
  propertyTimeline,
  rentableSpaceActionAccess,
} from './portfolio-ia';

describe('Phase 4 Portfolio information architecture', () => {
  it('exposes the complete Property hierarchy with no generic Operations item', () => {
    expect(PORTFOLIO_NAVIGATION.properties.map((item) => item.label)).toEqual([
      'Overview',
      'Buildings',
      'Spaces',
      'Ownership',
      'Amenities',
      'Documents',
      'Branch History',
      'Activity',
    ]);
    expect(PORTFOLIO_NAVIGATION.properties.map((item) => item.label)).not.toContain('Operations');
  });

  it('keeps the Rentable Space hierarchy short and context-aware', () => {
    expect(PORTFOLIO_NAVIGATION.spaces.map((item) => item.label)).toEqual([
      'Overview',
      'Hierarchy',
      'Measurements',
      'Space Details',
      'Amenities',
      'Documents',
      'Lifecycle',
    ]);
  });

  it('restores a valid child route and falls back to the section overview', () => {
    expect(portfolioNavigationView('properties', 'documents')).toBe('documents');
    expect(portfolioNavigationView('properties', 'unknown')).toBe('overview');
    expect(portfolioNavigationView('parties', 'people')).toBe('people');
  });

  it('keeps every major Property workflow in a dedicated tab', () => {
    expect(PROPERTY_DETAIL_TABS.map((tab) => tab.label)).toEqual([
      'Overview',
      'Buildings',
      'Spaces',
      'Ownership',
      'Amenities',
      'Documents',
      'Branch History',
      'Activity',
    ]);
    expect(PROPERTY_DETAIL_TABS.some((tab) => String(tab.label) === 'Operations')).toBe(false);
  });

  it('separates current Owner properties, documents, and ownership history', () => {
    expect(OWNER_DETAIL_TABS.map((tab) => tab.label)).toEqual([
      'Overview',
      'Owned Properties',
      'Documents',
      'Ownership History',
    ]);
  });

  it('makes hierarchy, measurement history, specialization, and lifecycle discoverable', () => {
    expect(RENTABLE_SPACE_DETAIL_TABS.map((tab) => tab.label)).toEqual([
      'Overview',
      'Hierarchy',
      'Measurements',
      'Profile',
      'Amenities',
      'Documents',
      'Activity / History',
      'Lifecycle',
    ]);
  });

  it('maps dedicated Property sections to existing backend permissions', () => {
    expect(PROPERTY_SECTION_PERMISSIONS).toEqual({
      buildings: { read: 'portfolio.building.read', manage: 'portfolio.building.manage' },
      amenities: { read: 'portfolio.amenity.read', manage: 'portfolio.amenity.manage' },
      documents: { read: 'portfolio.document.read', manage: 'portfolio.document.manage' },
      'branch-history': { read: 'portfolio.property.read', manage: 'portfolio.property.update' },
    });
  });

  it('derives every Rentable Space write action from its backend permission', () => {
    const allowed = new Set(['portfolio.space.update', 'portfolio.amenity.manage']);
    const can = vi.fn((permission: string) => allowed.has(permission));
    expect(rentableSpaceActionAccess(can)).toEqual({
      update: true,
      partition: false,
      manageAmenities: true,
      manageDocuments: false,
    });
    expect(can).toHaveBeenCalledWith('portfolio.space.partition');
    expect(can).toHaveBeenCalledWith('portfolio.document.manage');
  });

  it('builds a newest-first readable Property timeline without raw relation IDs', () => {
    const records = propertyTimeline({
      id: 'property-id',
      propertyCode: 'PRP-001',
      name: 'Barwaaqo Tower',
      propertyType: 'RESIDENTIAL',
      status: 'ACTIVE',
      city: 'Mogadishu',
      branchAssignments: [
        {
          branchId: 'branch-secret-id',
          effectiveFrom: '2026-01-01',
          effectiveTo: null,
          branch: { id: 'branch-secret-id', code: 'HOD', name: 'Hodan Branch' },
        },
      ],
      ownerships: [
        {
          id: 'ownership-secret-id',
          propertyId: 'property-id',
          ownerPartyId: 'party-secret-id',
          ownershipPercent: '100',
          effectiveFrom: '2026-02-01',
          effectiveTo: null,
          owner: { id: 'party-secret-id', displayName: 'Ayaan Ali', kind: 'PERSON' },
          entitlements: [],
        },
      ],
    });
    expect(records.map((record) => record.label)).toEqual([
      'Ownership became effective',
      'Operating branch assigned',
    ]);
    expect(records.map((record) => record.detail).join(' ')).toContain('Ayaan Ali');
    expect(records.map((record) => record.detail).join(' ')).toContain('Hodan Branch');
    expect(records.map((record) => record.detail).join(' ')).not.toContain('secret-id');
  });
});
