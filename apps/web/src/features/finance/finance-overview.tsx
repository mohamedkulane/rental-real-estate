'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CreditCard,
  FileText,
  Landmark,
  Receipt,
  Wallet,
  CircleDollarSign,
  TrendingUp,
} from 'lucide-react';
import { BarChart } from '@/features/admin/dashboard-charts';
import { DashboardSkeleton } from '@/components/shared/loading-system';
import { ErrorState, PageHeader, StatusBadge } from '@/components/shared/ui';
import { api, hasPermission, userFacingError } from '@/lib/phase3-api';
import { formatDate, humanize } from '@/lib/presentation';
import { FinanceAccessDenied } from './finance-shared';
import { FinanceShell, useFinancePrincipal } from './finance-shell';

type FinanceOverview = {
  summary?: {
    openInvoices?: number;
    unallocatedPayments?: number;
    pendingOwnerPayouts?: number;
    openExpenses?: number;
    draftJournals?: number;
    openCharges?: number;
    receivablesTotal?: string;
    paymentsReceivedTotal?: string;
    managementFeesTotal?: string;
    brokerageCommissionsTotal?: string;
  };
  charts?: {
    monthlyCollections?: Array<{ label: string; value: number }>;
    billedVsCollected?: Array<{ label: string; billed: number; collected: number }>;
    expenseBreakdown?: Array<{ label: string; value: number }>;
    revenueBySource?: Array<{ label: string; value: number }>;
  };
  recentInvoices?: Array<Record<string, unknown>>;
  recentPayments?: Array<Record<string, unknown>>;
};

const cards = [
  {
    key: 'charges',
    label: 'Open Charges',
    field: 'openCharges' as const,
    href: '/finance/charges',
    permission: 'billing.read',
    icon: CircleDollarSign,
  },
  {
    key: 'invoices',
    label: 'Open Invoices',
    field: 'openInvoices' as const,
    href: '/finance/invoices',
    permission: 'invoice.read',
    icon: FileText,
  },
  {
    key: 'payments',
    label: 'Unallocated Payments',
    field: 'unallocatedPayments' as const,
    href: '/finance/payments',
    permission: 'payment.read',
    icon: CreditCard,
  },
  {
    key: 'payouts',
    label: 'Pending Owner Payouts',
    field: 'pendingOwnerPayouts' as const,
    href: '/finance/owner-payouts',
    permission: 'payout.read',
    icon: Wallet,
  },
  {
    key: 'expenses',
    label: 'Open Expenses',
    field: 'openExpenses' as const,
    href: '/finance/expenses',
    permission: 'expense.read',
    icon: Receipt,
  },
  {
    key: 'journals',
    label: 'Draft Journals',
    field: 'draftJournals' as const,
    href: '/finance/accounting',
    permission: 'journal.read',
    icon: Landmark,
  },
];

function formatMoney(value: string | number | undefined) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return String(value ?? '0');
  return new Intl.NumberFormat('en', {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function OverviewCard({
  label,
  value,
  href,
  icon: Icon,
}: {
  label: string;
  value: number;
  href: string;
  icon: typeof FileText;
}) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#0F172A] via-[#0F766E] to-emerald-400 opacity-80" />
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#ECFDF5] text-[#0F766E] ring-1 ring-emerald-100">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <ArrowRight
          className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#0F766E]"
          aria-hidden="true"
        />
      </div>
      <p className="mt-5 text-[30px] font-bold leading-none tracking-tight text-[#0F172A]">
        {value}
      </p>
      <p className="mt-2 text-[13px] font-medium text-slate-500">{label}</p>
    </Link>
  );
}

function HighlightMetric({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div
      className={
        accent
          ? 'rounded-2xl border border-emerald-200 bg-gradient-to-br from-[#ECFDF5] to-white p-5 shadow-sm'
          : 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'
      }
    >
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-3 text-[28px] font-bold tracking-tight text-[#0F172A]">{value}</p>
      <p className="mt-2 text-[12px] leading-relaxed text-slate-500">{hint}</p>
    </div>
  );
}

function RecentList({
  title,
  rows,
  href,
}: {
  title: string;
  rows: Array<Record<string, unknown>>;
  href: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-4">
        <h2 className="text-[15px] font-semibold text-[#0F172A]">{title}</h2>
        <Link className="text-[13px] font-semibold text-[#0F766E] hover:underline" href={href}>
          View all
        </Link>
      </header>
      {rows.length ? (
        <ul className="divide-y divide-slate-100">
          {rows.slice(0, 5).map((row) => {
            const number =
              (row.invoiceNumber as string | undefined) ??
              (row.paymentNumber as string | undefined) ??
              (row.id as string);
            const status = row.status as string | undefined;
            const date =
              (row.issueDate as string | undefined) ??
              (row.receivedAt as string | undefined) ??
              (row.createdAt as string | undefined);
            return (
              <li key={row.id as string} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-slate-900">{number}</p>
                  <p className="text-[12px] text-slate-500">{formatDate(date)}</p>
                </div>
                {status ? <StatusBadge value={status} /> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="px-5 py-10 text-center">
          <p className="text-sm font-medium text-slate-700">Nothing here yet</p>
          <p className="mt-1 text-[13px] text-slate-500">New activity will appear in this list.</p>
        </div>
      )}
    </section>
  );
}

export function FinanceOverview() {
  const { principal, error: principalError } = useFinancePrincipal();
  const allowed = Boolean(principal && hasPermission(principal, 'finance.overview.read'));
  const query = useQuery({
    queryKey: ['finance-overview'],
    enabled: allowed,
    queryFn: () => api<FinanceOverview>('/finance/overview'),
  });

  const visibleCards = cards.filter(
    (card) => principal && hasPermission(principal, card.permission),
  );
  const summary = query.data?.summary;
  const collections = query.data?.charts?.monthlyCollections ?? [];
  const hasCollections = collections.some((row) => row.value > 0);

  return (
    <FinanceShell principal={principal} principalError={principalError} activeItem="finance:overview">
      <PageHeader
        eyebrow="Finance workspace"
        title="Billing & Payments"
        description="See what is owed, what was collected, and what still needs action across your branches."
      />

      {principal && !allowed ? (
        <FinanceAccessDenied />
      ) : query.isLoading ? (
        <DashboardSkeleton />
      ) : query.isError ? (
        <ErrorState message={userFacingError(query.error)} />
      ) : (
        <div className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0F172A] text-white shadow-md">
            <div className="relative px-5 py-6 sm:px-7 sm:py-8">
              <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-[#0F766E]/30 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />
              <div className="relative grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-emerald-200/90">
                    Cash position snapshot
                  </p>
                  <h2 className="mt-2 text-[28px] font-bold tracking-tight sm:text-[32px]">
                    ${formatMoney(summary?.paymentsReceivedTotal)}
                  </h2>
                  <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-slate-300">
                    Payments received in the last 6 months. Outstanding receivables still to collect:{' '}
                    <span className="font-semibold text-white">
                      ${formatMoney(summary?.receivablesTotal)}
                    </span>
                    .
                  </p>
                  {principal && hasPermission(principal, 'payment.create') ? (
                    <Link
                      href="/finance/payments/new"
                      className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#0F766E] px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-700"
                    >
                      Record payment
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                      Brokerage deals
                    </p>
                    <p className="mt-2 text-[22px] font-bold">
                      ${formatMoney(summary?.brokerageCommissionsTotal)}
                    </p>
                    <p className="mt-1 text-[12px] text-slate-400">Confirmed deal amounts, not cash yet</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                      Open work
                    </p>
                    <p className="mt-2 text-[22px] font-bold">{summary?.openCharges ?? 0}</p>
                    <p className="mt-1 text-[12px] text-slate-400">Open charges waiting collection</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {visibleCards.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              {visibleCards.map((card) => (
                <OverviewCard
                  key={card.key}
                  label={card.label}
                  value={query.data?.summary?.[card.field] ?? 0}
                  href={card.href}
                  icon={card.icon}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-[14px] text-slate-600">
              No finance registers are available for your current permissions.
            </p>
          )}

          <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[16px] font-semibold text-[#0F172A]">Monthly collections</h2>
                  <p className="mt-1 text-[13px] text-slate-500">Cash received over the last 6 months</p>
                </div>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-[#0F766E]">
                  <TrendingUp className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              {collections.length ? (
                <div className="mt-5">
                  {hasCollections ? (
                    <BarChart items={collections} />
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
                      <p className="text-sm font-medium text-slate-700">No collections recorded yet</p>
                      <p className="mt-1 text-[13px] text-slate-500">
                        Record a payment to populate this chart.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
                  <p className="text-sm font-medium text-slate-700">Chart unavailable</p>
                </div>
              )}
            </section>

            <div className="grid gap-4">
              <HighlightMetric
                label="Receivables outstanding"
                value={`$${formatMoney(summary?.receivablesTotal)}`}
                hint="Open charge balances still owed by payers"
              />
              <HighlightMetric
                label="Payments received"
                value={`$${formatMoney(summary?.paymentsReceivedTotal)}`}
                hint="Last 6 months of captured receipts"
                accent
              />
              <HighlightMetric
                label="Brokerage commissions"
                value={`$${formatMoney(summary?.brokerageCommissionsTotal)}`}
                hint="Deal totals — use Record Payment to capture cash"
              />
            </div>
          </div>

          {query.data?.charts?.expenseBreakdown?.length ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-[16px] font-semibold text-[#0F172A]">Expense breakdown</h2>
              <p className="mt-1 text-[13px] text-slate-500">Where operating spend is concentrated</p>
              <div className="mt-5">
                <BarChart
                  items={query.data.charts.expenseBreakdown.map((row) => ({
                    label: humanize(row.label),
                    value: row.value,
                  }))}
                />
              </div>
            </section>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-2">
            {principal && hasPermission(principal, 'invoice.read') ? (
              <RecentList
                title="Recent Invoices"
                rows={query.data?.recentInvoices ?? []}
                href="/finance/invoices"
              />
            ) : null}
            {principal && hasPermission(principal, 'payment.read') ? (
              <RecentList
                title="Recent Payments"
                rows={query.data?.recentPayments ?? []}
                href="/finance/payments"
              />
            ) : null}
          </div>
        </div>
      )}
    </FinanceShell>
  );
}
