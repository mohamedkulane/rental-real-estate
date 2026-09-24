'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock3, Handshake, Plus, Search, SearchCheck, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
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
          <label className="block min-w-0 flex-1">
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
        </DataTableToolbar>
        {query.isLoading ? (
          <TableSkeleton columns={5} />
        ) : !query.data?.items.length ? (
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
                {query.data.items.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-4 py-3">
                      <Link className="font-semibold text-emerald-700" href={`/rental/properties/${row.id}`}>
                        {row.propertyCode} — {row.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{humanize(row.propertyType)}</td>
                    <td className="px-4 py-3">{row.location}</td>
                    <td className="px-4 py-3">
                      {row.monthlyRent ? `${row.currency} ${row.monthlyRent}` : '—'}
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
          <label className="block min-w-0 flex-1">
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
        </DataTableToolbar>
        {query.isLoading ? (
          <TableSkeleton columns={5} />
        ) : !query.data?.items.length ? (
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
                {query.data.items.map((lead) => (
                  <tr key={lead.id} className="border-b border-slate-100 text-sm">
                    <td className="px-4 py-3">
                      <Link className="font-semibold text-slate-900 hover:text-[var(--primary)]" href={`/rental/customers/${lead.id}`}>
                        {lead.displayName}
                      </Link>
                      <span className="mt-1 block text-xs text-slate-500">{lead.leadNumber}</span>
                    </td>
                    <td className="px-4 py-3">{lead.wantedType ? humanize(lead.wantedType) : 'Not specified'}</td>
                    <td className="px-4 py-3">{lead.preferredLocation ?? '—'}</td>
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
        >
          <div className="grid gap-3">
            <button
              type="button"
              className="rounded-lg border border-slate-200 p-4 text-left hover:border-emerald-500 hover:bg-emerald-50"
              onClick={() => {
                closeIntentChooser();
                openCreate();
              }}
            >
              <span className="block text-sm font-bold text-slate-900">Rent</span>
              <span className="mt-1 block text-xs text-slate-500">
                Open the rental customer form.
              </span>
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 p-4 text-left hover:border-emerald-500 hover:bg-emerald-50"
              onClick={() => router.push('/sales/buyers?create=1')}
            >
              <span className="block text-sm font-bold text-slate-900">Buy</span>
              <span className="mt-1 block text-xs text-slate-500">
                Open the existing buyer form.
              </span>
            </button>
          </div>
        </WorkspaceFormDrawer>
      ) : null}
    </RentalShell>
  );
}
