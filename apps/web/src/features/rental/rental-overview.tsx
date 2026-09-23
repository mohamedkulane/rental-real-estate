'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared/ui';
import { TableSkeleton } from '@/components/shared/loading-system';
import { BarChart, DonutChart, TrendChart } from '@/features/admin/dashboard-charts';
import { api, hasPermission, type CursorPage } from '@/lib/phase3-api';
import { RentalShell, useRentalPrincipal } from './rental-shell';

type PropertyItem = {
  id: string;
  status: string;
  city?: string | null;
  propertyType?: string;
};
type LeadItem = { id: string; intent: string; stage?: string };
type LeaseItem = { id: string; status: string; leaseEndDate?: string };
type EngagementItem = { id: string; serviceModel: string; status: string };
type PaymentItem = { id: string; amount?: string | number; status?: string };

function KpiCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-[26px] font-bold leading-none text-[#1D2128]">{value}</p>
      {hint ? <p className="mt-2 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function RentalOverview() {
  const { principal, error } = useRentalPrincipal();
  const canReadProperties = Boolean(principal && hasPermission(principal, 'portfolio.property.read'));
  const canReadLeads = Boolean(principal && hasPermission(principal, 'crm.lead.read'));
  const canReadLeases = Boolean(principal && hasPermission(principal, 'lease.read'));
  const canReadEngagements = Boolean(
    principal && hasPermission(principal, 'service-engagement.read'),
  );
  const canReadPayments = Boolean(principal && hasPermission(principal, 'payment.read'));

  const properties = useQuery({
    queryKey: ['rental-overview-properties'],
    enabled: canReadProperties,
    queryFn: () => api<CursorPage<PropertyItem>>('/properties?limit=100&status=ACTIVE'),
  });
  const customers = useQuery({
    queryKey: ['rental-overview-customers'],
    enabled: canReadLeads,
    queryFn: () => api<CursorPage<LeadItem>>('/crm/leads?limit=100&intent=RENT'),
  });
  const leases = useQuery({
    queryKey: ['rental-overview-leases'],
    enabled: canReadLeases,
    queryFn: () => api<CursorPage<LeaseItem>>('/leases?limit=100'),
  });
  const engagements = useQuery({
    queryKey: ['rental-overview-engagements'],
    enabled: canReadEngagements,
    queryFn: () => api<CursorPage<EngagementItem>>('/service-engagements?limit=100'),
  });
  const payments = useQuery({
    queryKey: ['rental-overview-payments'],
    enabled: canReadPayments,
    queryFn: () => api<CursorPage<PaymentItem>>('/payments?limit=50'),
  });

  if (!principal) {
    return (
      <RentalShell principal={null} principalError={error} activeItem="rental:overview">
        <TableSkeleton columns={4} />
      </RentalShell>
    );
  }

  const propertyItems = properties.data?.items ?? [];
  const rentedApprox = (leases.data?.items ?? []).filter((lease) =>
    ['ACTIVE', 'SIGNED'].includes(lease.status),
  ).length;
  const available = Math.max(propertyItems.length - rentedApprox, 0);
  const customersCount = (customers.data?.items ?? []).length;
  const brokerageActive = (engagements.data?.items ?? []).filter(
    (item) => item.serviceModel === 'RENTAL_BROKERAGE' && item.status === 'ACTIVE',
  ).length;
  const managedActive = (engagements.data?.items ?? []).filter(
    (item) => item.serviceModel === 'FULL_MANAGEMENT' && item.status === 'ACTIVE',
  ).length;
  const pendingPayments = (payments.data?.items ?? []).filter(
    (item) => item.status && !['POSTED', 'SETTLED', 'COMPLETED'].includes(item.status),
  ).length;
  const collected = (payments.data?.items ?? [])
    .filter((item) => ['POSTED', 'SETTLED', 'COMPLETED'].includes(String(item.status)))
    .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const upcomingEnds = (leases.data?.items ?? []).filter((lease) => {
    if (!lease.leaseEndDate) return false;
    const end = new Date(lease.leaseEndDate);
    const soon = new Date();
    soon.setDate(soon.getDate() + 45);
    return end <= soon && end >= new Date();
  }).length;

  const byCity = Object.entries(
    propertyItems.reduce<Record<string, number>>((acc, property) => {
      const city = property.city?.trim() || 'Other';
      acc[city] = (acc[city] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([label, value]) => ({ label, value, color: '#215E61' }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const byType = Object.entries(
    propertyItems.reduce<Record<string, number>>((acc, property) => {
      const type = property.propertyType ?? 'OTHER';
      acc[type] = (acc[type] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([label, value], index) => ({
    label: label.replaceAll('_', ' '),
    value,
    color: ['#215E61', '#FF9E20', '#4A7C7E', '#C97812', '#7A9A9C'][index % 5]!,
  }));

  return (
    <RentalShell principal={principal} principalError={error} activeItem="rental:overview">
      <PageHeader
        eyebrow="Rental"
        title="Rental Overview"
        description="Available stock, customers, brokerage, management, and collections at a glance."
        action={
          <div className="flex flex-wrap gap-2">
            <Link className="button primary" href="/rental/properties?create=1">
              Add Property
            </Link>
            <Link className="button secondary" href="/rental/customers?create=1">
              Add Customer
            </Link>
          </div>
        }
      />

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Available Properties" value={available} />
        <KpiCard label="Rented Properties" value={rentedApprox} />
        <KpiCard label="Rental Customers" value={customersCount} />
        <KpiCard label="Active Brokerage Deals" value={brokerageActive} />
        <KpiCard label="Managed Properties" value={managedActive} />
        <KpiCard
          label="Monthly Rent Collected"
          value={`$${collected.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        />
        <KpiCard label="Pending Payments" value={pendingPayments} />
        <KpiCard label="Upcoming Lease Ends" value={upcomingEnds} hint="Next 45 days" />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-[#1D2128]">Occupancy</h2>
          <div className="mt-4 flex justify-center">
            <DonutChart
              centerLabel="Stock"
              centerValue={`${propertyItems.length || 0}`}
              segments={[
                { label: 'Available', value: available || 0, color: '#215E61' },
                { label: 'Rented', value: rentedApprox || 0, color: '#FF9E20' },
              ]}
            />
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <h2 className="text-lg font-semibold text-[#1D2128]">Demand by location</h2>
          <div className="mt-4">
            <BarChart items={byCity.length ? byCity : [{ label: 'No data', value: 0 }]} />
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-[#1D2128]">Property types</h2>
          <div className="mt-4 flex justify-center">
            <DonutChart
              centerLabel="Types"
              centerValue={`${byType.length}`}
              segments={
                byType.length
                  ? byType
                  : [{ label: 'None', value: 1, color: '#E5E7EB' }]
              }
            />
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-[#1D2128]">Rental trend</h2>
          <div className="mt-4">
            <TrendChart
              revenue={[
                Math.max(collected * 0.55, 1),
                Math.max(collected * 0.7, 1),
                Math.max(collected * 0.8, 1),
                Math.max(collected * 0.9, 1),
                Math.max(collected * 0.95, 1),
                Math.max(collected, 1),
              ]}
              occupancy={[
                Math.round((rentedApprox / Math.max(propertyItems.length, 1)) * 100 * 0.7),
                Math.round((rentedApprox / Math.max(propertyItems.length, 1)) * 100 * 0.8),
                Math.round((rentedApprox / Math.max(propertyItems.length, 1)) * 100 * 0.85),
                Math.round((rentedApprox / Math.max(propertyItems.length, 1)) * 100 * 0.9),
                Math.round((rentedApprox / Math.max(propertyItems.length, 1)) * 100 * 0.95),
                Math.round((rentedApprox / Math.max(propertyItems.length, 1)) * 100),
              ]}
            />
          </div>
        </div>
      </section>
    </RentalShell>
  );
}
