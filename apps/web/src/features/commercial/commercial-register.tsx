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
import { CommercialShell, useCommercialPrincipal } from './commercial-shell';

export type CommercialRegisterMode = 'brokerage-deals' | 'sale-offers' | 'sale-settlements';

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
const money = (currency: unknown, amount: unknown) =>
  scalar(amount) ? `${text(currency)} ${scalar(amount)}` : 'Not set';

const config: Record<
  CommercialRegisterMode,
  {
    activeItem: string;
    eyebrow: string;
    title: string;
    description: string;
    permission: string;
    endpoint: string;
    empty: string;
    detailPath?: (id: string) => string;
    createHref?: string;
    createLabel?: string;
    createPermission?: string;
    statuses?: string[];
    columns: Column[];
  }
> = {
  'brokerage-deals': {
    activeItem: 'commercial:rental-brokerage',
    eyebrow: 'Commercial',
    title: 'Rental Brokerage Deals',
    description: 'Closed and in-progress placement deals under rental brokerage authority.',
    permission: 'brokerage-deal.read',
    endpoint: '/brokerage-deals',
    empty: 'No Brokerage Deals match the current filters.',
    detailPath: (id) => `/commercial/rental-brokerage/${id}`,
    createHref: '/commercial/rental-brokerage/new',
    createLabel: 'Create Deal',
    createPermission: 'brokerage-deal.manage',
    statuses: ['DRAFT', 'NEGOTIATING', 'CONFIRMED', 'CLOSED', 'CANCELLED'],
    columns: [
      { label: 'Deal', value: (row) => row.dealNumber as string },
      {
        label: 'Rentable Space',
        value: (row) =>
          `${text(nested(row, 'rentableSpace', 'spaceCode'))} — ${text(nested(row, 'rentableSpace', 'name'))}`,
      },
      {
        label: 'Lead',
        value: (row) =>
          `${text(nested(row, 'lead', 'leadNumber'))} — ${text(nested(row, 'lead', 'displayName'))}`,
      },
      { label: 'Commission', value: (row) => money(row.currency, row.grossCommission) },
      { label: 'Closed', value: (row) => date(row.closedAt) },
    ],
  },
  'sale-offers': {
    activeItem: 'commercial:offers',
    eyebrow: 'Commercial',
    title: 'Sale Offers',
    description: 'Offer register and negotiation history for authorized property sales.',
    permission: 'sale-offer.read',
    endpoint: '/sale-offers',
    empty: 'No Sale Offers match the current filters.',
    detailPath: (id) => `/commercial/offers/${id}`,
    createHref: '/commercial/offers/new',
    createLabel: 'Create Offer',
    createPermission: 'sale-offer.manage',
    statuses: ['DRAFT', 'SUBMITTED', 'COUNTERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'],
    columns: [
      { label: 'Offer', value: (row) => row.offerNumber as string },
      {
        label: 'Property',
        value: (row) =>
          `${text(nested(row, 'property', 'propertyCode'))} — ${text(nested(row, 'property', 'name'))}`,
      },
      { label: 'Buyer', value: (row) => text(nested(row, 'buyer', 'displayName')) || 'Not linked' },
      { label: 'Offer Amount', value: (row) => money(row.currency, row.offerAmount) },
      { label: 'Offer Date', value: (row) => date(row.offerDate) },
    ],
  },
  'sale-settlements': {
    activeItem: 'commercial:settlements',
    eyebrow: 'Commercial',
    title: 'Sale Settlements',
    description: 'Settlement batches, commission splits, and closing outcomes for accepted offers.',
    permission: 'sale-settlement.read',
    endpoint: '/sale-settlements',
    empty: 'No Sale Settlements match the current filters.',
    detailPath: (id) => `/commercial/settlements/${id}`,
    createHref: '/commercial/settlements/new',
    createLabel: 'Create Settlement',
    createPermission: 'sale-settlement.manage',
    statuses: ['DRAFT', 'APPROVED', 'SETTLED', 'CANCELLED'],
    columns: [
      { label: 'Settlement', value: (row) => row.settlementNumber as string },
      {
        label: 'Property',
        value: (row) =>
          `${text(nested(row, 'property', 'propertyCode'))} — ${text(nested(row, 'property', 'name'))}`,
      },
      {
        label: 'Offer',
        value: (row) => text(nested(row, 'saleOffer', 'offerNumber')),
      },
      { label: 'Sale Price', value: (row) => money(row.currency, row.salePrice) },
      { label: 'Closing', value: (row) => date(row.closingDate) },
    ],
  },
};

function AccessDenied() {
  return (
    <DataTableEmpty
      title="Access restricted"
      description="Your current access does not include this Commercial workspace."
    />
  );
}

export function CommercialRegister({ mode }: { mode: CommercialRegisterMode }) {
  const definition = config[mode];
  const { principal } = useCommercialPrincipal();
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

  const allowed = Boolean(principal && hasPermission(principal, definition.permission));
  const query = useQuery({
    queryKey: ['commercial-register', mode, path],
    enabled: allowed,
    queryFn: () => api<CursorPage<Row>>(path),
  });

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    ...(definition.statuses?.map((value) => ({ value, label: humanize(value) })) ?? []),
  ];

  const emptyTitle = debounced || status ? 'No matching records' : `No ${definition.title} yet`;

  return (
    <CommercialShell principal={principal} activeItem={definition.activeItem}>
      <PageHeader
        eyebrow={definition.eyebrow}
        title={definition.title}
        description={definition.description}
        action={
          definition.createHref &&
          principal &&
          definition.createPermission &&
          hasPermission(principal, definition.createPermission) ? (
            <Link className="button primary" href={definition.createHref}>
              {definition.createLabel}
            </Link>
          ) : null
        }
      />

      {principal && !allowed ? (
        <AccessDenied />
      ) : (
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
            <TableSkeleton columns={definition.columns.length + 1} />
          ) : query.isError ? (
            <DataTableError
              message={userFacingError(query.error)}
              onRetry={() => void query.refetch()}
            />
          ) : !query.data?.items.length ? (
            <DataTableEmpty title={emptyTitle} description={definition.empty} />
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
                      definition.detailPath ? (
                        <Link className="button secondary text-[13px]" href={definition.detailPath(row.id)}>
                          Open
                        </Link>
                      ) : undefined
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
                        {definition.detailPath ? (
                          <DataTableHeaderCell align="right">Actions</DataTableHeaderCell>
                        ) : null}
                      </tr>
                    </DataTableHead>
                    <DataTableBody>
                      {query.data.items.map((row) => (
                        <DataTableRow key={row.id}>
                          {definition.columns.map((column) => (
                            <DataTableCell key={column.label}>
                              {column.value(row) ?? '—'}
                            </DataTableCell>
                          ))}
                          <DataTableCell>
                            <StatusBadge value={row.status ?? 'ACTIVE'} />
                          </DataTableCell>
                          {definition.detailPath ? (
                            <DataTableCell align="right">
                              <Link
                                className="button ghost text-[13px]"
                                href={definition.detailPath(row.id)}
                              >
                                Open
                              </Link>
                            </DataTableCell>
                          ) : null}
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
      )}
    </CommercialShell>
  );
}
