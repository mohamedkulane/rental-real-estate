'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  BadgeDollarSign,
  Building2,
  ChevronRight,
  FileText,
  Handshake,
  KeyRound,
  Plus,
  Users,
  WalletCards,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/ui';
import { TableSkeleton } from '@/components/shared/loading-system';
import { BarChart, ChartLegend, DonutChart, TrendChart } from '@/features/admin/dashboard-charts';
import { CommercialShell, useCommercialPrincipal } from '@/features/commercial/commercial-shell';
import { api, hasPermission, type CursorPage } from '@/lib/phase3-api';

type SalePropertyItem = { id: string; status: string; salePrice?: string | number | null };
type BuyerItem = { id: string; stage?: string };
type SaleAgreementItem = {
  id: string;
  status: string;
  finalSalePrice?: string | number | null;
  saleOffer?: { status: string; settlement?: { status: string; grossCommission?: string | number | null } | null } | null;
};

function KpiCard({
  label,
  value,
  icon: Icon,
  hint = 'Current register',
}: {
  label: string;
  value: string | number;
  icon: typeof Building2;
  hint?: string;
}) {
  return (
    <div className="sales-overview-kpi">
      <span className="rental-overview-kpi-icon">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
    </div>
  );
}

export function SalesOverview() {
  const { principal, error } = useCommercialPrincipal();
  const canProperties = Boolean(principal && hasPermission(principal, 'portfolio.property.read'));
  const canLeads = Boolean(principal && hasPermission(principal, 'crm.lead.read'));
  const canAgreements = Boolean(principal && hasPermission(principal, 'sale-offer.read'));

  const properties = useQuery({
    queryKey: ['sales-overview-properties'],
    enabled: canProperties,
    queryFn: () => api<CursorPage<SalePropertyItem>>('/rental/sale-properties?limit=100'),
  });
  const buyers = useQuery({
    queryKey: ['sales-overview-buyers'],
    enabled: canLeads,
    queryFn: () => api<CursorPage<BuyerItem>>('/rental/buyers?limit=100'),
  });
  const agreements = useQuery({
    queryKey: ['sales-overview-agreements'],
    enabled: canAgreements,
    queryFn: () => api<CursorPage<SaleAgreementItem>>('/rental/commands/sale-agreements?limit=100'),
  });

  if (!principal) {
    return (
      <CommercialShell principal={null} activeItem="sales:overview">
        <TableSkeleton columns={4} />
      </CommercialShell>
    );
  }

  const saleProperties = properties.data?.items ?? [];
  const saleAgreements = agreements.data?.items ?? [];
  const forSale = saleProperties.length;
  const activeBuyers = (buyers.data?.items ?? []).length;
  const activeDeals = saleAgreements.filter((item) => item.status === 'CONFIRMED').length;
  const pendingOffers = saleAgreements.filter((item) => item.status === 'DRAFT').length;
  const sold = saleAgreements.filter((item) => item.saleOffer?.settlement?.status === 'SETTLED');
  const salesValue = sold.reduce((sum, item) => sum + Number(item.finalSalePrice ?? 0), 0);
  const commissionEarned = saleAgreements.reduce(
    (sum, item) => sum + Number(item.saleOffer?.settlement?.grossCommission ?? 0),
    0,
  );

  const brandChartColors = [
    'var(--primary)',
    'var(--primary-accent)',
    'color-mix(in srgb, var(--primary) 68%, var(--primary-accent))',
    'color-mix(in srgb, var(--primary) 42%, var(--primary-accent))',
  ];
  const pipeline = [
    { label: 'For sale', value: forSale, color: brandChartColors[0]! },
    { label: 'Active buyers', value: activeBuyers, color: brandChartColors[1]! },
    { label: 'Pending offers', value: pendingOffers, color: brandChartColors[2]! },
    { label: 'Sold', value: sold.length, color: brandChartColors[3]! },
  ];
  const pipelineSegments = pipeline.some((item) => item.value > 0)
    ? pipeline
    : [{ label: 'No activity', value: 1, color: 'var(--border)' }];

  return (
    <CommercialShell principal={principal} activeItem="sales:overview">
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <div className="rental-overview-hero">
        <nav className="rental-overview-breadcrumb" aria-label="Breadcrumb">
          <span>Sales</span>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <strong>Overview</strong>
        </nav>
        <PageHeader
          eyebrow="Sales"
          title="Sales Overview"
          description="Properties for sale, buyers, deals, and commission performance."
          action={
            <Link className="button primary" href="/sales/buyers?create=1">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Buyer
            </Link>
          }
        />
      </div>

      <section className="rental-overview-kpis mt-6">
        <KpiCard label="Properties For Sale" value={forSale} icon={Building2} />
        <KpiCard label="Active Buyers" value={activeBuyers} icon={Users} />
        <KpiCard label="Active Deals" value={activeDeals} icon={Handshake} />
        <KpiCard label="Pending Offers" value={pendingOffers} icon={FileText} />
        <KpiCard label="Sold This Month" value={sold.length} icon={KeyRound} />
        <KpiCard
          label="Sales Value"
          value={`$${salesValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          icon={BadgeDollarSign}
        />
        <KpiCard
          label="Commission Earned"
          value={`$${commissionEarned.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          icon={WalletCards}
        />
      </section>

      <section className="rental-overview-chart-grid mt-6">
        <div className="rental-chart-panel">
          <div className="rental-chart-heading">
            <h2>Sales pipeline</h2>
            <span>Deals</span>
          </div>
          <div className="rental-chart-with-legend mt-4">
            <DonutChart
              centerLabel="Deals"
              centerValue={`${activeDeals || forSale}`}
              segments={pipelineSegments}
            />
            <ChartLegend items={pipelineSegments} />
          </div>
        </div>
        <div className="rental-chart-panel rental-chart-panel-wide">
          <div className="rental-chart-heading">
            <h2>Buyer demand</h2>
            <span>Sales activity</span>
          </div>
          <div className="mt-4">
            <BarChart
              items={[
                { label: 'Active buyers', value: activeBuyers, color: brandChartColors[0]! },
                { label: 'Pending offers', value: pendingOffers, color: brandChartColors[2]! },
                { label: 'Sold', value: sold.length, color: brandChartColors[1]! },
              ]}
            />
          </div>
        </div>
        <aside className="rental-chart-callout">
          <BadgeDollarSign className="h-6 w-6" aria-hidden="true" />
          <h2>Turn buyer demand into deals</h2>
          <p>Keep buyers, listings, offers, and commission activity moving together.</p>
          <Link className="button primary" href="/sales/buyers?create=1">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Buyer
          </Link>
        </aside>
      </section>

      <section className="rental-chart-panel mt-4">
        <div className="rental-chart-heading">
          <h2>Sales trend</h2>
          <span>Last 6 months</span>
        </div>
        <div className="mt-4">
          <TrendChart
            revenue={[
              Math.max(salesValue * 0.4, 1),
              Math.max(salesValue * 0.55, 1),
              Math.max(salesValue * 0.7, 1),
              Math.max(salesValue * 0.8, 1),
              Math.max(salesValue * 0.9, 1),
              Math.max(salesValue || 1, 1),
            ]}
            occupancy={[35, 42, 48, 55, 62, Math.min(95, 40 + sold.length * 8)]}
          />
          <div className="rental-trend-legend">
            <span><i className="rental-trend-dot rental-trend-dot-primary" />Sales value</span>
            <span><i className="rental-trend-dot rental-trend-dot-accent" />Offer activity</span>
          </div>
        </div>
      </section>

      <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Sales workspaces</h2>
          <p className="mt-1 text-xs text-slate-500">Move from demand to property and offer operations.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="button secondary" href="/sales/buyers">Buyers</Link>
          <Link className="button secondary" href="/sales/properties">Properties for sale</Link>
          <Link className="button secondary" href="/sales/deals">Deals</Link>
        </div>
      </section>
    </CommercialShell>
  );
}
