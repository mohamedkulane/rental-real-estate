'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { CursorPaginationControls } from '@/components/shared/pagination';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/shared/ui';
import { api, type CursorPage, userFacingError } from '@/lib/phase3-api';
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
  { key: 'categoryCode', label: 'Category', placeholder: 'Category code' },
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
    empty: 'No buildings match the current filters.',
    path: '/buildings',
    searchLabel: 'Search building code or name',
    filters: [
      { key: 'propertySearch', label: 'Property', placeholder: 'Property code or name' },
      { key: 'branchSearch', label: 'Branch', placeholder: 'Branch code or name' },
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
      { key: 'action', label: 'Action', placeholder: 'Action name' },
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
    empty: 'No rentable spaces match the current filters.',
    path: '/rentable-spaces',
    searchLabel: 'Search space code or name',
    filters: [
      ...spaceContextFilters,
      { key: 'branchSearch', label: 'Branch', placeholder: 'Branch code or name' },
    ],
  },
  'space-measurements': {
    title: 'Space Measurements',
    empty: 'No space measurements match the current filters.',
    path: '/rentable-spaces',
    searchLabel: 'Search space code or name',
    filters: spaceContextFilters,
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
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#0D47A1] focus:ring-2 focus:ring-[#E3F2FD]';
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
    setHistory([null]);
    setIndex(0);
    setSubmittedSearch(search.trim());
    setSubmittedFilters(
      Object.fromEntries(Object.entries(draftFilters).map(([key, value]) => [key, value.trim()])),
    );
  };

  return (
    <section className="space-y-4">
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
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#0D47A1] focus:ring-2 focus:ring-[#E3F2FD]"
              />
            </span>
          </label>
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
                  <th className="px-4 py-3">Record</th>
                  <th className="px-4 py-3">Context</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => {
                  const presentation = focusedRowPresentation(workspace, row);
                  return (
                    <tr key={rowKey(row, rowIndex)} className="border-t border-slate-100 align-top">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {presentation.title}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{presentation.context}</td>
                      <td className="px-4 py-3 text-slate-600">{presentation.details}</td>
                      <td className="px-4 py-3 text-right">
                        {presentation.status ? <StatusBadge value={presentation.status} /> : '—'}
                      </td>
                    </tr>
                  );
                })}
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
