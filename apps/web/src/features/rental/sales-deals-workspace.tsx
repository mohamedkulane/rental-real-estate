'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DataTableEmpty, DataTableSurface, DataTableToolbar, TableActionButton, TableActionGroup } from '@/components/shared/data-table';
import { TableSkeleton } from '@/components/shared/loading-system';
import { ErrorState, PageHeader, StatusBadge } from '@/components/shared/ui';
import { CommercialShell, useCommercialPrincipal } from '@/features/commercial/commercial-shell';
import { api, hasPermission, type CursorPage, userFacingError } from '@/lib/phase3-api';
import { humanize } from '@/lib/presentation';
import toast from '@/lib/toast';

type SaleDeal = {
  id: string;
  agreementNumber: string;
  status: string;
  version: number;
  originalAskingPrice: string;
  finalSalePrice: string;
  currency: string;
  companyOwned: boolean;
  sellerCommissionValue: string | null;
  buyerCommissionValue: string | null;
  buyer: { displayName: string };
  seller: { displayName: string };
  property: { id: string; propertyCode: string; name: string };
  saleOffer: { id: string; status: string; settlement: { id: string; status: string } | null } | null;
};

export function SalesDealsWorkspace() {
  const { principal, error } = useCommercialPrincipal();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const canRead = Boolean(principal && hasPermission(principal, 'sale-offer.read'));
  const canManage = Boolean(principal && hasPermission(principal, 'sale-offer.manage'));
  const query = useQuery({
    queryKey: ['sales-deals', search],
    enabled: canRead,
    queryFn: () => api<CursorPage<SaleDeal>>(`/rental/commands/sale-agreements?limit=50${search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ''}`),
  });
  const confirm = useMutation({
    mutationFn: (deal: SaleDeal) => api(`/rental/commands/sale-agreements/${deal.id}/confirm`, { method: 'POST', body: JSON.stringify({ expectedVersion: deal.version, reason: 'Confirmed from Sales Deals workspace' }) }),
    onSuccess: () => {
      toast.success('Sale agreement confirmed.');
      void queryClient.invalidateQueries({ queryKey: ['sales-deals'] });
    },
    onError: (cause) => toast.error(userFacingError(cause)),
  });

  return (
    <CommercialShell principal={principal} activeItem="sales:deals">
      <PageHeader eyebrow="Sales" title="Sales Deals" description="Sale agreements, confirmation, and settlement handoff." />
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      {!canRead ? <ErrorState message="Sales deal access requires sale-offer.read permission." /> : (
        <DataTableSurface className="mt-6">
          <DataTableToolbar>
            <label className="block min-w-0 flex-1">
              <span className="mb-1 block text-[12px] font-semibold text-slate-500">Search deals</span>
              <div className="relative max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input className="input w-full pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Agreement, buyer, or property" />
              </div>
            </label>
          </DataTableToolbar>
          {query.isLoading ? <TableSkeleton columns={8} /> : query.isError ? <ErrorState message={userFacingError(query.error)} onRetry={() => void query.refetch()} /> : !query.data?.items.length ? <DataTableEmpty title="No sale agreements" description="Interested buyer viewings can become sale agreements here." /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>{['Agreement', 'Buyer', 'Seller', 'Property', 'Final price', 'Status', 'Settlement', 'Actions'].map((header) => <th key={header} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">{header}</th>)}</tr>
                </thead>
                <tbody>
                  {query.data.items.map((deal) => (
                    <tr key={deal.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3 font-semibold text-slate-900">{deal.agreementNumber}</td>
                      <td className="px-4 py-3">{deal.buyer.displayName}</td>
                      <td className="px-4 py-3">{deal.seller.displayName}</td>
                      <td className="px-4 py-3"><Link className="font-medium text-emerald-700" href={`/portfolio/properties/${deal.property.id}`}>{deal.property.propertyCode} — {deal.property.name}</Link></td>
                      <td className="px-4 py-3">{deal.currency} {deal.finalSalePrice}</td>
                      <td className="px-4 py-3"><StatusBadge value={humanize(deal.status)} /></td>
                      <td className="px-4 py-3">{deal.saleOffer?.settlement ? humanize(deal.saleOffer.settlement.status) : 'Not started'}</td>
                      <td className="px-4 py-3"><TableActionGroup className="justify-start">
                        {deal.status === 'DRAFT' && canManage ? <TableActionButton tone="manage" disabled={confirm.isPending} onClick={() => confirm.mutate(deal)}>Confirm</TableActionButton> : null}
                        {deal.status === 'CONFIRMED' && deal.saleOffer ? <TableActionButton tone="agreement" href={`/commercial/settlements/new?offerId=${deal.saleOffer.id}`}>Settlement</TableActionButton> : null}
                        {deal.saleOffer?.settlement ? <TableActionButton tone="open" href={`/commercial/settlements/${deal.saleOffer.settlement.id}`}>View</TableActionButton> : null}
                      </TableActionGroup></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataTableSurface>
      )}
    </CommercialShell>
  );
}
