'use client';

import { SearchableSelect } from '@/components/shared/searchable-select';

import { Edit3, Eye, MoreHorizontal, Plus, Search, UserRound, X } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { humanize } from '@/lib/presentation';
import { PaginationControls, usePagination } from '@/components/shared/pagination';
import { StatusBadge } from '@/components/shared/ui';

export type PartyRecord = {
  id: string;
  partyNumber: string;
  kind: 'PERSON' | 'ORGANIZATION';
  displayName: string;
  active: boolean;
  owner?: { ownerNumber: string; status: string } | null;
  person?: {
    givenName: string;
    familyName: string;
    preferredName?: string | null;
    birthDate?: string | null;
    nationalityCode?: string | null;
  } | null;
  organization?: {
    legalName: string;
    tradingName?: string | null;
    registrationNumber?: string | null;
    contactPersonName?: string | null;
  } | null;
  contacts?: {
    id?: string;
    type: 'PHONE' | 'WHATSAPP' | 'EMAIL';
    value?: string;
    primary: boolean;
  }[];
  addresses?: {
    id?: string;
    type?: string;
    line1: string;
    city?: string | null;
    countryCode: string;
  }[];
  scopeBranchIds: string[];
};

type Panel = 'create' | 'view' | 'edit' | 'status' | null;
const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';
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
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
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

export function PartyDirectory({
  records,
  branches,
  busy,
  canCreate,
  canUpdate,
  onCreate,
  onUpdate,
  onLoadDetails,
}: {
  records: PartyRecord[];
  branches: { id: string; name: string }[];
  busy: boolean;
  canCreate: boolean;
  canUpdate: (record: PartyRecord) => boolean;
  onCreate: (input: Record<string, unknown>) => Promise<void>;
  onUpdate: (partyId: string, input: Record<string, unknown>) => Promise<void>;
  onLoadDetails: (partyId: string) => Promise<PartyRecord>;
}) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState('all');
  const [panel, setPanel] = useState<Panel>(null);
  const [selected, setSelected] = useState<PartyRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editContacts, setEditContacts] = useState<NonNullable<PartyRecord['contacts']>>([]);
  const [editAddresses, setEditAddresses] = useState<NonNullable<PartyRecord['addresses']>>([]);
  const filtered = useMemo(
    () =>
      records.filter((party) => {
        const search = query.trim().toLowerCase();
        const matchesSearch =
          !search ||
          [
            party.displayName,
            party.partyNumber,
            party.contacts?.map((item) => item.value).join(' '),
          ]
            .join(' ')
            .toLowerCase()
            .includes(search);
        return (
          matchesSearch &&
          (kind === 'all' || party.kind === kind) &&
          (status === 'all' || String(party.active) === status)
        );
      }),
    [records, query, kind, status],
  );
  const pagination = usePagination(filtered);
  useEffect(() => pagination.setPage(1), [query, kind, status]);
  const open = (next: Exclude<Panel, null>, party?: PartyRecord) => {
    setSelected(party ?? null);
    setPanel(next);
  };
  const openEdit = async (party: PartyRecord) => {
    setSelected(party);
    setPanel('edit');
    setDetailLoading(true);
    try {
      const detail = await onLoadDetails(party.id);
      setSelected(detail);
      setEditContacts(detail.contacts ?? []);
      setEditAddresses(detail.addresses ?? []);
    } catch {
      setPanel(null);
      setSelected(null);
    } finally {
      setDetailLoading(false);
    }
  };
  const close = () => {
    setPanel(null);
    setSelected(null);
  };
  const primaryContact = (party: PartyRecord) =>
    party.contacts?.find((item) => item.primary) ?? party.contacts?.[0];

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            Portfolio
          </p>
          <h1 className="text-2xl font-bold sm:text-3xl">People & organizations</h1>
          <p className="mt-1 text-sm text-slate-500">
            A shared directory for owners and future tenants, vendors, and business contacts.
          </p>
        </div>
        {canCreate ? (
          <button
            type="button"
            onClick={() => open('create')}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" /> Add record
          </button>
        ) : null}
      </header>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-[minmax(260px,1fr)_180px_180px]">
          <label className="relative">
            <span className="sr-only">Search people and organizations</span>
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, number, phone or email…"
              className={inputClass + ' pl-10'}
            />
          </label>
          <SearchableSelect
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            className={inputClass}
            aria-label="Filter by type"
          >
            <option value="all">All types</option>
            <option value="PERSON">People</option>
            <option value="ORGANIZATION">Organizations</option>
          </SearchableSelect>
          <SearchableSelect
            searchable={false}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className={inputClass}
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </SearchableSelect>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {['Name', 'Type', 'Primary contact', 'Owner profile', 'Status', 'Actions'].map(
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
              {pagination.pageItems.map((party) => {
                const contact = primaryContact(party);
                return (
                  <tr key={party.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => open('view', party)}
                        className="flex items-center gap-3 text-left"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                          {party.displayName
                            .split(/\s+/)
                            .slice(0, 2)
                            .map((part) => part[0])
                            .join('')
                            .toUpperCase()}
                        </span>
                        <span>
                          <strong className="block text-sm">{party.displayName}</strong>
                          <span className="text-xs text-slate-500">{party.partyNumber}</span>
                        </span>
                      </button>
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold text-slate-600">
                      {humanize(party.kind)}
                    </td>
                    <td className="px-5 py-4">
                      <span className="block text-xs font-semibold text-slate-700">
                        {contact?.value || 'Not recorded'}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {contact ? humanize(contact.type) : 'Contact'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold text-slate-600">
                      {party.owner ? party.owner.ownerNumber : 'Not an owner'}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge value={party.active} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <details className="relative inline-block">
                        <summary className="cursor-pointer list-none rounded-lg p-2 text-slate-400 hover:text-emerald-700">
                          <MoreHorizontal className="h-5 w-5" />
                        </summary>
                        <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white p-1.5 text-left shadow-xl">
                          <button
                            type="button"
                            onClick={() => open('view', party)}
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                          >
                            <Eye className="h-4 w-4" /> View details
                          </button>
                          {canUpdate(party) ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void openEdit(party)}
                                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                              >
                                <Edit3 className="h-4 w-4" /> Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => open('status', party)}
                                className="flex w-full rounded-md px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                              >
                                {party.active ? 'Deactivate' : 'Activate'}
                              </button>
                            </>
                          ) : null}
                        </div>
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!filtered.length ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No matching people or organizations.
          </div>
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
          title="Add person or organization"
          description="Create one reusable business identity. The record number is generated automatically."
          onClose={close}
        >
          <form
            className="space-y-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const recordKind = value(form, 'kind');
              const name = value(form, 'displayName');
              const names = name.split(/\s+/);
              const contact = value(form, 'contact');
              void onCreate({
                branchId: value(form, 'branchId'),
                kind: recordKind,
                displayName: name,
                ...(recordKind === 'PERSON'
                  ? {
                      person: {
                        givenName: names[0] || name,
                        familyName: names.slice(1).join(' ') || 'Not provided',
                      },
                    }
                  : { organization: { legalName: name } }),
                ...(contact
                  ? {
                      contacts: [
                        { type: value(form, 'contactType'), value: contact, primary: true },
                      ],
                    }
                  : {}),
              })
                .then(close)
                .catch(() => undefined);
            }}
          >
            <label className="space-y-1.5 text-sm font-semibold">
              Responsible branch
              <SearchableSelect name="branchId" className={inputClass} required>
                <option value="">Choose a branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </SearchableSelect>
            </label>
            <label className="space-y-1.5 text-sm font-semibold">
              Record type
              <SearchableSelect name="kind" className={inputClass}>
                <option value="PERSON">Person</option>
                <option value="ORGANIZATION">Organization</option>
              </SearchableSelect>
            </label>
            <label className="space-y-1.5 text-sm font-semibold">
              Full or legal name
              <input
                name="displayName"
                required
                minLength={2}
                placeholder="Amina Hassan"
                className={inputClass}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-semibold">
                Contact type
                <SearchableSelect name="contactType" className={inputClass}>
                  <option value="PHONE">Phone</option>
                  <option value="EMAIL">Email</option>
                  <option value="WHATSAPP">WhatsApp</option>
                </SearchableSelect>
              </label>
              <label className="space-y-1.5 text-sm font-semibold">
                Contact (optional)
                <input name="contact" className={inputClass} />
              </label>
            </div>
            <button
              disabled={busy}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Create record'}
            </button>
          </form>
        </Drawer>
      ) : null}
      {panel === 'view' && selected ? (
        <Drawer
          title={selected.displayName}
          description="Business identity and contact summary."
          onClose={close}
        >
          <div className="space-y-5">
            <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white">
                <UserRound className="h-6 w-6" />
              </span>
              <div>
                <strong>{selected.displayName}</strong>
                <p className="text-xs text-slate-500">
                  {selected.partyNumber} · {humanize(selected.kind)}
                </p>
              </div>
              <span className="ml-auto">
                <StatusBadge value={selected.active} />
              </span>
            </div>
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                Contacts
              </h3>
              <div className="space-y-2">
                {selected.contacts?.length ? (
                  selected.contacts.map((contact) => (
                    <div key={contact.id} className="rounded-lg border border-slate-200 p-3">
                      <strong className="text-sm">{contact.value || 'Protected contact'}</strong>
                      <p className="text-xs text-slate-500">
                        {humanize(contact.type)}
                        {contact.primary ? ' · Primary' : ''}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                    No contact recorded.
                  </p>
                )}
              </div>
            </section>
          </div>
        </Drawer>
      ) : null}
      {panel === 'edit' && selected ? (
        <Drawer
          title="Edit record"
          description="Review and update every editable business identity field."
          onClose={close}
        >
          <form
            className="space-y-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void onUpdate(selected.id, {
                displayName: value(form, 'displayName'),
                active: value(form, 'active') === 'true',
                ...(selected.kind === 'PERSON'
                  ? {
                      person: {
                        givenName: value(form, 'givenName'),
                        familyName: value(form, 'familyName'),
                        preferredName: value(form, 'preferredName') || undefined,
                        birthDate: value(form, 'birthDate') || undefined,
                        nationalityCode: value(form, 'nationalityCode') || undefined,
                      },
                    }
                  : {
                      organization: {
                        legalName: value(form, 'legalName'),
                        tradingName: value(form, 'tradingName') || undefined,
                        registrationNumber: value(form, 'registrationNumber') || undefined,
                        contactPersonName: value(form, 'contactPersonName') || undefined,
                      },
                    }),
                contacts: editContacts
                  .filter((contact) => contact.value?.trim())
                  .map((contact) => ({
                    type: contact.type,
                    value: contact.value?.trim(),
                    primary: contact.primary,
                  })),
                addresses: editAddresses
                  .filter((address) => address.line1.trim())
                  .map((address) => ({
                    type: address.type || 'PRIMARY',
                    line1: address.line1.trim(),
                    city: address.city?.trim() || undefined,
                    countryCode: address.countryCode.trim().toUpperCase(),
                  })),
              })
                .then(close)
                .catch(() => undefined);
            }}
          >
            {detailLoading ? (
              <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                Loading complete record...
              </p>
            ) : null}
            <div className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-semibold">
                Record number
                <input
                  value={selected.partyNumber}
                  disabled
                  className={inputClass + ' bg-slate-50'}
                />
              </label>
              <label className="space-y-1.5 text-sm font-semibold">
                Record type
                <input
                  value={humanize(selected.kind)}
                  disabled
                  className={inputClass + ' bg-slate-50'}
                />
              </label>
              <label className="space-y-1.5 text-sm font-semibold">
                Status
                <SearchableSelect
                  name="active"
                  defaultValue={String(selected.active)}
                  className={inputClass}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </SearchableSelect>
              </label>
            </div>
            {selected.kind === 'PERSON' ? (
              <section className="space-y-4">
                <h3 className="text-sm font-bold">Person details</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1.5 text-sm font-semibold">
                    Given name
                    <input
                      name="givenName"
                      required
                      defaultValue={selected.person?.givenName ?? ''}
                      className={inputClass}
                    />
                  </label>
                  <label className="space-y-1.5 text-sm font-semibold">
                    Family name
                    <input
                      name="familyName"
                      required
                      defaultValue={selected.person?.familyName ?? ''}
                      className={inputClass}
                    />
                  </label>
                  <label className="space-y-1.5 text-sm font-semibold">
                    Preferred name
                    <input
                      name="preferredName"
                      defaultValue={selected.person?.preferredName ?? ''}
                      className={inputClass}
                    />
                  </label>
                  <label className="space-y-1.5 text-sm font-semibold">
                    Birth date
                    <input
                      name="birthDate"
                      type="date"
                      defaultValue={selected.person?.birthDate?.slice(0, 10) ?? ''}
                      className={inputClass}
                    />
                  </label>
                  <label className="space-y-1.5 text-sm font-semibold">
                    Nationality code
                    <input
                      name="nationalityCode"
                      maxLength={2}
                      defaultValue={selected.person?.nationalityCode ?? ''}
                      className={inputClass}
                    />
                  </label>
                </div>
              </section>
            ) : (
              <section className="space-y-4">
                <h3 className="text-sm font-bold">Organization details</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1.5 text-sm font-semibold sm:col-span-2">
                    Legal name
                    <input
                      name="legalName"
                      required
                      defaultValue={selected.organization?.legalName ?? ''}
                      className={inputClass}
                    />
                  </label>
                  <label className="space-y-1.5 text-sm font-semibold">
                    Trading name
                    <input
                      name="tradingName"
                      defaultValue={selected.organization?.tradingName ?? ''}
                      className={inputClass}
                    />
                  </label>
                  <label className="space-y-1.5 text-sm font-semibold">
                    Registration number
                    <input
                      name="registrationNumber"
                      defaultValue={selected.organization?.registrationNumber ?? ''}
                      className={inputClass}
                    />
                  </label>
                  <label className="space-y-1.5 text-sm font-semibold sm:col-span-2">
                    Contact person
                    <input
                      name="contactPersonName"
                      defaultValue={selected.organization?.contactPersonName ?? ''}
                      className={inputClass}
                    />
                  </label>
                </div>
              </section>
            )}
            <label className="space-y-1.5 text-sm font-semibold">
              Display or legal name
              <input
                name="displayName"
                required
                minLength={2}
                defaultValue={selected.displayName}
                className={inputClass}
              />
            </label>
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">Contacts</h3>
                <button
                  type="button"
                  disabled={editContacts.length >= 10}
                  onClick={() =>
                    setEditContacts((items) => [
                      ...items,
                      { type: 'PHONE', value: '', primary: items.length === 0 },
                    ])
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold disabled:opacity-50"
                >
                  Add contact
                </button>
              </div>
              {editContacts.map((contact, index) => (
                <div
                  key={contact.id ?? index}
                  className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-[140px_1fr_auto]"
                >
                  <SearchableSelect
                    value={contact.type}
                    onChange={(event) =>
                      setEditContacts((items) =>
                        items.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                type: event.target.value as 'PHONE' | 'WHATSAPP' | 'EMAIL',
                              }
                            : item,
                        ),
                      )
                    }
                    className={inputClass}
                    aria-label={'Contact type ' + (index + 1)}
                  >
                    <option value="PHONE">Phone</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="EMAIL">Email</option>
                  </SearchableSelect>
                  <input
                    value={contact.value ?? ''}
                    onChange={(event) =>
                      setEditContacts((items) =>
                        items.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, value: event.target.value } : item,
                        ),
                      )
                    }
                    className={inputClass}
                    aria-label={'Contact value ' + (index + 1)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setEditContacts((items) =>
                        items.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    className="text-xs font-bold text-red-600"
                  >
                    Remove
                  </button>
                  <label className="flex items-center gap-2 text-xs font-semibold sm:col-span-3">
                    <input
                      type="radio"
                      name="primaryContact"
                      checked={contact.primary}
                      onChange={() =>
                        setEditContacts((items) =>
                          items.map((item, itemIndex) => ({
                            ...item,
                            primary: itemIndex === index,
                          })),
                        )
                      }
                    />
                    Primary contact
                  </label>
                </div>
              ))}
            </section>
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">Addresses</h3>
                <button
                  type="button"
                  disabled={editAddresses.length >= 5}
                  onClick={() =>
                    setEditAddresses((items) => [
                      ...items,
                      { type: 'PRIMARY', line1: '', city: '', countryCode: 'SO' },
                    ])
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold disabled:opacity-50"
                >
                  Add address
                </button>
              </div>
              {editAddresses.map((address, index) => (
                <div
                  key={address.id ?? index}
                  className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2"
                >
                  <input
                    value={address.type ?? 'PRIMARY'}
                    onChange={(event) =>
                      setEditAddresses((items) =>
                        items.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, type: event.target.value } : item,
                        ),
                      )
                    }
                    className={inputClass}
                    aria-label={'Address type ' + (index + 1)}
                  />
                  <input
                    value={address.countryCode}
                    maxLength={2}
                    required
                    onChange={(event) =>
                      setEditAddresses((items) =>
                        items.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, countryCode: event.target.value } : item,
                        ),
                      )
                    }
                    className={inputClass}
                    aria-label={'Country code ' + (index + 1)}
                  />
                  <input
                    value={address.line1}
                    required
                    onChange={(event) =>
                      setEditAddresses((items) =>
                        items.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, line1: event.target.value } : item,
                        ),
                      )
                    }
                    className={inputClass + ' sm:col-span-2'}
                    aria-label={'Address line ' + (index + 1)}
                  />
                  <input
                    value={address.city ?? ''}
                    onChange={(event) =>
                      setEditAddresses((items) =>
                        items.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, city: event.target.value } : item,
                        ),
                      )
                    }
                    className={inputClass}
                    aria-label={'City ' + (index + 1)}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setEditAddresses((items) =>
                        items.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    className="rounded-lg border border-red-200 px-3 py-2.5 text-xs font-bold text-red-600"
                  >
                    Remove address
                  </button>
                </div>
              ))}
            </section>
            <button
              disabled={busy}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white"
            >
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </Drawer>
      ) : null}
      {panel === 'status' && selected ? (
        <Drawer
          title={selected.active ? 'Deactivate record' : 'Activate record'}
          description="The identity and business history remain available."
          onClose={close}
        >
          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <strong>{selected.displayName}</strong>
              <p className="text-xs text-slate-500">{selected.partyNumber}</p>
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
                (selected.active ? 'bg-red-600' : 'bg-emerald-600')
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
