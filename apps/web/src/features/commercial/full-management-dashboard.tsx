'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Building2, KeyRound, Receipt, Wallet } from 'lucide-react';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableDesktopOnly,
  DataTableEmpty,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableScroll,
  DataTableSurface,
} from '@/components/shared/data-table';
import { DashboardSkeleton, TableSkeleton } from '@/components/shared/loading-system';
import { ErrorState, PageHeader, StatusBadge } from '@/components/shared/ui';
import { api, hasPermission, type CursorPage, userFacingError } from '@/lib/phase3-api';
import { formatDate, humanize } from '@/lib/presentation';
import { CommercialShell, useCommercialPrincipal } from './commercial-shell';

type EngagementRow = Record<string, unknown> & {
  id: string;
  engagementNumber?: string;
  status?: string;
  serviceModel?: string;
};

function MetricCard({
  label,
  value,
  href,
  icon: Icon,
}: {
  label: string;
  value: number;
  href: string;
  icon: typeof Building2;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-200"
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="mt-4 text-[28px] font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-[13px] font-medium text-slate-500">{label}</p>
    </Link>
  );
}

export function FullManagementDashboard() {
  const { principal } = useCommercialPrincipal();
  const allowed = Boolean(principal && hasPermission(principal, 'service-engagement.read'));

  const engagementsQuery = useQuery({
    queryKey: ['full-management-engagements'],
    enabled: allowed,
    queryFn: () =>
      api<CursorPage<EngagementRow>>(
        '/service-engagements?limit=25&serviceModel=FULL_MANAGEMENT&status=ACTIVE',
      ),
  });

  const overviewQuery = useQuery({
    queryKey: ['full-management-overview'],
    enabled: allowed && hasPermission(principal!, 'finance.overview.read'),
    queryFn: () =>
      api<{
        summary?: {
          activeLeases?: number;
          openInvoices?: number;
          pendingOwnerPayouts?: number;
        };
      }>('/finance/overview?scope=FULL_MANAGEMENT'),
  });

  const nested = (row: EngagementRow, ...keys: string[]) =>
    keys.reduce<unknown>(
      (value, key) =>
        value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined,
      row,
    );
  const text = (value: unknown) => (typeof value === 'string' ? value : '');

  return (
    <CommercialShell principal={principal} activeItem="commercial:full-management">
      <PageHeader
        eyebrow="Commercial"
        title="Full Management Operations"
        description="Active full-management authorities, linked leases, and finance workload indicators."
        action={
          <Link className="button secondary" href="/commercial/service-engagements">
            Service Agreements
          </Link>
        }
      />

      {principal && !allowed ? (
        <DataTableEmpty
          title="Access restricted"
          description="Your current access does not include Full Management operations."
        />
      ) : engagementsQuery.isLoading ? (
        <DashboardSkeleton />
      ) : engagementsQuery.isError ? (
        <ErrorState message={userFacingError(engagementsQuery.error)} />
      ) : (
        <div className="space-y-6">
          {principal && hasPermission(principal, 'finance.overview.read') ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <MetricCard
                label="Active Engagements"
                value={engagementsQuery.data?.items.length ?? 0}
                href="/commercial/service-engagements"
                icon={Building2}
              />
              <MetricCard
                label="Active Leases"
                value={overviewQuery.data?.summary?.activeLeases ?? 0}
                href="/leasing/leases"
                icon={KeyRound}
              />
              <MetricCard
                label="Open Invoices"
                value={overviewQuery.data?.summary?.openInvoices ?? 0}
                href="/finance/invoices"
                icon={Receipt}
              />
              <MetricCard
                label="Pending Payouts"
                value={overviewQuery.data?.summary?.pendingOwnerPayouts ?? 0}
                href="/finance/owner-payouts"
                icon={Wallet}
              />
            </div>
          ) : null}

          <DataTableSurface>
            <header className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-[15px] font-semibold text-slate-900">Active Full Management Authorities</h2>
              <p className="mt-1 text-[13px] text-slate-500">
                Recurring billing applies only to these engagements. Brokerage authorities are excluded.
              </p>
            </header>

            {engagementsQuery.isFetching && !engagementsQuery.data ? (
              <TableSkeleton columns={4} />
            ) : !engagementsQuery.data?.items.length ? (
              <DataTableEmpty
                title="No active Full Management engagements"
                description="Start a Full Management workflow or activate a Service Agreement to populate this dashboard."
                action={
                  <Link className="button primary" href="/workflows/new?type=FULL_MANAGEMENT">
                    Start Full Management
                  </Link>
                }
              />
            ) : (
              <DataTableDesktopOnly>
                <DataTableScroll>
                  <DataTable minWidth={760}>
                    <DataTableHead>
                      <tr>
                        <DataTableHeaderCell>Engagement</DataTableHeaderCell>
                        <DataTableHeaderCell>Property</DataTableHeaderCell>
                        <DataTableHeaderCell>Effective From</DataTableHeaderCell>
                        <DataTableHeaderCell>Status</DataTableHeaderCell>
                        <DataTableHeaderCell align="right">Actions</DataTableHeaderCell>
                      </tr>
                    </DataTableHead>
                    <DataTableBody>
                      {engagementsQuery.data.items.map((row) => (
                        <DataTableRow key={row.id}>
                          <DataTableCell>{text(row.engagementNumber)}</DataTableCell>
                          <DataTableCell>
                            {`${text(nested(row, 'property', 'propertyCode'))} — ${text(nested(row, 'property', 'name'))}`}
                          </DataTableCell>
                          <DataTableCell>{formatDate(row.effectiveFrom)}</DataTableCell>
                          <DataTableCell>
                            <StatusBadge value={row.status ?? 'ACTIVE'} />
                          </DataTableCell>
                          <DataTableCell align="right">
                            <Link
                              className="button ghost text-[13px]"
                              href={`/commercial/service-engagements/${row.id}`}
                            >
                              Open
                            </Link>
                          </DataTableCell>
                        </DataTableRow>
                      ))}
                    </DataTableBody>
                  </DataTable>
                </DataTableScroll>
              </DataTableDesktopOnly>
            )}
          </DataTableSurface>

          <p className="text-[13px] text-slate-500">
            Service model: {humanize('FULL_MANAGEMENT')}. Rent collection and owner accounting follow
            engagement commercial terms.
          </p>
        </div>
      )}
    </CommercialShell>
  );
}
