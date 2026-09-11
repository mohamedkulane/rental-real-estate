'use client';

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
import { FinanceAccessDenied } from './finance-shared';
import { FinanceShell, useFinancePrincipal } from './finance-shell';

export type FinanceRegisterMode =
  | 'invoices'
  | 'payments'
  | 'owner-statements'
  | 'owner-payouts'
  | 'expenses'
  | 'accounting';

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
  FinanceRegisterMode,
  {
    activeItem: string;
    eyebrow: string;
    title: string;
    description: string;
    permission: string;
    endpoint: string;
    empty: string;
    statuses?: string[];
    columns: Column[];
  }
> = {
  invoices: {
    activeItem: 'finance:invoices',
    eyebrow: 'Finance',
    title: 'Invoices',
    description: 'Issued tenant and debtor invoices with branch-scoped visibility.',
    permission: 'invoice.read',
    endpoint: '/invoices',
    empty: 'No Invoices match the current filters.',
    statuses: ['DRAFT', 'ISSUED', 'VOID'],
    columns: [
      { label: 'Invoice', value: (row) => row.invoiceNumber as string },
      { label: 'Debtor', value: (row) => text(nested(row, 'debtor', 'displayName')) },
      { label: 'Issue Date', value: (row) => date(row.issueDate) },
      { label: 'Due Date', value: (row) => date(row.dueDate) },
      { label: 'Currency', value: (row) => text(row.currency) },
    ],
  },
  payments: {
    activeItem: 'finance:payments',
    eyebrow: 'Finance',
    title: 'Payments',
    description: 'Manual payment capture, verification, allocation, and receipt issuance.',
    permission: 'payment.read',
    endpoint: '/payments',
    empty: 'No Payments match the current filters.',
    statuses: [
      'CAPTURED',
      'VERIFYING',
      'VERIFIED',
      'POSTED',
      'PARTIALLY_ALLOCATED',
      'FULLY_ALLOCATED',
      'REJECTED',
      'REVERSED',
    ],
    columns: [
      { label: 'Payment', value: (row) => row.paymentNumber as string },
      { label: 'Payer', value: (row) => text(nested(row, 'payer', 'displayName')) },
      { label: 'Received', value: (row) => date(row.receivedAt) },
      { label: 'Amount', value: (row) => money(row.currency, row.amount) },
      { label: 'Method', value: (row) => text(nested(row, 'method', 'name')) },
    ],
  },
  'owner-statements': {
    activeItem: 'finance:owner-statements',
    eyebrow: 'Finance',
    title: 'Owner Statements',
    description: 'Immutable owner statement snapshots for managed properties.',
    permission: 'owner-statement.read',
    endpoint: '/owner-statements',
    empty: 'No Owner Statements match the current filters.',
    statuses: ['DRAFT', 'ISSUED', 'SUPERSEDED'],
    columns: [
      { label: 'Statement', value: (row) => row.statementNumber as string },
      { label: 'Owner', value: (row) => text(nested(row, 'owner', 'displayName')) },
      {
        label: 'Period',
        value: (row) => `${date(row.periodStart)} — ${date(row.periodEnd)}`,
      },
      { label: 'Currency', value: (row) => text(row.currency) },
      { label: 'Issued', value: (row) => date(row.issuedAt) },
    ],
  },
  'owner-payouts': {
    activeItem: 'finance:owner-payouts',
    eyebrow: 'Finance',
    title: 'Owner Payouts',
    description: 'Review, approve, and track owner payout batches with joint ownership splits.',
    permission: 'payout.read',
    endpoint: '/owner-payouts',
    empty: 'No Owner Payouts match the current filters.',
    statuses: [
      'DRAFT',
      'REVIEW',
      'APPROVED',
      'QUEUED',
      'PROCESSING',
      'PAID',
      'RECONCILED',
      'HELD',
    ],
    columns: [
      { label: 'Payout', value: (row) => row.payoutNumber as string },
      { label: 'Owner', value: (row) => text(nested(row, 'owner', 'displayName')) },
      {
        label: 'Period',
        value: (row) => `${date(row.periodStart)} — ${date(row.periodEnd)}`,
      },
      { label: 'Net Payable', value: (row) => money(row.currency, row.netPayable) },
      {
        label: 'Property',
        value: (row) => text(nested(row, 'property', 'name')) || 'Portfolio scope',
      },
    ],
  },
  expenses: {
    activeItem: 'finance:expenses',
    eyebrow: 'Finance',
    title: 'Expenses',
    description: 'Property and owner-billable expenses with approval and posting controls.',
    permission: 'expense.read',
    endpoint: '/expenses',
    empty: 'No Expenses match the current filters.',
    statuses: [
      'DRAFT',
      'SUBMITTED',
      'REVIEW',
      'APPROVED',
      'POSTED',
      'PAID',
      'RECONCILED',
      'REJECTED',
    ],
    columns: [
      { label: 'Expense', value: (row) => row.expenseNumber as string },
      { label: 'Category', value: (row) => humanize(text(row.categoryCode)) },
      { label: 'Business Date', value: (row) => date(row.businessDate) },
      { label: 'Amount', value: (row) => money(row.currency, row.amount) },
      {
        label: 'Property',
        value: (row) => text(nested(row, 'property', 'name')) || 'Not linked',
      },
    ],
  },
  accounting: {
    activeItem: 'finance:accounting',
    eyebrow: 'Finance',
    title: 'Accounting',
    description: 'Journal entries, posting status, and reversal traceability.',
    permission: 'journal.read',
    endpoint: '/journals',
    empty: 'No Journal Entries match the current filters.',
    statuses: ['DRAFT', 'POSTED', 'REVERSED'],
    columns: [
      { label: 'Journal', value: (row) => row.journalNumber as string },
      { label: 'Business Date', value: (row) => date(row.businessDate) },
      { label: 'Description', value: (row) => text(row.description) },
      { label: 'Currency', value: (row) => text(row.currency) },
      { label: 'Posted', value: (row) => date(row.postedAt) },
    ],
  },
};

export function FinanceRegister({ mode }: { mode: FinanceRegisterMode }) {
  const definition = config[mode];
  const { principal, error: principalError } = useFinancePrincipal();
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
    queryKey: ['finance-register', mode, path],
    enabled: allowed,
    queryFn: () => api<CursorPage<Row>>(path),
  });

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    ...(definition.statuses?.map((value) => ({ value, label: humanize(value) })) ?? []),
  ];

  const emptyTitle = debounced || status ? 'No matching records' : `No ${definition.title} yet`;

  return (
    <FinanceShell
      principal={principal}
      principalError={principalError}
      activeItem={definition.activeItem}
    >
      <PageHeader
        eyebrow={definition.eyebrow}
        title={definition.title}
        description={definition.description}
      />

      {principal && !allowed ? (
        <FinanceAccessDenied />
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
    </FinanceShell>
  );
}
