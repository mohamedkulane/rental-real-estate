'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import {
  DataTable,
  DataTableActions,
  DataTableBody,
  DataTableCell,
  DataTableDesktopOnly,
  DataTableEmpty,
  DataTableError,
  DataTableFilter,
  DataTableHead,
  DataTableHeaderCell,
  DataTableMobileCard,
  DataTableMobileCards,
  DataTableResetButton,
  DataTableRow,
  DataTableScroll,
  DataTableSurface,
  DataTableToolbar,
} from '@/components/shared/data-table';
import { TableSkeleton } from '@/components/shared/loading-system';
import { CursorPaginationControls } from '@/components/shared/pagination';
import { PageHeader, StatusBadge } from '@/components/shared/ui';
import { api, hasPermission, type CursorPage, userFacingError } from '@/lib/phase3-api';
import { formatDate, humanize } from '@/lib/presentation';
import { OperationsShell, useOperationsPrincipal } from './operations-shell';
import { Phase5CreateAction, Phase5RowAction, type OperationsMode } from './phase5-actions';

type Mode = OperationsMode;
type RecordValue = string | number | null | undefined;
type Row = Record<string, unknown> & { id: string; status?: string };
type Column = { label: string; value: (row: Row) => RecordValue };

const nested = (row: Row, ...keys: string[]): unknown =>
  keys.reduce<unknown>(
    (value, key) =>
      value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined,
    row,
  );
const text = (value: unknown) => (typeof value === 'string' ? value : '');
const scalar = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const date = (value: unknown) => formatDate(value);

const config: Record<
  Mode,
  {
    eyebrow: string;
    title: string;
    description: string;
    permission: string;
    endpoint: string;
    empty: string;
    action?: { label: string; href: string };
    statuses?: string[];
    columns: Column[];
  }
> = {
  'rental-listings': {
    eyebrow: 'Marketing',
    title: 'Rental Listing Register',
    description: 'Market eligible Rentable Spaces through approved commercial authority.',
    permission: 'listing.read',
    endpoint: '/rental-listings',
    empty: 'No Rental Listings are available in your authorized branches.',
    action: { label: 'Start Rental Brokerage', href: '/workflows/new?type=RENTAL_BROKERAGE' },
    statuses: [
      'DRAFT',
      'PENDING_REVIEW',
      'PUBLISHED',
      'PAUSED',
      'UNPUBLISHED',
      'CLOSED',
      'ARCHIVED',
    ],
    columns: [
      { label: 'Listing', value: (row) => row.listingNumber as string },
      { label: 'Title', value: (row) => row.title as string },
      {
        label: 'Rentable Space',
        value: (row) =>
          `${text(nested(row, 'rentableSpace', 'spaceCode'))} — ${text(nested(row, 'rentableSpace', 'name'))}`,
      },
      {
        label: 'Property',
        value: (row) => text(nested(row, 'rentableSpace', 'property', 'name')),
      },
      {
        label: 'Rent',
        value: (row) =>
          scalar(row.askingRent) ? `${text(row.currency)} ${scalar(row.askingRent)}` : 'Not set',
      },
    ],
  },
  'sale-listings': {
    eyebrow: 'Marketing',
    title: 'Sale Listing Register',
    description: 'Market eligible Properties without creating fake ownership assets.',
    permission: 'listing.read',
    endpoint: '/sale-listings',
    empty: 'No Sale Listings are available in your authorized branches.',
    action: { label: 'Start Property Sale', href: '/workflows/new?type=PROPERTY_SALE' },
    statuses: ['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'PAUSED', 'UNPUBLISHED', 'CLOSED', 'ARCHIVED'],
    columns: [
      { label: 'Listing', value: (row) => row.listingNumber as string },
      { label: 'Title', value: (row) => row.title as string },
      {
        label: 'Property',
        value: (row) =>
          `${text(nested(row, 'property', 'propertyCode'))} — ${text(nested(row, 'property', 'name'))}`,
      },
      {
        label: 'Price',
        value: (row) =>
          scalar(row.askingPrice) ? `${text(row.currency)} ${scalar(row.askingPrice)}` : 'Not set',
      },
    ],
  },
  viewings: {
    eyebrow: 'CRM',
    title: 'Viewings',
    description: 'Schedule and progress authorized rental and sale appointments.',
    permission: 'viewing.read',
    endpoint: '/viewings',
    empty: 'No Viewings match the current filters.',
    statuses: ['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
    columns: [
      {
        label: 'Lead',
        value: (row) =>
          `${text(nested(row, 'lead', 'leadNumber'))} — ${text(nested(row, 'lead', 'displayName'))}`,
      },
      {
        label: 'Listing',
        value: (row) =>
          text(nested(row, 'rentalListing', 'title')) || text(nested(row, 'saleListing', 'title')),
      },
      { label: 'Scheduled', value: (row) => date(row.scheduledAt) },
      {
        label: 'Assigned Agent',
        value: (row) => text(nested(row, 'assignedEmployee', 'party', 'displayName')),
      },
    ],
  },
  applications: {
    eyebrow: 'Leasing',
    title: 'Applications',
    description: 'Review rental applications and restricted screening outcomes.',
    permission: 'application.read',
    endpoint: '/applications',
    empty: 'No Applications match the current filters.',
    statuses: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN'],
    columns: [
      { label: 'Application', value: (row) => row.applicationNumber as string },
      {
        label: 'Applicant',
        value: (row) =>
          text(nested(row, 'applicantParty', 'displayName')) || text(nested(row, 'lead', 'displayName')),
      },
      { label: 'Listing', value: (row) => text(nested(row, 'rentalListing', 'title')) },
      { label: 'Screening', value: (row) => text(row.screeningStatus) },
    ],
  },
  reservations: {
    eyebrow: 'Leasing',
    title: 'Reservations',
    description: 'Control exclusive, time-bound holds on Rentable Spaces.',
    permission: 'reservation.read',
    endpoint: '/reservations',
    empty: 'No Reservations match the current filters.',
    statuses: ['ACTIVE', 'EXPIRED', 'CANCELLED', 'CONVERTED'],
    columns: [
      { label: 'Reservation', value: (row) => row.reservationNumber as string },
      {
        label: 'Applicant',
        value: (row) => text(nested(row, 'application', 'lead', 'displayName')),
      },
      {
        label: 'Rentable Space',
        value: (row) =>
          `${text(nested(row, 'rentableSpace', 'spaceCode'))} — ${text(nested(row, 'rentableSpace', 'name'))}`,
      },
      { label: 'Expires', value: (row) => date(row.expiresAt) },
    ],
  },
  tenants: {
    eyebrow: 'Leasing',
    title: 'Tenant Register',
    description: 'Canonical Party identities with an active Tenant role.',
    permission: 'tenant.read',
    endpoint: '/tenants',
    empty: 'No Tenant profiles are available.',
    columns: [
      { label: 'Tenant', value: (row) => row.tenantNumber as string },
      { label: 'Name', value: (row) => text(nested(row, 'party', 'displayName')) },
      { label: 'Party', value: (row) => text(nested(row, 'party', 'partyNumber')) },
      { label: 'Type', value: (row) => text(nested(row, 'party', 'kind')) },
    ],
  },
  leases: {
    eyebrow: 'Leasing',
    title: 'Lease Contracts',
    description: 'Manage versioned Lease Contracts for canonical Rentable Spaces.',
    permission: 'lease.read',
    endpoint: '/leases',
    empty: 'No Lease Contracts match the current filters.',
    statuses: [
      'DRAFT',
      'PENDING_APPROVAL',
      'APPROVED',
      'PENDING_SIGNATURE',
      'SIGNED',
      'ACTIVE',
      'ENDED',
      'TERMINATED',
      'ARCHIVED',
    ],
    columns: [
      { label: 'Lease', value: (row) => row.leaseNumber as string },
      {
        label: 'Rentable Space',
        value: (row) =>
          `${text(nested(row, 'rentableSpace', 'spaceCode'))} — ${text(nested(row, 'rentableSpace', 'name'))}`,
      },
      {
        label: 'Tenant',
        value: (row) => {
          const parties = row.parties as Array<Record<string, unknown>> | undefined;
          return (
            parties
              ?.map((party) => text(nested(party as Row, 'party', 'displayName')))
              .filter(Boolean)
              .join(', ') || '—'
          );
        },
      },
      {
        label: 'Period',
        value: (row) => `${date(row.leaseStartDate)} — ${date(row.leaseEndDate)}`,
      },
    ],
  },
  renewals: {
    eyebrow: 'Leasing',
    title: 'Renewals',
    description: 'Create successor agreements without overwriting historical Lease terms.',
    permission: 'renewal.read',
    endpoint: '/renewals',
    empty: 'No Renewal workflows match the current filters.',
    statuses: ['DRAFT', 'PROPOSED', 'APPROVED', 'SIGNED', 'ACTIVATED', 'REJECTED', 'CANCELLED'],
    columns: [
      { label: 'Existing Lease', value: (row) => text(nested(row, 'originalLease', 'leaseNumber')) },
      {
        label: 'Rentable Space',
        value: (row) => text(nested(row, 'originalLease', 'rentableSpace', 'name')),
      },
      {
        label: 'Proposed Period',
        value: (row) => `${date(row.proposedStartDate)} — ${date(row.proposedEndDate)}`,
      },
      {
        label: 'Successor',
        value: (row) => text(nested(row, 'successorLease', 'leaseNumber')) || 'Not created',
      },
    ],
  },
  'move-ins': {
    eyebrow: 'Leasing',
    title: 'Move-In',
    description: 'Coordinate possession handover for an active Lease.',
    permission: 'move-in.read',
    endpoint: '/move-ins',
    empty: 'No Move-In workflows match the current filters.',
    statuses: ['SCHEDULED', 'COMPLETED', 'CANCELLED'],
    columns: [
      { label: 'Lease', value: (row) => text(nested(row, 'lease', 'leaseNumber')) },
      {
        label: 'Rentable Space',
        value: (row) => text(nested(row, 'lease', 'rentableSpace', 'name')),
      },
      {
        label: 'Tenant',
        value: (row) => {
          const parties = nested(row, 'lease', 'parties') as Array<Record<string, unknown>> | undefined;
          return (
            parties
              ?.map((party) => text(nested(party as Row, 'party', 'displayName')))
              .filter(Boolean)
              .join(', ') || '—'
          );
        },
      },
      { label: 'Scheduled Date', value: (row) => date(row.scheduledDate) },
    ],
  },
};

export function Phase5Register({ mode }: { mode: Mode }) {
  const definition = config[mode];
  const { principal, error } = useOperationsPrincipal();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('');
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    setCursors([undefined]);
    setPage(0);
  }, [debounced, status]);

  const path = useMemo(() => {
    const params = new URLSearchParams({ limit: '25' });
    if (debounced) params.set('search', debounced);
    if (status) params.set('status', status);
    const cursor = cursors[page];
    if (cursor) params.set('cursor', cursor);
    return `${definition.endpoint}?${params}`;
  }, [cursors, debounced, definition.endpoint, page, status]);

  const query = useQuery({
    queryKey: ['phase5-register', mode, path],
    enabled: Boolean(principal && hasPermission(principal, definition.permission)),
    queryFn: () => api<CursorPage<Row> & { total?: number }>(path),
  });

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    ...(definition.statuses?.map((value) => ({ value, label: humanize(value) })) ?? []),
  ];

  const emptyTitle = debounced || status ? 'No matching records' : `No ${definition.title} yet`;
  const emptyAction = definition.action ? (
    <Link className="button primary" href={definition.action.href}>
      {definition.action.label}
    </Link>
  ) : undefined;

  return (
    <OperationsShell principal={principal} error={error} activeItem={mode}>
      <PageHeader
        eyebrow={definition.eyebrow}
        title={definition.title}
        description={definition.description}
        action={
          <div className="flex flex-wrap gap-2">
            {definition.action ? (
              <Link className="button secondary" href={definition.action.href}>
                {definition.action.label}
              </Link>
            ) : null}
            {principal ? (
              <Phase5CreateAction mode={mode} principal={principal} onSuccess={() => void query.refetch()} />
            ) : null}
          </div>
        }
      />

      <DataTableSurface className="mt-6">
        <DataTableToolbar>
          <label className="block min-w-0 flex-1">
            <span className="mb-1 block text-[12px] font-semibold text-slate-500">Search</span>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                className="w-full rounded-lg border border-slate-200 py-2 pl-10 pr-3 text-[14px] shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={`Search ${definition.title}`}
              />
            </div>
          </label>
          {definition.statuses ? (
            <DataTableFilter
              label="Status"
              value={status}
              onChange={setStatus}
              options={statusOptions}
            />
          ) : null}
          <DataTableActions>
            <DataTableResetButton
              onClick={() => {
                setSearch('');
                setStatus('');
              }}
            />
          </DataTableActions>
        </DataTableToolbar>

        {query.isLoading ? (
          <TableSkeleton columns={definition.columns.length + 2} />
        ) : query.isError ? (
          <DataTableError
            message={userFacingError(query.error)}
            onRetry={() => void query.refetch()}
          />
        ) : !query.data?.items.length ? (
          <DataTableEmpty title={emptyTitle} description={definition.empty} action={emptyAction} />
        ) : (
          <>
            <DataTableMobileCards>
              {query.data.items.map((row) => (
                <DataTableMobileCard
                  key={row.id}
                  title={definition.columns[0]?.value(row) ?? row.id}
                  subtitle={definition.columns[1]?.value(row)}
                  rows={[
                    ...definition.columns.slice(2).map((column) => ({
                      label: column.label,
                      value: column.value(row) ?? '—',
                    })),
                    { label: 'Status', value: <StatusBadge value={row.status ?? 'ACTIVE'} /> },
                  ]}
                  actions={
                    <Phase5RowAction mode={mode} row={row} onSuccess={() => void query.refetch()} />
                  }
                />
              ))}
            </DataTableMobileCards>

            <DataTableDesktopOnly>
              <DataTableScroll>
                <DataTable minWidth={860}>
                  <DataTableHead>
                    <tr>
                      {definition.columns.map((column) => (
                        <DataTableHeaderCell key={column.label}>{column.label}</DataTableHeaderCell>
                      ))}
                      <DataTableHeaderCell>Status</DataTableHeaderCell>
                      <DataTableHeaderCell align="right">Actions</DataTableHeaderCell>
                    </tr>
                  </DataTableHead>
                  <DataTableBody>
                    {query.data.items.map((row) => (
                      <DataTableRow key={row.id}>
                        {definition.columns.map((column) => (
                          <DataTableCell key={column.label}>{column.value(row) ?? '—'}</DataTableCell>
                        ))}
                        <DataTableCell>
                          <StatusBadge value={row.status ?? 'ACTIVE'} />
                        </DataTableCell>
                        <DataTableCell align="right">
                          <Phase5RowAction
                            mode={mode}
                            row={row}
                            onSuccess={() => void query.refetch()}
                          />
                        </DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              </DataTableScroll>
            </DataTableDesktopOnly>
          </>
        )}

        <CursorPaginationControls
          page={page + 1}
          itemCount={query.data?.items.length ?? 0}
          hasPrevious={page > 0}
          hasNext={Boolean(query.data?.pageInfo.hasNextPage)}
          busy={query.isFetching}
          onPrevious={() => setPage((value) => Math.max(0, value - 1))}
          onNext={() => {
            const next = query.data?.pageInfo.nextCursor;
            if (!next) return;
            setCursors((current) => {
              const copy = current.slice(0, page + 1);
              copy[page + 1] = next;
              return copy;
            });
            setPage((value) => value + 1);
          }}
        />
      </DataTableSurface>
    </OperationsShell>
  );
}
