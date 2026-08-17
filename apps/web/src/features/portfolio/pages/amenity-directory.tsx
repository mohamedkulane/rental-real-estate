'use client';

import { SearchableSelect } from '@/components/shared/searchable-select';

import { Edit3, MoreHorizontal, Plus, Search, Sparkles, X } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { PaginationControls, usePagination } from '@/components/shared/pagination';
import { StatusBadge } from '@/components/shared/ui';

export type AmenityRecord = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  _count?: { propertyAssignments: number; spaceAssignments: number };
};
type Panel = 'create' | 'edit' | 'status' | null;
const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0D47A1] focus:ring-2 focus:ring-[#E3F2FD]';
const value = (form: FormData, key: string) => {
  const entry = form.get(key);
  return typeof entry === 'string' ? entry.trim() : '';
};
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
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label="Close panel"
      />
      <aside className="relative max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl scroll-smooth">
        <header className="flex items-start justify-between border-b border-slate-200 p-5">
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
export function AmenityDirectory({
  records,
  busy,
  canManage,
  onCreate,
  onUpdate,
}: {
  records: AmenityRecord[];
  busy: boolean;
  canManage: boolean;
  onCreate: (input: Record<string, unknown>) => Promise<void>;
  onUpdate: (amenityId: string, input: Record<string, unknown>) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [panel, setPanel] = useState<Panel>(null);
  const [selected, setSelected] = useState<AmenityRecord | null>(null);
  const filtered = useMemo(
    () =>
      records.filter(
        (item) =>
          (!query.trim() ||
            `${item.name} ${item.code}`.toLowerCase().includes(query.trim().toLowerCase())) &&
          (status === 'all' || String(item.active) === status),
      ),
    [records, query, status],
  );
  const pagination = usePagination(filtered);
  useEffect(() => pagination.setPage(1), [query, status]);
  const open = (next: Exclude<Panel, null>, item?: AmenityRecord) => {
    setSelected(item ?? null);
    setPanel(next);
  };
  const close = () => {
    setPanel(null);
    setSelected(null);
  };
  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            Portfolio
          </p>
          <h1 className="text-2xl font-bold sm:text-3xl">Amenities catalog</h1>
          <p className="mt-1 text-sm text-slate-500">
            Register reusable features, then assign them to properties and rentable spaces.
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => open('create')}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0D47A1] px-4 py-2.5 text-sm font-bold text-white"
          >
            <Plus className="h-4 w-4" /> Add amenity
          </button>
        ) : null}
      </header>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-[minmax(260px,1fr)_190px]">
          <label className="relative">
            <span className="sr-only">Search amenities</span>
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search amenity name or code…"
              className={inputClass + ' pl-10'}
            />
          </label>
          <SearchableSelect
            searchable={false}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className={inputClass}
            aria-label="Filter amenity status"
          >
            <option value="all">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </SearchableSelect>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {['Amenity', 'Property use', 'Space use', 'Status', 'Actions'].map((header) => (
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
              {pagination.pageItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="rounded-lg bg-[#E3F2FD] p-2 text-[#0D47A1]">
                        <Sparkles className="h-4 w-4" />
                      </span>
                      <span>
                        <strong className="block text-sm">{item.name}</strong>
                        <span className="text-xs text-slate-500">{item.code}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs font-semibold text-slate-600">
                    {item._count?.propertyAssignments ?? 0}
                  </td>
                  <td className="px-5 py-4 text-xs font-semibold text-slate-600">
                    {item._count?.spaceAssignments ?? 0}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge value={item.active} />
                  </td>
                  <td className="px-5 py-4 text-right">
                    {canManage ? (
                      <details className="relative inline-block">
                        <summary className="cursor-pointer list-none rounded-lg p-2 text-slate-400">
                          <MoreHorizontal className="h-5 w-5" />
                        </summary>
                        <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white p-1.5 text-left shadow-xl">
                          <button
                            type="button"
                            onClick={() => open('edit', item)}
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                          >
                            <Edit3 className="h-4 w-4" /> Edit amenity
                          </button>
                          <button
                            type="button"
                            onClick={() => open('status', item)}
                            className="flex w-full rounded-md px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                          >
                            {item.active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </details>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length ? (
          <div className="p-10 text-center text-sm text-slate-500">No matching amenities.</div>
        ) : null}
        <PaginationControls
          page={pagination.page}
          pageCount={pagination.pageCount}
          total={filtered.length}
          onPageChange={pagination.setPage}
        />
      </section>
      {panel === 'create' ? (
        <Drawer
          title="Add amenity"
          description="Create a reusable catalog item with a readable name."
          onClose={close}
        >
          <form
            className="space-y-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void onCreate({
                code: value(form, 'code').toUpperCase().replaceAll(' ', '_'),
                name: value(form, 'name'),
              })
                .then(close)
                .catch(() => undefined);
            }}
          >
            <label className="space-y-1.5 text-sm font-semibold">
              Amenity name
              <input
                name="name"
                required
                minLength={2}
                placeholder="Backup generator"
                className={inputClass}
              />
            </label>
            <label className="space-y-1.5 text-sm font-semibold">
              Code
              <input
                name="code"
                required
                minLength={2}
                placeholder="BACKUP_GENERATOR"
                className={inputClass}
              />
              <span className="block text-xs font-normal text-slate-500">
                Stable internal code; users see the amenity name.
              </span>
            </label>
            <button
              disabled={busy}
              className="w-full rounded-lg bg-[#0D47A1] px-4 py-2.5 text-sm font-bold text-white"
            >
              {busy ? 'Saving…' : 'Create amenity'}
            </button>
          </form>
        </Drawer>
      ) : null}
      {panel === 'edit' && selected ? (
        <Drawer
          title="Edit amenity"
          description="Update the human-readable catalog name."
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
            <label className="space-y-1.5 text-sm font-semibold">
              Code
              <input value={selected.code} disabled className={inputClass + ' bg-slate-50'} />
            </label>
            <label className="space-y-1.5 text-sm font-semibold">
              Amenity name
              <input
                name="name"
                defaultValue={selected.name}
                required
                minLength={2}
                className={inputClass}
              />
            </label>
            <button
              disabled={busy}
              className="w-full rounded-lg bg-[#0D47A1] px-4 py-2.5 text-sm font-bold text-white"
            >
              {busy ? 'Saving…' : 'Save amenity'}
            </button>
          </form>
        </Drawer>
      ) : null}
      {panel === 'status' && selected ? (
        <Drawer
          title={selected.active ? 'Deactivate amenity' : 'Activate amenity'}
          description="Existing property and space assignments are preserved."
          onClose={close}
        >
          <div className="space-y-5">
            <div className="rounded-xl bg-slate-50 p-4">
              <strong>{selected.name}</strong>
              <p className="text-xs text-slate-500">{selected.code}</p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void onUpdate(selected.id, { active: !selected.active })
                  .then(close)
                  .catch(() => undefined)
              }
              className={
                'w-full rounded-lg px-4 py-2.5 text-sm font-bold text-white ' +
                (selected.active ? 'bg-red-600' : 'bg-[#0D47A1]')
              }
            >
              {busy ? 'Updating…' : selected.active ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        </Drawer>
      ) : null}
    </div>
  );
}
