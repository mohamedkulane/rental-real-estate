'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { SearchableSelect } from '@/components/shared/searchable-select';
import { CursorPaginationControls } from '@/components/shared/pagination';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/shared/ui';
import { api, apiUrl, type CursorPage, userFacingError } from '@/lib/phase3-api';
import { humanize } from '@/lib/presentation';

export type FocusedWorkspace =
  | 'property-buildings'
  | 'property-ownership'
  | 'property-amenities'
  | 'property-documents'
  | 'property-branches'
  | 'property-activity'
  | 'owner-properties'
  | 'owner-documents'
  | 'space-hierarchy'
  | 'space-measurements'
  | 'space-profiles'
  | 'space-amenities'
  | 'space-documents'
  | 'space-lifecycle';

type Row = Record<string, unknown>;
type FilterOption = { label: string; value: string };
type Filter = { key: string; label: string; placeholder?: string; options?: FilterOption[] };
type Config = {
  title: string;
  empty: string;
  path: string;
  searchLabel: string;
  filters: Filter[];
};

const periodOptions: FilterOption[] = [
  { label: 'All periods', value: '' },
  { label: 'Current', value: 'CURRENT' },
  { label: 'Scheduled', value: 'SCHEDULED' },
  { label: 'Historical', value: 'HISTORICAL' },
];
const measurementPeriodOptions: FilterOption[] = [
  { label: 'Current', value: '' },
  { label: 'Historical', value: 'HISTORICAL' },
  { label: 'All Periods', value: 'ALL' },
];
const documentCategoryOptions: FilterOption[] = [
  { label: 'All Categories', value: '' },
  { label: 'Title Deed', value: 'TITLE_DEED' },
  { label: 'Ownership Certificate', value: 'OWNERSHIP_CERTIFICATE' },
  { label: 'Survey', value: 'SURVEY' },
  { label: 'Plan', value: 'PLAN' },
  { label: 'Registration Document', value: 'REGISTRATION_DOCUMENT' },
  { label: 'Identification', value: 'IDENTIFICATION' },
  { label: 'Other', value: 'OTHER' },
];
const activityOptions: FilterOption[] = [
  { label: 'All Activities', value: '' },
  { label: 'Property Created', value: 'portfolio.property.created' },
  { label: 'Property Activated', value: 'portfolio.property.activated' },
  { label: 'Property Deactivated', value: 'portfolio.property.deactivated' },
  { label: 'Property Retired', value: 'portfolio.property.retired' },
  { label: 'Ownership Updated', value: 'portfolio.property.ownership' },
  { label: 'Operating Branch Transferred', value: 'portfolio.property.branch' },
];
const documentAccessOptions: FilterOption[] = [
  { label: 'All access levels', value: '' },
  { label: 'Internal', value: 'INTERNAL' },
  { label: 'Confidential', value: 'CONFIDENTIAL' },
  { label: 'Restricted', value: 'RESTRICTED' },
];
const documentStatusOptions: FilterOption[] = [
  { label: 'All document statuses', value: '' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Archived', value: 'ARCHIVED' },
];
const buildingStatusOptions: FilterOption[] = [
  { label: 'All Building statuses', value: '' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Inactive', value: 'INACTIVE' },
  { label: 'Retired', value: 'RETIRED' },
];
const spaceStatusOptions: FilterOption[] = [
  { label: 'All space statuses', value: '' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Retired', value: 'RETIRED' },
];
const entityFilter = (label: string): Filter => ({
  key: 'entitySearch',
  label,
  placeholder: `Search ${label.toLowerCase()}`,
});
const documentFilters = (entityLabel: string): Filter[] => [
  entityFilter(entityLabel),
  { key: 'categoryCode', label: 'Category', options: documentCategoryOptions },
  { key: 'accessClass', label: 'Access', options: documentAccessOptions },
  { key: 'status', label: 'Status', options: documentStatusOptions },
];
const spaceContextFilters: Filter[] = [
  { key: 'propertySearch', label: 'Property', placeholder: 'Property code or name' },
  { key: 'buildingSearch', label: 'Building', placeholder: 'Building code or name' },
];

export const focusedWorkspaceConfigs: Record<FocusedWorkspace, Config> = {
  'property-buildings': {
    title: 'Buildings',
    empty: 'No Buildings match the current filters.',
    path: '/buildings',
    searchLabel: 'Search Building name or code',
    filters: [
      { key: 'propertySearch', label: 'Property', placeholder: 'Property code or name' },
      { key: 'branchSearch', label: 'Branch', placeholder: 'Branch code or name' },
      { key: 'status', label: 'Status', options: buildingStatusOptions },
    ],
  },
  'property-ownership': {
    title: 'Property Ownership',
    empty: 'No ownership records match the current filters.',
    path: '/property-ownerships',
    searchLabel: 'Search property or owner',
    filters: [
      { key: 'propertySearch', label: 'Property', placeholder: 'Property code or name' },
      { key: 'ownerSearch', label: 'Owner', placeholder: 'Owner number or name' },
      { key: 'branchSearch', label: 'Branch', placeholder: 'Branch code or name' },
      { key: 'period', label: 'Period', options: periodOptions },
    ],
  },
  'property-amenities': {
    title: 'Property Amenities',
    empty: 'No property amenity assignments match the current filters.',
    path: '/property-amenities',
    searchLabel: 'Search property or amenity',
    filters: [
      { key: 'propertySearch', label: 'Property', placeholder: 'Property code or name' },
      { key: 'amenitySearch', label: 'Amenity', placeholder: 'Amenity code or name' },
      { key: 'branchSearch', label: 'Branch', placeholder: 'Branch code or name' },
    ],
  },
  'property-documents': {
    title: 'Property Documents',
    empty: 'No property documents match the current filters.',
    path: '/portfolio-documents?entityType=Property',
    searchLabel: 'Search document name or category',
    filters: documentFilters('Property'),
  },
  'property-branches': {
    title: 'Branch Assignments',
    empty: 'No branch assignments match the current filters.',
    path: '/property-branch-history',
    searchLabel: 'Search property code or name',
    filters: [
      { key: 'propertySearch', label: 'Property', placeholder: 'Property code or name' },
      { key: 'branchSearch', label: 'Branch', placeholder: 'Branch code or name' },
      { key: 'period', label: 'Period', options: periodOptions },
    ],
  },
  'property-activity': {
    title: 'Property Activity',
    empty: 'No property activity matches the current filters.',
    path: '/property-activity',
    searchLabel: 'Search action or reason',
    filters: [
      { key: 'propertySearch', label: 'Property', placeholder: 'Property code or name' },
      { key: 'branchSearch', label: 'Branch', placeholder: 'Branch code or name' },
      { key: 'action', label: 'Activity Type', options: activityOptions },
    ],
  },
  'owner-properties': {
    title: 'Owned Properties',
    empty: 'No owner-property relationships match the current filters.',
    path: '/property-ownerships',
    searchLabel: 'Search owner or property',
    filters: [
      { key: 'ownerSearch', label: 'Owner', placeholder: 'Owner number or name' },
      { key: 'propertySearch', label: 'Property', placeholder: 'Property code or name' },
      { key: 'branchSearch', label: 'Branch', placeholder: 'Branch code or name' },
      { key: 'period', label: 'Period', options: periodOptions },
    ],
  },
  'owner-documents': {
    title: 'Owner Documents',
    empty: 'No owner documents match the current filters.',
    path: '/portfolio-documents?entityType=Owner',
    searchLabel: 'Search document name or category',
    filters: documentFilters('Owner'),
  },
  'space-hierarchy': {
    title: 'Space Hierarchy',
    empty: 'No Rentable Spaces match the current filters.',
    path: '/rentable-spaces',
    searchLabel: 'Search Space name or code',
    filters: [
      ...spaceContextFilters,
      { key: 'typeSearch', label: 'Space Type', placeholder: 'Space type' },
      { key: 'status', label: 'Status', options: spaceStatusOptions },
    ],
  },
  'space-measurements': {
    title: 'Space Measurements',
    empty: 'No space measurements match the current filters.',
    path: '/rentable-spaces/measurements',
    searchLabel: 'Search space code or name',
    filters: [
      ...spaceContextFilters,
      { key: 'period', label: 'Period', options: measurementPeriodOptions },
    ],
  },
  'space-profiles': {
    title: 'Space Profiles',
    empty: 'No space profiles match the current filters.',
    path: '/rentable-spaces',
    searchLabel: 'Search space code or name',
    filters: [
      { key: 'propertySearch', label: 'Property', placeholder: 'Property code or name' },
      { key: 'typeSearch', label: 'Type', placeholder: 'Space type code or name' },
      { key: 'status', label: 'Status', options: spaceStatusOptions },
    ],
  },
  'space-amenities': {
    title: 'Space Amenities',
    empty: 'No space amenity records match the current filters.',
    path: '/rentable-spaces',
    searchLabel: 'Search space code or name',
    filters: [
      { key: 'propertySearch', label: 'Property', placeholder: 'Property code or name' },
      { key: 'typeSearch', label: 'Type', placeholder: 'Space type code or name' },
    ],
  },
  'space-documents': {
    title: 'Space Documents',
    empty: 'No space documents match the current filters.',
    path: '/portfolio-documents?entityType=RentableSpace',
    searchLabel: 'Search document name or category',
    filters: documentFilters('Space'),
  },
  'space-lifecycle': {
    title: 'Space Lifecycle',
    empty: 'No rentable spaces match the current filters.',
    path: '/rentable-spaces',
    searchLabel: 'Search space code or name',
    filters: [
      { key: 'propertySearch', label: 'Property', placeholder: 'Property code or name' },
      { key: 'branchSearch', label: 'Branch', placeholder: 'Branch code or name' },
      { key: 'status', label: 'Status', options: spaceStatusOptions },
    ],
  },
};

const record = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {};
const list = (value: unknown): Row[] => (Array.isArray(value) ? value.map(record) : []);
const text = (value: unknown, fallback = 'Not recorded') =>
  typeof value === 'string' && value.trim() ? value : fallback;
const date = (value: unknown) =>
  typeof value === 'string' && value
    ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value))
    : 'Open-ended';
const bytes = (value: unknown) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 'Size not recorded';
  if (amount < 1024) return `${amount} B`;
  if (amount < 1024 * 1024) return `${(amount / 1024).toFixed(1)} KB`;
  return `${(amount / (1024 * 1024)).toFixed(1)} MB`;
};

export function workspaceRequestPath(
  workspace: FocusedWorkspace,
  search: string,
  filters: Record<string, string>,
  cursor: string | null,
) {
  const config = focusedWorkspaceConfigs[workspace];
  const params = new URLSearchParams({ limit: '25' });
  if (search.trim()) params.set('search', search.trim());
  for (const [key, value] of Object.entries(filters)) {
    if (value.trim()) params.set(key, value.trim());
  }
  if (cursor) params.set('cursor', cursor);
  return `${config.path}${config.path.includes('?') ? '&' : '?'}${params.toString()}`;
}

function rowKey(row: Row, index: number) {
  if (typeof row.id === 'string') return row.id;
  if (typeof row.propertyId === 'string' && typeof row.amenityId === 'string') {
    return `${row.propertyId}:${row.amenityId}`;
  }
  return String(index);
}

export function focusedRowPresentation(workspace: FocusedWorkspace, row: Row) {
  const property = record(row.property);
  const owner = record(row.owner);
  const amenity = record(row.amenity);
  const space = record(row.space);
  const branch = record(row.branch ?? row.branches);
  const building = record(row.building);
  const versions = list(row.versions);
  const latestVersion = versions[0] ?? {};
  const propertyLabel = property.name
    ? `${text(property.propertyCode)} · ${text(property.name)}`
    : 'Property not recorded';
  const spaceLabel = space.name
    ? `${text(space.spaceCode)} · ${text(space.name)}`
    : 'Space not recorded';

  if (workspace === 'property-ownership' || workspace === 'owner-properties') {
    return {
      title: text(owner.displayName, text(record(row.owner).partyNumber, 'Owner record')),
      context: propertyLabel,
      details: `${text(row.ownershipPercent, '—')}% · ${date(row.effectiveFrom)} to ${date(row.effectiveTo)}`,
      status: undefined,
    };
  }
  if (workspace === 'property-amenities') {
    return {
      title: text(amenity.name, text(amenity.code, 'Amenity')),
      context: propertyLabel,
      details: text(amenity.code, 'Amenity assignment'),
      status:
        typeof amenity.active === 'boolean' ? (amenity.active ? 'ACTIVE' : 'INACTIVE') : undefined,
    };
  }
  if (workspace.includes('document')) {
    const entityContext = property.name
      ? propertyLabel
      : owner.displayName
        ? text(owner.displayName)
        : spaceLabel;
    return {
      title: text(row.displayName, 'Document'),
      context: entityContext,
      details: `${humanize(text(row.categoryCode, 'Uncategorized'))} · ${humanize(text(row.accessClass, 'Internal'))} · ${text(latestVersion.mimeType, 'File type not recorded')} · ${bytes(latestVersion.sizeBytes)}`,
      status: typeof row.status === 'string' ? row.status : undefined,
    };
  }
  if (workspace === 'property-branches') {
    return {
      title: propertyLabel,
      context: branch.name ? `${text(branch.code)} · ${text(branch.name)}` : 'Branch not recorded',
      details: `${date(row.effectiveFrom)} to ${date(row.effectiveTo)}`,
      status: undefined,
    };
  }
  if (workspace === 'property-activity') {
    return {
      title: text(row.label, humanize(text(row.action, 'Property activity'))),
      context: propertyLabel,
      details: `${branch.name ? text(branch.name) : 'Company-wide'} · ${date(row.occurredAt)}${row.reason ? ` · ${text(row.reason)}` : ''}`,
      status: undefined,
    };
  }
  if (workspace === 'property-buildings') {
    const count = Number(record(row._count).spaces ?? 0);
    return {
      title: text(row.name, text(row.buildingCode, 'Building')),
      context: propertyLabel,
      details: `${text(row.buildingCode)} · ${count} ${count === 1 ? 'space' : 'spaces'}`,
      status: typeof row.status === 'string' ? row.status : undefined,
    };
  }

  const title = `${text(row.spaceCode)} · ${text(row.name, 'Rentable space')}`;
  const context = `${propertyLabel}${building.name ? ` · ${text(building.name)}` : ''}`;
  if (workspace === 'space-measurements') {
    return {
      title,
      context,
      details: `${text(latestVersion.usableArea, '—')} usable / ${text(latestVersion.totalArea, '—')} total ${humanize(text(latestVersion.areaUnit, ''))}`,
      status: typeof row.status === 'string' ? row.status : undefined,
    };
  }
  if (workspace === 'space-hierarchy') {
    const parents = list(row.childRelations);
    const parent = record(parents[0]);
    return {
      title,
      context,
      details: parent.parentSpaceId
        ? `Parent relation active from ${date(parent.effectiveFrom)}`
        : 'Top-level space',
      status: typeof row.status === 'string' ? row.status : undefined,
    };
  }
  if (workspace === 'space-profiles') {
    const type = record(row.type);
    const profile = record(row.residentialProfile ?? row.commercialProfile ?? row.landProfile);
    const profileValues = Object.values(profile).filter(
      (value) => value !== null && value !== undefined,
    ).length;
    return {
      title,
      context,
      details: `${text(type.name, text(type.code, 'Type not recorded'))} · ${profileValues ? `${profileValues} profile fields` : 'Profile not recorded'}`,
      status: typeof row.status === 'string' ? row.status : undefined,
    };
  }
  if (workspace === 'space-amenities') {
    const amenities = list(row.amenities)
      .map((assignment) => text(record(assignment.amenity).name, ''))
      .filter(Boolean);
    return {
      title,
      context,
      details: amenities.length ? amenities.join(', ') : 'No amenities assigned',
      status: typeof row.status === 'string' ? row.status : undefined,
    };
  }
  return {
    title,
    context,
    details: `${humanize(text(record(row.type).name, 'Rentable space'))} · Updated ${date(row.updatedAt)}`,
    status: typeof row.status === 'string' ? row.status : undefined,
  };
}

function workspaceHeaders(workspace: FocusedWorkspace): string[] {
  if (workspace === 'property-buildings')
    return ['Building', 'Code', 'Property', 'Floors', 'Rentable Spaces', 'Status', 'Actions'];
  if (workspace === 'property-ownership' || workspace === 'owner-properties')
    return ['Owner', 'Property', 'Ownership', 'Effective Period', 'Period', 'Actions'];
  if (workspace.includes('document'))
    return [
      'Document',
      'Related Record',
      'Category',
      'Version',
      'Access',
      'Status',
      'Updated',
      'Actions',
    ];
  if (workspace === 'property-amenities')
    return ['Amenity', 'Property', 'Code', 'Status', 'Actions'];
  if (workspace === 'property-branches')
    return ['Property', 'Branch', 'Effective Period', 'Period', 'Actions'];
  if (workspace === 'property-activity')
    return ['Activity', 'Property', 'Branch', 'Occurred', 'Reason'];
  if (workspace === 'space-hierarchy')
    return ['Rentable Space', 'Property', 'Building', 'Parent', 'Status', 'Actions'];
  if (workspace === 'space-measurements')
    return ['Rentable Space', 'Property', 'Usable Area', 'Total Area', 'Unit', 'Status', 'Actions'];
  if (workspace === 'space-profiles')
    return ['Rentable Space', 'Property', 'Space Type', 'Profile', 'Status', 'Actions'];
  if (workspace === 'space-amenities')
    return ['Rentable Space', 'Property', 'Amenities', 'Status', 'Actions'];
  return ['Rentable Space', 'Property', 'Space Type', 'Updated', 'Status', 'Actions'];
}

function recordLink(href: string, label: string) {
  return (
    <a href={href} className="font-bold text-[#0D47A1] hover:underline">
      {label}
    </a>
  );
}

function workspaceCells(workspace: FocusedWorkspace, row: Row): ReactNode[] {
  const source = workspace === 'space-measurements' ? record(row.space) : row;
  const property = record(source.property);
  const owner = record(row.owner);
  const amenity = record(row.amenity);
  const branch = record(row.branch ?? row.branches);
  const building = record(source.building);
  const versions = list(source.versions);
  const latest = workspace === 'space-measurements' ? row : (versions[0] ?? {});
  const propertyName = text(property.name, 'Property not recorded');
  const propertyId = text(property.id, '');
  const spaceId = text(source.id, '');
  const spaceName = text(source.name, 'Rentable Space');
  const spaceCode = text(source.spaceCode, '');

  if (workspace === 'property-buildings') {
    const count = Number(record(row._count).spaces ?? 0);
    const id = text(row.id, '');
    return [
      text(row.name, 'Building'),
      text(row.buildingCode, ''),
      propertyId ? recordLink('/portfolio/properties/' + propertyId, propertyName) : propertyName,
      typeof row.numberOfFloors === 'number' ? String(row.numberOfFloors) : 'Not recorded',
      count ? String(count) : <span className="text-slate-500">None created</span>,
      <StatusBadge value={text(row.status, '')} />,
      <span className="flex flex-wrap justify-end gap-3">
        {recordLink('/portfolio/buildings/' + id, 'Open Building')}
        {recordLink(
          '/portfolio?section=spaces&view=overview&create=1&propertyId=' +
            encodeURIComponent(propertyId) +
            '&buildingId=' +
            encodeURIComponent(id),
          'Add Rentable Space',
        )}
      </span>,
    ];
  }
  if (workspace === 'property-ownership' || workspace === 'owner-properties') {
    const period = text(row.period, 'CURRENT');
    return [
      text(owner.displayName, text(record(owner.owner).ownerNumber, 'Owner')),
      propertyId ? recordLink('/portfolio/properties/' + propertyId, propertyName) : propertyName,
      text(row.ownershipPercent, '0') + '%',
      date(row.effectiveFrom) + ' - ' + date(row.effectiveTo),
      <StatusBadge value={period} />,
      <span className="flex flex-wrap justify-end gap-3">
        {propertyId ? recordLink('/portfolio/properties/' + propertyId, 'Open Property') : null}
        {propertyId
          ? recordLink(
              '/portfolio/properties/' + encodeURIComponent(propertyId) + '?tab=ownership&manage=1',
              'Manage Ownership',
            )
          : null}
      </span>,
    ];
  }
  if (workspace.includes('document')) {
    const entity = property.name ? property : owner.displayName ? owner : record(row.space);
    const entityName = text(entity.name ?? entity.displayName, 'Related record');
    const versionId = text(latest.id, '');
    const documentId = text(row.id, '');
    const entityHref = property.id
      ? '/portfolio/properties/' + text(property.id)
      : record(row.space).id
        ? '/portfolio/rentable-spaces/' + text(record(row.space).id)
        : '';
    return [
      <span>
        <strong className="block text-slate-900">{text(row.displayName, 'Document')}</strong>
        <span className="text-xs text-slate-500">
          {text(latest.originalFilename, text(latest.mimeType, 'File'))} · {bytes(latest.sizeBytes)}
        </span>
      </span>,
      entityHref ? recordLink(entityHref, entityName) : entityName,
      humanize(text(row.categoryCode, 'Other')),
      'Version ' + text(latest.sequence, '1'),
      humanize(text(row.accessClass, 'Internal')),
      <StatusBadge value={text(row.status, '')} />,
      date(row.updatedAt ?? row.createdAt),
      <span className="flex flex-wrap justify-end gap-3">
        {versionId
          ? recordLink(
              apiUrl(
                '/portfolio-documents/' +
                  documentId +
                  '/versions/' +
                  versionId +
                  '/content?disposition=inline',
              ),
              'View',
            )
          : null}
        {versionId
          ? recordLink(
              apiUrl(
                '/portfolio-documents/' +
                  documentId +
                  '/versions/' +
                  versionId +
                  '/content?disposition=attachment',
              ),
              'Download',
            )
          : null}
      </span>,
    ];
  }
  if (workspace === 'property-amenities')
    return [
      text(amenity.name, 'Amenity'),
      propertyId
        ? recordLink('/portfolio/properties/' + propertyId + '?tab=amenities', propertyName)
        : propertyName,
      text(amenity.code, ''),
      <StatusBadge value={typeof amenity.active === 'boolean' ? amenity.active : true} />,
      propertyId
        ? recordLink('/portfolio/properties/' + propertyId + '?tab=amenities', 'Manage')
        : null,
    ];
  if (workspace === 'property-branches')
    return [
      propertyId ? recordLink('/portfolio/properties/' + propertyId, propertyName) : propertyName,
      text(branch.name, 'Branch not recorded'),
      date(row.effectiveFrom) + ' - ' + date(row.effectiveTo),
      <StatusBadge value={text(row.period, row.effectiveTo ? 'HISTORICAL' : 'CURRENT')} />,
      propertyId
        ? recordLink('/portfolio/properties/' + propertyId + '?tab=branch-history', 'Open History')
        : null,
    ];
  if (workspace === 'property-activity')
    return [
      humanize(text(row.action, 'Property activity')),
      propertyName,
      text(branch.name, 'Company-wide'),
      date(row.occurredAt),
      text(row.reason, 'No reason recorded'),
    ];

  const spaceLabel = spaceCode ? spaceCode + ' - ' + spaceName : spaceName;
  const action = spaceId ? recordLink('/portfolio/rentable-spaces/' + spaceId, 'Open Space') : null;
  if (workspace === 'space-hierarchy') {
    const relation = record(list(row.childRelations)[0]);
    return [
      spaceLabel,
      propertyName,
      text(building.name, 'Property-level'),
      relation.parent
        ? text(record(relation.parent).name)
        : relation.parentSpaceId
          ? 'Parent Space'
          : 'Top-level Space',
      <StatusBadge value={text(row.status, '')} />,
      action,
    ];
  }
  if (workspace === 'space-measurements')
    return [
      spaceLabel,
      propertyName,
      text(latest.usableArea, 'Not recorded'),
      text(latest.totalArea, 'Not recorded'),
      humanize(text(latest.areaUnit, 'Not recorded')),
      <StatusBadge value={text(row.period, 'CURRENT')} />,
      action,
    ];
  if (workspace === 'space-profiles') {
    const profile = record(row.residentialProfile ?? row.commercialProfile ?? row.landProfile);
    const count = Object.values(profile).filter((value) => value != null).length;
    return [
      spaceLabel,
      propertyName,
      text(record(row.type).name, 'Not recorded'),
      count ? count + ' fields recorded' : 'Not recorded',
      <StatusBadge value={text(row.status, '')} />,
      action,
    ];
  }
  if (workspace === 'space-amenities') {
    const names = list(row.amenities)
      .map((item) => text(record(item.amenity).name, ''))
      .filter(Boolean);
    return [
      spaceLabel,
      propertyName,
      names.length ? names.join(', ') : 'None assigned',
      <StatusBadge value={text(row.status, '')} />,
      action,
    ];
  }
  return [
    spaceLabel,
    propertyName,
    text(record(row.type).name, 'Rentable Space'),
    date(row.updatedAt),
    <StatusBadge value={text(row.status, '')} />,
    action,
  ];
}
export type FocusedWorkspaceState = 'loading' | 'error' | 'empty' | 'filtered-empty' | 'populated';

export function focusedWorkspaceState(input: {
  loading: boolean;
  error: string;
  itemCount: number;
  filtered: boolean;
}): FocusedWorkspaceState {
  if (input.loading) return 'loading';
  if (input.error) return 'error';
  if (input.itemCount > 0) return 'populated';
  return input.filtered ? 'filtered-empty' : 'empty';
}
type LookupOption = { value: string; label: string };

function lookupKind(filter: Filter) {
  if (
    filter.key === 'propertySearch' ||
    (filter.key === 'entitySearch' && filter.label === 'Property')
  )
    return 'property';
  if (filter.key === 'ownerSearch' || (filter.key === 'entitySearch' && filter.label === 'Owner'))
    return 'owner';
  if (filter.key === 'branchSearch') return 'branch';
  if (filter.key === 'buildingSearch') return 'building';
  if (filter.key === 'amenitySearch') return 'amenity';
  if (filter.key === 'typeSearch') return 'space-type';
  if (filter.key === 'entitySearch' && filter.label === 'Space') return 'space';
  return null;
}

function lookupPath(kind: NonNullable<ReturnType<typeof lookupKind>>, query: string) {
  const params = new URLSearchParams();
  if (query.trim()) params.set('search', query.trim());
  if (kind !== 'branch' && kind !== 'amenity' && kind !== 'space-type') params.set('limit', '20');
  const resource =
    kind === 'property'
      ? 'properties'
      : kind === 'owner'
        ? 'owners'
        : kind === 'building'
          ? 'buildings'
          : kind === 'space'
            ? 'rentable-spaces'
            : kind === 'space-type'
              ? 'rentable-spaces/types'
              : kind === 'amenity'
                ? 'amenities'
                : 'branches';
  return '/' + resource + (params.size ? '?' + params.toString() : '');
}

function lookupPresentation(
  kind: NonNullable<ReturnType<typeof lookupKind>>,
  row: Row,
): LookupOption {
  if (kind === 'property')
    return {
      value: text(row.propertyCode, text(row.name, '')),
      label: text(row.propertyCode, '') + ' - ' + text(row.name, 'Property'),
    };
  if (kind === 'owner') {
    const party = record(row.party);
    return {
      value: text(row.ownerNumber, text(party.displayName, '')),
      label: text(row.ownerNumber, '') + ' - ' + text(party.displayName, 'Owner'),
    };
  }
  if (kind === 'branch')
    return {
      value: text(row.code, text(row.name, '')),
      label: text(row.code, '') + ' - ' + text(row.name, 'Branch'),
    };
  if (kind === 'building')
    return {
      value: text(row.buildingCode, text(row.name, '')),
      label: text(row.buildingCode, '') + ' - ' + text(row.name, 'Building'),
    };
  if (kind === 'space')
    return {
      value: text(row.spaceCode, text(row.name, '')),
      label: text(row.spaceCode, '') + ' - ' + text(row.name, 'Rentable Space'),
    };
  return {
    value: text(row.code, text(row.name, '')),
    label: text(row.name, text(row.code, 'Option')),
  };
}

function FilterControl({
  filter,
  value,
  onChange,
}: {
  filter: Filter;
  value: string;
  onChange: (value: string) => void;
}) {
  const controlClass =
    'h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#0D47A1] focus:ring-2 focus:ring-[#E3F2FD]';
  const kind = lookupKind(filter);
  const [options, setOptions] = useState<LookupOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const loadOptions = useCallback(
    (query: string) => {
      if (!kind) return;
      setLoadingOptions(true);
      void api<CursorPage<Row> | Row[]>(lookupPath(kind, query))
        .then((response) => {
          const rows = Array.isArray(response) ? response : response.items;
          setOptions(
            rows.map((row) => lookupPresentation(kind, row)).filter((option) => option.value),
          );
        })
        .catch(() => setOptions([]))
        .finally(() => setLoadingOptions(false));
    },
    [kind],
  );

  useEffect(() => {
    if (kind) loadOptions('');
    return undefined;
  }, [kind, loadOptions]);

  return (
    <label className="min-w-0 space-y-1.5">
      <span className="block text-xs font-bold uppercase tracking-wide text-slate-600">
        {filter.label}
      </span>
      {filter.options ? (
        <select
          className={controlClass}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {filter.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : kind ? (
        <SearchableSelect
          searchable
          searchThreshold={0}
          className={controlClass}
          value={value}
          loading={loadingOptions}
          onSearchChange={loadOptions}
          onChange={(event) => onChange(event.target.value)}
          searchPlaceholder={'Search or select ' + filter.label.toLowerCase()}
          aria-label={filter.label}
        >
          <option value="">All {filter.label}s</option>
          {value && !options.some((option) => option.value === value) ? (
            <option value={value}>{value}</option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SearchableSelect>
      ) : (
        <input
          className={controlClass}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={filter.placeholder}
        />
      )}
    </label>
  );
}
export function FocusedPortfolioWorkspace({ workspace }: { workspace: FocusedWorkspace }) {
  const config = focusedWorkspaceConfigs[workspace];
  const [search, setSearch] = useState('');
  const [draftFilters, setDraftFilters] = useState<Record<string, string>>({});
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [submittedFilters, setSubmittedFilters] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<Array<string | null>>([null]);
  const [index, setIndex] = useState(0);
  const [page, setPage] = useState<CursorPage<Row> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const restoredSearch = parameters.get('search') ?? '';
    const restoredFilters = Object.fromEntries(
      config.filters.map((filter) => [filter.key, parameters.get(filter.key) ?? '']),
    );
    setSearch(restoredSearch);
    setDraftFilters(restoredFilters);
    setSubmittedSearch(restoredSearch);
    setSubmittedFilters(restoredFilters);
    setHistory([null]);
    setIndex(0);
  }, [workspace]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    void api<CursorPage<Row>>(
      workspaceRequestPath(workspace, submittedSearch, submittedFilters, history[index] ?? null),
    )
      .then((result) => {
        if (live) setPage(result);
      })
      .catch((cause) => {
        if (live) setError(userFacingError(cause, `Unable to load ${config.title.toLowerCase()}.`));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [config.title, history, index, reload, submittedFilters, submittedSearch, workspace]);

  const rows = useMemo(() => page?.items ?? [], [page]);
  const hasFilters = Boolean(submittedSearch || Object.values(submittedFilters).some(Boolean));
  const state = focusedWorkspaceState({
    loading,
    error,
    itemCount: rows.length,
    filtered: hasFilters,
  });
  const submit = () => {
    const normalizedSearch = search.trim();
    const normalizedFilters = Object.fromEntries(
      Object.entries(draftFilters).map(([key, value]) => [key, value.trim()]),
    );
    setHistory([null]);
    setIndex(0);
    setSubmittedSearch(normalizedSearch);
    setSubmittedFilters(normalizedFilters);
    const url = new URL(window.location.href);
    if (normalizedSearch) url.searchParams.set('search', normalizedSearch);
    else url.searchParams.delete('search');
    for (const filter of config.filters) {
      const value = normalizedFilters[filter.key];
      if (value) url.searchParams.set(filter.key, value);
      else url.searchParams.delete(filter.key);
    }
    window.history.replaceState({}, '', url);
  };

  return (
    <section className="space-y-4">
      <header>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
          Dedicated workspace
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          {config.title}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Search, filter, and review authorized {config.title.toLowerCase()}.
        </p>
      </header>
      <form
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="min-w-0 space-y-1.5 md:col-span-2">
            <span className="block text-xs font-bold uppercase tracking-wide text-slate-600">
              Search
            </span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={config.searchLabel}
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-10 text-sm outline-none focus:border-[#0D47A1] focus:ring-2 focus:ring-[#E3F2FD]"
              />
              {search ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearch('')}
                  className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </span>
          </label>
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 md:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" /> Filters (
            {Object.values(draftFilters).filter(Boolean).length})
          </button>
          {config.filters.map((filter) => (
            <div className="hidden md:block" key={filter.key}>
              <FilterControl
                filter={filter}
                value={draftFilters[filter.key] ?? ''}
                onChange={(value) =>
                  setDraftFilters((current) => ({ ...current, [filter.key]: value }))
                }
              />
            </div>
          ))}
        </div>
        {mobileFiltersOpen ? (
          <div
            className="fixed inset-0 z-[90] bg-slate-950/40 md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Workspace filters"
          >
            <button
              type="button"
              className="absolute inset-0"
              aria-label="Close filters"
              onClick={() => setMobileFiltersOpen(false)}
            />
            <section className="absolute inset-x-0 bottom-0 max-h-[85vh] space-y-4 overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-950">Filters</h2>
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(false)}
                  className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200"
                  aria-label="Close filters"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                {config.filters.map((filter) => (
                  <FilterControl
                    key={filter.key}
                    filter={filter}
                    value={draftFilters[filter.key] ?? ''}
                    onChange={(value) =>
                      setDraftFilters((current) => ({ ...current, [filter.key]: value }))
                    }
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setDraftFilters({})}
                  className="h-11 rounded-lg border border-slate-300 text-sm font-bold text-slate-700"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => {
                    submit();
                    setMobileFiltersOpen(false);
                  }}
                  className="h-11 rounded-lg bg-[#0D47A1] text-sm font-bold text-white"
                >
                  Apply
                </button>
              </div>
            </section>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {hasFilters ? (
            <button
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              type="button"
              onClick={() => {
                setSearch('');
                setDraftFilters({});
                setSubmittedSearch('');
                setSubmittedFilters({});
                setHistory([null]);
                setIndex(0);
                const url = new URL(window.location.href);
                url.searchParams.delete('search');
                for (const filter of config.filters) url.searchParams.delete(filter.key);
                window.history.replaceState({}, '', url);
              }}
            >
              Clear filters
            </button>
          ) : null}
          <button
            className="rounded-lg bg-[#0D47A1] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#08376f]"
            type="submit"
          >
            Apply filters
          </button>
        </div>
      </form>

      {hasFilters ? (
        <div className="flex flex-wrap items-center gap-2" aria-label="Applied filters">
          {submittedSearch ? (
            <span className="rounded-full bg-[#E3F2FD] px-3 py-1 text-xs font-bold text-[#0D47A1]">
              Search: {submittedSearch}
            </span>
          ) : null}
          {config.filters.map((filter) =>
            submittedFilters[filter.key] ? (
              <span
                key={filter.key}
                className="rounded-full bg-[#E3F2FD] px-3 py-1 text-xs font-bold text-[#0D47A1]"
              >
                {filter.label}: {submittedFilters[filter.key]}
              </span>
            ) : null,
          )}
        </div>
      ) : null}

      {state === 'loading' ? (
        <LoadingState label={`Loading ${config.title.toLowerCase()}`} />
      ) : null}
      {state === 'error' ? (
        <div className="space-y-3">
          <ErrorState message={error} />
          <button
            className="rounded-lg border border-[#0D47A1] px-4 py-2 text-sm font-bold text-[#0D47A1]"
            type="button"
            onClick={() => setReload((value) => value + 1)}
          >
            Try again
          </button>
        </div>
      ) : null}
      {state === 'empty' || state === 'filtered-empty' ? (
        <EmptyState
          title={hasFilters ? config.empty : `No ${config.title.toLowerCase()} recorded yet.`}
          description={
            hasFilters
              ? 'Adjust or clear the current filters.'
              : 'Create a permitted record from its primary workspace.'
          }
        />
      ) : null}
      {state === 'populated' ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {workspaceHeaders(workspace).map((header, headerIndex, headers) => (
                    <th
                      key={header}
                      className={
                        'px-4 py-3 ' + (headerIndex === headers.length - 1 ? 'text-right' : '')
                      }
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowKey(row, rowIndex)} className="border-t border-slate-100 align-top">
                    {workspaceCells(workspace, row).map((cell, cellIndex, cells) => (
                      <td
                        key={cellIndex}
                        className={
                          'px-4 py-3 text-slate-600 ' +
                          (cellIndex === 0 ? 'font-semibold text-slate-900 ' : '') +
                          (cellIndex === cells.length - 1 ? 'text-right' : '')
                        }
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <CursorPaginationControls
            page={index + 1}
            itemCount={rows.length}
            hasPrevious={index > 0}
            hasNext={Boolean(page?.pageInfo.hasNextPage)}
            onPrevious={() => setIndex((value) => Math.max(0, value - 1))}
            onNext={() => {
              if (page?.pageInfo.nextCursor) {
                setHistory((items) => [...items.slice(0, index + 1), page.pageInfo.nextCursor]);
                setIndex((value) => value + 1);
              }
            }}
          />
        </div>
      ) : null}
    </section>
  );
}
