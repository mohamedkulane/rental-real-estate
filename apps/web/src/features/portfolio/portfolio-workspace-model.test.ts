import { describe, expect, it } from 'vitest';
import {
  isAggregatePortfolioView,
  ownerWorkspaceCounts,
  propertyWorkspaceCounts,
  spaceProfileFields,
  spaceWorkspaceCounts,
  type OwnerWorkspaceRecord,
  type PropertyWorkspaceRecord,
  type SpaceWorkspaceDetail,
} from './portfolio-workspace-model';

describe('portfolio child workspace projections', () => {
  it('routes every non-directory owner, property, and space child to an aggregate workspace', () => {
    expect(isAggregatePortfolioView('owners', 'directory')).toBe(false);
    expect(isAggregatePortfolioView('owners', 'owned-properties')).toBe(true);
    expect(isAggregatePortfolioView('owners', 'documents')).toBe(true);
    for (const view of [
      'buildings',
      'spaces',
      'ownership',
      'amenities',
      'documents',
      'branch-history',
      'activity',
    ])
      expect(isAggregatePortfolioView('properties', view)).toBe(true);
    for (const view of [
      'hierarchy',
      'measurements',
      'profile',
      'amenities',
      'documents',
      'lifecycle',
    ])
      expect(isAggregatePortfolioView('spaces', view)).toBe(true);
    expect(isAggregatePortfolioView('properties', 'overview')).toBe(false);
    expect(isAggregatePortfolioView('spaces', 'overview')).toBe(false);
  });
  it('counts every populated property child collection', () => {
    const property = {
      id: 'property-1',
      propertyCode: 'PROP-1',
      name: 'Harbor House',
      propertyType: 'RESIDENTIAL',
      status: 'ACTIVE',
      city: 'Mogadishu',
      branchAssignments: [
        { branchId: 'branch-1', effectiveFrom: '2026-01-01', effectiveTo: null },
        { branchId: 'branch-2', effectiveFrom: '2025-01-01', effectiveTo: '2026-01-01' },
      ],
      buildings: [{ id: 'building-1', name: 'Tower A', buildingCode: 'A' }],
      spaces: [
        {
          id: 'space-1',
          name: 'Unit 1',
          spaceCode: 'U1',
          status: 'ACTIVE',
          versions: [],
          childRelations: [],
        },
      ],
      ownerships: [
        {
          id: 'ownership-1',
          propertyId: 'property-1',
          ownerPartyId: 'owner-1',
          ownershipPercent: '100',
          effectiveFrom: '2026-01-01',
          effectiveTo: null,
          entitlements: [],
        },
      ],
      amenities: [{ amenity: { id: 'amenity-1', name: 'Parking' } }],
      documents: [
        {
          id: 'document-1',
          displayName: 'Title deed',
          categoryCode: 'TITLE',
          accessClass: 'CONFIDENTIAL',
          status: 'ACTIVE',
          versions: [],
        },
      ],
    } as PropertyWorkspaceRecord;

    expect(propertyWorkspaceCounts([property])).toEqual({
      properties: 1,
      buildings: 1,
      spaces: 1,
      ownerships: 1,
      amenities: 1,
      documents: 1,
      branchAssignments: 2,
    });
  });

  it('counts owner property and document rows separately', () => {
    const owner = {
      partyId: 'owner-1',
      ownerNumber: 'OWN-1',
      status: 'ACTIVE',
      scopeBranchIds: ['branch-1'],
      party: { id: 'owner-1', partyNumber: 'PTY-1', displayName: 'Amina Ali', kind: 'PERSON' },
      ownerships: [{ id: 'ownership-1' }, { id: 'ownership-2' }],
      documents: [{ id: 'document-1' }],
    } as OwnerWorkspaceRecord;
    expect(ownerWorkspaceCounts([owner])).toEqual({ owners: 1, properties: 2, documents: 1 });
  });

  it('counts space history and exposes only recorded profile fields', () => {
    const space = {
      id: 'space-1',
      propertyId: 'property-1',
      spaceCode: 'U1',
      name: 'Unit 1',
      status: 'RETIRED',
      type: { code: 'APARTMENT', name: 'Apartment' },
      versions: [
        { usableArea: '80', areaUnit: 'SQM' },
        { usableArea: '75', areaUnit: 'SQM' },
      ],
      childRelations: [],
      amenities: [{ amenity: { id: 'amenity-1', name: 'Parking' } }],
      documents: [
        {
          id: 'document-1',
          displayName: 'Floor plan',
          categoryCode: 'PLAN',
          accessClass: 'INTERNAL',
          status: 'ACTIVE',
          versions: [],
        },
      ],
      residentialProfile: { bedrooms: 2, bathrooms: null, furnishedStatus: 'FURNISHED' },
    } as SpaceWorkspaceDetail;

    expect(spaceWorkspaceCounts([space])).toEqual({
      spaces: 1,
      measurements: 2,
      amenities: 1,
      documents: 1,
      retired: 1,
    });
    expect(spaceProfileFields(space)).toEqual([
      ['bedrooms', 2],
      ['furnishedStatus', 'FURNISHED'],
    ]);
  });
});
