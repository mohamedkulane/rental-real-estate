'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  Banknote,
  Building2,
  CalendarClock,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  DoorOpen,
  Handshake,
  KeyRound,
  Receipt,
  Users,
  WalletCards,
  Wrench,
} from 'lucide-react';
import { DashboardSkeleton } from '@/components/shared/loading-system';
import { EmptyState, StatusBadge } from '@/components/shared/ui';
import { api } from '@/lib/phase3-api';
import { humanize } from '@/lib/presentation';
import { BarChart, DonutChart } from './dashboard-charts';

type Row = Record<string, unknown>;

export type DashboardSummary = {
  widgets: Record<string, number | string>;
  operational: {
    todayViewings: number;
    upcomingViewings: number;
    rentOutstanding: string;
    brokerageOutstanding: string;
    leasesEndingSoon: number;
    openMaintenance: number;
    salesInProgress: number;
    ownerPayoutsDue: number;
  };
  charts: {
    collectionsByMonth: Array<{ month: string; amount: string }>;
    paymentMethods: Array<{ label: string; amount: string }>;
  };
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

function formatMoney(value: unknown): string {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(numberValue(value));
}

function formatRelativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
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
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <article className="staff-kpi-card">
      <span className="staff-kpi-icon">{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <span className="staff-kpi-context">{detail}</span>
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

const operations = [
  {
    key: 'todayViewings',
    label: "Today's Viewings",
    href: '/viewings',
    icon: CalendarDays,
    money: false,
  },
  {
    key: 'upcomingViewings',
    label: 'Upcoming Viewings',
    href: '/viewings',
    icon: CalendarClock,
    money: false,
  },
  {
    key: 'rentOutstanding',
    label: 'Rent Outstanding',
    href: '/finance/charges',
    icon: Receipt,
    money: true,
  },
  {
    key: 'brokerageOutstanding',
    label: 'Brokerage Outstanding',
    href: '/commercial/rental-brokerage/deals',
    icon: Handshake,
    money: true,
  },
  {
    key: 'leasesEndingSoon',
    label: 'Leases Ending Soon',
    href: '/leasing/leases',
    icon: KeyRound,
    money: false,
  },
  {
    key: 'openMaintenance',
    label: 'Open Maintenance',
    href: '/operations/maintenance',
    icon: Wrench,
    money: false,
  },
  {
    key: 'salesInProgress',
    label: 'Sales in Progress',
    href: '/sales/deals',
    icon: ClipboardList,
    money: false,
  },
  {
    key: 'ownerPayoutsDue',
    label: 'Owner Payouts Due',
    href: '/finance/owner-payouts',
    icon: WalletCards,
    money: false,
  },
] as const;

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
  const [branchId, setBranchId] = useState('');
  const scoped = useQuery({
    queryKey: ['dashboard-summary', branchId],
    enabled: Boolean(branchId),
    queryFn: () => api<DashboardSummary>(`/dashboard/summary?branchId=${branchId}`),
  });

  if (loading) return <DashboardSkeleton />;
  const summary = branchId ? scoped.data : dashboard.summary;
  if (branchId && scoped.isLoading) return <DashboardSkeleton />;
  if (!summary)
    return (
      <EmptyState
        title="Dashboard unavailable"
        description="Operational summary data could not be loaded."
      />
    );

  const widgets = summary.widgets;
  const operational = summary.operational;
  const totalUnits = numberValue(widgets.rentableSpaces);
  const occupiedUnits = numberValue(widgets.occupiedUnits);
  const availableUnits = numberValue(widgets.availableUnits);
  const unavailableUnits = numberValue(widgets.unavailableUnits);
  const occupancySegments = [
    { label: 'Occupied', value: occupiedUnits, color: '#215E61' },
    { label: 'Available', value: availableUnits, color: '#2F9D78' },
    { label: 'Held / unavailable', value: unavailableUnits, color: '#CBD5E1' },
  ];
  const paymentTotal = summary.charts.paymentMethods.reduce(
    (sum, item) => sum + Number(item.amount),
    0,
  );
  const paymentSegments = summary.charts.paymentMethods.map((item, index) => ({
    label: item.label,
    value: Number(item.amount),
    color: ['#215E61', '#2F9D78', '#3B82A0', '#D79A2B', '#7C6DAF'][index % 5] ?? '#215E61',
  }));
  const collectionItems = summary.charts.collectionsByMonth.map((item) => ({
    label: new Date(`${item.month}-01T00:00:00Z`).toLocaleDateString('en', { month: 'short' }),
    value: Number(item.amount),
  }));

  return (
    <div className="staff-dashboard">
      <header className="staff-dashboard-header">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>{workspaceTitle}</h1>
          <p>{workspaceDescription}</p>
        </div>
        <label className="staff-dashboard-branch">
          <Building2 className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Branch</span>
          <select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
            <option value="">All authorized branches</option>
            {dashboard.branches.map((branch) => (
              <option key={text(branch.id)} value={text(branch.id)}>
                {text(branch.name, 'Unnamed branch')}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="staff-kpi-grid staff-kpi-grid-five" aria-label="Key operational indicators">
        <KpiCard
          label="Total Properties"
          value={String(numberValue(widgets.totalProperties))}
          detail="Active portfolio assets"
          icon={<Building2 aria-hidden="true" />}
        />
        <KpiCard
          label="Available Units"
          value={String(availableUnits)}
          detail={`${totalUnits} canonical rental units`}
          icon={<DoorOpen aria-hidden="true" />}
        />
        <KpiCard
          label="Occupied Units"
          value={String(occupiedUnits)}
          detail={`${numberValue(widgets.occupancyRate)}% occupancy`}
          icon={<Users aria-hidden="true" />}
        />
        <KpiCard
          label="Active Tenancies"
          value={String(numberValue(widgets.activeLeases))}
          detail="Active lease contracts"
          icon={<KeyRound aria-hidden="true" />}
        />
        <KpiCard
          label="Money Received This Month"
          value={formatMoney(widgets.monthlyRevenue)}
          detail="Posted and verified payments"
          icon={<Banknote aria-hidden="true" />}
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {operations.map((item) => {
          const Icon = item.icon;
          const value = operational[item.key];
          return (
            <Link
              key={item.key}
              href={item.href}
              className="group flex min-h-[92px] items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[var(--primary)]/35 hover:shadow-md"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[var(--primary-soft)] text-[var(--primary)]">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <small className="block text-xs font-semibold text-slate-500">{item.label}</small>
                <strong className="mt-1 block text-xl text-slate-900">
                  {item.money ? formatMoney(value) : String(value)}
                </strong>
              </span>
            </Link>
          );
        })}
      </div>

      <div className="staff-dashboard-analytics mt-5">
        <Panel title="Occupancy" subtitle="Canonical rentable inventory">
          {totalUnits ? (
            <div className="staff-donut-panel">
              <DonutChart
                segments={occupancySegments}
                centerLabel="Units"
                centerValue={String(totalUnits)}
              />
              <ul className="staff-legend-list">
                {occupancySegments.map((item) => (
                  <li key={item.label}>
                    <span>
                      <i style={{ background: item.color }} /> {item.label}
                    </span>
                    <strong>{item.value}</strong>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyState
              title="No rental inventory"
              description="Rental and full-management units will appear here."
            />
          )}
        </Panel>
        <Panel
          title="Collections by Month"
          subtitle="Posted and verified payments"
          className="staff-panel-wide"
        >
          {collectionItems.length ? (
            <BarChart items={collectionItems} />
          ) : (
            <EmptyState
              title="No collection data"
              description="Monthly collections will appear when payments are posted."
            />
          )}
        </Panel>
        <Panel title="Payment Methods" subtitle="Current month">
          {paymentSegments.length ? (
            <div className="staff-donut-panel">
              <DonutChart
                segments={paymentSegments}
                centerLabel="Received"
                centerValue={formatMoney(paymentTotal)}
              />
              <ul className="staff-legend-list">
                {paymentSegments.map((item) => (
                  <li key={item.label}>
                    <span>
                      <i style={{ background: item.color }} /> {item.label}
                    </span>
                    <strong>{formatMoney(item.value)}</strong>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyState
              title="No payment mix"
              description="Payment methods will appear with this month's receipts."
            />
          )}
        </Panel>
      </div>

      <div className="staff-dashboard-grid staff-dashboard-grid-secondary mt-5">
        <Panel title="Recent Activity" subtitle="Latest financial and operational records">
          {summary.recentActivity.length ? (
            <div className="staff-activity-list">
              {summary.recentActivity.map((item, index) => (
                <Link
                  className="staff-activity-row"
                  href={item.href}
                  key={`${item.kind}-${item.label}-${index}`}
                >
                  <span className="staff-activity-icon">
                    <CircleDollarSign aria-hidden="true" />
                  </span>
                  <div>
                    <strong>{item.label}</strong>
                    <small>
                      {humanize(item.kind)} · {formatRelativeTime(item.occurredAt)}
                    </small>
                  </div>
                  <StatusBadge value={humanize(item.status)} />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No recent activity"
              description="New operational records will appear here."
            />
          )}
        </Panel>
        <Panel title="Financial Attention" subtitle="Amounts requiring follow-up">
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <Link href="/finance/charges" className="rounded-md border border-slate-200 p-4">
              <small className="font-semibold text-slate-500">Outstanding Receivables</small>
              <strong className="mt-2 block text-xl">
                {formatMoney(widgets.outstandingReceivables)}
              </strong>
            </Link>
            <Link href="/finance/owner-payouts" className="rounded-md border border-slate-200 p-4">
              <small className="font-semibold text-slate-500">Owner Payouts Due</small>
              <strong className="mt-2 block text-xl">{String(operational.ownerPayoutsDue)}</strong>
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}
