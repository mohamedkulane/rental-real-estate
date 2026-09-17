'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Building2, Handshake, KeyRound, Receipt, ShoppingBag, Wallet } from 'lucide-react';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableDesktopOnly,
  DataTableEmpty,
  DataTableHead,
  DataTableHeaderCell,
  DataTableMobileCard,
  DataTableMobileCards,
  DataTableRow,
  DataTableScroll,
  DataTableSurface,
} from '@/components/shared/data-table';
import { DashboardSkeleton, TableSkeleton } from '@/components/shared/loading-system';
import { ErrorState, PageHeader, StatusBadge } from '@/components/shared/ui';
import { api, hasPermission, type CursorPage, userFacingError } from '@/lib/phase3-api';
import { formatDate, humanize } from '@/lib/presentation';
import type { EngagementRecord, ServiceModel } from './service-engagement-types';
import { CommercialShell, useCommercialPrincipal } from './commercial-shell';

type MetricDefinition = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
  queryKey: string[];
  queryFn: () => Promise<number>;
};

type ServiceDashboardConfig = {
  activeItem: string;
  serviceModel: ServiceModel;
  readPermission: string;
  workflowHref: string;
  startLabel: string;
  secondaryLabel: string;
  secondaryHref: string;
  title: string;
  description: string;
  tableTitle: string;
  tableDescription: string;
  emptyTitle: string;
  emptyDescription: string;
  footerNote: string;
  showSpaceColumn?: boolean;
  metrics: MetricDefinition[];
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
  icon: LucideIcon;
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

function propertyLabel(row: EngagementRecord) {
  return `${row.property.propertyCode} — ${row.property.name}`;
}

function currentBranch(row: EngagementRecord) {
  return row.property.branchAssignments?.[0]?.branch?.name ?? 'No current branch';
}

function spaceLabel(row: EngagementRecord) {
  if (!row.rentableSpace) return 'Whole property';
  return `${row.rentableSpace.spaceCode} — ${row.rentableSpace.name}`;
}

function CommercialHeaderActions({
  canStartWorkflow,
  workflowHref,
  startLabel,
  secondaryHref,
  secondaryLabel,
}: {
  canStartWorkflow: boolean;
  workflowHref: string;
  startLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
}) {
  return (
    <div className="flex flex-row flex-wrap items-center justify-end gap-2">
      {canStartWorkflow ? (
        <Link className="button primary shrink-0 whitespace-nowrap" href={workflowHref}>
          {startLabel}
        </Link>
      ) : null}
      <Link className="button secondary shrink-0 whitespace-nowrap" href={secondaryHref}>
        {secondaryLabel}
      </Link>
    </div>
  );
}

async function countItems(path: string, predicate?: (row: Record<string, unknown>) => boolean) {
  const page = await api<CursorPage<Record<string, unknown>>>(path);
  const items = page.items ?? [];
  return predicate ? items.filter(predicate).length : items.length;
}

function CommercialServiceDashboard({ config }: { config: ServiceDashboardConfig }) {
  const { principal } = useCommercialPrincipal();
  const allowed = Boolean(principal && hasPermission(principal, config.readPermission));
  const canStartWorkflow = Boolean(principal && hasPermission(principal, 'workflow.draft.update'));

  const engagementsQuery = useQuery({
    queryKey: ['commercial-service-engagements', config.serviceModel],
    enabled: allowed,
    queryFn: () =>
      api<CursorPage<EngagementRecord>>(
        `/service-engagements?limit=25&serviceModel=${config.serviceModel}&status=ACTIVE`,
      ),
  });

  const metricQueries = useQueries({
    queries: config.metrics.slice(1).map((metric) => ({
      queryKey: metric.queryKey,
      enabled:
        allowed &&
        Boolean(principal) &&
        (!metric.permission || hasPermission(principal!, metric.permission)),
      queryFn: metric.queryFn,
    })),
  });

  const propertyMetricValue = engagementsQuery.data?.items.length ?? 0;
  const propertyMetric = config.metrics[0];

  const headerActions = (
    <CommercialHeaderActions
      canStartWorkflow={canStartWorkflow}
      workflowHref={config.workflowHref}
      startLabel={config.startLabel}
      secondaryHref={config.secondaryHref}
      secondaryLabel={config.secondaryLabel}
    />
  );

  const metricsSection = (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {propertyMetric ? (
        <MetricCard
          label={propertyMetric.label}
          value={propertyMetricValue}
          href={propertyMetric.href}
          icon={propertyMetric.icon}
        />
      ) : null}
      {config.metrics.slice(1).map((metric, index) => {
        const query = metricQueries[index];
        if (
          principal &&
          metric.permission &&
          !hasPermission(principal, metric.permission)
        ) {
          return null;
        }
        return (
          <MetricCard
            key={metric.key}
            label={metric.label}
            value={query?.data ?? 0}
            href={metric.href}
            icon={metric.icon}
          />
        );
      })}
    </div>
  );

  return (
    <CommercialShell principal={principal} activeItem={config.activeItem}>
      <PageHeader
        eyebrow="Commercial"
        title={config.title}
        description={config.description}
        action={headerActions}
      />

      {principal && !allowed ? (
        <DataTableEmpty
          title="Access restricted"
          description={`Your current access does not include ${config.title.toLowerCase()}.`}
        />
      ) : engagementsQuery.isLoading ? (
        <DashboardSkeleton />
      ) : engagementsQuery.isError ? (
        <ErrorState message={userFacingError(engagementsQuery.error)} />
      ) : (
        <div className="space-y-6">
          {metricsSection}

          <DataTableSurface>
            <header className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-[15px] font-semibold text-slate-900">{config.tableTitle}</h2>
              <p className="mt-1 text-[13px] text-slate-500">{config.tableDescription}</p>
            </header>

            {engagementsQuery.isFetching && !engagementsQuery.data ? (
              <TableSkeleton columns={config.showSpaceColumn ? 6 : 5} />
            ) : !engagementsQuery.data?.items.length ? (
              <DataTableEmpty
                title={config.emptyTitle}
                description={config.emptyDescription}
                action={
                  canStartWorkflow ? (
                    <Link className="button primary" href={config.workflowHref}>
                      {config.startLabel}
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <>
                <DataTableMobileCards>
                  {engagementsQuery.data.items.map((row) => (
                    <DataTableMobileCard
                      key={row.id}
                      title={propertyLabel(row)}
                      subtitle={row.engagementNumber}
                      rows={[
                        ...(config.showSpaceColumn
                          ? [{ label: 'Rentable Space', value: spaceLabel(row) }]
                          : []),
                        { label: 'Branch', value: currentBranch(row) },
                        { label: 'Effective From', value: formatDate(row.effectiveFrom) },
                        { label: 'Status', value: <StatusBadge value={row.status} /> },
                      ]}
                      actions={
                        <div className="flex flex-row flex-wrap gap-2">
                          <Link
                            className="button secondary text-[13px]"
                            href={`/portfolio/properties/${row.property.id}`}
                          >
                            Open Property
                          </Link>
                          <Link
                            className="button ghost text-[13px]"
                            href={`/commercial/service-engagements/${row.id}`}
                          >
                            Open Agreement
                          </Link>
                        </div>
                      }
                    />
                  ))}
                </DataTableMobileCards>

                <DataTableDesktopOnly>
                  <DataTableScroll>
                    <DataTable minWidth={920}>
                      <DataTableHead>
                        <tr>
                          <DataTableHeaderCell>Property</DataTableHeaderCell>
                          {config.showSpaceColumn ? (
                            <DataTableHeaderCell>Rentable Space</DataTableHeaderCell>
                          ) : null}
                          <DataTableHeaderCell>Service Agreement</DataTableHeaderCell>
                          <DataTableHeaderCell>Operating Branch</DataTableHeaderCell>
                          <DataTableHeaderCell>Effective From</DataTableHeaderCell>
                          <DataTableHeaderCell>Status</DataTableHeaderCell>
                          <DataTableHeaderCell align="right">Actions</DataTableHeaderCell>
                        </tr>
                      </DataTableHead>
                      <DataTableBody>
                        {engagementsQuery.data.items.map((row) => (
                          <DataTableRow key={row.id}>
                            <DataTableCell>
                              <Link
                                className="font-semibold text-[#0D47A1] hover:underline"
                                href={`/portfolio/properties/${row.property.id}`}
                              >
                                {propertyLabel(row)}
                              </Link>
                            </DataTableCell>
                            {config.showSpaceColumn ? (
                              <DataTableCell>{spaceLabel(row)}</DataTableCell>
                            ) : null}
                            <DataTableCell>{row.engagementNumber}</DataTableCell>
                            <DataTableCell>{currentBranch(row)}</DataTableCell>
                            <DataTableCell>{formatDate(row.effectiveFrom)}</DataTableCell>
                            <DataTableCell>
                              <StatusBadge value={row.status} />
                            </DataTableCell>
                            <DataTableCell align="right">
                              <div className="flex justify-end gap-2">
                                <Link
                                  className="button ghost text-[13px]"
                                  href={`/portfolio/properties/${row.property.id}`}
                                >
                                  Property
                                </Link>
                                <Link
                                  className="button ghost text-[13px]"
                                  href={`/commercial/service-engagements/${row.id}`}
                                >
                                  Agreement
                                </Link>
                              </div>
                            </DataTableCell>
                          </DataTableRow>
                        ))}
                      </DataTableBody>
                    </DataTable>
                  </DataTableScroll>
                </DataTableDesktopOnly>
              </>
            )}
          </DataTableSurface>

          <p className="text-[13px] text-slate-500">{config.footerNote}</p>
        </div>
      )}
    </CommercialShell>
  );
}

const fullManagementConfig: ServiceDashboardConfig = {
  activeItem: 'commercial:full-management',
  serviceModel: 'FULL_MANAGEMENT',
  readPermission: 'service-engagement.read',
  workflowHref: '/workflows/new?type=FULL_MANAGEMENT',
  startLabel: 'Start Full Management',
  secondaryLabel: 'Service Agreements',
  secondaryHref: '/commercial/service-engagements?serviceModel=FULL_MANAGEMENT&status=ACTIVE',
  title: 'Full Management Operations',
  description:
    'Review properties under active Full Management authority, then open leases, billing, and owner payouts from the linked workspaces.',
  tableTitle: 'Managed Properties',
  tableDescription:
    'Properties with active Full Management service agreements. Recurring billing applies only to these authorities.',
  emptyTitle: 'No managed properties yet',
  emptyDescription:
    'Start a Full Management guided workflow to register a property under this service model.',
  footerNote:
    'Service model: Full Management. Rent collection and owner accounting follow engagement commercial terms.',
  metrics: [
    {
      key: 'managed-properties',
      label: 'Managed Properties',
      href: '/commercial/service-engagements?serviceModel=FULL_MANAGEMENT&status=ACTIVE',
      icon: Building2,
      queryKey: ['full-management-managed-count'],
      queryFn: () => Promise.resolve(0),
    },
    {
      key: 'active-leases',
      label: 'Active Leases',
      href: '/leasing/leases',
      icon: KeyRound,
      permission: 'finance.overview.read',
      queryKey: ['full-management-active-leases'],
      queryFn: async () => {
        const overview = await api<{ summary?: { activeLeases?: number } }>(
          '/finance/overview?scope=FULL_MANAGEMENT',
        );
        return overview.summary?.activeLeases ?? 0;
      },
    },
    {
      key: 'open-invoices',
      label: 'Open Invoices',
      href: '/finance/invoices',
      icon: Receipt,
      permission: 'finance.overview.read',
      queryKey: ['full-management-open-invoices'],
      queryFn: async () => {
        const overview = await api<{ summary?: { openInvoices?: number } }>(
          '/finance/overview?scope=FULL_MANAGEMENT',
        );
        return overview.summary?.openInvoices ?? 0;
      },
    },
    {
      key: 'pending-payouts',
      label: 'Pending Payouts',
      href: '/finance/owner-payouts',
      icon: Wallet,
      permission: 'finance.overview.read',
      queryKey: ['full-management-pending-payouts'],
      queryFn: async () => {
        const overview = await api<{ summary?: { pendingOwnerPayouts?: number } }>(
          '/finance/overview?scope=FULL_MANAGEMENT',
        );
        return overview.summary?.pendingOwnerPayouts ?? 0;
      },
    },
  ],
};

const rentalBrokerageConfig: ServiceDashboardConfig = {
  activeItem: 'commercial:rental-brokerage',
  serviceModel: 'RENTAL_BROKERAGE',
  readPermission: 'service-engagement.read',
  workflowHref: '/workflows/new?type=RENTAL_BROKERAGE',
  startLabel: 'Start Rental Brokerage',
  secondaryLabel: 'Brokerage Deals',
  secondaryHref: '/commercial/rental-brokerage/deals',
  title: 'Rental Brokerage Operations',
  description:
    'Review properties under active rental brokerage authority, then open placement deals and commission workflows.',
  tableTitle: 'Brokerage Properties',
  tableDescription:
    'Properties and rentable spaces covered by active rental brokerage service agreements.',
  emptyTitle: 'No brokerage properties yet',
  emptyDescription:
    'Start a Rental Brokerage guided workflow to register a property under this service model.',
  footerNote:
    'Service model: Rental Brokerage. Placement commission only; recurring Full Management billing does not apply.',
  showSpaceColumn: true,
  metrics: [
    {
      key: 'brokerage-properties',
      label: 'Brokerage Properties',
      href: '/commercial/service-engagements?serviceModel=RENTAL_BROKERAGE&status=ACTIVE',
      icon: Building2,
      queryKey: ['rental-brokerage-property-count'],
      queryFn: () => Promise.resolve(0),
    },
    {
      key: 'open-deals',
      label: 'Open Deals',
      href: '/commercial/rental-brokerage/deals',
      icon: Handshake,
      permission: 'brokerage-deal.read',
      queryKey: ['rental-brokerage-open-deals'],
      queryFn: () =>
        countItems('/brokerage-deals?limit=100', (row) =>
          ['DRAFT', 'NEGOTIATING', 'CONFIRMED'].includes(String(row.status ?? '')),
        ),
    },
    {
      key: 'closed-deals',
      label: 'Closed Deals',
      href: '/commercial/rental-brokerage/deals',
      icon: Receipt,
      permission: 'brokerage-deal.read',
      queryKey: ['rental-brokerage-closed-deals'],
      queryFn: () =>
        countItems('/brokerage-deals?limit=100', (row) => String(row.status ?? '') === 'CLOSED'),
    },
    {
      key: 'rental-listings',
      label: 'Rental Listings',
      href: '/marketing/rental-listings',
      icon: KeyRound,
      permission: 'listing.read',
      queryKey: ['rental-brokerage-listings'],
      queryFn: () => countItems('/rental-listings?limit=100'),
    },
  ],
};

const propertySaleConfig: ServiceDashboardConfig = {
  activeItem: 'commercial:property-sales',
  serviceModel: 'SALE_BROKERAGE',
  readPermission: 'service-engagement.read',
  workflowHref: '/workflows/new?type=PROPERTY_SALE',
  startLabel: 'Start Property Sale',
  secondaryLabel: 'Sales Pipeline',
  secondaryHref: '/commercial/property-sales/pipeline',
  title: 'Property Sale Operations',
  description:
    'Review properties under active sale brokerage authority, then open offers, negotiations, and settlements.',
  tableTitle: 'Properties for Sale',
  tableDescription:
    'Properties with active sale brokerage service agreements and seller-side commercial authority.',
  emptyTitle: 'No sale properties yet',
  emptyDescription:
    'Start a Property Sale guided workflow to register a property under this service model.',
  footerNote:
    'Service model: Sale Brokerage. Offers, settlements, and commissions follow engagement commercial terms.',
  metrics: [
    {
      key: 'sale-properties',
      label: 'Sale Properties',
      href: '/commercial/service-engagements?serviceModel=SALE_BROKERAGE&status=ACTIVE',
      icon: Building2,
      queryKey: ['property-sale-property-count'],
      queryFn: () => Promise.resolve(0),
    },
    {
      key: 'active-offers',
      label: 'Active Offers',
      href: '/commercial/offers',
      icon: ShoppingBag,
      permission: 'sale-offer.read',
      queryKey: ['property-sale-active-offers'],
      queryFn: () =>
        countItems('/sale-offers?limit=100', (row) =>
          ['DRAFT', 'SUBMITTED', 'COUNTERED'].includes(String(row.status ?? '')),
        ),
    },
    {
      key: 'accepted-offers',
      label: 'Accepted Offers',
      href: '/commercial/offers',
      icon: Handshake,
      permission: 'sale-offer.read',
      queryKey: ['property-sale-accepted-offers'],
      queryFn: () =>
        countItems('/sale-offers?limit=100', (row) => String(row.status ?? '') === 'ACCEPTED'),
    },
    {
      key: 'settlements',
      label: 'Settlements',
      href: '/commercial/settlements',
      icon: Wallet,
      permission: 'sale-settlement.read',
      queryKey: ['property-sale-settlements'],
      queryFn: () => countItems('/sale-settlements?limit=100'),
    },
  ],
};

export function FullManagementDashboard() {
  return <CommercialServiceDashboard config={fullManagementConfig} />;
}

export function RentalBrokerageDashboard() {
  return <CommercialServiceDashboard config={rentalBrokerageConfig} />;
}

export function PropertySaleDashboard() {
  return <CommercialServiceDashboard config={propertySaleConfig} />;
}
