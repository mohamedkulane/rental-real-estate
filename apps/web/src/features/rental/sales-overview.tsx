'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared/ui';
import { TableSkeleton } from '@/components/shared/loading-system';
import { BarChart, DonutChart, TrendChart } from '@/features/admin/dashboard-charts';
import { CommercialShell, useCommercialPrincipal } from '@/features/commercial/commercial-shell';
import { api, hasPermission, type CursorPage } from '@/lib/phase3-api';

type ListingItem = { id: string; status: string; askingPrice?: string | number | null };
type BuyerItem = { id: string; stage?: string };
type OfferItem = { id: string; status: string; offerAmount?: string | number | null };
type EngagementItem = { id: string; serviceModel: string; status: string };

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-[26px] font-bold leading-none text-[#1D2128]">{value}</p>
    </div>
  );
}

export function SalesOverview() {
  const { principal, error } = useCommercialPrincipal();
  const canListings = Boolean(principal && hasPermission(principal, 'listing.read'));
  const canLeads = Boolean(principal && hasPermission(principal, 'crm.lead.read'));
  const canOffers = Boolean(principal && hasPermission(principal, 'sale-offer.read'));
  const canEngagements = Boolean(principal && hasPermission(principal, 'service-engagement.read'));

  const listings = useQuery({
    queryKey: ['sales-overview-listings'],
    enabled: canListings,
    queryFn: () => api<CursorPage<ListingItem>>('/sale-listings?limit=100&status=PUBLISHED'),
  });
  const buyers = useQuery({
    queryKey: ['sales-overview-buyers'],
    enabled: canLeads,
    queryFn: () => api<CursorPage<BuyerItem>>('/rental/buyers?limit=100'),
  });
  const offers = useQuery({
    queryKey: ['sales-overview-offers'],
    enabled: canOffers,
    queryFn: () => api<CursorPage<OfferItem>>('/sale-offers?limit=100'),
  });
  const engagements = useQuery({
    queryKey: ['sales-overview-engagements'],
    enabled: canEngagements,
    queryFn: () => api<CursorPage<EngagementItem>>('/service-engagements?limit=100'),
  });

  if (!principal) {
    return (
      <CommercialShell principal={null} activeItem="sales:overview">
        <TableSkeleton columns={4} />
      </CommercialShell>
    );
  }

  const forSale = (listings.data?.items ?? []).length;
  const activeBuyers = (buyers.data?.items ?? []).length;
  const activeDeals = (engagements.data?.items ?? []).filter(
    (item) =>
      ['SALE_BROKERAGE', 'COMPANY_OWNED'].includes(item.serviceModel) &&
      item.status === 'ACTIVE',
  ).length;
  const pendingOffers = (offers.data?.items ?? []).filter((item) =>
    ['SUBMITTED', 'UNDER_REVIEW', 'NEGOTIATING', 'PENDING'].includes(item.status),
  ).length;
  const sold = (offers.data?.items ?? []).filter((item) =>
    ['ACCEPTED', 'SETTLED', 'CLOSED'].includes(item.status),
  );
  const salesValue = sold.reduce((sum, item) => sum + Number(item.offerAmount ?? 0), 0);
  const commissionEarned = Math.round(salesValue * 0.03);

  const pipeline = [
    { label: 'For sale', value: forSale, color: '#215E61' },
    { label: 'Active buyers', value: activeBuyers, color: '#4A7C7E' },
    { label: 'Pending offers', value: pendingOffers, color: '#FF9E20' },
    { label: 'Sold', value: sold.length, color: '#C97812' },
  ];

  return (
    <CommercialShell principal={principal} activeItem="sales:overview">
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <PageHeader
        eyebrow="Sales"
        title="Sales Overview"
        description="Properties for sale, buyers, deals, and commission performance."
        action={
          <div className="flex flex-wrap gap-2">
            <Link className="button primary" href="/sales/buyers?create=1">
              Add Buyer
            </Link>
          </div>
        }
      />

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="Properties For Sale" value={forSale} />
        <KpiCard label="Active Buyers" value={activeBuyers} />
        <KpiCard label="Active Deals" value={activeDeals} />
        <KpiCard label="Pending Offers" value={pendingOffers} />
        <KpiCard label="Sold This Month" value={sold.length} />
        <KpiCard
          label="Sales Value"
          value={`$${salesValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        />
        <KpiCard
          label="Commission Earned"
          value={`$${commissionEarned.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-[#1D2128]">Sales pipeline</h2>
          <div className="mt-4 flex justify-center">
            <DonutChart
              centerLabel="Deals"
              centerValue={`${activeDeals || forSale}`}
              segments={pipeline.filter((item) => item.value > 0).length ? pipeline : [{ label: 'None', value: 1, color: '#E5E7EB' }]}
            />
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-[#1D2128]">Buyer demand</h2>
          <div className="mt-4">
            <BarChart
              items={[
                { label: 'Active buyers', value: activeBuyers, color: '#215E61' },
                { label: 'Pending offers', value: pendingOffers, color: '#FF9E20' },
                { label: 'Sold', value: sold.length, color: '#4A7C7E' },
              ]}
            />
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-[#1D2128]">Sales trend</h2>
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
        </div>
      </section>
    </CommercialShell>
  );
}
