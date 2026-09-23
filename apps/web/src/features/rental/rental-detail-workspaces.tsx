'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { PageHeader, StatusBadge } from '@/components/shared/ui';
import { TableSkeleton } from '@/components/shared/loading-system';
import { api, hasPermission, userFacingError } from '@/lib/phase3-api';
import { humanize } from '@/lib/presentation';
import { PreferenceSummary } from '@/features/crm/crm-preferences';
import type { LeadDetail } from '@/features/crm/crm-types';
import { RentalCustomerMatches } from './rental-matches';
import { RentalShell, useRentalPrincipal } from './rental-shell';

function rentalStatusLabel(value: string) {
  if (value === 'AVAILABLE') return 'Available';
  if (value === 'RENTED') return 'Rented';
  if (value === 'UNAVAILABLE') return 'Unavailable';
  return humanize(value);
}

export function RentalCustomerDetailWorkspace({ leadId }: { leadId: string }) {
  const { principal, error } = useRentalPrincipal();
  const query = useQuery({
    queryKey: ['rental-customer', leadId],
    enabled: Boolean(principal),
    queryFn: () => api<LeadDetail>(`/rental/customers/${leadId}`),
  });

  if (!principal) {
    return (
      <RentalShell principal={null} principalError={error} activeItem="rental:customers">
        <TableSkeleton columns={1} />
      </RentalShell>
    );
  }

  const lead = query.data;

  return (
    <RentalShell principal={principal} principalError={error} activeItem="rental:customers">
      {query.isLoading ? <TableSkeleton columns={1} /> : null}
      {query.isError ? (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{userFacingError(query.error)}</p>
      ) : null}
      {lead ? (
        <>
          <PageHeader
            eyebrow={lead.leadNumber}
            title={lead.displayName}
            description={`Rental customer · ${lead.responsibleBranch.name}`}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={humanize(lead.stage)} />
                <Link className="button secondary" href="/rental/customers">
                  Back to customers
                </Link>
                {hasPermission(principal, 'crm.lead.update') ? (
                  <Link className="button secondary" href={`/crm/leads/${lead.id}/edit`}>
                    Edit customer
                  </Link>
                ) : null}
                {hasPermission(principal, 'lease.create') ? (
                  <Link className="button primary" href={`/rental/leases/new?leadId=${lead.id}`}>
                    Create Lease
                  </Link>
                ) : null}
              </div>
            }
          />

          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <h2 className="mb-4 text-lg font-semibold text-[#1D2128]">
                Requirements and preferences
              </h2>
              <PreferenceSummary intent={lead.intent} preference={lead.preference} />
              <div className="mt-8 border-t border-slate-100 pt-6">
                <RentalCustomerMatches lead={lead} principal={principal} />
              </div>
            </section>

            <aside className="space-y-4">
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-[#1D2128]">Contact</h2>
                <p className="mt-3 break-words text-sm text-slate-800">
                  {lead.contact?.phone ?? lead.contact?.phoneMasked ?? 'Phone not provided'}
                </p>
                <p className="mt-2 break-words text-sm text-slate-800">
                  {lead.contact?.email ?? lead.contact?.emailMasked ?? 'Email not provided'}
                </p>
              </section>
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-[#1D2128]">Responsibility</h2>
                <p className="mt-3 text-sm text-slate-800">
                  {lead.currentAssignee?.displayName ?? 'Unassigned'}
                </p>
                <p className="mt-2 text-sm text-slate-800">{lead.responsibleBranch.name}</p>
                <p className="mt-2 text-sm text-slate-600">
                  {lead.source.label}
                  {lead.source.status === 'INACTIVE' ? ' (Inactive)' : ''}
                </p>
              </section>
              {lead.party ? (
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-base font-semibold text-[#1D2128]">Linked party</h2>
                  <p className="mt-3 text-sm text-slate-800">{lead.party.displayName}</p>
                  <p className="mt-1 text-xs text-slate-500">{lead.party.partyNumber}</p>
                </section>
              ) : null}
            </aside>
          </div>
        </>
      ) : null}
    </RentalShell>
  );
}

export function RentalPropertyDetailWorkspace({ propertyId }: { propertyId: string }) {
  const { principal, error } = useRentalPrincipal();
  const query = useQuery({
    queryKey: ['rental-property', propertyId],
    enabled: Boolean(principal),
    queryFn: () =>
      api<{
        id: string;
        propertyCode: string;
        name: string;
        propertyType: string;
        location: string;
        rentalStatus: string;
        monthlyRent: string | null;
        currency: string;
        ownerDisplayName: string | null;
        ownerNumber: string | null;
        listing: { listingNumber: string; status: string } | null;
        spaces: Array<{ id: string; spaceCode: string; name: string }>;
      }>(`/rental/properties/${propertyId}`),
  });

  if (!principal) {
    return (
      <RentalShell principal={null} principalError={error} activeItem="properties">
        <TableSkeleton columns={1} />
      </RentalShell>
    );
  }

  const property = query.data;

  return (
    <RentalShell principal={principal} principalError={error} activeItem="properties">
      {query.isLoading ? <TableSkeleton columns={1} /> : null}
      {query.isError ? (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{userFacingError(query.error)}</p>
      ) : null}
      {property ? (
        <div className="space-y-5">
          <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-[#E8F3F3] text-[#215E61]">
                  <Building2 className="h-7 w-7" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#215E61]">
                    {property.propertyCode}
                  </p>
                  <h1 className="mt-1 text-[28px] font-bold leading-tight text-[#1D2128]">
                    {property.name}
                  </h1>
                  <p className="mt-2 text-[15px] font-medium text-slate-600">
                    {humanize(property.propertyType)} · {property.location}
                  </p>
                  {property.ownerDisplayName ? (
                    <p className="mt-1 text-sm text-slate-500">
                      Owner:{' '}
                      <span className="font-semibold text-[#1D2128]">
                        {property.ownerDisplayName}
                        {property.ownerNumber ? ` (${property.ownerNumber})` : ''}
                      </span>
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={rentalStatusLabel(property.rentalStatus)} />
                <Link className="button secondary" href="/rental/properties">
                  Back
                </Link>
                <Link
                  className="button primary"
                  href={`/portfolio/properties/${property.id}`}
                >
                  Full details
                </Link>
                {hasPermission(principal, 'lease.create') ? (
                  <Link
                    className="button primary"
                    href={`/rental/leases/new?propertyId=${property.id}&rent=${encodeURIComponent(property.monthlyRent ?? '')}`}
                  >
                    Create Lease
                  </Link>
                ) : null}
              </div>
            </div>
          </header>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-[18px] font-semibold text-[#1D2128]">Property details</h2>
              <dl className="mt-4 divide-y divide-slate-100">
                {[
                  { label: 'Monthly rent', value: property.monthlyRent ? `${property.currency} ${property.monthlyRent}` : 'Not set' },
                  { label: 'Units', value: String(property.spaces.length) },
                  {
                    label: 'Listing',
                    value: property.listing
                      ? `${property.listing.listingNumber} · ${humanize(property.listing.status)}`
                      : 'Registered inventory (no marketing listing yet)',
                  },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between gap-4 py-3 text-sm">
                    <dt className="text-slate-500">{item.label}</dt>
                    <dd className="font-semibold text-[#1D2128]">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-[18px] font-semibold text-[#1D2128]">Units</h2>
              <ul className="mt-4 space-y-2">
                {property.spaces.map((space) => (
                  <li key={space.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span className="font-semibold text-[#1D2128]">{space.name}</span>
                    <span className="ml-2 text-slate-500">{space.spaceCode}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      ) : null}
    </RentalShell>
  );
}
