'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Banknote,
  Building2,
  CircleDollarSign,
  Handshake,
  Receipt,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { BarChart } from '@/features/admin/dashboard-charts';
import { DashboardSkeleton } from '@/components/shared/loading-system';
import { ErrorState, PageHeader, StatusBadge } from '@/components/shared/ui';
import { api, hasPermission, userFacingError } from '@/lib/phase3-api';
import { formatDate, humanize } from '@/lib/presentation';
import { FinanceAccessDenied } from './finance-shared';
import { FinanceShell, useFinancePrincipal } from './finance-shell';

type FinanceOverviewData = {
  summary?: {
    pendingOwnerPayouts?: number;
    openExpenses?: number;
    paymentsReceivedTotal?: string;
    rentCollected?: string;
    brokerageCashReceived?: string;
    brokerageOutstanding?: string;
    managementFeesTotal?: string;
    ownerPayoutsDue?: string;
    expensesTotal?: string;
  };
  charts?: {
    monthlyCollections?: Array<{ label: string; value: number }>;
    expenseBreakdown?: Array<{ label: string; value: number }>;
    revenueBySource?: Array<{ label: string; value: number }>;
    receivedByMethod?: Array<{ label: string; value: number }>;
  };
  recentPayments?: Array<{
    id: string;
    paymentNumber: string;
    receivedAt: string;
    status: string;
    currency: string;
    amount: string;
  }>;
};

type Metric = {
  key: string;
  label: string;
  value: string | undefined;
  hint: string;
  href: string;
  permission: string;
  icon: LucideIcon;
};

function formatMoney(value: string | number | undefined) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return String(value ?? '0');
  return new Intl.NumberFormat('en', {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function MetricCard({ metric }: { metric: Metric }) {
  const Icon = metric.icon;
  return (
    <Link
      href={metric.href}
      className="group flex min-h-28 items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#087A63]">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-slate-500">{metric.label}</span>
        <strong className="mt-1 block text-2xl text-slate-950">USD {formatMoney(metric.value)}</strong>
        <span className="mt-1 block text-xs text-slate-500">{metric.hint}</span>
      </span>
      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#087A63]" aria-hidden="true" />
    </Link>
  );
}

function ChartPanel({ title, description, items }: { title: string; description: string; items: Array<{ label: string; value: number }> }) {
  const hasValues = items.some((item) => item.value > 0);
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#087A63]">
          <TrendingUp className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-5">
        {items.length && hasValues ? (
          <BarChart items={items} />
        ) : (
          <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 text-center">
            <p className="text-sm text-slate-500">No activity has been recorded for this period.</p>
          </div>
        )}
      </div>
    </section>
  );
}

export function FinanceOverview() {
  const { principal, error: principalError } = useFinancePrincipal();
  const allowed = Boolean(principal && hasPermission(principal, 'finance.overview.read'));
  const query = useQuery({
    queryKey: ['finance-overview'],
    enabled: allowed,
    queryFn: () => api<FinanceOverviewData>('/finance/overview'),
  });

  const summary = query.data?.summary;
  const metrics: Metric[] = [
    { key: 'received', label: 'Received This Month', value: summary?.paymentsReceivedTotal, hint: 'All confirmed receipts', href: '/finance/payments', permission: 'payment.read', icon: Banknote },
    { key: 'rent', label: 'Rent Collected', value: summary?.rentCollected, hint: 'Allocated tenant rent', href: '/finance/payments', permission: 'payment.read', icon: Building2 },
    { key: 'brokerage-received', label: 'Brokerage Received', value: summary?.brokerageCashReceived, hint: 'Owner and tenant commissions', href: '/commercial/rental-brokerage', permission: 'brokerage-deal.read', icon: Handshake },
    { key: 'brokerage-outstanding', label: 'Brokerage Outstanding', value: summary?.brokerageOutstanding, hint: 'Confirmed commission due', href: '/commercial/rental-brokerage', permission: 'brokerage-deal.read', icon: CircleDollarSign },
    { key: 'management-fee', label: 'Management Fee Earned', value: summary?.managementFeesTotal, hint: 'From owner payout calculations', href: '/commercial/full-management', permission: 'payout.read', icon: Wallet },
    { key: 'payouts-due', label: 'Owner Payouts Due', value: summary?.ownerPayoutsDue, hint: `${summary?.pendingOwnerPayouts ?? 0} awaiting completion`, href: '/finance/owner-payouts', permission: 'payout.read', icon: Wallet },
    { key: 'expenses', label: 'Expenses This Month', value: summary?.expensesTotal, hint: `${summary?.openExpenses ?? 0} awaiting approval`, href: '/finance/expenses', permission: 'expense.read', icon: Receipt },
  ];
  const visibleMetrics = metrics.filter((metric) => principal && hasPermission(principal, metric.permission));
  const sourceItems = (query.data?.charts?.revenueBySource ?? []).filter((item) => item.value > 0);
  const methodItems = (query.data?.charts?.receivedByMethod ?? []).filter((item) => item.value > 0);
  const expenseItems = (query.data?.charts?.expenseBreakdown ?? []).map((item) => ({ label: humanize(item.label), value: item.value }));

  return (
    <FinanceShell principal={principal} principalError={principalError} activeItem="finance:overview">
      <PageHeader eyebrow="Finance" title="Finance Overview" description="Track money received, commission still due, owner payouts, and operating expenses." />

      {principal && !allowed ? (
        <FinanceAccessDenied />
      ) : query.isLoading ? (
        <DashboardSkeleton />
      ) : query.isError ? (
        <ErrorState message={userFacingError(query.error)} />
      ) : (
        <div className="space-y-5">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {visibleMetrics.map((metric) => <MetricCard key={metric.key} metric={metric} />)}
          </section>

          <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
            <ChartPanel title="Monthly Collections" description="Confirmed payments received during the last six months" items={query.data?.charts?.monthlyCollections ?? []} />
            <ChartPanel title="Revenue by Source" description="How collected money is split across rent and brokerage" items={sourceItems} />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <ChartPanel title="Payments by Method" description="Confirmed receipts grouped by payment method" items={methodItems} />
            <ChartPanel title="Expense Breakdown" description="Operating expenses grouped by category" items={expenseItems} />
          </div>

          {principal && hasPermission(principal, 'payment.read') ? (
            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">Recent Payments</h2>
                  <p className="mt-1 text-xs text-slate-500">Latest confirmed money received</p>
                </div>
                <Link className="inline-flex items-center gap-1 text-sm font-semibold text-[#087A63] hover:underline" href="/finance/payments">
                  View all <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </header>
              {query.data?.recentPayments?.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr><th className="px-5 py-3 font-semibold">Payment</th><th className="px-5 py-3 font-semibold">Received</th><th className="px-5 py-3 font-semibold">Amount</th><th className="px-5 py-3 font-semibold">Status</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {query.data.recentPayments.map((payment) => (
                        <tr key={payment.id}>
                          <td className="px-5 py-3 font-semibold text-slate-900">{payment.paymentNumber}</td>
                          <td className="px-5 py-3 text-slate-600">{formatDate(payment.receivedAt)}</td>
                          <td className="px-5 py-3 font-semibold text-slate-900">{payment.currency} {formatMoney(payment.amount)}</td>
                          <td className="px-5 py-3"><StatusBadge value={payment.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-5 py-10 text-center text-sm text-slate-500">No payments have been recorded yet.</div>
              )}
            </section>
          ) : null}
        </div>
      )}
    </FinanceShell>
  );
}
