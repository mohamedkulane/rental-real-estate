'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared/ui';
import {
  DataTableEmpty,
  DataTableSurface,
  DataTableToolbar,
  TableActionButton,
  TableActionGroup,
} from '@/components/shared/data-table';
import { TableSkeleton } from '@/components/shared/loading-system';
import { ErrorState } from '@/components/shared/ui';
import { api, hasPermission, type CursorPage, userFacingError } from '@/lib/phase3-api';
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
        {!principal || query.isLoading ? <TableSkeleton columns={5} /> : query.isError ? (
          <ErrorState message={userFacingError(query.error)} onRetry={() => void query.refetch()} />
        ) : query.data?.items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {['Property', 'Type', 'Location', 'Sale price', 'Actions'].map((header) => (
                    <th key={header} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                    <td className="px-4 py-3"><div className="font-semibold text-slate-900">{row.name}</div><div className="text-xs text-slate-500">{row.propertyCode}</div></td>
                    <td className="px-4 py-3">{humanize(row.propertyType)}</td>
                    <td className="px-4 py-3">{row.location || 'Not set'}</td>
                    <td className="px-4 py-3 font-medium">{row.salePrice ? `${row.currency} ${row.salePrice}` : 'Not set'}</td>
                    <td className="px-4 py-3">
                      <TableActionGroup className="justify-start">
                        <TableActionButton tone="open" href={`/portfolio/properties/${row.id}`}>
                          Open property
                        </TableActionButton>
                      </TableActionGroup>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <DataTableEmpty title="No sale properties" description="Owner properties with Sale service intent will appear here." />}
      </DataTableSurface>
    </CommercialShell>
  );
}
