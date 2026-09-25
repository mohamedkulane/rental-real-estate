'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import {
  Activity,
  Building2,
  CalendarDays,
  DollarSign,
  KeyRound,
  Percent,
  Receipt,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import { DashboardSkeleton } from '@/components/shared/loading-system';
import { EmptyState, StatusBadge } from '@/components/shared/ui';
import { formatDate, humanize } from '@/lib/presentation';
import { groupBy } from '@/lib/group-by';
import { BarChart, DonutChart, TrendChart } from './dashboard-charts';

const DASHBOARD_PROPERTY_IMAGE = '/images/dashboard/property-building.jpg';

type Row = Record<string, unknown>;

export type DashboardSummary = {
  widgets: Record<string, number | string>;
  recentActivity: Array<{
    kind: string;
    label: string;
    status: string;
    occurredAt: string;
    href: string;
  }>;
};

export type DashboardSnapshot = {
  summary: DashboardSummary | null;
  branches: Row[];
  employees: Row[];
  owners: Row[];
  properties: Row[];
  spaces: Row[];
  activity: Row[];
  renewals: Row[];
  operations: {
    openMaintenance: number;
    highPriorityIssues: number;
    workOrdersInProgress: number;
    upcomingInspections: number;
    overdueTasks: number;
  } | null;
};

const text = (value: unknown, fallback = '') =>
  typeof value === 'string' && value.trim() ? value : fallback;
const numberValue = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const array = (value: unknown): Row[] =>
  Array.isArray(value)
    ? value.filter((item): item is Row => Boolean(item) && typeof item === 'object')
    : [];
const nested = (row: Row, ...keys: string[]) =>
  keys.reduce<unknown>(
    (value, key) =>
      value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined,
    row,
  );

function formatMoney(value: unknown): string {
  const amount = numberValue(value);
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatRelativeTime(value: unknown): string {
  if (typeof value !== 'string' && !(value instanceof Date)) return 'Recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function KpiCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <article className="staff-kpi-card">
      <span className="staff-kpi-icon">{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <span className="staff-kpi-context">
          <TrendingUp aria-hidden="true" /> Current register
        </span>
      </div>
    </article>
  );
}

function Panel({
  title,
  subtitle,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`staff-dashboard-panel ${className}`.trim()}>
      <header className="staff-dashboard-panel-header">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

function propertyBranchName(property: Row): string {
  const assignments = array(property.branchAssignments);
  const current =
    assignments.find((assignment) => !assignment.effectiveTo) ?? assignments[0] ?? null;
  return text(nested(current ?? {}, 'branch', 'name'), 'Unassigned');
}

function countPropertiesByBranch(properties: Row[], branches: Row[]) {
  const counts = new Map<string, number>();
  for (const branch of branches) counts.set(text(branch.name), 0);
  for (const property of properties) {
    const label = propertyBranchName(property);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, value]) => ({ label, value }));
}

export function StaffDashboard({
  dashboard,
  loading,
  workspaceTitle,
  workspaceDescription,
}: {
  dashboard: DashboardSnapshot;
  loading: boolean;
  workspaceTitle: string;
  workspaceDescription: string;
}) {
  const [period, setPeriod] = useState('month');
  const [branchId, setBranchId] = useState('');

  if (loading) return <DashboardSkeleton />;

  const widgets = dashboard.summary?.widgets ?? {};
  const scopedProperties = useMemo(
    () =>
      branchId
        ? dashboard.properties.filter((property) => {
            const assignments = array(property.branchAssignments);
            const current = assignments.find((assignment) => !assignment.effectiveTo) ?? assignments[0];
            return text(nested(current ?? {}, 'branch', 'id')) === branchId;
          })
        : dashboard.properties,
    [branchId, dashboard.properties],
  );
  const totalProperties = branchId
    ? scopedProperties.length
    : numberValue(widgets.totalProperties ?? dashboard.properties.length);
  const occupancyRate = numberValue(widgets.occupancyRate);
  const activeLeases = numberValue(widgets.activeLeases);
  const monthlyRevenue = numberValue(widgets.monthlyRevenue);
  const openMaintenance = numberValue(
    widgets.openMaintenance ?? dashboard.operations?.openMaintenance,
  );
  const outstandingReceivables = numberValue(widgets.outstandingReceivables);
  const totalBilled = monthlyRevenue + outstandingReceivables;
  const collectedPercent =
    totalBilled > 0 ? Math.round((monthlyRevenue / totalBilled) * 100) : monthlyRevenue > 0 ? 100 : 0;

  const propertyGroups = Object.entries(
    groupBy(scopedProperties, (property) => humanize(text(property.propertyType))),
  )
    .map(([label, items]) => ({ label, value: items?.length ?? 0 }))
    .sort((left, right) => right.value - left.value);

  const branchItems = countPropertiesByBranch(scopedProperties, dashboard.branches);
  const trendRevenue = [0, 0, 0, 0, 0, monthlyRevenue];
  const trendOccupancy = [occupancyRate, occupancyRate, occupancyRate, occupancyRate, occupancyRate, occupancyRate];

  const maintenanceSegments = [
    {
      label: 'Urgent',
      value: dashboard.operations?.highPriorityIssues ?? 0,
      color: '#ef4444',
    },
    {
      label: 'High',
      value: dashboard.operations?.overdueTasks ?? 0,
      color: '#f97316',
    },
    {
      label: 'Medium',
      value: dashboard.operations?.workOrdersInProgress ?? 0,
      color: '#eab308',
    },
    {
      label: 'Low',
      value: Math.max(
        0,
        openMaintenance -
          (dashboard.operations?.highPriorityIssues ?? 0) -
          (dashboard.operations?.overdueTasks ?? 0) -
          (dashboard.operations?.workOrdersInProgress ?? 0),
      ),
      color: '#059669',
    },
  ];

  const activityItems = dashboard.summary?.recentActivity.length
    ? dashboard.summary.recentActivity
    : dashboard.activity.slice(0, 6).map((item) => ({
        kind: text(item.entityType, 'Activity'),
        label: humanize(text(item.action)),
        status: 'Recorded',
        occurredAt: text(item.occurredAt),
        href: '/audit',
      }));

  const typeSegments = propertyGroups.length
    ? propertyGroups.map((group, index) => ({
        label: group.label,
        value: group.value,
        color: ['#059669', '#14b8a6', '#0ea5e9', '#6366f1', '#a855f7'][index % 5] ?? '#059669',
      }))
    : [{ label: 'No data', value: 1, color: '#e2e8f0' }];

  return (
    <div className="staff-dashboard">
      <header className="staff-dashboard-header">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>{workspaceTitle}</h1>
          <p>{workspaceDescription}</p>
        </div>
        <div className="staff-dashboard-controls" aria-label="Dashboard filters">
          {([
            ['today', 'Today'],
            ['week', 'This Week'],
            ['month', 'This Month'],
            ['year', 'This Year'],
          ] as const).map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={period === value ? 'is-active' : ''}
              onClick={() => setPeriod(value)}
            >
              {label}
            </button>
          ))}
          <label className="staff-dashboard-branch">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">Branch</span>
            <select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
              <option value="">All Branches</option>
              {dashboard.branches.map((branch) => (
                <option key={text(branch.id)} value={text(branch.id)}>
                  {text(branch.name, 'Unnamed branch')}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div className="staff-kpi-grid" aria-label="Key performance indicators">
        <KpiCard
          label="Total Properties"
          value={String(totalProperties)}
          icon={<Building2 aria-hidden="true" />}
        />
        <KpiCard
          label="Occupancy Rate"
          value={`${occupancyRate}%`}
          icon={<Percent aria-hidden="true" />}
        />
        <KpiCard
          label="Active Leases"
          value={String(activeLeases)}
          icon={<KeyRound aria-hidden="true" />}
        />
        <KpiCard
          label="Monthly Revenue"
          value={formatMoney(monthlyRevenue)}
          icon={<DollarSign aria-hidden="true" />}
        />
        <KpiCard
          label="Open Maintenance"
          value={String(openMaintenance)}
          icon={<Wrench aria-hidden="true" />}
        />
        <KpiCard
          label="Outstanding Receivables"
          value={formatMoney(outstandingReceivables)}
          icon={<Receipt aria-hidden="true" />}
        />
      </div>

      <div className="staff-dashboard-analytics">
        <Panel title="Revenue & Occupancy Trend" subtitle="Last 6 months" className="staff-panel-wide">
          <div className="staff-trend-wrap">
            <TrendChart revenue={trendRevenue} occupancy={trendOccupancy} />
            <div className="staff-trend-legend">
              <span>
                <i className="staff-legend-dot staff-legend-dot-revenue" /> Revenue
              </span>
              <span>
                <i className="staff-legend-dot staff-legend-dot-occupancy" /> Occupancy
              </span>
            </div>
          </div>
        </Panel>

        <Panel title="Properties by Branch">
          {branchItems.some((item) => item.value > 0) ? (
            <BarChart items={branchItems} />
          ) : (
            <EmptyState
              title="No branch distribution yet"
              description="Active properties will appear by operating branch."
            />
          )}
        </Panel>

        <Panel title="Property Type Mix">
          <div className="staff-donut-panel">
            <DonutChart
              segments={typeSegments}
              centerLabel="Properties"
              centerValue={String(totalProperties)}
            />
            <ul className="staff-legend-list">
              {propertyGroups.map((group) => {
                const percent = totalProperties
                  ? Math.round((group.value / totalProperties) * 100)
                  : 0;
                return (
                  <li key={group.label}>
                    <span>{group.label}</span>
                    <strong>
                      {group.value} ({percent}%)
                    </strong>
                  </li>
                );
              })}
            </ul>
          </div>
        </Panel>
      </div>

      <div className="staff-dashboard-grid">
        <Panel title="Recent Properties">
          {dashboard.properties.length ? (
            <div className="staff-property-list">
              {dashboard.properties.slice(0, 4).map((property) => (
                <Link
                  className="staff-property-card"
                  href={`/portfolio/properties/${text(property.id)}`}
                  key={text(property.id)}
                >
                  <span className="staff-property-thumb">
                    <Image
                      src={DASHBOARD_PROPERTY_IMAGE}
                      alt=""
                      width={54}
                      height={54}
                      className="staff-property-thumb-image"
                    />
                  </span>
                  <div>
                    <strong>{text(property.name)}</strong>
                    <small>
                      {text(property.propertyCode)} · {humanize(text(property.propertyType))} ·{' '}
                      {text(property.city, 'Location not set')}
                    </small>
                  </div>
                  <StatusBadge value={text(property.status, 'DRAFT')} />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No properties yet"
              description="Properties in your authorized scope will appear here."
            />
          )}
        </Panel>

        <Panel title="Upcoming Renewals">
          {dashboard.renewals.length ? (
            <div className="staff-renewal-list">
              {dashboard.renewals.slice(0, 4).map((renewal) => (
                <article className="staff-renewal-row" key={text(renewal.id)}>
                  <div className="staff-renewal-date">
                    <strong>{formatDate(renewal.proposedEndDate ?? renewal.effectiveTo).slice(0, 6)}</strong>
                    <small>{formatDate(renewal.proposedEndDate ?? renewal.effectiveTo)}</small>
                  </div>
                  <div>
                    <strong>{text(nested(renewal, 'originalLease', 'leaseNumber'), 'Lease renewal')}</strong>
                    <small>{humanize(text(renewal.status, 'PROPOSED'))}</small>
                  </div>
                  <Link
                    className="button ghost staff-renewal-action"
                    href={`/leasing/leases/${text(nested(renewal, 'originalLease', 'id'), '')}`}
                  >
                    Renewal
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No upcoming renewals"
              description="Lease renewals will appear here when leases approach expiry."
            />
          )}
        </Panel>

        <Panel title="Maintenance Overview">
          <div className="staff-donut-panel staff-donut-panel-compact">
            <DonutChart
              segments={maintenanceSegments}
              centerLabel="Open Requests"
              centerValue={String(openMaintenance)}
              size={148}
            />
            <ul className="staff-legend-list">
              {maintenanceSegments.map((segment) => (
                <li key={segment.label}>
                  <span>
                    <i style={{ background: segment.color }} /> {segment.label}
                  </span>
                  <strong>{segment.value}</strong>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>

      <div className="staff-dashboard-grid staff-dashboard-grid-secondary">
        <Panel title="Recent Activity">
          {activityItems.length ? (
            <div className="staff-activity-list">
              {activityItems.slice(0, 6).map((item, index) => (
                <article className="staff-activity-row" key={`${item.label}-${index}`}>
                  <span className="staff-activity-icon">
                    <Activity aria-hidden="true" />
                  </span>
                  <div>
                    <strong>{item.label}</strong>
                    <small>
                      {humanize(item.kind)} · {formatRelativeTime(item.occurredAt)}
                    </small>
                  </div>
                  <StatusBadge value={item.status} />
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No recent activity"
              description="Operational and governance activity will appear here."
            />
          )}
        </Panel>

        <Panel title="Collections Summary">
          <div className="staff-collections-panel">
            <DonutChart
              segments={[
                { label: 'Collected', value: collectedPercent, color: '#059669' },
                { label: 'Outstanding', value: Math.max(0, 100 - collectedPercent), color: '#e2e8f0' },
              ]}
              centerLabel="Collected"
              centerValue={`${collectedPercent}%`}
              size={148}
            />
            <div className="staff-collections-stats">
              <div>
                <small>Collected this month</small>
                <strong>{formatMoney(monthlyRevenue)}</strong>
              </div>
              <div>
                <small>Total billed</small>
                <strong>{formatMoney(totalBilled)}</strong>
              </div>
              <div>
                <small>Outstanding</small>
                <strong>{formatMoney(outstandingReceivables)}</strong>
              </div>
              <div>
                <small>Overdue accounts</small>
                <strong>{numberValue(widgets.pendingOwnerPayouts)}</strong>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
