'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared/ui';
import { DataTableEmpty, DataTableSurface, DataTableToolbar } from '@/components/shared/data-table';
import { TableSkeleton } from '@/components/shared/loading-system';
import { api, hasPermission, type CursorPage } from '@/lib/phase3-api';
import { humanize } from '@/lib/presentation';
import { CommercialShell, useCommercialPrincipal } from '@/features/commercial/commercial-shell';

type SaleProperty = {
  id: string;
  propertyCode: string;
  name: string;
  propertyType: string;
  location: string;
  salePrice: string | null;
  currency: string;
};

export function SalesPropertiesWorkspace() {
  const { principal, error } = useCommercialPrincipal();
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: ['sale-property-inventory', search],
    enabled: Boolean(principal && hasPermission(principal, 'portfolio.property.read')),
    queryFn: () => api<CursorPage<SaleProperty>>(`/rental/sale-properties?limit=50${search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ''}`),
  });

  return (
    <CommercialShell principal={principal} activeItem="sales:properties">
      <PageHeader eyebrow="Sales" title="Properties for Sale" description="Available sale-intent property inventory." />
      <DataTableSurface className="mt-6">
        <DataTableToolbar>
          <input className="input max-w-sm" placeholder="Search properties" value={search} onChange={(event) => setSearch(event.target.value)} />
        </DataTableToolbar>
        {!principal || query.isLoading ? <TableSkeleton columns={5} /> : query.data?.items.length ? (
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Property</th><th>Type</th><th>Location</th><th className="text-right">Sale price</th></tr></thead><tbody>{query.data.items.map((row) => <tr key={row.id} className="border-t border-slate-100"><td><div className="font-semibold">{row.name}</div><div className="text-xs text-slate-500">{row.propertyCode}</div></td><td>{humanize(row.propertyType)}</td><td>{row.location || 'Not set'}</td><td className="text-right font-medium">{row.salePrice ? `${row.currency} ${row.salePrice}` : 'Not set'}</td></tr>)}</tbody></table></div>
        ) : <DataTableEmpty title="No sale properties" description="Owner properties with Sale service intent will appear here." />}
      </DataTableSurface>
    </CommercialShell>
  );
}
