'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import toast from '@/lib/toast';
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
import { useCreateDrawerState } from '@/components/shared/use-create-drawer-state';
import {
  WorkspaceFormDrawer,
  WorkspaceFormDrawerFooter,
} from '@/components/shared/workspace-form-drawer';
import { api, hasPermission, type CursorPage, type Principal, userFacingError } from '@/lib/phase3-api';
import { formatDate, humanize } from '@/lib/presentation';
import { BranchSelect } from '@/features/finance/finance-forms';
import { OperationsShell, useOperationsPrincipal } from './operations-shell';

export type OperationsRegisterMode = 'maintenance' | 'work-orders' | 'inspections' | 'vendors';

type RecordValue = string | number | null | undefined;
type Row = Record<string, unknown> & { id: string; status?: string; partyId?: string };
type Column = { label: string; value: (row: Row) => RecordValue };

const nested = (row: Row, ...keys: string[]): unknown =>
  keys.reduce<unknown>(
    (value, key) =>
      value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined,
    row,
  );
const text = (value: unknown) => (typeof value === 'string' ? value : '');
const date = (value: unknown) => formatDate(value);

const config: Record<
  OperationsRegisterMode,
  {
    activeItem: string;
    title: string;
    description: string;
    permission: string;
    managePermission: string;
    endpoint: string;
    empty: string;
    detailPath: (id: string) => string;
    statuses?: string[];
    columns: Column[];
  }
> = {
  maintenance: {
    activeItem: 'operations:maintenance',
    title: 'Maintenance Register',
    description: 'Property and tenant maintenance requests with assignment and history.',
    permission: 'maintenance.read',
    managePermission: 'maintenance.manage',
    endpoint: '/maintenance-requests',
    empty: 'No Maintenance Requests match the current filters.',
    detailPath: (id) => `/operations/maintenance/${id}`,
    statuses: ['NEW', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'],
    columns: [
      { label: 'Request', value: (row) => text(row.requestNumber) },
      { label: 'Title', value: (row) => text(row.title) },
      {
        label: 'Property',
        value: (row) => `${text(nested(row, 'property', 'propertyCode'))} — ${text(nested(row, 'property', 'name'))}`,
      },
      { label: 'Priority', value: (row) => humanize(text(row.priority)) },
      { label: 'Reported', value: (row) => date(row.reportedAt) },
    ],
  },
  'work-orders': {
    activeItem: 'operations:work-orders',
    title: 'Work Order Register',
    description: 'Scheduled and completed maintenance work with cost and approval status.',
    permission: 'work-order.read',
    managePermission: 'work-order.manage',
    endpoint: '/work-orders',
    empty: 'No Work Orders match the current filters.',
    detailPath: (id) => `/operations/work-orders/${id}`,
    statuses: ['DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'],
    columns: [
      { label: 'Work Order', value: (row) => text(row.workOrderNumber) },
      { label: 'Request', value: (row) => text(nested(row, 'request', 'requestNumber')) || 'Manual' },
      {
        label: 'Property',
        value: (row) => `${text(nested(row, 'property', 'propertyCode'))} — ${text(nested(row, 'property', 'name'))}`,
      },
      { label: 'Scheduled', value: (row) => date(row.scheduledAt) },
      { label: 'Approval', value: (row) => humanize(text(row.approvalStatus)) },
    ],
  },
  inspections: {
    activeItem: 'operations:inspections',
    title: 'Inspection Register',
    description: 'Move-in, move-out, periodic, property, and maintenance inspections.',
    permission: 'inspection.read',
    managePermission: 'inspection.manage',
    endpoint: '/inspections',
    empty: 'No Inspections match the current filters.',
    detailPath: (id) => `/operations/inspections/${id}`,
    statuses: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
    columns: [
      { label: 'Inspection', value: (row) => text(row.inspectionNumber) },
      { label: 'Type', value: (row) => humanize(text(row.type)) },
      {
        label: 'Property',
        value: (row) => `${text(nested(row, 'property', 'propertyCode'))} — ${text(nested(row, 'property', 'name'))}`,
      },
      { label: 'Scheduled', value: (row) => date(row.scheduledAt) },
      { label: 'Completed', value: (row) => date(row.completedAt) },
    ],
  },
  vendors: {
    activeItem: 'operations:vendors',
    title: 'Vendor Register',
    description: 'Service providers available to authorized branches.',
    permission: 'vendor.read',
    managePermission: 'vendor.manage',
    endpoint: '/vendors',
    empty: 'No Vendors match the current filters.',
    detailPath: (id) => `/operations/vendors/${id}`,
    columns: [
      { label: 'Vendor', value: (row) => text(nested(row, 'party', 'displayName')) },
      { label: 'Number', value: (row) => text(nested(row, 'party', 'partyNumber')) },
      { label: 'Kind', value: (row) => humanize(text(nested(row, 'party', 'kind'))) },
      { label: 'Active', value: (row) => (row.active === false ? 'Inactive' : 'Active') },
    ],
  },
};

const drawerCopy: Record<
  OperationsRegisterMode,
  { actionLabel: string; title: string; description: string; submitLabel: string; formId: string }
> = {
  maintenance: {
    actionLabel: 'Add request',
    title: 'Add maintenance request',
    description: 'Log a property or tenant maintenance request for the selected branch.',
    submitLabel: 'Add request',
    formId: 'create-maintenance-form',
  },
  'work-orders': {
    actionLabel: 'Add work order',
    title: 'Add work order',
    description: 'Schedule maintenance work for the selected property.',
    submitLabel: 'Add work order',
    formId: 'create-work-order-form',
  },
  inspections: {
    actionLabel: 'Add inspection',
    title: 'Add inspection',
    description: 'Schedule a periodic inspection for the selected property.',
    submitLabel: 'Add inspection',
    formId: 'create-inspection-form',
  },
  vendors: {
    actionLabel: 'Add vendor',
    title: 'Add vendor',
    description: 'Register a service provider for the selected branch.',
    submitLabel: 'Add vendor',
    formId: 'create-vendor-form',
  },
};

function AccessDenied() {
  return (
    <DataTableEmpty
      title="Access restricted"
      description="Your current access does not include this Operations workspace."
    />
  );
}

export function OperationsRegister({ mode }: { mode: OperationsRegisterMode }) {
  const definition = config[mode];
  const copy = drawerCopy[mode];
  const { principal } = useOperationsPrincipal();
  const queryClient = useQueryClient();
  const { createOpen, openCreate, closeCreate } = useCreateDrawerState();
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
  const canManage = Boolean(principal && hasPermission(principal, definition.managePermission));
  const query = useQuery({
    queryKey: ['operations-register', mode, path],
    enabled: allowed,
    queryFn: () => api<CursorPage<Row>>(path),
  });

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    ...(definition.statuses?.map((value) => ({ value, label: humanize(value) })) ?? []),
  ];
  const emptyTitle = debounced || status ? 'No matching records' : `No ${definition.title} yet`;

  return (
    <OperationsShell principal={principal} activeItem={definition.activeItem}>
      <PageHeader
        eyebrow="Operations"
        title={definition.title}
        description={definition.description}
        action={
          canManage ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-800"
              onClick={openCreate}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {copy.actionLabel}
            </button>
          ) : undefined
        }
      />
      {principal && canManage ? (
        <CreateOperationsRecord
          mode={mode}
          principal={principal}
          open={createOpen}
          onClose={closeCreate}
          onCreated={() => {
            closeCreate();
            void queryClient.invalidateQueries({ queryKey: ['operations-register', mode] });
          }}
        />
      ) : null}
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
              <DataTableFilter label="Status" value={status} onChange={setStatus} options={statusOptions} />
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
            <DataTableError message={userFacingError(query.error)} onRetry={() => void query.refetch()} />
          ) : !query.data?.items.length ? (
            <DataTableEmpty
              title={emptyTitle}
              description={definition.empty}
              action={
                canManage && !debounced && !status ? (
                  <button type="button" className="button primary" onClick={openCreate}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    {copy.actionLabel}
                  </button>
                ) : undefined
              }
            />
          ) : (
            <>
              <DataTableMobileCards>
                {query.data.items.map((row) => {
                  const id = mode === 'vendors' ? text(row.partyId) || row.id : row.id;
                  return (
                    <DataTableMobileCard
                      key={id}
                      title={definition.columns[0]?.value(row) ?? id}
                      subtitle={definition.columns[1]?.value(row)}
                      rows={[
                        ...definition.columns.slice(2).map((column) => ({
                          label: column.label,
                          value: column.value(row) ?? '—',
                        })),
                        { label: 'Status', value: <StatusBadge value={text(row.status) || 'ACTIVE'} /> },
                      ]}
                    />
                  );
                })}
              </DataTableMobileCards>
              <DataTableDesktopOnly>
                <DataTableScroll>
                  <DataTable>
                    <DataTableHead>
                      <tr>
                        {definition.columns.map((column) => (
                          <DataTableHeaderCell key={column.label}>{column.label}</DataTableHeaderCell>
                        ))}
                        <DataTableHeaderCell>Status</DataTableHeaderCell>
                      </tr>
                    </DataTableHead>
                    <DataTableBody>
                      {query.data.items.map((row) => {
                        const id = mode === 'vendors' ? text(row.partyId) || row.id : row.id;
                        return (
                          <DataTableRow key={id}>
                            {definition.columns.map((column, index) => (
                              <DataTableCell key={column.label}>
                                {index === 0 ? (
                                  <Link className="text-emerald-700" href={definition.detailPath(id)}>
                                    {column.value(row) ?? id}
                                  </Link>
                                ) : (
                                  (column.value(row) ?? '—')
                                )}
                              </DataTableCell>
                            ))}
                            <DataTableCell>
                              <StatusBadge value={text(row.status) || (row.active === false ? 'INACTIVE' : 'ACTIVE')} />
                            </DataTableCell>
                          </DataTableRow>
                        );
                      })}
                    </DataTableBody>
                  </DataTable>
                </DataTableScroll>
              </DataTableDesktopOnly>
              <CursorPaginationControls
                page={page + 1}
                itemCount={query.data.items.length}
                hasPrevious={page > 0}
                hasNext={Boolean(query.data.pageInfo.hasNextPage)}
                busy={query.isFetching}
                onPrevious={() => setPage((current) => Math.max(0, current - 1))}
                onNext={() => {
                  const next = query.data.pageInfo.nextCursor;
                  if (!next) return;
                  setCursors((current) => [...current.slice(0, page + 1), next]);
                  setPage((current) => current + 1);
                }}
              />
            </>
          )}
        </DataTableSurface>
      )}
    </OperationsShell>
  );
}

function CreateOperationsRecord({
  mode,
  principal,
  open,
  onClose,
  onCreated,
}: {
  mode: OperationsRegisterMode;
  principal: Principal;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const copy = drawerCopy[mode];
  const [propertyId, setPropertyId] = useState('');
  const [branchId, setBranchId] = useState(principal.branches[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    if (!open) return;
    setPropertyId('');
    setBranchId(principal.branches[0]?.id ?? '');
    setTitle('');
    setDescription('');
    setDisplayName('');
  }, [open, principal.branches]);

  const properties = useQuery({
    queryKey: ['operations-properties'],
    enabled: open && mode !== 'vendors',
    queryFn: () => api<CursorPage<{ id: string; name: string; propertyCode: string }>>('/properties?limit=50'),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!branchId) throw new Error('Choose a branch before creating this record.');
      if (mode === 'vendors') {
        return api('/vendors', {
          method: 'POST',
          body: JSON.stringify({
            kind: 'ORGANIZATION',
            displayName,
            branchIds: [branchId],
            services: [{ categoryCode: 'GENERAL', name: 'General services' }],
          }),
        });
      }
      if (mode === 'inspections') {
        return api('/inspections', {
          method: 'POST',
          body: JSON.stringify({
            branchId,
            type: 'PERIODIC',
            propertyId,
            scheduledAt: new Date().toISOString(),
            notes: description || undefined,
            items: [{ area: 'General', item: 'Overall condition', condition: 'GOOD' }],
          }),
        });
      }
      if (mode === 'work-orders') {
        return api('/work-orders', {
          method: 'POST',
          body: JSON.stringify({
            branchId,
            propertyId,
            currency: 'USD',
            laborNotes: description || undefined,
          }),
        });
      }
      return api('/maintenance-requests', {
        method: 'POST',
        body: JSON.stringify({
          branchId,
          propertyId,
          title,
          description,
          categoryCode: 'GENERAL',
          priority: 'MEDIUM',
        }),
      });
    },
    onSuccess: () => {
      toast.success('Record created.');
      onCreated();
    },
    onError: (cause) => toast.error(userFacingError(cause)),
  });

  const ready =
    Boolean(branchId) &&
    (mode === 'vendors'
      ? Boolean(displayName.trim())
      : mode === 'maintenance'
        ? Boolean(propertyId && title.trim() && description.trim())
        : Boolean(propertyId));

  return (
    <WorkspaceFormDrawer
      open={open}
      eyebrow="Operations"
      title={copy.title}
      description={copy.description}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
      size="md"
      footer={
        <WorkspaceFormDrawerFooter
          formId={copy.formId}
          onCancel={onClose}
          submitLabel={copy.submitLabel}
          isPending={mutation.isPending}
          disabled={!ready}
        />
      }
    >
      <form
        id={copy.formId}
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!ready) {
            toast.error('Complete the required fields before saving.');
            return;
          }
          mutation.mutate();
        }}
      >
        <BranchSelect
          branches={principal.branches}
          value={branchId}
          onChange={setBranchId}
          label="Branch"
        />
        {mode === 'vendors' ? (
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-slate-500">Vendor name</span>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px]"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
              autoFocus
            />
          </label>
        ) : (
          <>
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-slate-500">Property</span>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px]"
                value={propertyId}
                onChange={(event) => setPropertyId(event.target.value)}
                required
                autoFocus
              >
                <option value="">Select property</option>
                {(properties.data?.items ?? []).map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.propertyCode} — {property.name}
                  </option>
                ))}
              </select>
            </label>
            {mode === 'maintenance' ? (
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-slate-500">Title</span>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px]"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                />
              </label>
            ) : null}
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-slate-500">
                {mode === 'maintenance' ? 'Description' : 'Notes'}
              </span>
              <textarea
                className="min-h-[96px] w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px]"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required={mode === 'maintenance'}
              />
            </label>
          </>
        )}
      </form>
    </WorkspaceFormDrawer>
  );
}
