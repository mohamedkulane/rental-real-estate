import type { OwnerRecord } from './pages/owner-directory';
import type { PropertyRecord } from './pages/property-registry';

export function isAggregatePortfolioView(section: string, view: string) {
  if (section === 'owners') return view === 'owned-properties' || view === 'documents';
  if (section === 'properties') return view !== 'overview';
  if (section === 'spaces') return view !== 'overview';
  return false;
}

export type PortfolioDocument = {
  id: string;
  displayName: string;
  categoryCode: string;
  accessClass: string;
  status: string;
  createdAt?: string;
  versions: Array<{ id: string; sequence: number; mimeType: string; sizeBytes: string }>;
};

export type SpaceWorkspaceRecord = {
  id: string;
  propertyId: string;
  spaceCode: string;
  name: string;
  status: string;
  type: { code: string; name: string };
  property?: { name?: string };
  building?: { name: string } | null;
  versions: Array<{
    id?: string;
    effectiveFrom?: string;
    effectiveTo?: string | null;
    usableArea: string | null;
    totalArea?: string | null;
    areaUnit: string | null;
    floorNumber?: number | null;
    capacity?: number | null;
  }>;
  childRelations: Array<{
    parentSpaceId: string;
    effectiveFrom?: string;
    effectiveTo: string | null;
    parent?: { name: string; spaceCode: string };
  }>;
  parentRelations?: Array<{
    effectiveFrom?: string;
    effectiveTo: string | null;
    child?: { id: string; name: string; spaceCode: string; type?: { name: string } };
  }>;
  amenities?: Array<{ amenity: { id: string; name: string } }>;
  residentialProfile?: Record<string, unknown> | null;
  commercialProfile?: Record<string, unknown> | null;
  landProfile?: Record<string, unknown> | null;
};

export type PropertyWorkspaceRecord = PropertyRecord & { documents?: PortfolioDocument[] };
export type OwnerWorkspaceRecord = OwnerRecord & { documents?: PortfolioDocument[] };
export type SpaceWorkspaceDetail = SpaceWorkspaceRecord & { documents?: PortfolioDocument[] };

export const propertyWorkspaceCounts = (records: PropertyWorkspaceRecord[]) => ({
  properties: records.length,
  buildings: records.reduce((total, record) => total + (record.buildings?.length ?? 0), 0),
  spaces: records.reduce((total, record) => total + (record.spaces?.length ?? 0), 0),
  ownerships: records.reduce((total, record) => total + (record.ownerships?.length ?? 0), 0),
  amenities: records.reduce((total, record) => total + (record.amenities?.length ?? 0), 0),
  documents: records.reduce((total, record) => total + (record.documents?.length ?? 0), 0),
  branchAssignments: records.reduce((total, record) => total + record.branchAssignments.length, 0),
});

export const ownerWorkspaceCounts = (records: OwnerWorkspaceRecord[]) => ({
  owners: records.length,
  properties: records.reduce((total, record) => total + (record.ownerships?.length ?? 0), 0),
  documents: records.reduce((total, record) => total + (record.documents?.length ?? 0), 0),
});

export const spaceWorkspaceCounts = (records: SpaceWorkspaceDetail[]) => ({
  spaces: records.length,
  measurements: records.reduce((total, record) => total + record.versions.length, 0),
  amenities: records.reduce((total, record) => total + (record.amenities?.length ?? 0), 0),
  documents: records.reduce((total, record) => total + (record.documents?.length ?? 0), 0),
  retired: records.filter((record) => record.status === 'RETIRED').length,
});

export const spaceProfileFields = (space: SpaceWorkspaceDetail) => {
  const profile = space.landProfile ?? space.residentialProfile ?? space.commercialProfile;
  if (!profile) return [];
  return Object.entries(profile).filter(
    ([, value]) => value !== null && value !== undefined && value !== '',
  );
};
