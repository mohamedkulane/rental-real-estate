'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useState } from 'react';
import {
  DataTableEmpty,
  DataTableSurface,
  DataTableToolbar,
  TableActionButton,
} from '@/components/shared/data-table';
import { TableSkeleton } from '@/components/shared/loading-system';
import { PageHeader, StatusBadge } from '@/components/shared/ui';
import { api, hasPermission, type CursorPage, userFacingError } from '@/lib/phase3-api';
import { formatDate, humanize } from '@/lib/presentation';
import { RentalShell, useRentalPrincipal } from './rental-shell';

type ViewingRow = {
  id: string;
  status: string;
  scheduledAt: string;
  lead?: { id: string; leadNumber: string; displayName: string; intent?: string } | null;
  rentableSpace?: { id: string; spaceCode: string; name: string; propertyId?: string } | null;
  rentalListing?: { id: string; title: string; listingNumber: string } | null;
  assignedEmployee?: {
    id: string;
    employeeNumber: string;
    party?: { displayName: string } | null;
  } | null;
};

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-[#215E61] focus:outline-none focus:ring-2 focus:ring-[#215E61]/15';

export function RentalViewingsRegister() {
  const { principal, error } = useRentalPrincipal();
  const [search, setSearch] = useState('');
  const allowed = Boolean(principal && hasPermission(principal, 'viewing.read'));
  const query = useQuery({
    queryKey: ['rental-viewings', search],
    enabled: allowed,
    queryFn: () => {
      const params = new URLSearchParams({ limit: '50' });
      if (search.trim()) params.set('search', search.trim());
      return api<CursorPage<ViewingRow>>(`/viewings?${params.toString()}`);
    },
  });

  return (
    <RentalShell principal={principal} principalError={error} activeItem="rental:viewings">
      <PageHeader
        eyebrow="Rental"
        title="Viewings"
        description="All scheduled property viewings. Open a customer to schedule or complete a viewing."
        action={
          <Link className="button primary" href="/rental/customers">
            Go to customers
          </Link>
        }
      />
      {!allowed ? (
        <p className="mt-6 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
          You cannot read viewings with your current access.
        </p>
      ) : null}
      {allowed ? (
        <DataTableSurface className="mt-6">
          <DataTableToolbar>
            <label className="block min-w-0 flex-1">
              <span className="mb-1 block text-[12px] font-semibold text-slate-500">Search</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className={inputClass + ' pl-10'}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by customer or notes"
                />
              </div>
            </label>
          </DataTableToolbar>
          {query.isLoading ? <TableSkeleton columns={5} /> : null}
          {query.isError ? (
            <p className="p-4 text-sm text-red-700">{userFacingError(query.error)}</p>
          ) : null}
          {!query.isLoading && !query.isError && !(query.data?.items.length ?? 0) ? (
            <DataTableEmpty
              title="No viewings yet"
              description="Schedule a viewing from a rental customer match."
            />
          ) : null}
          {(query.data?.items.length ?? 0) > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3">Agent</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(query.data?.items ?? []).map((row) => (
                    <tr key={row.id} className="border-b border-slate-100">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatDate(row.scheduledAt, true)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">
                          {row.lead?.displayName ?? '—'}
                        </p>
                        <p className="text-xs text-slate-500">{row.lead?.leadNumber}</p>
                      </td>
                      <td className="px-4 py-3">
                        {row.rentableSpace
                          ? `${row.rentableSpace.spaceCode} — ${row.rentableSpace.name}`
                          : (row.rentalListing?.title ?? '—')}
                      </td>
                      <td className="px-4 py-3">
                        {row.assignedEmployee?.party?.displayName ??
                          row.assignedEmployee?.employeeNumber ??
                          '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge value={humanize(row.status)} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.lead?.id ? (
                          <TableActionButton
                            tone="open"
                            href={`/rental/customers/${row.lead.id}`}
                          >
                            Open customer
                          </TableActionButton>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </DataTableSurface>
      ) : null}
    </RentalShell>
  );
}
