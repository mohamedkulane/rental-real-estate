'use client';

import { SearchableSelect } from '@/components/shared/searchable-select';
import { DetailTabs } from '@/components/shared/detail-tabs';
import { OWNER_DETAIL_TABS } from '../portfolio-ia';

import { Building2, Edit3, Eye, MoreHorizontal, Plus, Search, X } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { humanize } from '@/lib/presentation';
import { PaginationControls, usePagination } from '@/components/shared/pagination';
import type { PartyRecord } from './party-directory';
import { StatusBadge } from '@/components/shared/ui';
import { OwnerPropertyPortfolio } from '../ownership-workflow';
import { EntityDocuments } from '../entity-documents';
import type { PropertyOwnershipRecord } from '../ownership-model';

export type OwnerRecord = {
  partyId: string;
  ownerNumber: string;
  status: string;
  communicationPreference?: string | null;
  notes?: string | null;
  scopeBranchIds: string[];
  party: PartyRecord;
  ownerships?: (PropertyOwnershipRecord & {
    property: {
      id: string;
      propertyCode: string;
      name: string;
      propertyType: string;
      status: string;
      city: string;
      branchAssignments?: {
        branch?: { name: string };
        effectiveFrom: string;
        effectiveTo: string | null;
      }[];
    };
  })[];
};

type Panel = 'create' | 'view' | 'edit' | null;
export type OwnerDetailTab = (typeof OWNER_DETAIL_TABS)[number]['key'];
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
        aria-label="Close panel"
        onClick={onClose}
      />
      <aside className="relative max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl scroll-smooth">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
          <div>
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 p-2 text-slate-500"
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

export function OwnerDirectory({
  records,
  parties,
  businessDate,
  busy,
  canCreate,
  canUpdate,
  canReadDocuments,
  canManageDocuments,
  onCreate,
  onUpdate,
  onLoadDetails,
  initialDetailTab = 'overview',
}: {
  records: OwnerRecord[];
  parties: PartyRecord[];
  businessDate: string;
  busy: boolean;
  canCreate: (party: PartyRecord) => boolean;
  canUpdate: (record: OwnerRecord) => boolean;
  canReadDocuments: (record: OwnerRecord) => boolean;
  canManageDocuments: (record: OwnerRecord) => boolean;
  onCreate: (input: Record<string, unknown>) => Promise<void>;
  onUpdate: (partyId: string, input: Record<string, unknown>) => Promise<void>;
  onLoadDetails: (partyId: string) => Promise<OwnerRecord>;
  initialDetailTab?: OwnerDetailTab;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [panel, setPanel] = useState<Panel>(null);
  const [selected, setSelected] = useState<OwnerRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<OwnerDetailTab>(initialDetailTab);
  useEffect(() => {
    setDetailTab(initialDetailTab);
  }, [initialDetailTab]);

  const filtered = useMemo(
    () =>
      records.filter((owner) => {
        const search = query.trim().toLowerCase();
        return (
          (!search ||
            [
              owner.party.displayName,
              owner.ownerNumber,
              owner.party.partyNumber,
              owner.communicationPreference,
            ]
              .join(' ')
              .toLowerCase()
              .includes(search)) &&
          (status === 'all' || owner.status === status)
        );
      }),
    [records, query, status],
  );
  const pagination = usePagination(filtered);
  useEffect(() => pagination.setPage(1), [query, status]);
  const eligibleParties = parties.filter(
    (party) =>
      party.active && canCreate(party) && !records.some((owner) => owner.partyId === party.id),
  );
  const open = (next: Exclude<Panel, null>, record?: OwnerRecord) => {
    setSelected(record ?? null);
    setPanel(next);
  };
  const openView = async (record: OwnerRecord) => {
    setSelected(record);
    setDetailTab(initialDetailTab);
    setPanel('view');
    setDetailLoading(true);
    try {
      setSelected(await onLoadDetails(record.partyId));
    } finally {
      setDetailLoading(false);
    }
  };
  const close = () => {
    setPanel(null);
    setDetailTab(initialDetailTab);
    setSelected(null);
  };
  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            Portfolio
          </p>
          <h1 className="text-2xl font-bold sm:text-3xl">Property owners</h1>
          <p className="mt-1 text-sm text-slate-500">
            Owner profiles connected to readable people and organization records.
          </p>
        </div>
        {eligibleParties.length ? (
          <button
            type="button"
            onClick={() => open('create')}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0D47A1] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0D47A1]"
          >
            <Plus className="h-4 w-4" /> Add owner
          </button>
        ) : null}
      </header>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-[minmax(260px,1fr)_200px]">
          <label className="relative">
            <span className="sr-only">Search owners</span>
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search owner name or number…"
              className={inputClass + ' pl-10'}
            />
          </label>
          <SearchableSelect
            searchable={false}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className={inputClass}
            aria-label="Filter owner status"
          >
            <option value="all">All statuses</option>
            {['PROSPECTIVE', 'ACTIVE', 'SUSPENDED', 'INACTIVE'].map((item) => (
              <option key={item} value={item}>
                {humanize(item)}
              </option>
            ))}
          </SearchableSelect>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {['Owner', 'Record type', 'Communication', 'Status', 'Actions'].map((header) => (
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
              {pagination.pageItems.map((owner) => (
                <tr key={owner.partyId} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => void openView(owner)}
                      className="flex items-center gap-3 text-left"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E3F2FD] text-[#0D47A1]">
                        <Building2 className="h-4 w-4" />
                      </span>
                      <span>
                        <strong className="block text-sm">{owner.party.displayName}</strong>
                        <span className="text-xs text-slate-500">
                          {owner.ownerNumber} · {owner.party.partyNumber}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className="px-5 py-4 text-xs font-semibold text-slate-600">
                    {humanize(owner.party.kind)}
                  </td>
                  <td className="px-5 py-4 text-xs font-semibold text-slate-600">
                    {owner.communicationPreference || 'Not specified'}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge value={owner.status} />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <details className="relative inline-block">
                      <summary className="cursor-pointer list-none rounded-lg p-2 text-slate-400 hover:text-[#0D47A1]">
                        <MoreHorizontal className="h-5 w-5" />
                      </summary>
                      <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white p-1.5 text-left shadow-xl">
                        <button
                          type="button"
                          onClick={() => void openView(owner)}
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                        >
                          <Eye className="h-4 w-4" /> View owner
                        </button>
                        {canUpdate(owner) ? (
                          <button
                            type="button"
                            onClick={() => open('edit', owner)}
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                          >
                            <Edit3 className="h-4 w-4" /> Edit owner
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
          <div className="p-10 text-center text-sm text-slate-500">No matching owners.</div>
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
          title="Add owner"
          description="Choose a person or organization by name. The owner number is generated automatically."
          onClose={close}
        >
          <form
            className="space-y-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void onCreate({
                partyId: value(form, 'partyId'),
                status: value(form, 'status'),
                communicationPreference: value(form, 'communicationPreference') || undefined,
              })
                .then(close)
                .catch(() => undefined);
            }}
          >
            <label className="space-y-1.5 text-sm font-semibold">
              Person or organization
              <SearchableSelect searchable name="partyId" required className={inputClass}>
                <option value="">Choose by name</option>
                {eligibleParties.map((party) => (
                  <option key={party.id} value={party.id}>
                    {party.displayName} — {party.partyNumber} ({humanize(party.kind)})
                  </option>
                ))}
              </SearchableSelect>
              <span className="block text-xs font-normal text-slate-500">
                Only active records without an existing owner profile are shown.
              </span>
            </label>
            <label className="space-y-1.5 text-sm font-semibold">
              Status
              <SearchableSelect searchable={false} name="status" className={inputClass}>
                <option value="PROSPECTIVE">Prospective</option>
                <option value="ACTIVE">Active</option>
              </SearchableSelect>
            </label>
            <label className="space-y-1.5 text-sm font-semibold">
              Preferred communication
              <SearchableSelect name="communicationPreference" className={inputClass}>
                <option value="">Not specified</option>
                <option value="PHONE">Phone</option>
                <option value="EMAIL">Email</option>
                <option value="WHATSAPP">WhatsApp</option>
              </SearchableSelect>
            </label>
            <button
              disabled={busy || !eligibleParties.length}
              className="w-full rounded-lg bg-[#0D47A1] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Create owner profile'}
            </button>
            {!eligibleParties.length ? (
              <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                Create an active person or organization first, or all available records already have
                owner profiles.
              </p>
            ) : null}
          </form>
        </Drawer>
      ) : null}
      {panel === 'view' && selected ? (
        <Drawer
          title={selected.party.displayName}
          description="Owner identity and operating preferences."
          onClose={close}
        >
          {detailLoading ? (
            <div className="space-y-3" aria-label="Loading owner details">
              <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-28 animate-pulse rounded-lg bg-slate-100" />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-sm font-bold text-slate-900">{selected.ownerNumber}</p>
                  <p className="text-xs text-slate-500">
                    {humanize(selected.party.kind)} owner profile
                  </p>
                </div>
                <StatusBadge value={selected.status} />
              </div>
              <DetailTabs
                tabs={OWNER_DETAIL_TABS}
                active={detailTab}
                onChange={setDetailTab}
                label="Owner detail sections"
              />
              {detailTab === 'overview' ? (
                <div className="space-y-4">
                  <dl className="grid gap-3 sm:grid-cols-2">
                    {[
                      ['Owner number', selected.ownerNumber],
                      ['Party number', selected.party.partyNumber],
                      ['Record type', humanize(selected.party.kind)],
                      ['Communication', selected.communicationPreference || 'Not specified'],
                      ['Status', humanize(selected.status)],
                      ['Notes', selected.notes || 'No notes'],
                    ].map(([term, content]) => (
                      <div key={term} className="rounded-lg border border-slate-200 p-3">
                        <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {term}
                        </dt>
                        <dd className="mt-1 text-sm font-semibold text-slate-800">{content}</dd>
                      </div>
                    ))}
                  </dl>
                  <section>
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                      Contact information
                    </h3>
                    {selected.party.contacts?.length ? (
                      <div className="space-y-2">
                        {selected.party.contacts.map((contact, index) => (
                          <p
                            key={contact.id ?? `${contact.type}-${index}`}
                            className="rounded-lg border border-slate-200 p-3 text-sm"
                          >
                            <strong>{contact.value || 'Protected contact'}</strong>
                            <span className="ml-2 text-xs text-slate-500">
                              {humanize(contact.type)}
                              {contact.primary ? ' · Primary' : ''}
                            </span>
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                        No contact information recorded.
                      </p>
                    )}
                  </section>
                </div>
              ) : null}
              {detailTab === 'owned-properties' ? (
                <OwnerPropertyPortfolio
                  ownerships={selected.ownerships ?? []}
                  businessDate={businessDate}
                  mode="current"
                />
              ) : null}
              {detailTab === 'documents' ? (
                canReadDocuments(selected) ? (
                  <EntityDocuments
                    entityType="Owner"
                    entityId={selected.partyId}
                    canManage={canManageDocuments(selected)}
                  />
                ) : (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    You do not have permission to view owner documents.
                  </p>
                )
              ) : null}
              {detailTab === 'ownership-history' ? (
                <OwnerPropertyPortfolio
                  ownerships={selected.ownerships ?? []}
                  businessDate={businessDate}
                  mode="history"
                />
              ) : null}
            </div>
          )}{' '}
        </Drawer>
      ) : null}
      {panel === 'edit' && selected ? (
        <Drawer
          title="Edit owner"
          description="Update owner status and communication preferences without losing history."
          onClose={close}
        >
          <form
            className="space-y-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void onUpdate(selected.partyId, {
                status: value(form, 'status'),
                communicationPreference: value(form, 'communicationPreference') || undefined,
                notes: value(form, 'notes') || undefined,
              })
                .then(close)
                .catch(() => undefined);
            }}
          >
            <div className="rounded-xl bg-slate-50 p-4">
              <strong>{selected.party.displayName}</strong>
              <p className="text-xs text-slate-500">{selected.ownerNumber}</p>
            </div>
            <label className="space-y-1.5 text-sm font-semibold">
              Status
              <SearchableSelect
                searchable={false}
                name="status"
                defaultValue={selected.status}
                className={inputClass}
              >
                {['PROSPECTIVE', 'ACTIVE', 'SUSPENDED', 'INACTIVE'].map((item) => (
                  <option key={item} value={item}>
                    {humanize(item)}
                  </option>
                ))}
              </SearchableSelect>
            </label>
            <label className="space-y-1.5 text-sm font-semibold">
              Preferred communication
              <SearchableSelect
                name="communicationPreference"
                defaultValue={selected.communicationPreference ?? ''}
                className={inputClass}
              >
                <option value="">Not specified</option>
                <option value="PHONE">Phone</option>
                <option value="EMAIL">Email</option>
                <option value="WHATSAPP">WhatsApp</option>
              </SearchableSelect>
            </label>
            <label className="space-y-1.5 text-sm font-semibold">
              Notes
              <textarea
                name="notes"
                defaultValue={selected.notes ?? ''}
                rows={4}
                className={inputClass}
              />
            </label>
            <button
              disabled={busy}
              className="w-full rounded-lg bg-[#0D47A1] px-4 py-2.5 text-sm font-bold text-white"
            >
              {busy ? 'Saving…' : 'Save owner'}
            </button>
          </form>
        </Drawer>
      ) : null}
    </div>
  );
}
