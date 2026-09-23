'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from '@/lib/toast';
import { DetailTabs } from '@/components/shared/detail-tabs';
import { PageHeader, StatusBadge } from '@/components/shared/ui';
import { TableSkeleton } from '@/components/shared/loading-system';
import { OperationsShell, useOperationsPrincipal } from '@/features/leasing/operations-shell';
import { api, hasPermission, userFacingError } from '@/lib/phase3-api';
import { humanize } from '@/lib/presentation';

const tabs = [
  { key: 'overview', label: 'Overview' },
  { key: 'payments', label: 'Payments' },
  { key: 'renewal', label: 'Renewal' },
  { key: 'move-in', label: 'Move-In' },
  { key: 'documents', label: 'Documents' },
  { key: 'activity', label: 'Activity' },
] as const;

type TabKey = (typeof tabs)[number]['key'];

type LeaseDetail = {
  id: string;
  leaseNumber: string;
  status: string;
  rentAmount: string;
  currency: string;
  leaseStartDate: string;
  leaseEndDate: string;
  branchId: string;
  rentableSpace: {
    id: string;
    spaceCode: string;
    name: string;
    property: { id: string; propertyCode: string; name: string; city: string };
  };
  parties: Array<{ role: string; party: { id: string; displayName: string } }>;
  moveIn: { id: string; status: string; scheduledDate: string } | null;
  application: {
    id: string;
    applicationNumber: string;
    lead: { id: string; displayName: string; leadNumber: string };
  } | null;
  renewals: Array<{ id: string; status: string; proposedRent: string; currency: string }>;
};

export function LeaseDetailWorkspace({ leaseId }: { leaseId: string }) {
  const { principal, error } = useOperationsPrincipal();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>('overview');
  const query = useQuery({
    queryKey: ['lease-detail', leaseId],
    enabled: Boolean(principal),
    queryFn: () => api<LeaseDetail>(`/rental/leases/${leaseId}`),
  });
  const startRenewal = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api('/renewals', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Renewal started.');
      void queryClient.invalidateQueries({ queryKey: ['lease-detail', leaseId] });
    },
    onError: (cause) => toast.error(userFacingError(cause)),
  });
  const scheduleMoveIn = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api('/move-ins', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Move-in scheduled.');
      void queryClient.invalidateQueries({ queryKey: ['lease-detail', leaseId] });
    },
    onError: (cause) => toast.error(userFacingError(cause)),
  });

  if (!principal) {
    return (
      <OperationsShell principal={null} error={error} activeItem="leases">
        <TableSkeleton columns={1} />
      </OperationsShell>
    );
  }

  const lease = query.data;
  const tenants = lease?.parties.filter((party) => party.role === 'TENANT') ?? [];

  return (
    <OperationsShell principal={principal} error={error} activeItem="leases">
      {query.isLoading ? <TableSkeleton columns={1} /> : null}
      {query.isError ? (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{userFacingError(query.error)}</p>
      ) : null}
      {lease ? (
        <>
          <PageHeader
            eyebrow="Lease"
            title={lease.leaseNumber}
            description={`${lease.rentableSpace.property.name} · ${humanize(lease.status)}`}
            action={
              <Link className="button secondary" href="/leasing/leases">
                Back to leases
              </Link>
            }
          />
          <div className="mt-6">
            <DetailTabs tabs={tabs} active={tab} onChange={setTab} label="Lease sections" />
          </div>

          {tab === 'overview' ? (
            <section className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Property</p>
                <Link
                  className="mt-2 block text-sm font-semibold text-emerald-700"
                  href={`/rental/properties/${lease.rentableSpace.property.id}`}
                >
                  {lease.rentableSpace.property.propertyCode} — {lease.rentableSpace.property.name}
                </Link>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Rent</p>
                <p className="mt-2 text-sm font-semibold">
                  {lease.currency} {lease.rentAmount}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Term</p>
                <p className="mt-2 text-sm font-semibold">
                  {lease.leaseStartDate.slice(0, 10)} → {lease.leaseEndDate.slice(0, 10)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:col-span-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Tenants</p>
                <p className="mt-2 text-sm">
                  {tenants.map((tenant) => tenant.party.displayName).join(', ') || '—'}
                </p>
                {lease.application?.lead ? (
                  <p className="mt-2 text-sm text-slate-600">
                    Customer:{' '}
                    <Link className="text-emerald-700 underline" href={`/rental/customers/${lease.application.lead.id}`}>
                      {lease.application.lead.displayName}
                    </Link>
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

          {tab === 'payments' ? (
            <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-600">
                Record and review rent payments for this lease from the payments workspace.
              </p>
              {hasPermission(principal, 'payment.read') ? (
                <Link className="button mt-4" href="/finance/payments">
                  Open Payments
                </Link>
              ) : null}
            </section>
          ) : null}

          {tab === 'renewal' ? (
            <section className="mt-6 space-y-4">
              {lease.renewals.length ? (
                <ul className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
                  {lease.renewals.map((renewal) => (
                    <li key={renewal.id} className="flex items-center justify-between gap-3 py-2">
                      <span>Renewal {renewal.id.slice(0, 8)}</span>
                      <StatusBadge value={renewal.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
                  No renewal started for this lease yet.
                </p>
              )}
              {hasPermission(principal, 'renewal.manage') && lease ? (
                <form
                  className="grid gap-3 sm:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    startRenewal.mutate({
                      originalLeaseId: lease.id,
                      proposedStartDate: String(form.get('proposedStartDate') ?? ''),
                      proposedEndDate: String(form.get('proposedEndDate') ?? ''),
                      proposedRent: String(form.get('proposedRent') ?? ''),
                      currency: lease.currency,
                    });
                  }}
                >
                  <label className="text-sm font-semibold text-slate-700">
                    Proposed start
                    <input
                      name="proposedStartDate"
                      type="date"
                      required
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      defaultValue={lease.leaseEndDate.slice(0, 10)}
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Proposed end
                    <input
                      name="proposedEndDate"
                      type="date"
                      required
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                    Proposed rent
                    <input
                      name="proposedRent"
                      required
                      inputMode="decimal"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      defaultValue={String(lease.rentAmount)}
                    />
                  </label>
                  <button className="button secondary" type="submit" disabled={startRenewal.isPending}>
                    {startRenewal.isPending ? 'Saving...' : 'Start Renewal'}
                  </button>
                </form>
              ) : null}
            </section>
          ) : null}

          {tab === 'move-in' ? (
            <section className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              {lease.moveIn ? (
                <>
                  <p className="text-sm">
                    Scheduled: {lease.moveIn.scheduledDate.slice(0, 10)} ·{' '}
                    <StatusBadge value={lease.moveIn.status} />
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-600">Move-in has not been scheduled yet.</p>
              )}
              {hasPermission(principal, 'move-in.manage') && !lease.moveIn ? (
                <form
                  className="grid max-w-md gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    scheduleMoveIn.mutate({
                      leaseId: lease.id,
                      scheduledDate: String(form.get('scheduledDate') ?? ''),
                    });
                  }}
                >
                  <label className="text-sm font-semibold text-slate-700">
                    Move-in date
                    <input
                      name="scheduledDate"
                      type="date"
                      required
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      defaultValue={lease.leaseStartDate.slice(0, 10)}
                    />
                  </label>
                  <button className="button secondary" type="submit" disabled={scheduleMoveIn.isPending}>
                    {scheduleMoveIn.isPending ? 'Saving...' : 'Schedule Move-In'}
                  </button>
                </form>
              ) : null}
            </section>
          ) : null}

          {tab === 'documents' ? (
            <section className="mt-6 space-y-3">
              <p className="text-sm text-slate-600">
                Store signed lease documents and related files with the property record.
              </p>
              <Link
                className="button secondary"
                href={`/portfolio/properties/${lease.rentableSpace.property.id}?tab=documents`}
              >
                Open Property Documents
              </Link>
            </section>
          ) : null}

          {tab === 'activity' ? (
            <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
              Lease lifecycle events are recorded in the audit trail. Use the full lease register to
              transition status when required.
            </section>
          ) : null}
        </>
      ) : null}
    </OperationsShell>
  );
}
