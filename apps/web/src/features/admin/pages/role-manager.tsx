'use client';

import { SearchableSelect } from '@/components/shared/searchable-select';

import type { FormEvent, ReactNode } from 'react';
import {
  ChevronRight,
  Edit3,
  KeyRound,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { humanize, permissionDomain, permissionLabel } from '@/lib/presentation';
import { userFacingError } from '@/lib/phase3-api';
import { PaginationControls, usePagination } from '@/components/shared/pagination';
import { StatusBadge } from '@/components/shared/ui';

export type PermissionRecord = { id: string; code: string; description?: string };
export type RoleRecord = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  permissions: { permissionId: string; permission: PermissionRecord }[];
};
const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100';
const value = (form: FormData, key: string) => {
  const item = form.get(key);
  return typeof item === 'string' ? item.trim() : '';
};
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
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/35"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close panel"
        onClick={onClose}
      />
      <section className="relative flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 p-2 text-slate-500"
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
    <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
      <span>{label}</span>
      {children}
      {hint ? <span className="block text-xs font-normal text-slate-500">{hint}</span> : null}
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
  const [query, setQuery] = useState('');
  const [panel, setPanel] = useState<
    'create' | 'edit' | 'status' | 'permissions' | 'revoke' | null
  >(null);
  const [selected, setSelected] = useState<RoleRecord | null>(null);
  const [revoking, setRevoking] = useState<PermissionRecord | null>(null);
  const [formError, setFormError] = useState('');
  const filtered = useMemo(
    () =>
      records.filter(
        (role) =>
          !query.trim() ||
          [role.name, role.code, ...role.permissions.map((item) => item.permission.code)].some(
            (item) => item.toLowerCase().includes(query.trim().toLowerCase()),
          ),
      ),
    [query, records],
  );
  const pagination = usePagination(filtered);
  const close = () => {
    setPanel(null);
    setRevoking(null);
    setFormError('');
  };
  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            <span>Team & access</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-700">Roles & permissions</span>
          </div>
          <h1 className="text-2xl font-bold sm:text-3xl">Roles & permissions</h1>
          <p className="mt-1 text-sm text-slate-500">
            Define business roles in plain language and choose exactly what each role can do.
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => {
              setFormError('');
              setPanel('create');
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" /> Add role
          </button>
        ) : null}
      </header>
      <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <strong>Where capabilities come from</strong>
        <p className="mt-1 leading-6 text-blue-800">
          Capabilities are registered in the controlled system catalog during database setup and
          stored in the Permissions table. Administrators cannot invent technical capabilities here;
          they choose approved capabilities and assign them to business roles.
        </p>
      </section>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <label className="relative block max-w-lg">
            <span className="sr-only">Search roles</span>
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search roles or capabilities…"
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {['Business role', 'Capabilities', 'Status', 'Actions'].map((header) => (
                  <th
                    key={header}
                    className={
                      'px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 ' +
                      (header === 'Actions' ? 'text-right' : '')
                    }
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagination.pageItems.map((role) => (
                <tr key={role.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <strong className="block text-sm">{role.name}</strong>
                    <span className="text-xs text-slate-500">{humanize(role.code)}</span>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(role);
                        setPanel('permissions');
                      }}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      {role.permissions.length} capabilities
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge value={role.active} />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <details className="relative inline-block">
                      <summary className="cursor-pointer list-none rounded-lg p-2 text-slate-400 hover:text-emerald-700">
                        <MoreHorizontal className="h-5 w-5" />
                      </summary>
                      <div className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-slate-200 bg-white p-1.5 text-left shadow-xl">
                        <button
                          type="button"
                          onClick={() => {
                            setSelected(role);
                            setPanel('permissions');
                          }}
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                        >
                          <ShieldCheck className="h-4 w-4" /> Manage capabilities
                        </button>
                        {canManage ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelected(role);
                              setPanel('edit');
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                          >
                            <Edit3 className="h-4 w-4" /> Rename role
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
                              'flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold ' +
                              (role.active
                                ? 'text-red-700 hover:bg-red-50'
                                : 'text-emerald-700 hover:bg-emerald-50')
                            }
                          >
                            {role.active ? 'Deactivate role' : 'Activate role'}
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
        <PaginationControls
          page={pagination.page}
          pageCount={pagination.pageCount}
          total={filtered.length}
          onPageChange={pagination.setPage}
        />
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
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
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
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
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
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <strong>{selected.name}</strong>
              <p className="mt-1 text-xs text-slate-500">
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
                (selected.active ? 'bg-red-600' : 'bg-emerald-600')
              }
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
                  className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white"
                >
                  Add
                </button>
              </form>
            ) : null}
            <div className="space-y-4">
              {Object.entries(
                Object.groupBy(selected.permissions, (item) =>
                  permissionDomain(item.permission.code),
                ),
              ).map(([domain, items]) => (
                <section key={domain}>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                    {domain}
                  </h3>
                  <div className="space-y-2">
                    {items?.map((item) => (
                      <div
                        key={item.permissionId}
                        className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
                      >
                        <div>
                          <p className="text-sm font-bold">
                            {permissionLabel(item.permission.code)}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
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
                            className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-700"
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
              <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
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
