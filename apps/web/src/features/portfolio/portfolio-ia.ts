import type { PropertyRecord } from './pages/property-registry';

export const PORTFOLIO_NAVIGATION = {
  parties: [
    { key: 'all', label: 'All Parties' },
    { key: 'people', label: 'People' },
    { key: 'organizations', label: 'Organizations' },
  ],
  owners: [
    { key: 'directory', label: 'Owner Directory' },
    { key: 'owned-properties', label: 'Owned Properties' },
    { key: 'documents', label: 'Documents' },
  ],
  properties: [
    { key: 'overview', label: 'Overview' },
    { key: 'buildings', label: 'Buildings' },
    { key: 'spaces', label: 'Spaces' },
    { key: 'ownership', label: 'Ownership' },
    { key: 'amenities', label: 'Amenities' },
    { key: 'documents', label: 'Documents' },
    { key: 'branch-history', label: 'Branch History' },
    { key: 'activity', label: 'Activity' },
  ],
  spaces: [
    { key: 'overview', label: 'Overview' },
    { key: 'hierarchy', label: 'Hierarchy' },
    { key: 'measurements', label: 'Measurements' },
    { key: 'profile', label: 'Space Details' },
    { key: 'amenities', label: 'Amenities' },
    { key: 'documents', label: 'Documents' },
    { key: 'lifecycle', label: 'Lifecycle' },
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
export const PROPERTY_DETAIL_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'buildings', label: 'Buildings' },
  { key: 'spaces', label: 'Spaces' },
  { key: 'ownership', label: 'Ownership' },
  { key: 'amenities', label: 'Amenities' },
  { key: 'documents', label: 'Documents' },
  { key: 'branch-history', label: 'Branch History' },
  { key: 'activity', label: 'Activity' },
] as const;

export const OWNER_DETAIL_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'owned-properties', label: 'Owned Properties' },
  { key: 'documents', label: 'Documents' },
  { key: 'ownership-history', label: 'Ownership History' },
] as const;

export const RENTABLE_SPACE_DETAIL_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'hierarchy', label: 'Hierarchy' },
  { key: 'measurements', label: 'Measurements' },
  { key: 'profile', label: 'Profile' },
  { key: 'amenities', label: 'Amenities' },
  { key: 'documents', label: 'Documents' },
  { key: 'history', label: 'Activity / History' },
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
