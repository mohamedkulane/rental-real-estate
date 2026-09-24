'use client';

import { SearchableSelect } from '@/components/shared/searchable-select';

import type { FormEvent, ReactNode } from 'react';
import {
  ArrowDownUp,
  ArrowRight,
  Ban,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  List,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { humanize, permissionDomain, permissionLabel } from '@/lib/presentation';
import { groupBy } from '@/lib/group-by';
import { userFacingError } from '@/lib/phase3-api';
import { usePagination } from '@/components/shared/pagination';

export type PermissionRecord = { id: string; code: string; description?: string };
export type RoleRecord = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  permissions: { permissionId: string; permission: PermissionRecord }[];
};

const PRIMARY = '#0F766E';
const PRIMARY_HOVER = '#115E59';

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 disabled:bg-gray-100';

const value = (form: FormData, key: string) => {
  const item = form.get(key);
  return typeof item === 'string' ? item.trim() : '';
};

function roleInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'R';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}
function roleHint(role: RoleRecord) {
  const count = role.permissions.length;
  if (count === 0) return 'No capabilities assigned yet.';
  if (count === 1) return '1 approved capability assigned.';
  return `${count} approved capabilities assigned.`;
}

function Panel({
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
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/35 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button type="button" className="absolute inset-0" aria-label="Close panel" onClick={onClose} />
      <section className="relative flex h-full w-full max-w-xl flex-col border-l border-gray-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
            aria-label="Close panel"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </section>
    </div>
  );
}
function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5 text-sm font-semibold text-gray-700">
      <span>{label}</span>
      {children}
      {hint ? <span className="block text-xs font-normal text-gray-500">{hint}</span> : null}
    </label>
  );
}

export function RoleManager({
  records,
  permissions,
  busy,
  canManage,
  onCreate,
  onUpdate,
  onGrant,
  onRevoke,
}: {
  records: RoleRecord[];
  permissions: PermissionRecord[];
  busy: boolean;
  canManage: boolean;
  onCreate: (input: Record<string, unknown>) => Promise<void>;
  onUpdate: (id: string, input: Record<string, unknown>) => Promise<void>;
  onGrant: (id: string, permissionId: string) => Promise<void>;
  onRevoke: (id: string, permissionId: string, reason: string) => Promise<void>;
}) {
  const normalizedRecords = useMemo(
    () =>
      records.map((role) => ({
        ...role,
        permissions: (role.permissions ?? []).filter(
          (item) => item?.permission?.code,
        ) as RoleRecord['permissions'],
      })),
    [records],
  );
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [panel, setPanel] = useState<
    'create' | 'edit' | 'status' | 'permissions' | 'revoke' | null
  >(null);
  const [selected, setSelected] = useState<RoleRecord | null>(null);
  const [revoking, setRevoking] = useState<PermissionRecord | null>(null);
  const [formError, setFormError] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = normalizedRecords.filter((role) => {
      if (statusFilter === 'active' && !role.active) return false;
      if (statusFilter === 'inactive' && role.active) return false;
      if (!q) return true;
      return [role.name, role.code, ...role.permissions.map((item) => item.permission.code)].some(
        (item) => item.toLowerCase().includes(q),
      );
    });
    rows.sort((a, b) => {
      const cmp = a.name.localeCompare(b.name);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [normalizedRecords, query, sortDir, statusFilter]);

  const pagination = usePagination(filtered);
  const close = () => {
    setPanel(null);
    setRevoking(null);
    setFormError('');
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header: mint band + house photo as right-side background (not a separate card) */}
      <header className="relative overflow-hidden rounded-2xl bg-[#E8F5F2]">
        <div
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-[55%] bg-cover bg-center sm:block md:w-[48%] lg:w-[42%]"
          style={{
            backgroundImage: 'url(/brand/roles-hero.jpg)',
            maskImage:
              'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.35) 18%, rgba(0,0,0,0.9) 42%, #000 100%)',
            WebkitMaskImage:
              'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.35) 18%, rgba(0,0,0,0.9) 42%, #000 100%)',
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-[55%] bg-gradient-to-r from-[#E8F5F2] via-[#E8F5F2]/70 to-transparent sm:block md:w-[48%] lg:w-[42%]"
          aria-hidden="true"
        />

        <div className="relative z-10 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500">
              <span>Team & Access</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-gray-800">Roles & Permissions</span>
            </div>
            {canManage ? (
              <button
                type="button"
                onClick={() => {
                  setFormError('');
                  setPanel('create');
                }}
                className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
                style={{ backgroundColor: PRIMARY }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.backgroundColor = PRIMARY_HOVER;
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.backgroundColor = PRIMARY;
                }}
              >
                <Plus className="h-4 w-4" /> Add role
              </button>
            ) : null}
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(180px,280px)] lg:items-end">
            <div className="min-w-0 max-w-xl">
              <h1 className="text-[28px] font-bold leading-tight text-gray-900 sm:text-[32px]">
                Roles & permissions
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                Define business roles in plain language and choose exactly what each role can do.
              </p>
            </div>

            <p
              className="max-w-[11rem] text-[22px] font-medium leading-[1.05] sm:text-[26px] lg:justify-self-start"
              style={{ fontFamily: 'var(--font-decorative)', color: PRIMARY }}
            >
              Right People
              <br />
              Right Access
              <br />
              Greater Possibilities
            </p>
          </div>

          {/* Mobile: show house strip when desktop bg is hidden */}
          <div
            className="mt-5 h-28 overflow-hidden rounded-xl bg-cover bg-center sm:hidden"
            style={{ backgroundImage: 'url(/brand/roles-hero.jpg)' }}
            aria-hidden="true"
          />
        </div>
      </header>

      <section className="rounded-xl border border-emerald-100 bg-[#ECFDF5] p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `${PRIMARY}18`, color: PRIMARY }}
          >
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 max-w-3xl">
                <h2 className="text-sm font-bold" style={{ color: PRIMARY }}>
                  Where capabilities come from
                </h2>
                <p className="mt-1 text-sm leading-6 text-emerald-900/80">
                  Capabilities are registered in the controlled system catalog during database setup
                  and stored in the Permissions table. Administrators cannot invent technical
                  capabilities here; they choose approved capabilities and assign them to business
                  roles.
                </p>
              </div>
              <a
                href="#capabilities-note"
                className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold sm:pt-0.5"
                style={{ color: PRIMARY }}
              >
                Learn more <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
            <label className="relative block min-w-0 flex-1">
              <span className="sr-only">Search roles</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search roles or capabilities..."
                className="h-11 w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20"
              />
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_auto] lg:flex lg:shrink-0">
              <div className="relative min-w-0 lg:min-w-[148px]">
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')
                  }
                  className="h-11 w-full appearance-none rounded-lg border border-gray-300 bg-white py-2.5 pl-3 pr-9 text-sm font-medium text-gray-800 outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20"
                  aria-label="Filter by status"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <ChevronRight className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-gray-400" />
              </div>

              <div className="relative min-w-0 lg:min-w-[158px]">
                <span className="pointer-events-none absolute left-3 top-1.5 text-[10px] font-medium leading-none text-gray-400">
                  Sort by
                </span>
                <select
                  value={sortDir}
                  onChange={(event) => setSortDir(event.target.value as 'asc' | 'desc')}
                  className="h-11 w-full appearance-none rounded-lg border border-gray-300 bg-white pb-2 pl-3 pr-9 pt-5 text-sm font-medium text-gray-800 outline-none focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20"
                  aria-label="Sort roles"
                >
                  <option value="asc">Name (A-Z)</option>
                  <option value="desc">Name (Z-A)</option>
                </select>
                <ChevronRight className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-gray-400" />
              </div>

              <button
                type="button"
                className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 sm:col-span-2 sm:w-11 lg:col-span-1 lg:w-11"
                aria-label="Toggle sort direction"
                onClick={() => setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'))}
              >
                <ArrowDownUp className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                {['Business role', 'Capabilities', 'Status', 'Users', 'Last updated', 'Actions'].map(
                  (header) => (
                    <th
                      key={header}
                      className={
                        'px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500 ' +
                        (header === 'Actions' ? 'text-right' : '')
                      }
                    >
                      {header}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pagination.pageItems.map((role) => (
                <tr key={role.id} className="hover:bg-gray-50/80">
                  <td className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                        style={{ backgroundColor: `${PRIMARY}14`, color: PRIMARY }}
                      >
                        {roleInitials(role.name)}
                      </div>
                      <div className="min-w-0">
                        <strong className="block text-sm font-semibold text-gray-900">{role.name}</strong>
                        <span className="mt-0.5 block text-xs text-gray-500">{roleHint(role)}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(role);
                        setPanel('permissions');
                      }}
                      className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-[#0F766E]"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      {role.permissions.length} capabilities
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ' +
                        (role.active
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-gray-100 text-gray-600')
                      }
                    >
                      <span
                        className={
                          'h-1.5 w-1.5 rounded-full ' + (role.active ? 'bg-emerald-500' : 'bg-gray-400')
                        }
                      />
                      {role.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
                      <Users className="h-3.5 w-3.5" />
                      —
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-500">—</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(role);
                          setPanel('permissions');
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                      >
                        <List className="h-3.5 w-3.5" />
                        Capabilities
                      </button>
                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelected(role);
                            setPanel('edit');
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Rename
                        </button>
                      ) : null}
                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelected(role);
                            setPanel('status');
                          }}
                          className={
                            'inline-flex items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1.5 text-xs font-semibold ' +
                            (role.active
                              ? 'border-red-300 text-red-700 hover:bg-red-50'
                              : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50')
                          }
                        >
                          <Ban className="h-3.5 w-3.5" />
                          {role.active ? 'Deactivate' : 'Activate'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50"
                        aria-label="More actions"
                        onClick={() => {
                          setSelected(role);
                          setPanel('permissions');
                        }}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!filtered.length ? (
          <div className="p-10 text-center text-sm text-gray-500">No matching roles.</div>
        ) : null}

        <div
          id="capabilities-note"
          className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-xs font-semibold text-gray-500">
            {filtered.length
              ? `Showing ${(pagination.page - 1) * pagination.pageSize + 1} to ${Math.min(
                  pagination.page * pagination.pageSize,
                  filtered.length,
                )} of ${filtered.length} roles`
              : 'Showing 0 roles'}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => pagination.setPage(pagination.page - 1)}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            {Array.from({ length: pagination.pageCount }, (_, index) => index + 1).map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => pagination.setPage(pageNumber)}
                className={
                  'inline-flex h-9 min-w-9 items-center justify-center rounded-lg text-xs font-bold ' +
                  (pageNumber === pagination.page
                    ? 'text-white'
                    : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50')
                }
                style={
                  pageNumber === pagination.page ? { backgroundColor: PRIMARY } : undefined
                }
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              disabled={pagination.page >= pagination.pageCount}
              onClick={() => pagination.setPage(pagination.page + 1)}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {panel === 'create' ? (
        <Panel
          title="Add business role"
          description="Use a name staff will understand. Capabilities are added after creation."
          onClose={close}
        >
          <form
            className="space-y-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              setFormError('');
              void onCreate({ code: value(form, 'code'), name: value(form, 'name') })
                .then(close)
                .catch((cause: unknown) => {
                  setFormError(userFacingError(cause, 'The business role could not be created.'));
                });
            }}
          >
            {formError ? (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {formError}
              </div>
            ) : null}
            <Field
              label="Role code"
              hint="Permanent internal shorthand, for example PROPERTY_MANAGER"
            >
              <input name="code" required minLength={2} maxLength={64} className={inputClass} />
            </Field>
            <Field label="Business role name">
              <input
                name="name"
                required
                minLength={2}
                maxLength={120}
                className={inputClass}
                placeholder="Property manager"
              />
            </Field>
            <button
              disabled={busy}
              className="w-full rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              style={{ backgroundColor: PRIMARY }}
            >
              {busy ? 'Creating…' : 'Create role'}
            </button>
          </form>
        </Panel>
      ) : null}

      {panel === 'edit' && selected ? (
        <Panel
          title="Rename business role"
          description="The permanent role code remains unchanged."
          onClose={close}
        >
          <form
            className="space-y-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              void onUpdate(selected.id, { name: value(new FormData(event.currentTarget), 'name') })
                .then(close)
                .catch(() => undefined);
            }}
          >
            <Field label="Role code">
              <input value={humanize(selected.code)} disabled className={inputClass} />
            </Field>
            <Field label="Role name">
              <input name="name" defaultValue={selected.name} required className={inputClass} />
            </Field>
            <button
              disabled={busy}
              className="w-full rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              style={{ backgroundColor: PRIMARY }}
            >
              {busy ? 'Saving…' : 'Save role'}
            </button>
          </form>
        </Panel>
      ) : null}

      {panel === 'status' && selected ? (
        <Panel
          title={selected.active ? 'Deactivate role' : 'Activate role'}
          description={
            selected.active
              ? 'Employees stop receiving capabilities from this role. Assignments and audit history remain.'
              : 'Employees with current assignments can receive this role again.'
          }
          onClose={close}
        >
          <form
            className="space-y-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const reason = value(new FormData(event.currentTarget), 'reason');
              void onUpdate(selected.id, {
                active: !selected.active,
                ...(reason ? { reason } : {}),
              })
                .then(close)
                .catch(() => undefined);
            }}
          >
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <strong>{selected.name}</strong>
              <p className="mt-1 text-xs text-gray-500">
                {selected.permissions.length} assigned capabilities
              </p>
            </div>
            {selected.active ? (
              <Field label="Reason">
                <textarea name="reason" required minLength={3} rows={4} className={inputClass} />
              </Field>
            ) : null}
            <button
              disabled={busy}
              className={
                'w-full rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60 ' +
                (selected.active ? 'bg-red-600' : '')
              }
              style={selected.active ? undefined : { backgroundColor: PRIMARY }}
            >
              {busy ? 'Updating…' : selected.active ? 'Deactivate role' : 'Activate role'}
            </button>
          </form>
        </Panel>
      ) : null}

      {panel === 'permissions' && selected ? (
        <Panel
          title={'Capabilities for ' + selected.name}
          description="Capabilities are grouped in readable business language. Changes apply to current role assignments."
          onClose={close}
        >
          <div className="space-y-6">
            {canManage ? (
              <form
                className="flex gap-2"
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  const permissionId = value(new FormData(event.currentTarget), 'permissionId');
                  void onGrant(selected.id, permissionId)
                    .then(close)
                    .catch(() => undefined);
                }}
              >
                <SearchableSelect searchable name="permissionId" required className={inputClass}>
                  <option value="">Choose a capability</option>
                  {permissions
                    .filter(
                      (permission) =>
                        !selected.permissions.some((item) => item.permissionId === permission.id),
                    )
                    .map((permission) => (
                      <option key={permission.id} value={permission.id}>
                        {permissionDomain(permission.code)} — {permissionLabel(permission.code)}
                      </option>
                    ))}
                </SearchableSelect>
                <button
                  disabled={busy}
                  className="shrink-0 rounded-lg px-4 py-2 text-xs font-bold text-white"
                  style={{ backgroundColor: PRIMARY }}
                >
                  Add
                </button>
              </form>
            ) : null}
            <div className="space-y-4">
              {Object.entries(
                groupBy(selected.permissions, (item) => permissionDomain(item.permission.code)),
              ).map(([domain, items]) => (
                <section key={domain}>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                    {domain}
                  </h3>
                  <div className="space-y-2">
                    {items?.map((item) => (
                      <div
                        key={item.permissionId}
                        className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                      >
                        <div>
                          <p className="text-sm font-bold text-gray-900">
                            {permissionLabel(item.permission.code)}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {item.permission.description || 'Business capability'}
                          </p>
                        </div>
                        {canManage ? (
                          <button
                            type="button"
                            onClick={() => {
                              setRevoking(item.permission);
                              setPanel('revoke');
                            }}
                            className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-700"
                            aria-label={'Remove ' + permissionLabel(item.permission.code)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            {selected.permissions.length === 0 ? (
              <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
                No capabilities assigned yet.
              </p>
            ) : null}
          </div>
        </Panel>
      ) : null}

      {panel === 'revoke' && selected && revoking ? (
        <Panel
          title="Remove capability"
          description="Explain why this capability is being removed from the role."
          onClose={() => {
            setPanel('permissions');
            setRevoking(null);
          }}
        >
          <form
            className="space-y-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              void onRevoke(
                selected.id,
                revoking.id,
                value(new FormData(event.currentTarget), 'reason'),
              )
                .then(close)
                .catch(() => undefined);
            }}
          >
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <strong className="text-red-800">{permissionLabel(revoking.code)}</strong>
              <p className="mt-1 text-xs text-red-700">Remove from {selected.name}</p>
            </div>
            <Field label="Reason">
              <textarea name="reason" required minLength={3} rows={4} className={inputClass} />
            </Field>
            <button
              disabled={busy}
              className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? 'Removing…' : 'Remove capability'}
            </button>
          </form>
        </Panel>
      ) : null}
    </div>
  );
}
