'use client';

import { SearchableSelect } from '@/components/shared/searchable-select';

import { BarChart3, CheckCircle2, CircleOff, Grid2X2, Plus, Search, Sparkles, X } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { TableActionButton, TableActionGroup } from '@/components/shared/data-table';
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
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15';
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
  const [sort, setSort] = useState('most-used');
  const [panel, setPanel] = useState<Panel>(null);
  const [selected, setSelected] = useState<AmenityRecord | null>(null);
  const filtered = useMemo(() => {
    const next = records.filter(
      (item) =>
        (!query.trim() ||
          `${item.name} ${item.code}`.toLowerCase().includes(query.trim().toLowerCase())) &&
        (status === 'all' || String(item.active) === status),
    );
    return [...next].sort((left, right) => {
      if (sort === 'name') return left.name.localeCompare(right.name);
      if (sort === 'status') return Number(right.active) - Number(left.active);
      const leftUse = (left._count?.propertyAssignments ?? 0) + (left._count?.spaceAssignments ?? 0);
      const rightUse = (right._count?.propertyAssignments ?? 0) + (right._count?.spaceAssignments ?? 0);
      return rightUse - leftUse || left.name.localeCompare(right.name);
    });
  }, [records, query, sort, status]);
  const pagination = usePagination(filtered);
  useEffect(() => pagination.setPage(1), [query, sort, status]);
  const totalAssignments = records.reduce(
    (sum, item) => sum + (item._count?.propertyAssignments ?? 0) + (item._count?.spaceAssignments ?? 0),
    0,
  );
  const mostUsed = [...records].sort(
    (left, right) =>
      (right._count?.propertyAssignments ?? 0) + (right._count?.spaceAssignments ?? 0) -
      ((left._count?.propertyAssignments ?? 0) + (left._count?.spaceAssignments ?? 0)),
  )[0];
  const open = (next: Exclude<Panel, null>, item?: AmenityRecord) => {
    setSelected(item ?? null);
    setPanel(next);
  };
  const close = () => {
    setPanel(null);
    setSelected(null);
  };
  return (
    <div className="amenities-directory">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            Portfolio
          </p>
          <h1 className="text-2xl font-bold sm:text-3xl">Amenities Catalog</h1>
          <p className="mt-1 text-sm text-slate-500">
            Register reusable features, then assign them to properties and rentable spaces.
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => open('create')}
            className="button primary"
          >
            <Plus className="h-4 w-4" /> Add amenity
          </button>
        ) : null}
      </header>
      <section className="amenities-kpis" aria-label="Amenities summary">
        {[
          { label: 'Total Amenities', value: records.length, meta: `${totalAssignments} assignments`, icon: Grid2X2 },
          { label: 'Active Amenities', value: records.filter((item) => item.active).length, meta: records.length ? `${Math.round((records.filter((item) => item.active).length / records.length) * 100)}% of total` : '0% of total', icon: CheckCircle2 },
          { label: 'Inactive Amenities', value: records.filter((item) => !item.active).length, meta: records.length ? `${Math.round((records.filter((item) => !item.active).length / records.length) * 100)}% of total` : '0% of total', icon: CircleOff },
          { label: 'Most Used', value: mostUsed?.name ?? '—', meta: mostUsed ? `${(mostUsed._count?.propertyAssignments ?? 0) + (mostUsed._count?.spaceAssignments ?? 0)} assignments` : 'No assignments', icon: BarChart3 },
        ].map(({ label, value, meta, icon: Icon }) => (
          <div className="amenity-kpi" key={label}>
            <span className="amenity-kpi-icon"><Icon className="h-5 w-5" aria-hidden="true" /></span>
            <div className="min-w-0">
              <p>{label}</p>
              <strong title={String(value)}>{value}</strong>
              <small>{meta}</small>
            </div>
          </div>
        ))}
      </section>

      <section className="amenity-table-surface">
        <div className="amenity-filter-bar">
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
          <SearchableSelect
            searchable={false}
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className={inputClass}
            aria-label="Sort amenities"
          >
            <option value="most-used">Most used</option>
            <option value="name">Name A-Z</option>
            <option value="status">Active first</option>
          </SearchableSelect>
        </div>
        <div className="overflow-x-auto">
          <table className="amenity-table w-full min-w-[780px] text-left">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {['Amenity', 'Properties', 'Spaces', 'Status', 'Actions'].map((header) => (
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
                <tr key={item.id}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="amenity-row-icon">
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
                      <TableActionGroup>
                        <TableActionButton tone="edit" onClick={() => open('edit', item)}>
                          Edit
                        </TableActionButton>
                        <TableActionButton
                          tone={item.active ? 'danger' : 'create'}
                          onClick={() => open('status', item)}
                        >
                          {item.active ? 'Deactivate' : 'Activate'}
                        </TableActionButton>
                      </TableActionGroup>
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
              className="button primary w-full"
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
              className="button primary w-full"
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
              className={selected.active ? 'button danger w-full' : 'button primary w-full'}
            >
              {busy ? 'Updating…' : selected.active ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        </Drawer>
      ) : null}
    </div>
  );
}
