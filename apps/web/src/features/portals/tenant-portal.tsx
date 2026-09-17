'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import toast from '@/lib/toast';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableScroll,
  DataTableSurface,
} from '@/components/shared/data-table';
import { PageSkeleton } from '@/components/shared/loading-system';
import { EmptyState, ErrorState, FormSection, PageHeader, StatusBadge } from '@/components/shared/ui';
import { api, userFacingError } from '@/lib/phase3-api';
import { formatDate, humanize } from '@/lib/presentation';
import { PortalShell, usePortalPrincipal } from './portal-shell';

const tabs = [
  { key: 'overview', label: 'Overview' },
  { key: 'lease', label: 'Lease' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'payments', label: 'Payments' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'profile', label: 'Profile' },
] as const;

type TenantTab = (typeof tabs)[number]['key'];

type OverviewData = {
  lease: Record<string, unknown> | null;
  summary: {
    openInvoices: number;
    outstandingBalance: string;
    openMaintenance: number;
  };
};

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-[28px] font-bold leading-none text-slate-900">{value}</p>
      <p className="mt-2 text-[13px] font-medium text-slate-500">{label}</p>
    </div>
  );
}

export function TenantPortal({ initialTab = 'overview' }: { initialTab?: TenantTab }) {
  const { principal, error } = usePortalPrincipal('TENANT');
  const [activeTab, setActiveTab] = useState<TenantTab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [invoices, setInvoices] = useState<Array<Record<string, unknown>>>([]);
  const [payments, setPayments] = useState<Array<Record<string, unknown>>>([]);
  const [maintenance, setMaintenance] = useState<Array<Record<string, unknown>>>([]);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadTab = useCallback(async (tab: TenantTab) => {
    setLoading(true);
    setLoadError('');
    try {
      if (tab === 'overview' || tab === 'lease') {
        const data = await api<OverviewData>('/portal/tenant/overview');
        setOverview(data);
      } else if (tab === 'invoices') {
        const data = await api<{ items: Array<Record<string, unknown>> }>('/portal/tenant/invoices');
        setInvoices(data.items);
      } else if (tab === 'payments') {
        const data = await api<{ items: Array<Record<string, unknown>> }>('/portal/tenant/payments');
        setPayments(data.items);
      } else if (tab === 'maintenance') {
        const data = await api<{ items: Array<Record<string, unknown>> }>('/portal/tenant/maintenance');
        setMaintenance(data.items);
      } else if (tab === 'profile') {
        const data = await api<Record<string, unknown>>('/portal/tenant/profile');
        setProfile(data);
      }
    } catch (cause) {
      setLoadError(userFacingError(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!principal) return;
    void loadTab(activeTab);
  }, [activeTab, loadTab, principal]);

  async function submitMaintenance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const values = new FormData(event.currentTarget);
    try {
      await api('/portal/tenant/maintenance', {
        method: 'POST',
        body: JSON.stringify({
          title: values.get('title'),
          description: values.get('description'),
          priority: values.get('priority') || 'MEDIUM',
        }),
      });
      toast.success('Maintenance request submitted.');
      event.currentTarget.reset();
      await loadTab('maintenance');
    } catch (cause) {
      toast.error(userFacingError(cause));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PortalShell
      title="Tenant Portal"
      subtitle="Your lease, invoices, and maintenance"
      principal={principal}
      principalError={error}
      tabs={[...tabs]}
      activeTab={activeTab}
      onTabChange={(key) => setActiveTab(key as TenantTab)}
    >
      <PageHeader
        eyebrow="Tenant workspace"
        title={tabs.find((tab) => tab.key === activeTab)?.label ?? 'Overview'}
        description="Stay on top of your lease, billing, and maintenance requests."
      />
      {loadError ? <ErrorState message={loadError} /> : null}
      {loading && activeTab !== 'maintenance' ? <PageSkeleton /> : null}
      {!loadError ? renderTab(activeTab, {
        loading,
        overview,
        invoices,
        payments,
        maintenance,
        profile,
        submitting,
        onSubmitMaintenance: (event) => {
          void submitMaintenance(event);
        },
      }) : null}
    </PortalShell>
  );
}

function renderTab(
  tab: TenantTab,
  ctx: {
    loading: boolean;
    overview: OverviewData | null;
    invoices: Array<Record<string, unknown>>;
    payments: Array<Record<string, unknown>>;
    maintenance: Array<Record<string, unknown>>;
    profile: Record<string, unknown> | null;
    submitting: boolean;
    onSubmitMaintenance: (event: FormEvent<HTMLFormElement>) => void;
  },
) {
  if (tab === 'overview' && ctx.overview && !ctx.loading) {
    const lease = ctx.overview.lease;
    const space = lease?.space as { name?: string; property?: { name?: string; city?: string } } | undefined;
    return (
      <div className="mt-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard label="Open Invoices" value={ctx.overview.summary.openInvoices} />
          <MetricCard
            label="Outstanding Balance"
            value={ctx.overview.summary.outstandingBalance}
          />
          <MetricCard label="Open Maintenance" value={ctx.overview.summary.openMaintenance} />
        </div>
        {lease ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-[15px] font-semibold text-slate-900">Current lease</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-[12px] font-semibold text-slate-500">Lease</p>
                <p>{String(lease.leaseNumber)}</p>
              </div>
              <div>
                <p className="text-[12px] font-semibold text-slate-500">Space</p>
                <p>{space?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-[12px] font-semibold text-slate-500">Property</p>
                <p>{space?.property?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-[12px] font-semibold text-slate-500">Status</p>
                <StatusBadge value={String(lease.status)} />
              </div>
            </div>
          </section>
        ) : (
          <EmptyState
            title="No active lease"
            description="Your lease details will appear here once assigned."
          />
        )}
      </div>
    );
  }

  if (tab === 'lease' && ctx.overview && !ctx.loading) {
    const lease = ctx.overview.lease;
    if (!lease) {
      return (
        <EmptyState
          title="No lease on file"
          description="Contact your property manager if you believe this is incorrect."
        />
      );
    }
    const space = lease.space as {
      name?: string;
      spaceCode?: string;
      property?: { name?: string; propertyCode?: string; city?: string };
    } | undefined;
    const renewal = lease.renewal as { status?: string; proposedEndDate?: string } | null | undefined;
    return (
      <div className="mt-6 space-y-4">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-[12px] font-semibold text-slate-500">Lease number</p>
              <p className="font-medium">{String(lease.leaseNumber)}</p>
            </div>
            <div>
              <p className="text-[12px] font-semibold text-slate-500">Term</p>
              <p>
                {formatDate(lease.leaseStartDate)} — {formatDate(lease.leaseEndDate)}
              </p>
            </div>
            <div>
              <p className="text-[12px] font-semibold text-slate-500">Monthly rent</p>
              <p>
                {String(lease.currency)} {String(lease.rentAmount)}
              </p>
            </div>
            <div>
              <p className="text-[12px] font-semibold text-slate-500">Space</p>
              <p>
                {space?.name ?? '—'} ({space?.spaceCode ?? '—'})
              </p>
            </div>
            <div>
              <p className="text-[12px] font-semibold text-slate-500">Property</p>
              <p>
                {space?.property?.name ?? '—'} · {space?.property?.city ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-[12px] font-semibold text-slate-500">Status</p>
              <StatusBadge value={String(lease.status)} />
            </div>
          </div>
        </section>
        {renewal ? (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold text-amber-900">Renewal in progress</p>
            <p className="mt-1 text-sm text-amber-800">
              {humanize(String(renewal.status))}
              {renewal.proposedEndDate ? ` · proposed end ${formatDate(renewal.proposedEndDate)}` : ''}
            </p>
          </section>
        ) : null}
      </div>
    );
  }

  if (tab === 'invoices' && !ctx.loading) {
    if (!ctx.invoices.length) {
      return (
        <EmptyState title="No invoices yet" description="Issued invoices will appear here." />
      );
    }
    return (
      <DataTableSurface className="mt-6">
        <DataTableScroll>
          <DataTable>
            <DataTableHead>
              <tr>
                <DataTableHeaderCell>Invoice</DataTableHeaderCell>
                <DataTableHeaderCell>Issued</DataTableHeaderCell>
                <DataTableHeaderCell>Due</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Amount</DataTableHeaderCell>
                <DataTableHeaderCell>Status</DataTableHeaderCell>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {ctx.invoices.map((row) => (
                <DataTableRow key={String(row.id)}>
                  <DataTableCell>{String(row.invoiceNumber)}</DataTableCell>
                  <DataTableCell>{formatDate(row.issueDate)}</DataTableCell>
                  <DataTableCell>{formatDate(row.dueDate)}</DataTableCell>
                  <DataTableCell align="right">
                    {String(row.currency)} {String(row.totalAmount)}
                  </DataTableCell>
                  <DataTableCell>
                    <StatusBadge value={String(row.status)} />
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </DataTableScroll>
      </DataTableSurface>
    );
  }

  if (tab === 'payments' && !ctx.loading) {
    if (!ctx.payments.length) {
      return (
        <EmptyState title="No payments yet" description="Recorded payments will appear here." />
      );
    }
    return (
      <DataTableSurface className="mt-6">
        <DataTableScroll>
          <DataTable>
            <DataTableHead>
              <tr>
                <DataTableHeaderCell>Payment</DataTableHeaderCell>
                <DataTableHeaderCell>Received</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Amount</DataTableHeaderCell>
                <DataTableHeaderCell>Status</DataTableHeaderCell>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {ctx.payments.map((row) => (
                <DataTableRow key={String(row.id)}>
                  <DataTableCell>{String(row.paymentNumber)}</DataTableCell>
                  <DataTableCell>{formatDate(row.receivedAt, true)}</DataTableCell>
                  <DataTableCell align="right">
                    {String(row.currency)} {String(row.amount)}
                  </DataTableCell>
                  <DataTableCell>
                    <StatusBadge value={String(row.status)} />
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </DataTableScroll>
      </DataTableSurface>
    );
  }

  if (tab === 'maintenance') {
    return (
      <div className="mt-6 space-y-6">
        <FormSection title="Submit a maintenance request">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => void ctx.onSubmitMaintenance(event)}>
            <label className="md:col-span-2">
              Title
              <input name="title" required minLength={3} placeholder="Brief summary of the issue" />
            </label>
            <label className="md:col-span-2">
              Description
              <textarea
                name="description"
                required
                minLength={10}
                rows={4}
                placeholder="Describe the issue and any access instructions"
              />
            </label>
            <label>
              Priority
              <select name="priority" defaultValue="MEDIUM">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </label>
            <div className="flex items-end">
              <button className="primary" type="submit" disabled={ctx.submitting} aria-busy={ctx.submitting}>
                {ctx.submitting ? 'Submitting...' : 'Submit request'}
              </button>
            </div>
          </form>
        </FormSection>
        {ctx.loading ? (
          <PageSkeleton />
        ) : ctx.maintenance.length ? (
          <DataTableSurface>
            <DataTableScroll>
              <DataTable>
                <DataTableHead>
                  <tr>
                    <DataTableHeaderCell>Request</DataTableHeaderCell>
                    <DataTableHeaderCell>Location</DataTableHeaderCell>
                    <DataTableHeaderCell>Reported</DataTableHeaderCell>
                    <DataTableHeaderCell>Priority</DataTableHeaderCell>
                    <DataTableHeaderCell>Status</DataTableHeaderCell>
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {ctx.maintenance.map((row) => {
                    const property = row.property as { name?: string } | undefined;
                    const space = row.rentableSpace as { name?: string } | undefined;
                    return (
                      <DataTableRow key={String(row.id)}>
                        <DataTableCell>
                          <strong>{String(row.requestNumber)}</strong>
                          <p className="text-sm text-slate-500">{String(row.title)}</p>
                        </DataTableCell>
                        <DataTableCell>
                          {property?.name ?? '—'}
                          {space?.name ? ` · ${space.name}` : ''}
                        </DataTableCell>
                        <DataTableCell>{formatDate(row.reportedAt, true)}</DataTableCell>
                        <DataTableCell>{humanize(String(row.priority))}</DataTableCell>
                        <DataTableCell>
                          <StatusBadge value={String(row.status)} />
                        </DataTableCell>
                      </DataTableRow>
                    );
                  })}
                </DataTableBody>
              </DataTable>
            </DataTableScroll>
          </DataTableSurface>
        ) : (
          <EmptyState
            title="No maintenance requests"
            description="Your submitted requests will appear here."
          />
        )}
      </div>
    );
  }

  if (tab === 'profile' && ctx.profile && !ctx.loading) {
    const contacts = Array.isArray(ctx.profile.contacts)
      ? (ctx.profile.contacts as Array<Record<string, unknown>>)
      : [];
    const addresses = Array.isArray(ctx.profile.addresses)
      ? (ctx.profile.addresses as Array<Record<string, unknown>>)
      : [];
    return (
      <div className="mt-6 space-y-4">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-[12px] font-semibold text-slate-500">Display name</p>
              <p>{String(ctx.profile.displayName)}</p>
            </div>
            <div>
              <p className="text-[12px] font-semibold text-slate-500">Tenant number</p>
              <p>{String(ctx.profile.tenantNumber)}</p>
            </div>
            <div>
              <p className="text-[12px] font-semibold text-slate-500">Status</p>
              <StatusBadge value={String(ctx.profile.status)} />
            </div>
          </div>
        </section>
        {contacts.length ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-[15px] font-semibold text-slate-900">Contact details</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {contacts.map((contact, index) => (
                <li key={index}>
                  {humanize(String(contact.type))}: {String(contact.primary)}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {addresses.length ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-[15px] font-semibold text-slate-900">Addresses</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {addresses.map((address, index) => (
                <li key={index}>
                  {humanize(String(address.type))}: {String(address.line1)}, {String(address.city)}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    );
  }

  return null;
}
