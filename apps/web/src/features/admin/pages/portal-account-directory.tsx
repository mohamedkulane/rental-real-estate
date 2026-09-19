'use client';

import { SearchableSelect } from '@/components/shared/searchable-select';
import {
  Eye,
  Globe,
  MoreHorizontal,
  Plus,
  Search,
  ShieldAlert,
  UserRound,
  X,
} from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { humanize } from '@/lib/presentation';
import { PaginationControls, usePagination } from '@/components/shared/pagination';
import { StatusBadge } from '@/components/shared/ui';

export type PortalAccountRecord = {
  id: string;
  portalType: 'OWNER' | 'TENANT';
  active: boolean;
  createdAt: string;
  updatedAt: string;
  partyId: string;
  userId: string;
  party: {
    id: string;
    displayName: string;
    partyNumber: string;
  };
  user: {
    id: string;
    emailNormalized: string;
    status: string;
  };
};

export type PortalPartyOption = {
  partyId: string;
  label: string;
  partyNumber?: string;
};

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0D47A1] focus:ring-2 focus:ring-[#E3F2FD]';
const value = (form: FormData, key: string) => {
  const entry = form.get(key);
  return typeof entry === 'string' ? entry.trim() : '';
};
const format = (input: string) =>
  new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(input),
  );

function Drawer({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/40"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Close panel" />
      <aside className="relative max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl scroll-smooth">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
          <div>
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 p-2"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="p-6">{children}</div>
      </aside>
    </div>
  );
}

export function PortalAccountDirectory({
  records,
  ownerOptions,
  tenantOptions,
  busy,
  canCreate,
  canUpdate,
  onCreate,
  onStatus,
}: {
  records: PortalAccountRecord[];
  ownerOptions: PortalPartyOption[];
  tenantOptions: PortalPartyOption[];
  busy: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  onCreate: (input: Record<string, unknown>) => Promise<void>;
  onStatus: (portalAccountId: string, input: Record<string, unknown>) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [portalTypeFilter, setPortalTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<PortalAccountRecord | null>(null);
  const [mode, setMode] = useState<'view' | 'create' | 'status' | null>(null);
  const [createPortalType, setCreatePortalType] = useState<'OWNER' | 'TENANT'>('OWNER');
  const [createError, setCreateError] = useState('');

  const linkedPartyIds = useMemo(
    () => new Set(records.map((record) => record.partyId)),
    [records],
  );
  const availableOwnerOptions = useMemo(
    () => ownerOptions.filter((option) => !linkedPartyIds.has(option.partyId)),
    [ownerOptions, linkedPartyIds],
  );
  const availableTenantOptions = useMemo(
    () => tenantOptions.filter((option) => !linkedPartyIds.has(option.partyId)),
    [tenantOptions, linkedPartyIds],
  );
  const partyOptions =
    createPortalType === 'OWNER' ? availableOwnerOptions : availableTenantOptions;

  const filtered = useMemo(
    () =>
      records.filter((record) => {
        const search = query.trim().toLowerCase();
        return (
          (!search ||
            [
              record.user.emailNormalized,
              record.party.displayName,
              record.party.partyNumber,
            ]
              .join(' ')
              .toLowerCase()
              .includes(search)) &&
          (portalTypeFilter === 'all' || record.portalType === portalTypeFilter) &&
          (statusFilter === 'all' ||
            (statusFilter === 'active' ? record.active : !record.active))
        );
      }),
    [records, query, portalTypeFilter, statusFilter],
  );
  const pagination = usePagination(filtered);
  useEffect(() => pagination.setPage(1), [query, portalTypeFilter, statusFilter]);

  const close = () => {
    setSelected(null);
    setMode(null);
    setCreateError('');
  };
  const openCreate = () => {
    setCreatePortalType('OWNER');
    setCreateError('');
    setMode('create');
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            External access
          </p>
          <h1 className="text-2xl font-bold sm:text-3xl">Portal accounts</h1>
          <p className="mt-1 text-sm text-slate-500">
            Give owners and tenants their own login. Each email must be unique and linked to one
            party only.
          </p>
        </div>
        {canCreate ? (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0D47A1] px-4 py-2.5 text-sm font-bold text-white"
          >
            <Plus className="h-4 w-4" />
            Enable portal login
          </button>
        ) : null}
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-semibold text-slate-500">All portal accounts</span>
          <strong className="mt-1 block text-2xl">{records.length}</strong>
        </div>
        <div className="rounded-xl border border-[#90CAF9] bg-[#E3F2FD] p-4">
          <span className="text-xs font-semibold text-[#0D47A1]">Active logins</span>
          <strong className="mt-1 block text-2xl text-[#0D47A1]">
            {records.filter((item) => item.active).length}
          </strong>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-semibold text-slate-500">Owner portals</span>
          <strong className="mt-1 block text-2xl">
            {records.filter((item) => item.portalType === 'OWNER').length}
          </strong>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-[minmax(260px,1fr)_180px_180px]">
          <label className="relative">
            <span className="sr-only">Search portal accounts</span>
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search party, number, or email…"
              className={inputClass + ' pl-10'}
            />
          </label>
          <SearchableSelect
            searchable={false}
            value={portalTypeFilter}
            onChange={(event) => setPortalTypeFilter(event.target.value)}
            className={inputClass}
            aria-label="Filter portal type"
          >
            <option value="all">All portal types</option>
            <option value="OWNER">Owner</option>
            <option value="TENANT">Tenant</option>
          </SearchableSelect>
          <SearchableSelect
            searchable={false}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className={inputClass}
            aria-label="Filter portal status"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </SearchableSelect>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {['Party', 'Portal type', 'Login email', 'Status', 'Created', 'Actions'].map(
                  (header) => (
                    <th
                      key={header}
                      className={
                        'px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 ' +
                        (header === 'Actions' ? 'text-right' : '')
                      }
                    >
                      {header}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagination.pageItems.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(record);
                        setMode('view');
                      }}
                      className="flex items-center gap-3 text-left"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white">
                        <UserRound className="h-4 w-4" />
                      </span>
                      <span>
                        <strong className="block text-sm">{record.party.displayName}</strong>
                        <span className="text-xs text-slate-500">{record.party.partyNumber}</span>
                      </span>
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                      <Globe className="h-3.5 w-3.5" />
                      {humanize(record.portalType)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs font-semibold text-slate-700">
                    {record.user.emailNormalized}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge value={record.active ? 'ACTIVE' : 'SUSPENDED'} />
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-500">{format(record.createdAt)}</td>
                  <td className="px-5 py-4 text-right">
                    <details className="relative inline-block">
                      <summary className="cursor-pointer list-none rounded-lg p-2 text-slate-400">
                        <MoreHorizontal className="h-5 w-5" />
                      </summary>
                      <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-slate-200 bg-white p-1.5 text-left shadow-xl">
                        <button
                          type="button"
                          onClick={() => {
                            setSelected(record);
                            setMode('view');
                          }}
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                        >
                          <Eye className="h-4 w-4" /> View account
                        </button>
                        {canUpdate ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelected(record);
                              setMode('status');
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                          >
                            <ShieldAlert className="h-4 w-4" /> Change status
                          </button>
                        ) : null}
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length ? (
          <div className="p-10 text-center text-sm text-slate-500">No matching portal accounts.</div>
        ) : null}
        <PaginationControls
          page={pagination.page}
          pageCount={pagination.pageCount}
          total={filtered.length}
          onPageChange={pagination.setPage}
        />
      </section>

      {mode === 'view' && selected ? (
        <Drawer
          title={selected.party.displayName}
          description="Portal login linked to this party."
          onClose={close}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Portal type
              </span>
              <strong className="mt-1 block text-sm">{humanize(selected.portalType)}</strong>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Status
              </span>
              <div className="mt-1">
                <StatusBadge value={selected.active ? 'ACTIVE' : 'SUSPENDED'} />
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 sm:col-span-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Login email
              </span>
              <strong className="mt-1 block break-all text-sm">{selected.user.emailNormalized}</strong>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Party number
              </span>
              <strong className="mt-1 block text-sm">{selected.party.partyNumber}</strong>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Created
              </span>
              <strong className="mt-1 block text-sm">{format(selected.createdAt)}</strong>
            </div>
          </div>
        </Drawer>
      ) : null}

      {mode === 'create' ? (
        <Drawer
          title="Enable portal login"
          description="Create a unique login email for one owner or tenant party."
          onClose={close}
        >
          <form
            className="space-y-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              setCreateError('');
              const form = new FormData(event.currentTarget);
              const password = value(form, 'password');
              const confirmPassword = value(form, 'confirmPassword');
              if (password !== confirmPassword) {
                setCreateError('Passwords do not match.');
                return;
              }
              void onCreate({
                partyId: value(form, 'partyId'),
                portalType: value(form, 'portalType'),
                email: value(form, 'email'),
                password,
              })
                .then(close)
                .catch((cause: unknown) => {
                  setCreateError(
                    cause instanceof Error ? cause.message : 'Unable to create portal account.',
                  );
                });
            }}
          >
            <label className="space-y-1.5 text-sm font-semibold">
              Portal type
              <SearchableSelect
                name="portalType"
                value={createPortalType}
                onChange={(event) =>
                  setCreatePortalType(event.target.value as 'OWNER' | 'TENANT')
                }
                className={inputClass}
                required
              >
                <option value="OWNER">Owner portal</option>
                <option value="TENANT">Tenant portal</option>
              </SearchableSelect>
            </label>
            <label className="space-y-1.5 text-sm font-semibold">
              Party
              <SearchableSelect searchable name="partyId" required className={inputClass}>
                <option value="">Choose a party</option>
                {partyOptions.map((option) => (
                  <option key={option.partyId} value={option.partyId}>
                    {option.label}
                    {option.partyNumber ? ` (${option.partyNumber})` : ''}
                  </option>
                ))}
              </SearchableSelect>
              {!partyOptions.length ? (
                <span className="block text-xs font-normal text-amber-700">
                  No eligible {createPortalType === 'OWNER' ? 'owners' : 'tenants'} without portal
                  access.
                </span>
              ) : null}
            </label>
            <label className="space-y-1.5 text-sm font-semibold">
              Login email
              <input
                name="email"
                type="email"
                required
                autoComplete="off"
                className={inputClass}
                placeholder="owner@example.com"
              />
              <span className="block text-xs font-normal text-slate-500">
                Must be unique across staff and portal accounts.
              </span>
            </label>
            <label className="space-y-1.5 text-sm font-semibold">
              Temporary password
              <input
                name="password"
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                className={inputClass}
              />
            </label>
            <label className="space-y-1.5 text-sm font-semibold">
              Confirm password
              <input
                name="confirmPassword"
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                className={inputClass}
              />
            </label>
            {createError ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {createError}
              </p>
            ) : null}
            <button
              disabled={busy || !partyOptions.length}
              className="w-full rounded-lg bg-[#0D47A1] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? 'Creating…' : 'Create portal login'}
            </button>
          </form>
        </Drawer>
      ) : null}

      {mode === 'status' && selected ? (
        <Drawer
          title="Change portal status"
          description="Deactivating ends active portal sessions for this login."
          onClose={close}
        >
          <form
            className="space-y-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void onStatus(selected.id, {
                active: value(form, 'active') === 'true',
                reason: value(form, 'reason'),
              })
                .then(close)
                .catch(() => undefined);
            }}
          >
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <strong>{selected.party.displayName}</strong>
              <p className="mt-1 text-xs text-slate-500">{selected.user.emailNormalized}</p>
            </div>
            <label className="space-y-1.5 text-sm font-semibold">
              Portal status
              <SearchableSelect
                name="active"
                defaultValue={selected.active ? 'true' : 'false'}
                className={inputClass}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </SearchableSelect>
            </label>
            <label className="space-y-1.5 text-sm font-semibold">
              Reason
              <input name="reason" required minLength={3} className={inputClass} />
            </label>
            <button
              disabled={busy}
              className="w-full rounded-lg bg-[#0D47A1] px-4 py-2.5 text-sm font-bold text-white"
            >
              {busy ? 'Saving…' : 'Save portal status'}
            </button>
          </form>
        </Drawer>
      ) : null}
    </div>
  );
}
