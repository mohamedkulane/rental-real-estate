'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { PageHeader, StatusBadge } from '@/components/shared/ui';
import { TableSkeleton } from '@/components/shared/loading-system';
import { WorkspaceFormDrawer, WorkspaceFormDrawerFooter } from '@/components/shared/workspace-form-drawer';
import { api, hasPermission, type CursorPage, userFacingError } from '@/lib/phase3-api';
import { formatDate, humanize } from '@/lib/presentation';
import toast from '@/lib/toast';
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

type CustomerLease = {
  id: string;
  leaseNumber: string;
  status: string;
  rentAmount: string;
  currency: string;
  leaseStartDate: string;
  leaseEndDate: string | null;
  rentableSpace: { name: string; property: { name: string } };
};

const customerInputClass =
  'w-full rounded-md border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/15';

function RentalCustomerEditDrawer({
  lead,
  open,
  onClose,
  onSaved,
}: {
  lead: LeadDetail;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api(`/crm/leads/${lead.id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Customer changes saved.');
      onSaved();
      onClose();
    },
    onError: (cause) => toast.error(userFacingError(cause)),
  });

  return (
    <WorkspaceFormDrawer
      open={open}
      eyebrow="Rental customer"
      title="Edit customer"
      description="Update the customer record without leaving the rental workflow."
      onClose={onClose}
      size="md"
      layout="compact"
      footer={
        <WorkspaceFormDrawerFooter
          formId="edit-rental-customer"
          onCancel={onClose}
          submitLabel="Save changes"
          isPending={mutation.isPending}
        />
      }
    >
      <form
        id="edit-rental-customer"
        className="space-y-4"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const phone = String(form.get('phone') ?? '').trim();
          const email = String(form.get('email') ?? '').trim();
          mutation.mutate({
            expectedVersion: lead.version,
            reason: String(form.get('reason') ?? '').trim(),
            displayName: String(form.get('displayName') ?? '').trim(),
            ...(phone ? { phone } : {}),
            ...(email ? { email } : {}),
          });
        }}
      >
        <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
          Customer name
          <input name="displayName" required defaultValue={lead.displayName} className={customerInputClass} />
        </label>
        <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
          New phone number (optional)
          <input name="phone" type="tel" minLength={5} className={customerInputClass} placeholder={lead.contact.phone ?? lead.contact.phoneMasked ?? ''} />
        </label>
        <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
          New email (optional)
          <input name="email" type="email" className={customerInputClass} placeholder={lead.contact.email ?? lead.contact.emailMasked ?? ''} />
        </label>
        <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
          Reason for change
          <textarea name="reason" required minLength={3} rows={2} className={customerInputClass} />
        </label>
      </form>
    </WorkspaceFormDrawer>
  );
}

export function RentalCustomerDetailWorkspace({ leadId }: { leadId: string }) {
  const { principal, error } = useRentalPrincipal();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const query = useQuery({
    queryKey: ['rental-customer', leadId],
    enabled: Boolean(principal),
    queryFn: () => api<LeadDetail>(`/rental/customers/${leadId}`),
  });
  const leases = useQuery({
    queryKey: ['rental-customer-leases', leadId],
    enabled: Boolean(principal && hasPermission(principal, 'lease.read')),
    queryFn: () => api<CursorPage<CustomerLease>>(`/leases?leadId=${leadId}&limit=20`),
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
                  <button type="button" className="button secondary" onClick={() => setEditOpen(true)}>
                    Edit customer
                  </button>
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
                <h2 className="text-base font-semibold text-[#1D2128]">Current progress</h2>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-600">Rental journey</span>
                  <StatusBadge value={humanize(lead.stage)} />
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  Continue with matching and viewings. A lease becomes available only after a confirmed agreement.
                </p>
              </section>
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
          <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Lease history</h2>
                <p className="mt-1 text-sm text-slate-600">Confirmed tenancies created from this customer journey.</p>
              </div>
              <Link className="button secondary" href="/leasing/leases">Open all leases</Link>
            </div>
            {leases.isLoading ? (
              <div className="mt-4"><TableSkeleton columns={4} /></div>
            ) : (leases.data?.items ?? []).length ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                    <tr><th className="px-3 py-2">Lease</th><th className="px-3 py-2">Property / unit</th><th className="px-3 py-2">Term</th><th className="px-3 py-2">Rent</th><th className="px-3 py-2">Status</th></tr>
                  </thead>
                  <tbody>
                    {(leases.data?.items ?? []).map((lease) => (
                      <tr key={lease.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-3"><Link className="font-semibold text-emerald-800" href={`/leasing/leases/${lease.id}`}>{lease.leaseNumber}</Link></td>
                        <td className="px-3 py-3">{lease.rentableSpace.property.name} · {lease.rentableSpace.name}</td>
                        <td className="px-3 py-3">{formatDate(lease.leaseStartDate)} → {lease.leaseEndDate ? formatDate(lease.leaseEndDate) : 'Open-ended'}</td>
                        <td className="px-3 py-3 font-semibold">{lease.currency} {lease.rentAmount}</td>
                        <td className="px-3 py-3"><StatusBadge value={humanize(lease.status)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No lease has been created for this customer yet.</p>
            )}
          </section>
          {hasPermission(principal, 'crm.lead.update') ? (
            <RentalCustomerEditDrawer
              lead={lead}
              open={editOpen}
              onClose={() => setEditOpen(false)}
              onSaved={() => void queryClient.invalidateQueries({ queryKey: ['rental-customer', leadId] })}
            />
          ) : null}
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
