'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CreditCard, FileText, Landmark, Receipt, Wallet, CircleDollarSign } from 'lucide-react';
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

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-[24px] font-bold text-slate-900">{value}</p>
    </div>
  );
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
      className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <ArrowRight
          className="h-4 w-4 text-slate-300 transition group-hover:text-emerald-600"
          aria-hidden="true"
        />
      </div>
      <p className="mt-4 text-[28px] font-bold leading-none text-slate-900">{value}</p>
      <p className="mt-2 text-[13px] font-medium text-slate-500">{label}</p>
    </Link>
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
  if (!rows.length) return null;
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
        <Link className="button ghost text-[13px]" href={href}>
          View all
        </Link>
      </header>
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

  return (
    <FinanceShell principal={principal} principalError={principalError} activeItem="finance:overview">
      <PageHeader
        eyebrow="Finance workspace"
        title="Billing & Payments"
        description="Operational billing, receipts, owner accounting, and journal activity across your authorized branches."
      />

      {principal && !allowed ? (
        <FinanceAccessDenied />
      ) : query.isLoading ? (
        <DashboardSkeleton />
      ) : query.isError ? (
        <ErrorState message={userFacingError(query.error)} />
      ) : (
        <div className="space-y-6">
          {visibleCards.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
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
            <p className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-[14px] text-slate-600">
              No finance registers are available for your current permissions.
            </p>
          )}

          <div className="grid gap-6 xl:grid-cols-2">
            {query.data?.charts?.monthlyCollections?.length ? (
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-[15px] font-semibold text-slate-900">Monthly collections</h2>
                <div className="mt-4">
                  <BarChart items={query.data.charts.monthlyCollections} />
                </div>
              </section>
            ) : null}
            {query.data?.charts?.expenseBreakdown?.length ? (
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-[15px] font-semibold text-slate-900">Expense breakdown</h2>
                <div className="mt-4">
                  <BarChart
                    items={query.data.charts.expenseBreakdown.map((row) => ({
                      label: humanize(row.label),
                      value: row.value,
                    }))}
                  />
                </div>
              </section>
            ) : null}
          </div>

          {query.data?.summary ? (
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile label="Receivables outstanding" value={query.data.summary.receivablesTotal ?? '0'} />
              <MetricTile label="Payments received (6 mo.)" value={query.data.summary.paymentsReceivedTotal ?? '0'} />
              <MetricTile label="Brokerage commissions" value={query.data.summary.brokerageCommissionsTotal ?? '0'} />
              {principal && hasPermission(principal, 'billing.read') ? (
                <Link href="/finance/charges" className="block">
                  <MetricTile label="Open charges" value={String(query.data.summary.openCharges ?? 0)} />
                </Link>
              ) : (
                <MetricTile label="Open charges" value={String(query.data.summary.openCharges ?? 0)} />
              )}
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

          {visibleCards.length ? (
            <section className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-4">
              <p className="text-[13px] text-slate-600">
                Finance registers use server-side search, branch scope, and cursor pagination. Posted
                journals remain immutable; corrections require {humanize('REVERSAL')} entries.
              </p>
            </section>
          ) : null}
        </div>
      )}
    </FinanceShell>
  );
}
