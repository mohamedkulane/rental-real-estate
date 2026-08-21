import { describe, expect, it } from 'vitest';
import {
  focusedRowPresentation,
  focusedWorkspaceConfigs,
  focusedWorkspaceState,
  workspaceRequestPath,
  type FocusedWorkspace,
} from './focused-portfolio-workspace';

const workspaces = Object.keys(focusedWorkspaceConfigs) as FocusedWorkspace[];

describe('focused portfolio aggregate workspaces', () => {
  it('uses one focused paginated request and forwards server-side filters and cursor', () => {
    const path = workspaceRequestPath(
      'property-amenities',
      'Parking',
      { propertySearch: 'barwaaqo', amenitySearch: 'PARK', branchSearch: 'hodan' },
      'property-id:amenity-id',
    );

    expect(path).toContain('/property-amenities?');
    expect(path).toContain('limit=25');
    expect(path).toContain('search=Parking');
    expect(path).toContain('propertySearch=barwaaqo');
    expect(path).toContain('amenitySearch=PARK');
    expect(path).toContain('branchSearch=hodan');
    expect(path).toContain('cursor=property-id%3Aamenity-id');
    expect(path.match(/\/property-amenities/g)).toHaveLength(1);
  });

  it('keeps every dedicated child workspace on a focused API without a completeness limit hack', () => {
    expect(workspaces).toHaveLength(14);
    for (const workspace of workspaces) {
      const path = workspaceRequestPath(workspace, '', {}, null);
      expect(path).toContain('limit=25');
      expect(path).not.toContain('limit=100');
      expect(focusedWorkspaceConfigs[workspace].filters).toBeDefined();
    }
  });

  it('distinguishes loading, error, initial-empty, filtered-empty, and populated states', () => {
    expect(focusedWorkspaceState({ loading: true, error: '', itemCount: 0, filtered: false })).toBe(
      'loading',
    );
    expect(
      focusedWorkspaceState({
        loading: false,
        error: 'Network error',
        itemCount: 0,
        filtered: false,
      }),
    ).toBe('error');
    expect(
      focusedWorkspaceState({ loading: false, error: '', itemCount: 0, filtered: false }),
    ).toBe('empty');
    expect(focusedWorkspaceState({ loading: false, error: '', itemCount: 0, filtered: true })).toBe(
      'filtered-empty',
    );
    expect(focusedWorkspaceState({ loading: false, error: '', itemCount: 2, filtered: true })).toBe(
      'populated',
    );
  });

  it('shows readable document metadata and related entity context', () => {
    const view = focusedRowPresentation('property-documents', {
      displayName: 'Signed title deed',
      categoryCode: 'TITLE_DEED',
      accessClass: 'CONFIDENTIAL',
      status: 'ACTIVE',
      property: { propertyCode: 'PROP-0015', name: 'Boundary Property' },
      versions: [{ mimeType: 'application/pdf', sizeBytes: '2048' }],
    });

    expect(view.title).toBe('Signed title deed');
    expect(view.context).toContain('PROP-0015');
    expect(view.details).toContain('Title Deed');
    expect(view.details).toContain('application/pdf');
    expect(view.details).toContain('2.0 KB');
    expect(view.status).toBe('ACTIVE');
  });

  it('keeps search values case-preserving for case-insensitive backend matching', () => {
    const upper = workspaceRequestPath('owner-properties', 'FADUMO', { ownerSearch: 'ALI' }, null);
    const lower = workspaceRequestPath('owner-properties', 'fadumo', { ownerSearch: 'ali' }, null);
    expect(upper).toContain('search=FADUMO');
    expect(lower).toContain('search=fadumo');
    expect(upper).not.toBe(lower);
  });
});
