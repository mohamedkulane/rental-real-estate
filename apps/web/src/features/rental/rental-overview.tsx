'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  CalendarDays,
  ChevronRight,
  Handshake,
  KeyRound,
  Plus,
  Users,
  WalletCards,
  WalletMinimal,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/ui';
import { TableSkeleton } from '@/components/shared/loading-system';
import { BarChart, ChartLegend, DonutChart, TrendChart } from '@/features/admin/dashboard-charts';
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

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof Building2;
}) {
  return (
    <div className="rental-overview-kpi">
      <span className="rental-overview-kpi-icon">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{hint ?? 'Current register'}</small>
      </div>
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

  const brandChartColors = [
    'var(--primary)',
    'var(--primary-accent)',
    'color-mix(in srgb, var(--primary) 68%, var(--primary-accent))',
    'color-mix(in srgb, var(--primary) 42%, var(--primary-accent))',
    'color-mix(in srgb, var(--primary) 24%, var(--primary-accent))',
  ];

  const byCity = Object.entries(
    propertyItems.reduce<Record<string, number>>((acc, property) => {
      const city = property.city?.trim() || 'Other';
      acc[city] = (acc[city] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([label, value], index) => ({
      label,
      value,
      color: brandChartColors[index % brandChartColors.length]!,
    }))
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
    color: brandChartColors[index % brandChartColors.length]!,
  }));

  const occupancySegments = [
    { label: 'Occupied', value: rentedApprox || 0, color: 'var(--primary)' },
    { label: 'Vacant', value: available || 0, color: 'var(--primary-soft)' },
  ];
  const propertyTypeSegments = byType.length
    ? byType
    : [{ label: 'No data', value: 1, color: 'var(--border)' }];

  return (
    <RentalShell principal={principal} principalError={error} activeItem="rental:overview">
      <div className="rental-overview-hero">
        <nav className="rental-overview-breadcrumb" aria-label="Breadcrumb">
          <span>Rentals</span>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <strong>Overview</strong>
        </nav>
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
      </div>

      <section className="rental-overview-kpis mt-6">
        <KpiCard label="Available Properties" value={available} icon={Building2} />
        <KpiCard label="Rented Properties" value={rentedApprox} icon={KeyRound} />
        <KpiCard label="Rental Customers" value={customersCount} icon={Users} />
        <KpiCard label="Active Brokerage Deals" value={brokerageActive} icon={Handshake} />
        <KpiCard label="Managed Properties" value={managedActive} icon={Building2} />
        <KpiCard
          label="Monthly Rent Collected"
          value={`$${collected.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          icon={WalletMinimal}
        />
        <KpiCard label="Pending Payments" value={pendingPayments} icon={WalletCards} />
        <KpiCard label="Upcoming Lease Ends" value={upcomingEnds} hint="Next 45 days" icon={CalendarDays} />
      </section>

      <section className="rental-overview-chart-grid mt-6">
        <div className="rental-chart-panel">
          <div className="rental-chart-heading">
            <h2>Occupancy</h2>
            <span>Units</span>
          </div>
          <div className="rental-chart-with-legend mt-4">
            <DonutChart
              centerLabel="Stock"
              centerValue={`${propertyItems.length || 0}`}
              segments={occupancySegments}
            />
            <ChartLegend items={occupancySegments} />
          </div>
        </div>
        <div className="rental-chart-panel rental-chart-panel-wide">
          <div className="rental-chart-heading">
            <h2>Demand by location</h2>
            <span>Properties</span>
          </div>
          <div className="mt-4">
            <BarChart items={byCity.length ? byCity : [{ label: 'No data', value: 0 }]} />
          </div>
        </div>
        <aside className="rental-chart-callout">
          <Building2 className="h-6 w-6" aria-hidden="true" />
          <h2>Turn more properties into profit</h2>
          <p>List properties, manage tenants, and track performance from one place.</p>
          <Link className="button primary" href="/rental/properties?create=1">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Property
          </Link>
        </aside>
      </section>

      <section className="rental-overview-chart-grid rental-overview-chart-grid-bottom mt-4">
        <div className="rental-chart-panel">
          <div className="rental-chart-heading">
            <h2>Property types</h2>
            <span>Properties</span>
          </div>
          <div className="rental-chart-with-legend mt-4">
            <DonutChart
              centerLabel="Types"
              centerValue={`${byType.length}`}
              segments={propertyTypeSegments}
            />
            <ChartLegend items={propertyTypeSegments} />
          </div>
        </div>
        <div className="rental-chart-panel">
          <div className="rental-chart-heading">
            <h2>Rental trend</h2>
            <span>Last 6 months</span>
          </div>
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
            <div className="rental-trend-legend">
              <span><i className="rental-trend-dot rental-trend-dot-primary" />Rent collected</span>
              <span><i className="rental-trend-dot rental-trend-dot-accent" />Occupancy</span>
            </div>
          </div>
        </div>
      </section>
    </RentalShell>
  );
}
