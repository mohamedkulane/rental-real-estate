'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Building2, Clock3, Handshake, KeyRound, MapPin, Plus, Search, SearchCheck, Users, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  DataTableFilter,
  DataTableEmpty,
  DataTableSurface,
  DataTableToolbar,
  TableActionButton,
} from '@/components/shared/data-table';
import { TableSkeleton } from '@/components/shared/loading-system';
import { PageHeader, StatusBadge } from '@/components/shared/ui';
import { api, hasPermission, type CursorPage } from '@/lib/phase3-api';
import { formatDate, humanize } from '@/lib/presentation';
import {
  AddRentalCustomerDrawer,
  AddRentalPropertyDrawer,
} from './rental-create-drawers';
import { WorkspaceFormDrawer } from '@/components/shared/workspace-form-drawer';
import { RentalShell, useRentalPrincipal } from './rental-shell';
import { useCreateDrawerState } from './use-create-drawer-state';

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/15';

type RentalPropertyRow = {
  id: string;
  propertyCode: string;
  name: string;
  propertyType: string;
  location: string;
  rentalStatus: string;
  monthlyRent: string | null;
  currency: string;
};

function rentalStatusLabel(value: string) {
  if (value === 'AVAILABLE') return 'Available';
  if (value === 'RENTED') return 'Rented';
  if (value === 'UNAVAILABLE') return 'Unavailable';
  return humanize(value);
}

export function RentalPropertyRegister() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { principal, error } = useRentalPrincipal();
  const { createOpen, openCreate, closeCreate } = useCreateDrawerState();
  const [search, setSearch] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [propertyStatus, setPropertyStatus] = useState('');
  const query = useQuery({
    queryKey: ['rental-properties', search],
    enabled: Boolean(principal && hasPermission(principal, 'portfolio.property.read')),
    queryFn: () => {
      const params = new URLSearchParams({ limit: '25' });
      if (search.trim()) params.set('search', search.trim());
      return api<CursorPage<RentalPropertyRow>>(`/rental/properties?${params.toString()}`);
    },
  });
  const canCreate = Boolean(principal && hasPermission(principal, 'portfolio.property.create'));
  const propertyRows = query.data?.items ?? [];
  const propertyTypes = useMemo(
    () => Array.from(new Set(propertyRows.map((row) => row.propertyType).filter(Boolean))).sort(),
    [propertyRows],
  );
  const propertyStatuses = useMemo(
    () => Array.from(new Set(propertyRows.map((row) => row.rentalStatus).filter(Boolean))).sort(),
    [propertyRows],
  );
  const filteredPropertyRows = propertyRows.filter(
    (row) =>
      (!propertyType || row.propertyType === propertyType) &&
      (!propertyStatus || row.rentalStatus === propertyStatus),
  );

  return (
    <RentalShell principal={principal} principalError={error} activeItem="properties">
      <PageHeader
        eyebrow="Portfolio"
        title="Properties"
        description="Rental properties with simple availability status. Waa la kireyn karaa / Waa la kireeyey."
        action={
          canCreate ? (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-800"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Property
            </button>
          ) : undefined
        }
      />
      <DataTableSurface className="mt-6">
        <DataTableToolbar>
          <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2">
          <label className="block min-w-[220px] flex-1">
            <span className="mb-1 block text-[12px] font-semibold text-slate-500">Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className={inputClass + ' pl-10'}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search properties"
              />
            </div>
          </label>
            <DataTableFilter
              label="Type"
              value={propertyType}
              onChange={setPropertyType}
              options={[{ value: '', label: 'All property types' }, ...propertyTypes.map((value) => ({ value, label: humanize(value) }))]}
            />
            <DataTableFilter
              label="Status"
              value={propertyStatus}
              onChange={setPropertyStatus}
              options={[{ value: '', label: 'All statuses' }, ...propertyStatuses.map((value) => ({ value, label: rentalStatusLabel(value) }))]}
            />
          </div>
        </DataTableToolbar>
        {query.isLoading ? (
          <TableSkeleton columns={5} />
        ) : !filteredPropertyRows.length ? (
          <DataTableEmpty
            title="No properties yet"
            description="Add the first rental property."
            action={
              canCreate ? (
                <button type="button" className="button primary" onClick={openCreate}>
                  Add Property
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {['Property', 'Type', 'Location', 'Rent', 'Status', 'Actions'].map((header) => (
                    <th key={header} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPropertyRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-4 py-3">
                      <Link className="flex items-center gap-2 font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)]" href={`/rental/properties/${row.id}`}>
                        <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>{row.propertyCode} — {row.name}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-[var(--primary)]" aria-hidden="true" />{humanize(row.propertyType)}</span></td>
                    <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-[var(--primary)]" aria-hidden="true" />{row.location}</span></td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5 text-[var(--primary)]" aria-hidden="true" />{row.monthlyRent ? `${row.currency} ${row.monthlyRent}` : '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={rentalStatusLabel(row.rentalStatus)} />
                    </td>
                    <td className="px-4 py-3">
                      <TableActionButton tone="open" href={`/rental/properties/${row.id}`}>
                        Open
                      </TableActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataTableSurface>
      {principal && canCreate ? (
        <AddRentalPropertyDrawer
          open={createOpen}
          onClose={closeCreate}
          principal={principal}
          onCreated={(purpose) => {
            closeCreate();
            void queryClient.invalidateQueries({ queryKey: ['rental-properties'] });
            if (purpose === 'SALE') router.push('/sales/properties');
          }}
        />
      ) : null}
    </RentalShell>
  );
}

type RentalCustomerRow = {
  id: string;
  leadNumber: string;
  displayName: string;
  stage: string;
  createdAt: string;
  wantedType: string | null;
  preferredLocation: string | null;
  minRentBudget: string | null;
  maxRentBudget: string | null;
  currency: string;
};

export function RentalCustomerRegister() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { principal, error } = useRentalPrincipal();
  const { createOpen, openCreate, closeCreate } = useCreateDrawerState();
  const [intentChooserOpen, setIntentChooserOpen] = useState(
    searchParams.get('chooseIntent') === '1',
  );
  const [search, setSearch] = useState('');
  const [wantedType, setWantedType] = useState('');
  const [location, setLocation] = useState('');
  const [stage, setStage] = useState('');
  const allowed = Boolean(principal && hasPermission(principal, 'crm.lead.read'));
  const query = useQuery({
    queryKey: ['rental-customers', search],
    enabled: allowed,
    queryFn: () => {
      const params = new URLSearchParams({ limit: '25' });
      if (search.trim()) params.set('search', search.trim());
      return api<CursorPage<RentalCustomerRow>>(`/rental/customers?${params.toString()}`);
    },
  });
  const canCreate = Boolean(principal && hasPermission(principal, 'crm.lead.create'));
  const customerRows = query.data?.items ?? [];
  const wantedTypes = useMemo(
    () =>
      Array.from(
        new Set(
          customerRows
            .map((row) => row.wantedType)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    [customerRows],
  );
  const locations = useMemo(
    () =>
      Array.from(
        new Set(
          customerRows
            .map((row) => row.preferredLocation)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    [customerRows],
  );
  const stages = useMemo(
    () => Array.from(new Set(customerRows.map((row) => row.stage).filter(Boolean))).sort(),
    [customerRows],
  );
  const filteredCustomerRows = customerRows.filter(
    (row) =>
      (!wantedType || row.wantedType === wantedType) &&
      (!location || row.preferredLocation === location) &&
      (!stage || row.stage === stage),
  );
  const matchedAndRented = customerRows.filter((lead) =>
    ['CONVERTED', 'RENTED', 'MATCHED'].includes(lead.stage.toUpperCase()),
  ).length;
  const newCustomers = customerRows.filter((lead) => lead.stage.toUpperCase() === 'NEW').length;
  const inProgress = customerRows.filter((lead) =>
    ['CONTACTED', 'QUALIFIED', 'MATCHING', 'NURTURING'].includes(lead.stage.toUpperCase()),
  ).length;

  useEffect(() => {
    setIntentChooserOpen(searchParams.get('chooseIntent') === '1');
  }, [searchParams]);

  const closeIntentChooser = () => {
    setIntentChooserOpen(false);
    router.replace('/rental/customers', { scroll: false });
  };

  return (
    <RentalShell principal={principal} principalError={error} activeItem="rental:customers">
      <div className="rental-customer-workspace">
        <PageHeader
          eyebrow="Rental"
          title="Rental Customers"
          description="People looking for a rental. Match them to available properties from their detail page."
          action={
            canCreate ? (
              <button type="button" onClick={openCreate} className="button primary">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add Rental Customer
              </button>
            ) : undefined
          }
        />

        <section className="rental-customer-kpis" aria-label="Rental customer summary">
          {[
            { label: 'Total Customers', value: customerRows.length, icon: Users },
            { label: 'New Customers', value: newCustomers, icon: SearchCheck },
            { label: 'Matched & Rented', value: matchedAndRented, icon: Handshake },
            { label: 'In Progress', value: inProgress, icon: Clock3 },
          ].map(({ label, value, icon: Icon }) => (
            <div className="rental-customer-kpi" key={label}>
              <span className="rental-customer-kpi-icon">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p>{label}</p>
                <strong>{value}</strong>
                <small>{label === 'New Customers' ? 'This month' : 'Current register'}</small>
              </div>
            </div>
          ))}
        </section>

      <DataTableSurface className="rental-customer-table-surface">
        <DataTableToolbar>
          <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2">
          <label className="block min-w-[220px] flex-1">
            <span className="mb-1 block text-[12px] font-semibold text-slate-500">Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className={inputClass + ' pl-10'}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search customers by name, phone or lead number..."
              />
            </div>
          </label>
            <DataTableFilter label="Wanted type" value={wantedType} onChange={setWantedType} options={[{ value: '', label: 'All wanted types' }, ...wantedTypes.map((value) => ({ value, label: humanize(value) }))]} />
            <DataTableFilter label="Location" value={location} onChange={setLocation} options={[{ value: '', label: 'All locations' }, ...locations.map((value) => ({ value, label: value }))]} />
            <DataTableFilter label="Match status" value={stage} onChange={setStage} options={[{ value: '', label: 'All match statuses' }, ...stages.map((value) => ({ value, label: humanize(value) }))]} />
          </div>
        </DataTableToolbar>
        {query.isLoading ? (
          <TableSkeleton columns={5} />
        ) : !filteredCustomerRows.length ? (
          <DataTableEmpty
            title="No rental customers yet"
            description="Add someone looking for a property to start matching."
            action={
              canCreate ? (
                <button type="button" className="button primary" onClick={openCreate}>
                  Add Rental Customer
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="rental-customer-table w-full min-w-[900px] text-left">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {['Customer', 'Wanted Type', 'Location', 'Budget', 'Match Status', 'Added On', 'Actions'].map(
                    (header) => (
                      <th
                        key={header}
                        className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500"
                      >
                        {header}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredCustomerRows.map((lead) => (
                  <tr key={lead.id} className="border-b border-slate-100 text-sm">
                    <td className="px-4 py-3">
                      <Link className="font-semibold text-slate-900 hover:text-[var(--primary)]" href={`/rental/customers/${lead.id}`}>
                        {lead.displayName}
                      </Link>
                      <span className="mt-1 block text-xs text-slate-500">{lead.leadNumber}</span>
                    </td>
                    <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--primary-soft)] px-2 py-1 text-xs font-medium text-[var(--primary)]"><Building2 className="h-3.5 w-3.5" aria-hidden="true" />{lead.wantedType ? humanize(lead.wantedType) : 'Not specified'}</span></td>
                    <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-[var(--primary)]" aria-hidden="true" />{lead.preferredLocation ?? '—'}</span></td>
                    <td className="px-4 py-3">
                      {lead.minRentBudget
                        ? `${lead.currency} ${lead.minRentBudget}${
                            lead.maxRentBudget && lead.maxRentBudget !== lead.minRentBudget
                              ? ` – ${lead.maxRentBudget}`
                              : ''
                          }`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={humanize(lead.stage)} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {formatDate(lead.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <TableActionButton tone="view" href={`/rental/customers/${lead.id}`}>
                          View
                        </TableActionButton>
                        <TableActionButton tone="open" href={`/rental/customers/${lead.id}`}>
                          Open
                        </TableActionButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataTableSurface>
      </div>
      {principal && canCreate ? (
        <AddRentalCustomerDrawer
          open={createOpen}
          onClose={closeCreate}
          principal={principal}
          onCreated={() => {
            closeCreate();
            void queryClient.invalidateQueries({ queryKey: ['rental-customers'] });
          }}
        />
      ) : null}
      {principal && canCreate ? (
        <WorkspaceFormDrawer
          open={intentChooserOpen}
          eyebrow="Customer"
          title="Add Customer"
          description="What is the customer looking for?"
          onClose={closeIntentChooser}
          size="md"
          layout="compact"
        >
          <div className="grid gap-2">
            <button
              type="button"
              className="workspace-choice-card group flex items-center gap-3 rounded-md border border-slate-200 bg-white p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30"
              onClick={() => {
                closeIntentChooser();
                openCreate();
              }}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary)]">
                <KeyRound className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="workspace-choice-card-title block text-sm font-semibold text-slate-900">Rent</span>
                <span className="workspace-choice-card-description mt-0.5 block text-xs text-slate-500">
                  Register a customer looking for a rental property.
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[var(--primary)]" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="workspace-choice-card group flex items-center gap-3 rounded-md border border-slate-200 bg-white p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30"
              onClick={() => router.push('/sales/buyers?create=1')}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary)]">
                <Building2 className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="workspace-choice-card-title block text-sm font-semibold text-slate-900">Buy</span>
                <span className="workspace-choice-card-description mt-0.5 block text-xs text-slate-500">
                  Open the buyer form for a property purchase.
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[var(--primary)]" aria-hidden="true" />
            </button>
          </div>
        </WorkspaceFormDrawer>
      ) : null}
    </RentalShell>
  );
}
