'use client';

import { SearchableSelect } from '@/components/shared/searchable-select';
import { DetailTabs } from '@/components/shared/detail-tabs';
import { OWNER_DETAIL_TABS } from '../portfolio-ia';

import { Building2, Plus, Search, X } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { humanize } from '@/lib/presentation';
import type { PartyRecord } from './party-directory';
import { TableActionButton, TableActionGroup } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/ui';
import { OwnerPropertyPortfolio } from '../ownership-workflow';
import { EntityDocuments } from '../entity-documents';
import type { PropertyOwnershipRecord } from '../ownership-model';
import type { Principal } from '@/lib/phase3-api';
import { AddOwnerDrawer } from '../add-owner-drawer';

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

type Panel = 'view' | 'edit' | null;
export type OwnerDetailTab = (typeof OWNER_DETAIL_TABS)[number]['key'];
const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#215E61] focus:ring-2 focus:ring-[#215E61]/15';

function splitDisplayName(name: string): { givenName: string; familyName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { givenName: '', familyName: '' };
  if (parts.length === 1) return { givenName: parts[0]!, familyName: parts[0]! };
  return { givenName: parts[0]!, familyName: parts.slice(1).join(' ') };
}

function primaryContact(
  contacts: PartyRecord['contacts'] | undefined,
  type: 'PHONE' | 'EMAIL',
): string {
  const match = contacts?.find((contact) => contact.type === type && contact.value);
  return match?.value?.trim() ?? '';
}
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
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-3 sm:p-4"
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
      <aside className="relative flex max-h-[min(90vh,820px)] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="form-panel-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {children}
        </div>
      </aside>
    </div>
  );
}

export function OwnerDirectory({
  records,
  principal,
  businessDate,
  busy,
  canCreateOwner,
  canUpdate,
  canReadDocuments,
  canManageDocuments,
  onOwnerCreated,
  onUpdate,
  onLoadDetails,
  onQueryChange,
  initialDetailTab = 'overview',
  initialCreateOpen = false,
  onCreateClose,
}: {
  records: OwnerRecord[];
  principal: Principal;
  businessDate: string;
  busy: boolean;
  canCreateOwner: boolean;
  canUpdate: (record: OwnerRecord) => boolean;
  canReadDocuments: (record: OwnerRecord) => boolean;
  canManageDocuments: (record: OwnerRecord) => boolean;
  onOwnerCreated: () => Promise<void> | void;
  onUpdate: (partyId: string, input: Record<string, unknown>) => Promise<void>;
  onLoadDetails: (partyId: string) => Promise<OwnerRecord>;
  onQueryChange?: (filters: Record<string, string>) => void;
  initialDetailTab?: OwnerDetailTab;
  initialCreateOpen?: boolean;
  onCreateClose?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [panel, setPanel] = useState<Panel>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<OwnerRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<OwnerDetailTab>(initialDetailTab);
  useEffect(() => {
    setDetailTab(initialDetailTab);
  }, [initialDetailTab]);
  useEffect(() => {
    if (initialCreateOpen && canCreateOwner) setCreateOpen(true);
  }, [initialCreateOpen, canCreateOwner]);
  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        onQueryChange?.({
          search: query.trim(),
          status: status === 'all' ? '' : status,
        }),
      350,
    );
    return () => window.clearTimeout(timer);
  }, [onQueryChange, query, status]);

  const filtered = records;
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
  const openEdit = async (record: OwnerRecord) => {
    setSelected(record);
    setPanel('edit');
    setDetailLoading(true);
    try {
      setSelected(await onLoadDetails(record.partyId));
    } catch {
      setPanel(null);
      setSelected(null);
    } finally {
      setDetailLoading(false);
    }
  };
  const close = () => {
    setPanel(null);
    setDetailTab(initialDetailTab);
    setSelected(null);
  };
  const closeCreate = () => {
    setCreateOpen(false);
    onCreateClose?.();
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
        {canCreateOwner ? (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
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
              className={inputClass + ' pl-10 pr-10'}
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear Owner search"
                onClick={() => setQuery('')}
                className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
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
              {filtered.map((owner) => (
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
                    <TableActionGroup>
                      <TableActionButton tone="view" onClick={() => void openView(owner)}>
                        View
                      </TableActionButton>
                      {canUpdate(owner) ? (
                        <TableActionButton tone="edit" onClick={() => void openEdit(owner)}>
                          Edit
                        </TableActionButton>
                      ) : null}
                    </TableActionGroup>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length ? (
          <div className="p-10 text-center text-sm text-slate-500">No matching owners.</div>
        ) : null}
      </section>
      <AddOwnerDrawer
        open={createOpen}
        principal={principal}
        onClose={closeCreate}
        onCreated={() => {
          closeCreate();
          void onOwnerCreated();
        }}
      />
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
          description="Update the owner name, contacts, status, and preferences."
          onClose={close}
        >
          {detailLoading ? (
            <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-500">
              Loading owner details…
            </p>
          ) : (
          <form
            key={selected.partyId + ':' + (selected.party.displayName ?? '')}
            className="space-y-4"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const displayName = value(form, 'displayName');
              const phone = value(form, 'phone');
              const email = value(form, 'email');
              const names = splitDisplayName(displayName);
              const existingContacts = selected.party.contacts ?? [];
              const contactsMasked = existingContacts.some((contact) => contact.masked);
              const preserved = existingContacts
                .filter((contact) => contact.type !== 'PHONE' && contact.type !== 'EMAIL')
                .filter((contact) => contact.value?.trim())
                .map((contact) => ({
                  type: contact.type,
                  value: contact.value!.trim(),
                  primary: contact.primary,
                }));
              const contacts = [
                ...preserved,
                ...(phone ? [{ type: 'PHONE' as const, value: phone, primary: true }] : []),
                ...(email
                  ? [{ type: 'EMAIL' as const, value: email, primary: !phone }]
                  : []),
              ];
              void onUpdate(selected.partyId, {
                displayName,
                ...(selected.party.kind === 'PERSON'
                  ? {
                      person: {
                        givenName: names.givenName || displayName,
                        familyName: names.familyName || displayName,
                      },
                    }
                  : {
                      organization: {
                        legalName: displayName,
                        tradingName: displayName,
                      },
                    }),
                ...(!contactsMasked && (phone || email || preserved.length)
                  ? { contacts }
                  : !contactsMasked && existingContacts.length
                    ? { contacts: preserved }
                    : {}),
                status: value(form, 'status'),
                communicationPreference: value(form, 'communicationPreference') || undefined,
                notes: value(form, 'notes') || undefined,
              })
                .then(close)
                .catch(() => undefined);
            }}
          >
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
              Owner number
              <input
                value={selected.ownerNumber}
                disabled
                className={inputClass + ' bg-slate-50 text-slate-500'}
              />
            </label>
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
              Display name
              <input
                name="displayName"
                required
                minLength={2}
                defaultValue={selected.party.displayName}
                className={inputClass}
                autoFocus
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                Phone
                <input
                  name="phone"
                  defaultValue={primaryContact(selected.party.contacts, 'PHONE')}
                  className={inputClass}
                  placeholder="+25261..."
                />
              </label>
              <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                Email
                <input
                  name="email"
                  type="email"
                  defaultValue={primaryContact(selected.party.contacts, 'EMAIL')}
                  className={inputClass}
                  placeholder="name@example.com"
                />
              </label>
            </div>
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
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
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
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
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
              Notes
              <textarea
                name="notes"
                defaultValue={selected.notes ?? ''}
                rows={3}
                className={inputClass}
              />
            </label>
            <button
              disabled={busy}
              className="button primary w-full"
              type="submit"
            >
              {busy ? 'Saving…' : 'Save owner'}
            </button>
          </form>
          )}
        </Drawer>
      ) : null}
    </div>
  );
}
