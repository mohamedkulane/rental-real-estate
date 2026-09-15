'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FormSkeleton } from '@/components/shared/loading-system';
import { ErrorState, FormSection, PageHeader, StatusBadge } from '@/components/shared/ui';
import { api, hasPermission, pageItems, type CursorPage, userFacingError } from '@/lib/phase3-api';
import { formatDate, humanize } from '@/lib/presentation';
import type { PickRecord } from '@/features/workflow/record-picker';
import {
  FinanceField,
  FinanceFormPanel,
  FinanceRecordSelect,
  FinanceTextField,
  financeMoney,
  financeNested,
  financePickerMap,
  financeScalar,
  financeText,
  type FinanceRow,
} from './finance-forms';
import { FinanceAccessDenied } from './finance-shared';
import { FinanceShell, useFinancePrincipal } from './finance-shell';

type ChargeRow = FinanceRow & {
  chargeNumber?: string;
  outstandingAmount?: string;
  currency?: string;
  selected?: boolean;
};

export function InvoiceCreateWorkspace() {
  const router = useRouter();
  const { principal, error: principalError } = useFinancePrincipal();
  const allowed = Boolean(principal && hasPermission(principal, 'invoice.manage'));
  const [debtor, setDebtor] = useState<PickRecord | null>(null);
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
  );
  const [currency, setCurrency] = useState('USD');
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const charges = useQuery({
    queryKey: ['open-charges', debtor?.id],
    enabled: allowed && Boolean(debtor?.id),
    queryFn: () =>
      api<CursorPage<ChargeRow>>(
        `/charges?limit=50&debtorPartyId=${encodeURIComponent(String(debtor?.id))}`,
      ),
  });

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, value]) => value).map(([id]) => id),
    [selected],
  );

  const issue = useMutation({
    mutationFn: () =>
      api<{ id: string }>('/invoices', {
        method: 'POST',
        body: JSON.stringify({
          debtorPartyId: debtor?.id,
          chargeIds: selectedIds,
          issueDate,
          dueDate,
          currency,
        }),
      }),
    onSuccess: (invoice: { id: string }) => {
      toast.success('Invoice issued.');
      router.push(`/finance/invoices/${invoice.id}`);
    },
    onError: (error) => toast.error(userFacingError(error)),
  });

  return (
    <FinanceShell principal={principal} principalError={principalError} activeItem="finance:invoices">
      <PageHeader
        eyebrow="Finance"
        title="Create Invoice"
        description="Issue an invoice from open charges for a tenant or debtor."
        action={
          <Link className="button secondary" href="/finance/invoices">
            Back to invoices
          </Link>
        }
      />
      {principal && !allowed ? (
        <FinanceAccessDenied description="Invoice creation requires invoice.manage permission." />
      ) : (
        <div className="space-y-6">
          <FinanceFormPanel
            title="Invoice details"
            submitLabel="Issue invoice"
            busy={issue.isPending}
            disabled={!debtor?.id || selectedIds.length === 0}
            onSubmit={() => {
              if (!debtor?.id || selectedIds.length === 0) {
                toast.error('Choose a tenant and at least one open charge.');
                return;
              }
              issue.mutate();
            }}
          >
            <FinanceRecordSelect
              label="Customer / tenant"
              path="/tenants"
              value={debtor?.id ?? ''}
              map={financePickerMap.tenant}
              onChange={setDebtor}
              required
              emptyHint="No tenant records are available yet."
            />
            <FinanceTextField label="Issue date" type="date" value={issueDate} onChange={setIssueDate} required />
            <FinanceTextField label="Due date" type="date" value={dueDate} onChange={setDueDate} required />
            <FinanceTextField
              label="Currency"
              value={currency}
              onChange={(value) => setCurrency(value.toUpperCase())}
              maxLength={3}
              required
            />
          </FinanceFormPanel>

          <FormSection title="Charge lines" description="Select open charges to include on this invoice.">
            {!debtor ? (
              <p className="text-[14px] text-slate-500">Choose a tenant to load open charges.</p>
            ) : charges.isLoading ? (
              <FormSkeleton />
            ) : !pageItems(charges.data ?? []).length ? (
              <p className="text-[14px] text-slate-500">
                No open charges for this debtor. Run billing or post charges first.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {pageItems(charges.data ?? []).map((charge) => (
                  <li key={charge.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <label className="flex min-w-0 flex-1 items-center gap-3">
                      <input
                        type="checkbox"
                        checked={Boolean(selected[charge.id])}
                        onChange={(event) =>
                          setSelected((current) => ({ ...current, [charge.id]: event.target.checked }))
                        }
                      />
                      <span className="truncate text-[14px] font-medium text-slate-900">
                        {financeText(charge.chargeNumber)} — {financeMoney(charge.currency, charge.outstandingAmount)}
                      </span>
                    </label>
                    <span className="text-[12px] text-slate-500">Due {formatDate(charge.dueDate)}</span>
                  </li>
                ))}
              </ul>
            )}
          </FormSection>
        </div>
      )}
    </FinanceShell>
  );
}

export function InvoiceDetailWorkspace() {
  const params = useParams<{ id: string }>();
  const { principal, error: principalError } = useFinancePrincipal();
  const allowed = Boolean(principal && hasPermission(principal, 'invoice.read'));
  const query = useQuery({
    queryKey: ['invoice', params.id],
    enabled: allowed && Boolean(params.id),
    queryFn: () => api<FinanceRow>(`/invoices/${params.id}`),
  });

  const lines = (query.data?.lines as Array<Record<string, unknown>> | undefined) ?? [];
  const total = lines.reduce(
    (sum, line) => sum + Number(financeScalar(line.displayAmount) || 0),
    0,
  );

  return (
    <FinanceShell principal={principal} principalError={principalError} activeItem="finance:invoices">
      <PageHeader
        eyebrow="Finance"
        title={financeText(query.data?.invoiceNumber) || 'Invoice'}
        description="Invoice lifecycle, charge lines, and outstanding balance."
        action={
          <Link className="button secondary" href="/finance/invoices">
            Back to invoices
          </Link>
        }
      />
      {principal && !allowed ? (
        <FinanceAccessDenied />
      ) : query.isLoading ? (
        <FormSkeleton />
      ) : query.isError ? (
        <ErrorState message={userFacingError(query.error)} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <FormSection title="Invoice summary">
            <div className="grid gap-4 sm:grid-cols-2">
              <FinanceField label="Status" value={humanize(financeText(query.data?.status))} />
              <FinanceField label="Total" value={financeMoney(query.data?.currency, total)} />
              <FinanceField label="Issue date" value={formatDate(query.data?.issueDate)} />
              <FinanceField label="Due date" value={formatDate(query.data?.dueDate)} />
              <FinanceField label="Debtor" value={financeText(financeNested(query.data ?? {}, 'debtor', 'displayName')) || 'Linked tenant'} />
            </div>
            <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-left text-[14px]">
                <thead className="bg-slate-50 text-[12px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Charge</th>
                    <th className="px-4 py-2">Amount</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={financeText(line.id)} className="border-t border-slate-100">
                      <td className="px-4 py-2">
                        {financeText(financeNested(line, 'charge', 'chargeNumber'))}
                      </td>
                      <td className="px-4 py-2">{financeMoney(query.data?.currency, line.displayAmount)}</td>
                      <td className="px-4 py-2">
                        {humanize(financeText(financeNested(line, 'charge', 'status')))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FormSection>
          <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[14px] font-semibold text-slate-900">Payment state</h2>
              <StatusBadge value={financeText(query.data?.status)} />
            </div>
            <p className="mt-3 text-[13px] text-slate-600">
              Record a payment and allocate to the underlying charges from the payment workspace.
            </p>
            <Link className="button primary mt-4 w-full" href="/finance/payments/new">
              Record payment
            </Link>
          </aside>
        </div>
      )}
    </FinanceShell>
  );
}
