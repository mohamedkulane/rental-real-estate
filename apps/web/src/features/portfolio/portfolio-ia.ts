import type { PropertyRecord } from './pages/property-registry';

export const PORTFOLIO_NAVIGATION = {
  parties: [
    { key: 'all', label: 'Party Register' },
    { key: 'people', label: 'People' },
    { key: 'organizations', label: 'Organizations' },
  ],
  owners: [
    { key: 'directory', label: 'Owner Register' },
    { key: 'owned-properties', label: 'Owned Properties' },
    { key: 'documents', label: 'Owner Documents' },
  ],
  properties: [
    { key: 'overview', label: 'Property Register' },
    { key: 'buildings', label: 'Buildings' },
    { key: 'ownership', label: 'Property Ownership' },
    { key: 'amenities', label: 'Property Amenities' },
    { key: 'documents', label: 'Property Documents' },
    { key: 'branch-history', label: 'Branch Assignments' },
    { key: 'activity', label: 'Property Activity' },
  ],
  spaces: [
    { key: 'overview', label: 'Space Register' },
    { key: 'hierarchy', label: 'Space Hierarchy' },
    { key: 'measurements', label: 'Measurements' },
    { key: 'profile', label: 'Space Profiles' },
    { key: 'amenities', label: 'Space Amenities' },
    { key: 'documents', label: 'Space Documents' },
    { key: 'lifecycle', label: 'Space Lifecycle' },
  ],
} as const;

export type PortfolioNavigationSection = keyof typeof PORTFOLIO_NAVIGATION | 'amenities';

export function portfolioNavigationView(
  section: PortfolioNavigationSection,
  requested?: string | null,
): string {
  if (section === 'amenities') return 'catalog';
  const options = PORTFOLIO_NAVIGATION[section];
  return options.some((option) => option.key === requested) ? String(requested) : options[0].key;
}

export function rentableSpaceDetailHref(spaceId: string): string {
  return '/portfolio/rentable-spaces/' + encodeURIComponent(spaceId);
}
export const PROPERTY_DETAIL_TABS = [
  { key: 'overview', label: 'Property Details' },
  { key: 'buildings', label: 'Buildings' },
  { key: 'spaces', label: 'Rentable Spaces' },
  { key: 'ownership', label: 'Ownership' },
  { key: 'amenities', label: 'Amenities' },
  { key: 'documents', label: 'Documents' },
  { key: 'branch-history', label: 'Branch Assignments' },
  { key: 'activity', label: 'Activity' },
] as const;

export const OWNER_DETAIL_TABS = [
  { key: 'overview', label: 'Owner Profile' },
  { key: 'owned-properties', label: 'Owned Properties' },
  { key: 'documents', label: 'Documents' },
  { key: 'ownership-history', label: 'Ownership History' },
] as const;

export const RENTABLE_SPACE_DETAIL_TABS = [
  { key: 'overview', label: 'Space Details' },
  { key: 'hierarchy', label: 'Hierarchy' },
  { key: 'measurements', label: 'Measurements' },
  { key: 'profile', label: 'Profile' },
  { key: 'amenities', label: 'Amenities' },
  { key: 'documents', label: 'Documents' },
  { key: 'history', label: 'Activity' },
  { key: 'lifecycle', label: 'Lifecycle' },
] as const;

export type PropertyDetailSection = 'buildings' | 'amenities' | 'documents' | 'branch-history';
export const PROPERTY_SECTION_PERMISSIONS: Record<
  PropertyDetailSection,
  { read: string; manage: string }
> = {
  buildings: { read: 'portfolio.building.read', manage: 'portfolio.building.manage' },
  amenities: { read: 'portfolio.amenity.read', manage: 'portfolio.amenity.manage' },
  documents: { read: 'portfolio.document.read', manage: 'portfolio.document.manage' },
  'branch-history': { read: 'portfolio.property.read', manage: 'portfolio.property.update' },
};

export function rentableSpaceActionAccess(can: (permission: string) => boolean) {
  return {
    update: can('portfolio.space.update'),
    partition: can('portfolio.space.partition'),
    manageAmenities: can('portfolio.amenity.manage'),
    manageDocuments: can('portfolio.document.manage'),
  };
}

export type PropertyTimelineItem = {
  key: string;
  date: string;
  label: string;
  detail: string;
  kind: 'branch' | 'ownership';
};

export function propertyTimeline(property: PropertyRecord): PropertyTimelineItem[] {
  const branchItems: PropertyTimelineItem[] = property.branchAssignments.map((assignment) => ({
    key: `branch-${assignment.branchId}-${assignment.effectiveFrom}`,
    date: assignment.effectiveFrom,
    label: assignment.effectiveTo
      ? 'Operating branch assignment completed'
      : 'Operating branch assigned',
    detail: assignment.branch?.name ?? 'Branch record unavailable',
    kind: 'branch',
  }));
  const ownershipItems: PropertyTimelineItem[] = (property.ownerships ?? []).map((ownership) => ({
    key: `ownership-${ownership.id}`,
    date: ownership.effectiveFrom,
    label: ownership.effectiveTo ? 'Ownership period completed' : 'Ownership became effective',
    detail: `${ownership.owner?.displayName ?? 'Owner record unavailable'} · ${ownership.ownershipPercent}%`,
    kind: 'ownership',
  }));
  return [...branchItems, ...ownershipItems].sort((a, b) => b.date.localeCompare(a.date));
}
