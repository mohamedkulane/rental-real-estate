'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Building2, FileText, Wallet, Wrench } from 'lucide-react';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableScroll,
  DataTableSurface,
} from '@/components/shared/data-table';
import { PageSkeleton } from '@/components/shared/loading-system';
import { EmptyState, ErrorState, PageHeader, StatusBadge } from '@/components/shared/ui';
import { api, userFacingError } from '@/lib/phase3-api';
import { formatDate, humanize } from '@/lib/presentation';
import { PortalShell, usePortalPrincipal } from './portal-shell';

const tabs = [
  { key: 'overview', label: 'Overview' },
  { key: 'properties', label: 'Properties' },
  { key: 'statements', label: 'Statements' },
  { key: 'payouts', label: 'Payouts' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'activity', label: 'Activity' },
] as const;

type OwnerTab = (typeof tabs)[number]['key'];

type OverviewData = {
  summary: {
    propertyCount: number;
    activeServices: number;
    statements: number;
    pendingPayouts: number;
    openMaintenance: number;
  };
  properties: Array<Record<string, unknown>>;
  services: Array<Record<string, unknown>>;
};

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-[28px] font-bold leading-none text-slate-900">{value}</p>
      <p className="mt-2 text-[13px] font-medium text-slate-500">{label}</p>
    </div>
  );
}

function displayText(value: unknown, fallback = '—'): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }
  return fallback;
}

export function OwnerPortal({ initialTab = 'overview' }: { initialTab?: OwnerTab }) {
  const { principal, error } = usePortalPrincipal('OWNER');
  const [activeTab, setActiveTab] = useState<OwnerTab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [statements, setStatements] = useState<Array<Record<string, unknown>>>([]);
  const [payouts, setPayouts] = useState<Array<Record<string, unknown>>>([]);
  const [maintenance, setMaintenance] = useState<Array<Record<string, unknown>>>([]);
  const [activity, setActivity] = useState<Array<Record<string, unknown>>>([]);

  const loadTab = useCallback(async (tab: OwnerTab) => {
    setLoading(true);
    setLoadError('');
    try {
      if (tab === 'overview' || tab === 'properties') {
        const data = await api<OverviewData>('/portal/owner/overview');
        setOverview(data);
      } else if (tab === 'statements') {
        const data = await api<{ items: Array<Record<string, unknown>> }>('/portal/owner/statements');
        setStatements(data.items);
      } else if (tab === 'payouts') {
        const data = await api<{ items: Array<Record<string, unknown>> }>('/portal/owner/payouts');
        setPayouts(data.items);
      } else if (tab === 'maintenance') {
        const data = await api<{ items: Array<Record<string, unknown>> }>('/portal/owner/maintenance');
        setMaintenance(data.items);
      } else if (tab === 'activity') {
        const data = await api<{ items: Array<Record<string, unknown>> }>('/portal/owner/activity');
        setActivity(data.items);
      }
    } catch (cause) {
      setLoadError(userFacingError(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!principal) return;
    void loadTab(activeTab);
  }, [activeTab, loadTab, principal]);

  return (
    <PortalShell
      title="Owner Portal"
      subtitle="Your properties, statements, and payouts"
      principal={principal}
      principalError={error}
      tabs={[...tabs]}
      activeTab={activeTab}
      onTabChange={(key) => setActiveTab(key as OwnerTab)}
    >
      <PageHeader
        eyebrow="Owner workspace"
        title={tabs.find((tab) => tab.key === activeTab)?.label ?? 'Overview'}
        description="Review portfolio performance, financial statements, and property activity."
      />
      {loadError ? <ErrorState message={loadError} /> : null}
      {loading ? <PageSkeleton /> : null}
      {!loading && !loadError ? renderTab(activeTab, {
        overview,
        statements,
        payouts,
        maintenance,
        activity,
      }) : null}
    </PortalShell>
  );
}

function renderTab(
  tab: OwnerTab,
  data: {
    overview: OverviewData | null;
    statements: Array<Record<string, unknown>>;
    payouts: Array<Record<string, unknown>>;
    maintenance: Array<Record<string, unknown>>;
    activity: Array<Record<string, unknown>>;
  },
) {
  if (tab === 'overview' && data.overview) {
    const { summary } = data.overview;
    return (
      <div className="mt-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard label="Properties" value={summary.propertyCount} />
          <MetricCard label="Active Services" value={summary.activeServices} />
          <MetricCard label="Issued Statements" value={summary.statements} />
          <MetricCard label="Pending Payouts" value={summary.pendingPayouts} />
          <MetricCard label="Open Maintenance" value={summary.openMaintenance} />
        </div>
        {data.overview.services.length ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-[15px] font-semibold text-slate-900">Active service agreements</h2>
            <ul className="mt-4 divide-y divide-slate-100">
              {data.overview.services.map((service) => (
                <li key={String(service.id)} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-slate-900">{String(service.engagementNumber)}</p>
                    <p className="text-sm text-slate-500">
                      {humanize(String(service.serviceModel))} · {String((service.property as { name?: string })?.name ?? 'Property')}
                    </p>
                  </div>
                  <StatusBadge value="ACTIVE" />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    );
  }

  if (tab === 'properties' && data.overview) {
    if (!data.overview.properties.length) {
      return (
        <EmptyState
          title="No properties yet"
          description="Properties linked to your owner account will appear here."
        />
      );
    }
    return (
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {data.overview.properties.map((property) => (
          <article
            key={String(property.id)}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <Building2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold text-slate-900">{String(property.name)}</h3>
                <p className="text-sm text-slate-500">
                  {String(property.propertyCode)} · {humanize(String(property.propertyType))}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge value={String(property.status)} />
                  <span className="text-xs text-slate-500">
                    {String(property.ownershipShare)}% ownership
                  </span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    );
  }

  if (tab === 'statements') {
    return (
      <StatementTable
        rows={data.statements}
        emptyTitle="No statements yet"
        emptyDescription="Issued owner statements will appear here."
      />
    );
  }

  if (tab === 'payouts') {
    if (!data.payouts.length) {
      return (
        <EmptyState
          title="No payouts yet"
          description="Approved and paid owner payouts will appear here."
        />
      );
    }
    return (
      <DataTableSurface className="mt-6">
        <DataTableScroll>
          <DataTable>
            <DataTableHead>
              <tr>
                <DataTableHeaderCell>Payout</DataTableHeaderCell>
                <DataTableHeaderCell>Scheduled</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Amount</DataTableHeaderCell>
                <DataTableHeaderCell>Status</DataTableHeaderCell>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {data.payouts.map((row) => (
                <DataTableRow key={String(row.id)}>
                  <DataTableCell>{String(row.payoutNumber)}</DataTableCell>
                  <DataTableCell>{formatDate(row.scheduledPayDate)}</DataTableCell>
                  <DataTableCell align="right">
                    {String(row.currency)} {String(row.amount)}
                  </DataTableCell>
                  <DataTableCell>
                    <StatusBadge value={String(row.status)} />
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </DataTableScroll>
      </DataTableSurface>
    );
  }

  if (tab === 'maintenance') {
    return (
      <MaintenanceTable
        rows={data.maintenance}
        emptyTitle="No maintenance requests"
        emptyDescription="Maintenance activity on your properties will appear here."
      />
    );
  }

  if (tab === 'activity') {
    if (!data.activity.length) {
      return (
        <EmptyState
          title="No recent activity"
          description="Statements, payouts, and maintenance updates will appear here."
        />
      );
    }
    return (
      <ul className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
        {data.activity.map((item) => (
          <li key={String(item.id)} className="flex items-start gap-3 px-5 py-4">
            <span className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              {item.kind === 'OWNER_STATEMENT' ? (
                <FileText className="h-4 w-4" aria-hidden="true" />
              ) : item.kind === 'OWNER_PAYOUT' ? (
                <Wallet className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Wrench className="h-4 w-4" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">{String(item.label)}</p>
              <p className="text-sm text-slate-500">
                {humanize(String(item.kind))} · {formatDate(item.occurredAt, true)}
              </p>
            </div>
            <StatusBadge value={String(item.status)} />
            {typeof item.linkPath === 'string' ? (
              <Link className="text-sm font-semibold text-emerald-700" href={item.linkPath}>
                View
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    );
  }

  return null;
}

function StatementTable({
  rows,
  emptyTitle,
  emptyDescription,
}: {
  rows: Array<Record<string, unknown>>;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (!rows.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <DataTableSurface className="mt-6">
      <DataTableScroll>
        <DataTable>
          <DataTableHead>
            <tr>
              <DataTableHeaderCell>Statement</DataTableHeaderCell>
              <DataTableHeaderCell>Property</DataTableHeaderCell>
              <DataTableHeaderCell>Period</DataTableHeaderCell>
              <DataTableHeaderCell>Status</DataTableHeaderCell>
              <DataTableHeaderCell>Action</DataTableHeaderCell>
            </tr>
          </DataTableHead>
          <DataTableBody>
            {rows.map((row) => {
              const property = row.property as { name?: string } | undefined;
              return (
                <DataTableRow key={String(row.id)}>
                  <DataTableCell>{String(row.statementNumber)}</DataTableCell>
                  <DataTableCell>{property?.name ?? 'Portfolio'}</DataTableCell>
                  <DataTableCell>
                    {formatDate(row.periodStart)} — {formatDate(row.periodEnd)}
                  </DataTableCell>
                  <DataTableCell>
                    <StatusBadge value={String(row.status)} />
                  </DataTableCell>
                  <DataTableCell>
                    <Link
                      className="text-sm font-semibold text-emerald-700"
                      href={`/portal/owner/statements/${String(row.id)}`}
                    >
                      View
                    </Link>
                  </DataTableCell>
                </DataTableRow>
              );
            })}
          </DataTableBody>
        </DataTable>
      </DataTableScroll>
    </DataTableSurface>
  );
}

function MaintenanceTable({
  rows,
  emptyTitle,
  emptyDescription,
}: {
  rows: Array<Record<string, unknown>>;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (!rows.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <DataTableSurface className="mt-6">
      <DataTableScroll>
        <DataTable>
          <DataTableHead>
            <tr>
              <DataTableHeaderCell>Request</DataTableHeaderCell>
              <DataTableHeaderCell>Property</DataTableHeaderCell>
              <DataTableHeaderCell>Reported</DataTableHeaderCell>
              <DataTableHeaderCell>Priority</DataTableHeaderCell>
              <DataTableHeaderCell>Status</DataTableHeaderCell>
            </tr>
          </DataTableHead>
          <DataTableBody>
            {rows.map((row) => {
              const property = row.property as { name?: string } | undefined;
              return (
                <DataTableRow key={String(row.id)}>
                  <DataTableCell>
                    <strong>{String(row.requestNumber)}</strong>
                    <p className="text-sm text-slate-500">{String(row.title)}</p>
                  </DataTableCell>
                  <DataTableCell>{property?.name ?? '—'}</DataTableCell>
                  <DataTableCell>{formatDate(row.reportedAt, true)}</DataTableCell>
                  <DataTableCell>{humanize(String(row.priority))}</DataTableCell>
                  <DataTableCell>
                    <StatusBadge value={String(row.status)} />
                  </DataTableCell>
                </DataTableRow>
              );
            })}
          </DataTableBody>
        </DataTable>
      </DataTableScroll>
    </DataTableSurface>
  );
}

export function OwnerStatementDetail({ statementId }: { statementId: string }) {
  const { principal, error } = usePortalPrincipal('OWNER');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [statement, setStatement] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!principal) return;
    setLoading(true);
    void api<Record<string, unknown>>(`/portal/owner/statements/${statementId}`)
      .then(setStatement)
      .catch((cause) => setLoadError(userFacingError(cause)))
      .finally(() => setLoading(false));
  }, [principal, statementId]);

  const lines = Array.isArray(statement?.lines)
    ? (statement.lines as Array<Record<string, unknown>>)
    : [];
  const property = statement?.property as { name?: string; propertyCode?: string } | undefined;

  return (
    <PortalShell
      title="Owner Portal"
      principal={principal}
      principalError={error}
      tabs={[...tabs]}
      activeTab="statements"
      onTabChange={() => undefined}
    >
      <PageHeader
        eyebrow="Owner statement"
        title={displayText(statement?.statementNumber, 'Statement')}
        description="Review the issued statement lines for the selected period."
        action={
          <Link className="text-sm font-semibold text-emerald-700" href="/portal/owner">
            Back to portal
          </Link>
        }
      />
      {loading ? <PageSkeleton /> : null}
      {loadError ? <ErrorState message={loadError} /> : null}
      {statement && !loading ? (
        <div className="mt-6 space-y-4">
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-4">
            <div>
              <p className="text-[12px] font-semibold text-slate-500">Property</p>
              <p>{property?.name ?? 'Portfolio'}</p>
            </div>
            <div>
              <p className="text-[12px] font-semibold text-slate-500">Period</p>
              <p>
                {formatDate(statement.periodStart)} — {formatDate(statement.periodEnd)}
              </p>
            </div>
            <div>
              <p className="text-[12px] font-semibold text-slate-500">Opening balance</p>
              <p>
                {displayText(statement.currency)} {displayText(statement.openingBalance, '0')}
              </p>
            </div>
            <div>
              <p className="text-[12px] font-semibold text-slate-500">Closing balance</p>
              <p>
                {displayText(statement.currency)} {displayText(statement.closingBalance, '0')}
              </p>
            </div>
          </div>
          <DataTableSurface>
            <DataTableScroll>
              <DataTable>
                <DataTableHead>
                  <tr>
                    <DataTableHeaderCell>Line</DataTableHeaderCell>
                    <DataTableHeaderCell>Type</DataTableHeaderCell>
                    <DataTableHeaderCell>Description</DataTableHeaderCell>
                    <DataTableHeaderCell align="right">Amount</DataTableHeaderCell>
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {lines.map((line) => (
                    <DataTableRow key={String(line.id ?? line.lineNo)}>
                      <DataTableCell>{String(line.lineNo)}</DataTableCell>
                      <DataTableCell>{humanize(String(line.lineCode))}</DataTableCell>
                      <DataTableCell>{String(line.description)}</DataTableCell>
                      <DataTableCell align="right">
                        {String(statement.currency)} {String(line.amount)}
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </DataTableScroll>
          </DataTableSurface>
        </div>
      ) : null}
    </PortalShell>
  );
}
