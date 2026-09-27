'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Building2, CalendarDays, Handshake, KeyRound, MapPin, MoreHorizontal, Receipt, ShoppingBag, Wallet } from 'lucide-react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableDesktopOnly,
  DataTableEmpty,
  DataTableFilter,
  DataTableHead,
  DataTableHeaderCell,
  DataTableMobileCard,
  DataTableMobileCards,
  DataTableRow,
  DataTableSearch,
  DataTableScroll,
  DataTableSurface,
  DataTableToolbar,
  TableActionButton,
  TableActionGroup,
} from '@/components/shared/data-table';
import { DashboardSkeleton, TableSkeleton } from '@/components/shared/loading-system';
import { ErrorState, PageHeader, StatusBadge } from '@/components/shared/ui';
import { api, hasPermission, type CursorPage, userFacingError } from '@/lib/phase3-api';
import { formatDate } from '@/lib/presentation';
import type { EngagementRecord, ServiceModel } from './service-engagement-types';
import { CommercialShell, useCommercialPrincipal } from './commercial-shell';

type MetricDefinition = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
  queryKey: string[];
  queryFn: () => Promise<number | string>;
};

type ServiceDashboardConfig = {
  activeItem: string;
  serviceModel: ServiceModel;
  readPermission: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  title: string;
  description: string;
  tableTitle: string;
  tableDescription: string;
  emptyTitle: string;
  emptyDescription: string;
  showSpaceColumn?: boolean;
  premiumLayout?: boolean;
  metrics: MetricDefinition[];
};

type BrokeragePlacementRow = {
  id: string;
  dealNumber: string;
  leadId: string | null;
  status: string;
  currency: string;
  rentableSpace: {
    id: string;
    spaceCode: string;
    name: string;
    property: { id: string; propertyCode: string; name: string };
  };
  rentalAgreement: {
    agreementNumber: string;
    finalRent: string;
    owner: { displayName: string };
    customer: { displayName: string };
  } | null;
  lease: { id: string; leaseNumber: string; status: string; moveIn: { status: string } | null } | null;
  commissionReceivables: Array<{
    id: string;
    side: string | null;
    expected: string;
    received: string;
    outstanding: string;
  }>;
};

function MetricCard({
  label,
  value,
  href,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  href: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="service-metric-card rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition"
    >
      <span className="service-metric-icon inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
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

function managedLease(row: EngagementRecord) {
  return row.leases?.[0] ?? null;
}

function managedRentPosition(row: EngagementRecord) {
  const lease = managedLease(row);
  if (!lease) return { received: 0, outstanding: 0, currency: 'USD' };
  return lease.charges.reduce(
    (totals, charge) => ({
      received:
        totals.received + Number(charge.originalAmount) - Number(charge.outstandingAmount),
      outstanding: totals.outstanding + Number(charge.outstandingAmount),
      currency: charge.currency || totals.currency,
    }),
    { received: 0, outstanding: 0, currency: lease.currency || 'USD' },
  );
}

function managementFeeLabel(row: EngagementRecord) {
  const percent = row.commercialTerms?.managementFeePercent;
  return percent ? `${Number(percent).toFixed(2)}% of collected rent` : 'Not configured';
}

function CommercialHeaderActions({
  secondaryHref,
  secondaryLabel,
}: {
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  if (!secondaryHref || !secondaryLabel) return null;
  return (
    <div className="flex flex-row flex-wrap items-center justify-end gap-2">
      <Link className="button primary shrink-0 whitespace-nowrap" href={secondaryHref}>
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

function recordString(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === 'string' ? value : '';
}

function CommercialServiceDashboard({ config }: { config: ServiceDashboardConfig }) {
  const { principal } = useCommercialPrincipal();
  const allowed = Boolean(principal && hasPermission(principal, config.readPermission));
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('');

  const engagementsQuery = useQuery({
    queryKey: ['commercial-service-engagements', config.serviceModel],
    enabled: allowed,
    queryFn: () =>
      api<CursorPage<EngagementRecord>>(
        `/service-engagements?limit=25&serviceModel=${config.serviceModel}&status=ACTIVE`,
      ),
  });
  const placementsQuery = useQuery({
    queryKey: ['rental-brokerage-placements'],
    enabled:
      allowed &&
      config.serviceModel === 'RENTAL_BROKERAGE' &&
      Boolean(principal && hasPermission(principal, 'brokerage-deal.read')),
    queryFn: () => api<CursorPage<BrokeragePlacementRow>>('/brokerage-deals?limit=100'),
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
  const engagementRows = engagementsQuery.data?.items ?? [];
  const branches = useMemo(
    () => Array.from(new Set(engagementRows.map(currentBranch))).sort(),
    [engagementRows],
  );
  const filteredEngagementRows = engagementRows.filter((row) => {
    const searchable = `${propertyLabel(row)} ${spaceLabel(row)} ${row.engagementNumber} ${currentBranch(row)}`.toLowerCase();
    return (
      (!search.trim() || searchable.includes(search.trim().toLowerCase())) &&
      (!branch || currentBranch(row) === branch)
    );
  });

  const headerActions =
    config.secondaryHref && config.secondaryLabel ? (
      <CommercialHeaderActions
        secondaryHref={config.secondaryHref}
        secondaryLabel={config.secondaryLabel}
      />
    ) : undefined;

  const metricsSection = (
    <div className="service-metric-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
      <div className={config.premiumLayout ? 'service-dashboard service-dashboard--premium' : 'service-dashboard'}>
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
          <div className="service-dashboard-content space-y-6">
            <div className="service-dashboard-metrics">{metricsSection}</div>

            <DataTableSurface>
              <header className="border-b border-slate-100 px-5 py-4">
                <h2 className="text-[15px] font-semibold text-slate-900">{config.tableTitle}</h2>
                <p className="mt-1 text-[13px] text-slate-500">{config.tableDescription}</p>
              </header>
              <DataTableToolbar>
                <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2">
                  <DataTableSearch
                    value={search}
                    onChange={setSearch}
                    placeholder="Search properties, agreement, or branch..."
                  />
                  <DataTableFilter
                    label="Branch"
                    value={branch}
                    onChange={setBranch}
                    options={[
                      { value: '', label: 'All branches' },
                      ...branches.map((value) => ({ value, label: value })),
                    ]}
                  />
                </div>
              </DataTableToolbar>

              {engagementsQuery.isFetching && !engagementsQuery.data ? (
                <TableSkeleton columns={config.showSpaceColumn ? 6 : 5} />
              ) : !engagementRows.length ? (
                <DataTableEmpty
                  title={config.emptyTitle}
                  description={config.emptyDescription}
                />
              ) : !filteredEngagementRows.length ? (
                <DataTableEmpty
                  title="No matching properties"
                  description="Try another search term or branch filter."
                />
              ) : (
                <>
                  <DataTableMobileCards>
                    {filteredEngagementRows.map((row) => {
                      const lease = managedLease(row);
                      const rent = managedRentPosition(row);
                      const fullManagement = config.serviceModel === 'FULL_MANAGEMENT';
                      return (
                        <DataTableMobileCard
                          key={row.id}
                          title={propertyLabel(row)}
                          subtitle={fullManagement ? row.property.ownerships?.[0]?.owner.displayName ?? 'Owner not recorded' : row.engagementNumber}
                          rows={
                            fullManagement
                              ? [
                                  { label: 'Current tenant', value: lease?.parties[0]?.party.displayName ?? 'Vacant' },
                                  { label: 'Lease', value: lease?.leaseNumber ?? 'No active lease' },
                                  { label: 'Rent received', value: `${rent.currency} ${rent.received.toFixed(2)}` },
                                  { label: 'Outstanding rent', value: `${rent.currency} ${rent.outstanding.toFixed(2)}` },
                                  { label: 'Management fee', value: managementFeeLabel(row) },
                                  { label: 'Status', value: <StatusBadge value={row.status} /> },
                                ]
                              : [
                                  ...(config.showSpaceColumn
                                    ? [{ label: 'Rentable Space', value: spaceLabel(row) }]
                                    : []),
                                  { label: 'Branch', value: currentBranch(row) },
                                  { label: 'Effective From', value: formatDate(row.effectiveFrom) },
                                  { label: 'Status', value: <StatusBadge value={row.status} /> },
                                ]
                          }
                          actions={
                            <TableActionGroup>
                              <TableActionButton tone="property" href={`/portfolio/properties/${row.property.id}`}>
                                Open Property
                              </TableActionButton>
                              {fullManagement && lease ? (
                                <TableActionButton tone="open" href={`/leasing/leases/${lease.id}?tab=payments`}>
                                  Open Lease
                                </TableActionButton>
                              ) : !fullManagement ? (
                                <TableActionButton tone="agreement" href={`/commercial/service-engagements/${row.id}`}>
                                  Open Agreement
                                </TableActionButton>
                              ) : null}
                            </TableActionGroup>
                          }
                        />
                      );
                    })}
                  </DataTableMobileCards>

                  <DataTableDesktopOnly>
                    <DataTableScroll>
                      <DataTable minWidth={920}>
                        <DataTableHead>
                          <tr>
                            <DataTableHeaderCell>Property</DataTableHeaderCell>
                            {config.serviceModel === 'FULL_MANAGEMENT' ? (
                              <>
                                <DataTableHeaderCell>Owner / Tenant</DataTableHeaderCell>
                                <DataTableHeaderCell>Lease</DataTableHeaderCell>
                                <DataTableHeaderCell>Rent Position</DataTableHeaderCell>
                                <DataTableHeaderCell>Management Fee</DataTableHeaderCell>
                                <DataTableHeaderCell>Statement / Payout</DataTableHeaderCell>
                              </>
                            ) : (
                              <>
                                {config.showSpaceColumn ? <DataTableHeaderCell>Rentable Space</DataTableHeaderCell> : null}
                                <DataTableHeaderCell>Service Agreement</DataTableHeaderCell>
                                <DataTableHeaderCell>Operating Branch</DataTableHeaderCell>
                                <DataTableHeaderCell>Effective From</DataTableHeaderCell>
                              </>
                            )}
                            <DataTableHeaderCell>Status</DataTableHeaderCell>
                            <DataTableHeaderCell align="right">Actions</DataTableHeaderCell>
                          </tr>
                        </DataTableHead>
                        <DataTableBody>
                          {filteredEngagementRows.map((row) => {
                            const lease = managedLease(row);
                            const rent = managedRentPosition(row);
                            const fullManagement = config.serviceModel === 'FULL_MANAGEMENT';
                            const statement = row.property.ownerStatements?.[0];
                            const payout = row.property.ownerPayouts?.[0];
                            return <DataTableRow key={row.id}>
                              <DataTableCell>
                                <Link
                                  className="inline-flex items-center gap-2 font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)]"
                                  href={`/portfolio/properties/${row.property.id}`}
                                >
                                  <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                                  {propertyLabel(row)}
                                </Link>
                              </DataTableCell>
                              {fullManagement ? (
                                <>
                                  <DataTableCell>
                                    <span className="block font-medium text-slate-900">{row.property.ownerships?.[0]?.owner.displayName ?? 'Owner not recorded'}</span>
                                    <span className="mt-1 block text-xs text-slate-500">{lease?.parties[0]?.party.displayName ?? 'Vacant'}</span>
                                  </DataTableCell>
                                  <DataTableCell>
                                    {lease ? <Link className="font-semibold text-[var(--primary)]" href={`/leasing/leases/${lease.id}`}>{lease.leaseNumber}</Link> : 'No active lease'}
                                  </DataTableCell>
                                  <DataTableCell>
                                    <span className="block text-xs text-slate-600">Received: {rent.currency} {rent.received.toFixed(2)}</span>
                                    <span className="mt-1 block font-semibold text-slate-900">Outstanding: {rent.currency} {rent.outstanding.toFixed(2)}</span>
                                  </DataTableCell>
                                  <DataTableCell>{managementFeeLabel(row)}</DataTableCell>
                                  <DataTableCell>
                                    <span className="block text-xs text-slate-600">Statement: {statement?.status ?? 'Not generated'}</span>
                                    <span className="mt-1 block text-xs text-slate-600">Payout: {payout?.status ?? 'Not prepared'}</span>
                                  </DataTableCell>
                                </>
                              ) : config.showSpaceColumn ? (
                                <DataTableCell>
                                  <span className="inline-flex items-center gap-1.5">
                                    <Building2 className="h-3.5 w-3.5 text-[var(--primary)]" aria-hidden="true" />
                                    {spaceLabel(row)}
                                  </span>
                                </DataTableCell>
                              ) : null}
                              {!fullManagement ? <>
                                <DataTableCell>{row.engagementNumber}</DataTableCell>
                                <DataTableCell>
                                  <span className="inline-flex items-center gap-1.5">
                                    <MapPin className="h-3.5 w-3.5 text-[var(--primary)]" aria-hidden="true" />
                                    {currentBranch(row)}
                                  </span>
                                </DataTableCell>
                                <DataTableCell>
                                  <span className="inline-flex items-center gap-1.5">
                                    <CalendarDays className="h-3.5 w-3.5 text-[var(--primary)]" aria-hidden="true" />
                                    {formatDate(row.effectiveFrom)}
                                  </span>
                                </DataTableCell>
                              </> : null}
                              <DataTableCell>
                                <StatusBadge value={row.status} />
                              </DataTableCell>
                              <DataTableCell align="right">
                                <TableActionGroup>
                                  <TableActionButton
                                    tone="property"
                                    href={`/portfolio/properties/${row.property.id}`}
                                  >
                                    Property
                                  </TableActionButton>
                                  {fullManagement && lease ? <>
                                    <TableActionButton tone="open" href={`/leasing/leases/${lease.id}?tab=payments&recordRent=1`}>Record Rent</TableActionButton>
                                    <TableActionButton tone="edit" href={`/finance/expenses/new?propertyId=${row.property.id}&serviceEngagementId=${row.id}`}>Add Expense</TableActionButton>
                                    <details className="relative">
                                      <summary className="inline-flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" title="More property actions">
                                        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                                        <span className="sr-only">More property actions</span>
                                      </summary>
                                      <div className="absolute right-0 z-20 mt-1 grid min-w-44 gap-1 rounded-lg border border-slate-200 bg-white p-2 text-left shadow-md">
                                        <Link className="rounded-md px-3 py-2 text-sm hover:bg-slate-50" href={`/operations/maintenance?propertyId=${row.property.id}`}>Maintenance</Link>
                                        <Link className="rounded-md px-3 py-2 text-sm hover:bg-slate-50" href={`/finance/owner-statements?propertyId=${row.property.id}`}>Owner Statement</Link>
                                        <Link className="rounded-md px-3 py-2 text-sm hover:bg-slate-50" href={`/finance/owner-payouts?propertyId=${row.property.id}`}>Owner Payout</Link>
                                      </div>
                                    </details>
                                  </> : !fullManagement ? (
                                    <TableActionButton tone="agreement" href={`/commercial/service-engagements/${row.id}`}>Agreement</TableActionButton>
                                  ) : null}
                                </TableActionGroup>
                              </DataTableCell>
                            </DataTableRow>;
                          })}
                        </DataTableBody>
                      </DataTable>
                    </DataTableScroll>
                  </DataTableDesktopOnly>
                </>
              )}
            </DataTableSurface>

            {config.serviceModel === 'RENTAL_BROKERAGE' &&
            principal &&
            hasPermission(principal, 'brokerage-deal.read') ? (
              <DataTableSurface>
                <header className="border-b border-slate-100 px-5 py-4">
                  <h2 className="text-[15px] font-semibold text-slate-900">Placements and commission collection</h2>
                  <p className="mt-1 text-[13px] text-slate-500">
                    Confirmed agreements automatically create placements. Leases link automatically when created.
                  </p>
                </header>
                {placementsQuery.isLoading ? (
                  <TableSkeleton columns={7} />
                ) : placementsQuery.isError ? (
                  <ErrorState message={userFacingError(placementsQuery.error)} />
                ) : !(placementsQuery.data?.items ?? []).length ? (
                  <DataTableEmpty
                    title="No confirmed placements yet"
                    description="Complete a customer viewing and confirm the rental agreement to create the first placement."
                  />
                ) : (
                  <DataTableScroll>
                    <DataTable minWidth={1120}>
                      <DataTableHead>
                        <tr>
                          <DataTableHeaderCell>Property / Unit</DataTableHeaderCell>
                          <DataTableHeaderCell>Owner / Customer</DataTableHeaderCell>
                          <DataTableHeaderCell>Agreement / Lease</DataTableHeaderCell>
                          <DataTableHeaderCell>Owner Commission</DataTableHeaderCell>
                          <DataTableHeaderCell>Tenant Commission</DataTableHeaderCell>
                          <DataTableHeaderCell>Status</DataTableHeaderCell>
                          <DataTableHeaderCell align="right">Actions</DataTableHeaderCell>
                        </tr>
                      </DataTableHead>
                      <DataTableBody>
                        {(placementsQuery.data?.items ?? []).map((deal) => {
                          const owner = deal.commissionReceivables.find((item) => item.side === 'OWNER');
                          const tenant = deal.commissionReceivables.find((item) => item.side === 'TENANT');
                          const commissionText = (item: typeof owner) =>
                            item
                              ? `${deal.currency} ${item.received} received · ${item.outstanding} outstanding`
                              : 'Not configured';
                          return (
                            <DataTableRow key={deal.id}>
                              <DataTableCell>
                                <Link className="font-semibold text-[var(--primary)]" href={`/portfolio/properties/${deal.rentableSpace.property.id}`}>
                                  {deal.rentableSpace.property.propertyCode} — {deal.rentableSpace.property.name}
                                </Link>
                                <span className="mt-1 block text-xs text-slate-500">{deal.rentableSpace.spaceCode} — {deal.rentableSpace.name}</span>
                              </DataTableCell>
                              <DataTableCell>
                                <span className="block font-medium text-slate-900">{deal.rentalAgreement?.owner.displayName ?? 'Owner not recorded'}</span>
                                <span className="mt-1 block text-xs text-slate-500">{deal.rentalAgreement?.customer.displayName ?? 'Customer not recorded'}</span>
                              </DataTableCell>
                              <DataTableCell>
                                <span className="block font-medium text-slate-900">{deal.rentalAgreement?.agreementNumber ?? 'Agreement not recorded'}</span>
                                <span className="mt-1 block text-xs text-slate-500">{deal.lease?.leaseNumber ?? 'Lease pending'}</span>
                              </DataTableCell>
                              <DataTableCell><span className="text-xs text-slate-700">{commissionText(owner)}</span></DataTableCell>
                              <DataTableCell><span className="text-xs text-slate-700">{commissionText(tenant)}</span></DataTableCell>
                              <DataTableCell><StatusBadge value={deal.status} /></DataTableCell>
                              <DataTableCell align="right">
                                <TableActionButton tone="open" href={`/commercial/rental-brokerage/${deal.id}`}>Open Placement</TableActionButton>
                              </DataTableCell>
                            </DataTableRow>
                          );
                        })}
                      </DataTableBody>
                    </DataTable>
                  </DataTableScroll>
                )}
              </DataTableSurface>
            ) : null}

          </div>
        )}
      </div>

    </CommercialShell>
  );
}

const fullManagementConfig: ServiceDashboardConfig = {
  activeItem: 'commercial:full-management',
  serviceModel: 'FULL_MANAGEMENT',
  readPermission: 'service-engagement.read',
  title: 'Full Management Operations',
  description:
    'Manage tenants, rent, expenses, statements, maintenance, and owner payouts from each property.',
  tableTitle: 'Managed Properties',
  tableDescription:
    'Each property shows the active tenancy, rent position, management fee, statement, and payout status.',
  emptyTitle: 'No managed properties yet',
  emptyDescription:
    'Start a Full Management guided workflow to register a property under this service model.',
  metrics: [
    {
      key: 'managed-properties',
      label: 'Managed Properties',
      href: '/commercial/full-management',
      icon: Building2,
      queryKey: ['full-management-managed-count'],
      queryFn: () => Promise.resolve(0),
    },
    {
      key: 'active-leases',
      label: 'Active Managed Leases',
      href: '/leasing/leases',
      icon: KeyRound,
      permission: 'finance.overview.read',
      queryKey: ['full-management-active-leases'],
      queryFn: async () => {
        const overview = await api<{ summary?: { activeManagedLeases?: number } }>('/finance/overview');
        return overview.summary?.activeManagedLeases ?? 0;
      },
    },
    {
      key: 'rent-collected',
      label: 'Rent Collected',
      href: '/finance/payments',
      icon: Receipt,
      permission: 'finance.overview.read',
      queryKey: ['full-management-rent-collected'],
      queryFn: async () => {
        const overview = await api<{ summary?: { rentCollected?: string } }>('/finance/overview');
        return `USD ${overview.summary?.rentCollected ?? '0'}`;
      },
    },
    {
      key: 'pending-payouts',
      label: 'Owner Payouts Due',
      href: '/finance/owner-payouts',
      icon: Wallet,
      permission: 'finance.overview.read',
      queryKey: ['full-management-pending-payouts'],
      queryFn: async () => {
        const overview = await api<{ summary?: { pendingOwnerPayouts?: number } }>('/finance/overview');
        return overview.summary?.pendingOwnerPayouts ?? 0;
      },
    },
  ],
};

const rentalBrokerageConfig: ServiceDashboardConfig = {
  activeItem: 'commercial:rental-brokerage',
  serviceModel: 'RENTAL_BROKERAGE',
  readPermission: 'service-engagement.read',
  title: 'Rental Brokerage Operations',
  description:
    'Review properties under active rental brokerage authority, then open placement deals and commission workflows.',
  tableTitle: 'Brokerage Properties',
  tableDescription:
    'Properties and rentable spaces covered by active rental brokerage service agreements.',
  emptyTitle: 'No brokerage properties yet',
  emptyDescription:
    'Start a Rental Brokerage guided workflow to register a property under this service model.',
  showSpaceColumn: true,
  premiumLayout: true,
  metrics: [
    {
      key: 'brokerage-properties',
      label: 'Brokerage Properties',
      href: '/commercial/rental-brokerage',
      icon: Building2,
      queryKey: ['rental-brokerage-property-count'],
      queryFn: () => Promise.resolve(0),
    },
    {
      key: 'open-deals',
      label: 'Open Deals',
      href: '/commercial/rental-brokerage',
      icon: Handshake,
      permission: 'brokerage-deal.read',
      queryKey: ['rental-brokerage-open-deals'],
      queryFn: () =>
        countItems('/brokerage-deals?limit=100', (row) =>
          ['DRAFT', 'NEGOTIATING', 'CONFIRMED'].includes(recordString(row, 'status')),
        ),
    },
    {
      key: 'closed-deals',
      label: 'Closed Deals',
      href: '/commercial/rental-brokerage',
      icon: Receipt,
      permission: 'brokerage-deal.read',
      queryKey: ['rental-brokerage-closed-deals'],
      queryFn: () =>
        countItems('/brokerage-deals?limit=100', (row) => recordString(row, 'status') === 'CLOSED'),
    },
    {
      key: 'rental-listings',
      label: 'Rental Listings',
      href: '/rental/properties',
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
  metrics: [
    {
      key: 'sale-properties',
      label: 'Sale Properties',
      href: '/commercial/property-sales',
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
          ['DRAFT', 'SUBMITTED', 'COUNTERED'].includes(recordString(row, 'status')),
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
        countItems('/sale-offers?limit=100', (row) => recordString(row, 'status') === 'ACCEPTED'),
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
