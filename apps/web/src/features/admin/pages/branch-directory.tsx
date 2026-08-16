'use client';

import { SearchableSelect } from '@/components/shared/searchable-select';

import type { FormEvent, ReactNode } from 'react';
import {
  Building2,
  ChevronRight,
  Edit3,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { PaginationControls, usePagination } from '@/components/shared/pagination';
import { StatusBadge } from '@/components/shared/ui';

export type BranchRecord = {
  id: string;
  code: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: Record<string, unknown> | null;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
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
      <section className="relative flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
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
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function BranchDirectory({
  records,
  busy,
  canCreate,
  canUpdate,
  onCreate,
  onUpdate,
}: {
  records: BranchRecord[];
  busy: boolean;
  canCreate: boolean;
  canUpdate: (record: BranchRecord) => boolean;
  onCreate: (input: Record<string, unknown>) => Promise<void>;
  onUpdate: (id: string, input: Record<string, unknown>) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [panel, setPanel] = useState<'create' | 'details' | 'edit' | 'status' | null>(null);
  const [selected, setSelected] = useState<BranchRecord | null>(null);
  const filtered = useMemo(
    () =>
      records.filter((branch) => {
        const search = query.trim().toLowerCase();
        const matches =
          !search ||
          [branch.name, branch.code, branch.phone, branch.email]
            .filter(Boolean)
            .some((item) => String(item).toLowerCase().includes(search));
        return (
          matches && (status === 'all' || (status === 'active' ? branch.active : !branch.active))
        );
      }),
    [query, records, status],
  );
  const pagination = usePagination(filtered);
  const close = () => setPanel(null);
  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            <span>Company setup</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-700">Branches</span>
          </div>
          <h1 className="text-2xl font-bold sm:text-3xl">Branches</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage operating locations available within your authorized scope.
          </p>
        </div>
        {canCreate ? (
          <button
            type="button"
            onClick={() => setPanel('create')}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" /> Add branch
          </button>
        ) : null}
      </header>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block w-full sm:max-w-lg">
            <span className="sr-only">Search branches</span>
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search branch name, code, phone, or email…"
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <div className="flex items-center gap-4">
            <SearchableSelect
              searchable={false}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </SearchableSelect>
            <span className="text-xs font-semibold text-slate-500">
              {filtered.length} of {records.length}
            </span>
          </div>
        </div>
        {filtered.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {['Branch', 'Contact', 'Location', 'Status', 'Actions'].map((header) => (
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
                {pagination.pageItems.map((branch) => (
                  <tr key={branch.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(branch);
                          setPanel('details');
                        }}
                        className="flex items-center gap-3 text-left"
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
                          <Building2 className="h-5 w-5" />
                        </span>
                        <span>
                          <strong className="block text-sm">{branch.name}</strong>
                          <span className="text-xs text-slate-500">{branch.code}</span>
                        </span>
                      </button>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600">
                      <span className="block font-semibold">{branch.email || 'No email'}</span>
                      <span>{branch.phone || 'No phone'}</span>
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold text-slate-600">
                      {branch.address && typeof branch.address.line1 === 'string'
                        ? branch.address.line1
                        : 'Not recorded'}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge value={branch.active} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <details className="relative inline-block">
                        <summary className="cursor-pointer list-none rounded-lg p-2 text-slate-400 hover:bg-white hover:text-emerald-700">
                          <MoreHorizontal className="h-5 w-5" />
                        </summary>
                        <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white p-1.5 text-left shadow-xl">
                          <button
                            type="button"
                            onClick={() => {
                              setSelected(branch);
                              setPanel('details');
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                          >
                            <Building2 className="h-4 w-4" /> View branch
                          </button>
                          {canUpdate(branch) ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelected(branch);
                                setPanel('edit');
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                            >
                              <Edit3 className="h-4 w-4" /> Edit branch
                            </button>
                          ) : null}
                          {canUpdate(branch) ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelected(branch);
                                setPanel('status');
                              }}
                              className={
                                'flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold ' +
                                (branch.active
                                  ? 'text-red-700 hover:bg-red-50'
                                  : 'text-emerald-700 hover:bg-emerald-50')
                              }
                            >
                              {branch.active ? 'Deactivate branch' : 'Activate branch'}
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
        ) : (
          <div className="py-16 text-center">
            <MapPin className="mx-auto h-9 w-9 text-slate-300" />
            <h2 className="mt-3 font-bold">No matching branches</h2>
          </div>
        )}
        <PaginationControls
          page={pagination.page}
          pageCount={pagination.pageCount}
          total={filtered.length}
          onPageChange={pagination.setPage}
        />
      </section>
      {panel === 'create' ? (
        <Panel
          title="Add branch"
          description="Create a new operating location for the company."
          onClose={close}
        >
          <form
            className="space-y-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const phone = value(form, 'phone');
              const email = value(form, 'email');
              const line1 = value(form, 'line1');
              void onCreate({
                name: value(form, 'name'),
                ...(phone ? { phone } : {}),
                ...(email ? { email } : {}),
                ...(line1 ? { address: { line1 } } : {}),
              })
                .then(close)
                .catch(() => undefined);
            }}
          >
            <Field label="Branch name">
              <input name="name" required minLength={2} maxLength={160} className={inputClass} />
            </Field>
            <Field label="Address">
              <input name="line1" className={inputClass} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone">
                <input name="phone" className={inputClass} />
              </Field>
              <Field label="Email">
                <input name="email" type="email" className={inputClass} />
              </Field>
            </div>
            <button
              disabled={busy}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? 'Creating…' : 'Create branch'}
            </button>
          </form>
        </Panel>
      ) : null}
      {panel === 'edit' && selected ? (
        <Panel
          title="Edit branch"
          description="Update contact and operating-location details."
          onClose={close}
        >
          <form
            className="space-y-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const line1 = value(form, 'line1');
              void onUpdate(selected.id, {
                name: value(form, 'name'),
                phone: value(form, 'phone'),
                email: value(form, 'email'),
                ...(line1 ? { address: { line1 } } : {}),
              })
                .then(close)
                .catch(() => undefined);
            }}
          >
            <Field label="Branch code">
              <input value={selected.code} disabled className={inputClass} />
            </Field>
            <Field label="Branch name">
              <input name="name" defaultValue={selected.name} required className={inputClass} />
            </Field>
            <Field label="Address">
              <input
                name="line1"
                defaultValue={
                  selected.address && typeof selected.address.line1 === 'string'
                    ? selected.address.line1
                    : ''
                }
                className={inputClass}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone">
                <input name="phone" defaultValue={selected.phone ?? ''} className={inputClass} />
              </Field>
              <Field label="Email">
                <input
                  name="email"
                  type="email"
                  defaultValue={selected.email ?? ''}
                  className={inputClass}
                />
              </Field>
            </div>
            <button
              disabled={busy}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </Panel>
      ) : null}
      {panel === 'status' && selected ? (
        <Panel
          title={selected.active ? 'Deactivate branch' : 'Activate branch'}
          description="Historical assignments remain preserved. Deactivation prevents use for new active setup."
          onClose={close}
        >
          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <strong>{selected.name}</strong>
              <p className="mt-1 text-xs text-slate-500">{selected.code}</p>
            </div>
            <button
              disabled={busy}
              onClick={() => void onUpdate(selected.id, { active: !selected.active }).then(close)}
              className={
                'w-full rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60 ' +
                (selected.active
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-emerald-600 hover:bg-emerald-700')
              }
            >
              {busy ? 'Updating…' : selected.active ? 'Deactivate branch' : 'Activate branch'}
            </button>
          </div>
        </Panel>
      ) : null}
      {panel === 'details' && selected ? (
        <Panel
          title={selected.name}
          description={selected.code + ' · Operating branch'}
          onClose={close}
        >
          <div className="space-y-5">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="text-xs font-semibold text-slate-500">Branch status</p>
                <p className="mt-1 text-sm font-bold">Company operating location</p>
              </div>
              <StatusBadge value={selected.active} />
            </div>
            <dl className="grid gap-3">
              <div className="flex gap-3 rounded-lg border border-slate-200 p-3">
                <Mail className="h-5 w-5 text-slate-400" />
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Email
                  </dt>
                  <dd className="mt-1 text-sm font-semibold">{selected.email || 'Not recorded'}</dd>
                </div>
              </div>
              <div className="flex gap-3 rounded-lg border border-slate-200 p-3">
                <Phone className="h-5 w-5 text-slate-400" />
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Phone
                  </dt>
                  <dd className="mt-1 text-sm font-semibold">{selected.phone || 'Not recorded'}</dd>
                </div>
              </div>
              <div className="flex gap-3 rounded-lg border border-slate-200 p-3">
                <MapPin className="h-5 w-5 text-slate-400" />
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Address
                  </dt>
                  <dd className="mt-1 text-sm font-semibold">
                    {selected.address && typeof selected.address.line1 === 'string'
                      ? selected.address.line1
                      : 'Not recorded'}
                  </dd>
                </div>
              </div>
            </dl>
            {canUpdate(selected) ? (
              <button
                type="button"
                onClick={() => setPanel('edit')}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
              >
                <Edit3 className="h-4 w-4" /> Edit branch
              </button>
            ) : null}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
