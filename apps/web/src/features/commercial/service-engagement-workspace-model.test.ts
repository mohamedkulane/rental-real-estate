import { describe, expect, it } from 'vitest';
import {
  appendCursor,
  engagementRequestPath,
  engagementWorkspaceState,
} from './service-engagement-workspace-model';
import { capabilityLabel } from './service-engagement-types';

describe('Phase 5.1 Service Engagement workspace model', () => {
  it('forwards server-side filters without changing case and uses cursor pagination', () => {
    const path = engagementRequestPath(
      {
        search: 'HODAN',
        propertyId: 'property-id',
        serviceModel: 'FULL_MANAGEMENT',
        status: 'ACTIVE',
        period: 'CURRENT',
        branchId: 'branch-id',
      },
      'cursor-id',
      25,
    );
    expect(path).toContain('limit=25');
    expect(path).toContain('search=HODAN');
    expect(path).toContain('propertyId=property-id');
    expect(path).toContain('cursor=cursor-id');
    expect(path).not.toContain('limit=100');
  });

  it('distinguishes loading, error, empty, filtered-empty, and populated states', () => {
    expect(
      engagementWorkspaceState({ loading: true, error: false, itemCount: 0, filtered: false }),
    ).toBe('loading');
    expect(
      engagementWorkspaceState({ loading: false, error: true, itemCount: 0, filtered: false }),
    ).toBe('error');
    expect(
      engagementWorkspaceState({ loading: false, error: false, itemCount: 0, filtered: false }),
    ).toBe('empty');
    expect(
      engagementWorkspaceState({ loading: false, error: false, itemCount: 0, filtered: true }),
    ).toBe('filtered-empty');
    expect(
      engagementWorkspaceState({ loading: false, error: false, itemCount: 2, filtered: true }),
    ).toBe('populated');
  });

  it('advances cursor history without losing the previous-page path', () => {
    expect(appendCursor([undefined, 'page-2'], 1, 'page-3')).toEqual([
      undefined,
      'page-2',
      'page-3',
    ]);
    expect(appendCursor([undefined, 'old-page-2', 'stale-page-3'], 0, 'new-page-2')).toEqual([
      undefined,
      'new-page-2',
    ]);
  });

  it('does not auto-select a first result when the workspace opens', () => {
    const path = engagementRequestPath({});
    expect(path).toBe('/service-engagements?limit=10');
    expect(path).not.toContain('propertyId=');
    expect(path).not.toContain('rentableSpaceId=');
  });

  it('presents resolver capability names as readable business labels', () => {
    expect(capabilityLabel('canCreateRentalListing')).toBe('Create Rental Listing');
    expect(capabilityLabel('canManageMaintenance')).toBe('Manage Maintenance');
  });
});
