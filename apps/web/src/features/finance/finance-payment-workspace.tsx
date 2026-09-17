'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast, { notify } from '@/lib/toast';
import { FormSkeleton } from '@/components/shared/loading-system';
import { ErrorState, FormSection, PageHeader, StatusBadge } from '@/components/shared/ui';
import { api, hasPermission, type CursorPage, userFacingError } from '@/lib/phase3-api';
import { formatDate, humanize } from '@/lib/presentation';
import type { PickRecord } from '@/features/workflow/record-picker';
import {
  BranchSelect,
  FinanceField,
  FinanceFormPanel,
  FinanceRecordSelect,
  FinanceReferencePicker,
  FinanceTextArea,
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

export function PaymentCreateWorkspace() {
  const router = useRouter();
  const { principal, error: principalError } = useFinancePrincipal();
  const allowed = Boolean(principal && hasPermission(principal, 'payment.create'));
  const [branchId, setBranchId] = useState('');
  const [payer, setPayer] = useState<PickRecord | null>(null);
  const [methodId, setMethodId] = useState('');
  const [receivingAccountId, setReceivingAccountId] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [amount, setAmount] = useState('');
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().slice(0, 10));
  const [externalRef, setExternalRef] = useState('');
  const [notes, setNotes] = useState('');

  const ready = Boolean(branchId && payer?.id && methodId && receivingAccountId && Number(amount) > 0);

  const create = useMutation({
    mutationFn: () =>
      api<{ id: string }>('/payments', {
        method: 'POST',
        body: JSON.stringify({
          branchId,
          payerPartyId: payer?.id,
          methodId,
          receivingAccountId,
          currency,
          amount,
          receivedAt,
          externalRef: externalRef || undefined,
          notes: notes || undefined,
        }),
      }),
    onSuccess: (payment: { id: string }) => {
      notify.payment({ title: 'Payment recorded', message: 'Manual payment captured successfully.' });
      router.push(`/finance/payments/${payment.id}`);
    },
    onError: (error) => toast.error(userFacingError(error)),
  });

  return (
    <FinanceShell principal={principal} principalError={principalError} activeItem="finance:payments">
      <PageHeader
        eyebrow="Finance"
        title="Record Payment"
        description="Capture a manual payment, then allocate it to open charges on the next screen."
        action={
          <Link className="button secondary" href="/finance/payments">
            Back to payments
          </Link>
        }
      />
      {principal && !allowed ? (
        <FinanceAccessDenied description="Payment capture requires payment.create permission." />
      ) : (
        <FinanceFormPanel
          title="Payment details"
          description="Choose the payer, method, and receiving account. Allocation happens after the payment is saved."
          submitLabel="Record payment"
          busy={create.isPending}
          disabled={!ready}
          onSubmit={() => {
            if (!ready) {
              toast.error('Choose a branch, payer, payment method, receiving account, and amount.');
              return;
            }
            create.mutate();
          }}
        >
          {principal ? (
            <BranchSelect branches={principal.branches} value={branchId} onChange={setBranchId} />
          ) : null}
          <FinanceRecordSelect
            label="Payer"
            path="/tenants"
            value={payer?.id ?? ''}
            map={financePickerMap.tenant}
            onChange={setPayer}
            required
          />
          <FinanceReferencePicker
            label="Payment method"
            path="/finance/selectors/payment-methods"
            value={methodId}
            onChange={(record) => setMethodId(record?.id ?? '')}
            required
          />
          <FinanceReferencePicker
            label="Receiving account"
            path="/finance/selectors/receiving-accounts"
            value={receivingAccountId}
            onChange={(record) => setReceivingAccountId(record?.id ?? '')}
            required
          />
          <FinanceTextField
            label="Amount"
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={setAmount}
            required
          />
          <FinanceTextField
            label="Currency"
            value={currency}
            onChange={(value) => setCurrency(value.toUpperCase())}
            maxLength={3}
            required
          />
          <FinanceTextField label="Payment date" type="date" value={receivedAt} onChange={setReceivedAt} required />
          <FinanceTextField label="Reference" value={externalRef} onChange={setExternalRef} />
          <FinanceTextArea label="Notes" value={notes} onChange={setNotes} />
        </FinanceFormPanel>
      )}
    </FinanceShell>
  );
}

type AllocationDraft = { chargeId: string; outstanding: string; amount: string };

export function PaymentDetailWorkspace() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { principal, error: principalError } = useFinancePrincipal();
  const canRead = Boolean(principal && hasPermission(principal, 'payment.read'));
  const canAllocate = Boolean(principal && hasPermission(principal, 'payment.allocate'));
  const canReceipt = Boolean(principal && hasPermission(principal, 'payment.create'));

  const payment = useQuery({
    queryKey: ['payment', params.id],
    enabled: canRead && Boolean(params.id),
    queryFn: () => api<FinanceRow>(`/payments/${params.id}`),
  });

  const charges = useQuery({
    queryKey: ['allocatable-charges', payment.data?.branchId, payment.data?.currency],
    enabled: Boolean(payment.data?.branchId && payment.data?.currency),
    queryFn: () =>
      api<CursorPage<FinanceRow>>(`/charges?limit=50&branchId=${String(payment.data?.branchId)}`),
  });

  const [drafts, setDrafts] = useState<AllocationDraft[]>([]);

  const paymentAmount = Number(financeScalar(payment.data?.amount) || 0);
  const allocated = ((payment.data?.allocations as Array<{ amount?: string }> | undefined) ?? []).reduce(
    (sum, row) => sum + Number(financeScalar(row.amount) || 0),
    0,
  );
  const available = paymentAmount - allocated;
  const draftTotal = drafts.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const openCharges = useMemo(() => {
    const allocatedIds = new Set(
      ((payment.data?.allocations as Array<{ chargeId?: string }> | undefined) ?? []).map((row) =>
        financeText(row.chargeId),
      ),
    );
    return (charges.data?.items ?? []).filter(
      (row) =>
        financeText(row.currency) === financeText(payment.data?.currency) &&
        ['OPEN', 'PARTIALLY_PAID'].includes(financeText(row.status)) &&
        !allocatedIds.has(row.id),
    );
  }, [charges.data?.items, payment.data]);

  const allocate = useMutation({
    mutationFn: () =>
      api(`/payments/${params.id}/allocate`, {
        method: 'POST',
        body: JSON.stringify({
          allocations: drafts
            .filter((row) => Number(row.amount) > 0)
            .map((row) => ({ chargeId: row.chargeId, amount: row.amount })),
        }),
      }),
    onSuccess: () => {
      notify.payment({ title: 'Payment allocated', message: 'Funds were applied to the selected charges.' });
      setDrafts([]);
      void queryClient.invalidateQueries({ queryKey: ['payment', params.id] });
    },
    onError: (error) => toast.error(userFacingError(error)),
  });

  const receipt = useMutation({
    mutationFn: () => api(`/payments/${params.id}/receipt`, { method: 'POST', body: '{}' }),
    onSuccess: () => {
      notify.payment({ title: 'Receipt issued', message: 'Tenant receipt is ready to share.' });
      void queryClient.invalidateQueries({ queryKey: ['payment', params.id] });
    },
    onError: (error) => toast.error(userFacingError(error)),
  });

  const receiptRow = payment.data?.receipt as Record<string, unknown> | null | undefined;

  return (
    <FinanceShell principal={principal} principalError={principalError} activeItem="finance:payments">
      <PageHeader
        eyebrow="Finance"
        title={financeText(payment.data?.paymentNumber) || 'Payment'}
        description="Allocate the received amount, then issue a receipt."
        action={
          <Link className="button secondary" href="/finance/payments">
            Back to payments
          </Link>
        }
      />
      {principal && !canRead ? (
        <FinanceAccessDenied />
      ) : payment.isLoading ? (
        <FormSkeleton />
      ) : payment.isError ? (
        <ErrorState message={userFacingError(payment.error)} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <FormSection title="Payment summary">
              <div className="grid gap-4 sm:grid-cols-2">
                <FinanceField label="Status" value={humanize(financeText(payment.data?.status))} />
                <FinanceField label="Amount" value={financeMoney(payment.data?.currency, payment.data?.amount)} />
                <FinanceField
                  label="Payer"
                  value={financeText(financeNested(payment.data ?? {}, 'payer', 'displayName'))}
                />
                <FinanceField
                  label="Method"
                  value={financeText(financeNested(payment.data ?? {}, 'method', 'name'))}
                />
                <FinanceField
                  label="Receiving account"
                  value={`${financeText(financeNested(payment.data ?? {}, 'receivingAccount', 'code'))} ${financeText(financeNested(payment.data ?? {}, 'receivingAccount', 'name'))}`.trim()}
                />
                <FinanceField label="Received" value={formatDate(payment.data?.receivedAt)} />
                <FinanceField label="Reference" value={financeText(payment.data?.externalRef)} />
                <FinanceField label="Allocated" value={financeMoney(payment.data?.currency, allocated)} />
                <FinanceField label="Available to allocate" value={financeMoney(payment.data?.currency, available)} />
              </div>
            </FormSection>

            {canAllocate && available > 0 ? (
              <FormSection
                title="Allocate payment"
                description={`Received ${financeMoney(payment.data?.currency, paymentAmount)}. Remaining ${financeMoney(payment.data?.currency, available)}.`}
              >
                {charges.isLoading ? (
                  <p className="text-[13px] text-slate-500">Loading open charges…</p>
                ) : !openCharges.length ? (
                  <p className="text-[14px] text-slate-500">
                    No open charges are available to allocate in this branch and currency.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {openCharges.map((charge) => {
                      const draft = drafts.find((row) => row.chargeId === charge.id);
                      return (
                        <li key={charge.id} className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_160px]">
                          <div>
                            <p className="text-[14px] font-semibold text-slate-900">
                              {financeText(charge.chargeNumber)}
                            </p>
                            <p className="text-[12px] text-slate-500">
                              Outstanding {financeMoney(charge.currency, charge.outstandingAmount)}
                            </p>
                          </div>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="rounded-lg border border-slate-200 px-3 py-2 text-[14px]"
                            placeholder="Amount"
                            value={draft?.amount ?? ''}
                            onChange={(event) => {
                              const next = event.target.value;
                              setDrafts((current) => {
                                const rest = current.filter((row) => row.chargeId !== charge.id);
                                if (!next) return rest;
                                return [
                                  ...rest,
                                  {
                                    chargeId: charge.id,
                                    outstanding: financeScalar(charge.outstandingAmount),
                                    amount: next,
                                  },
                                ];
                              });
                            }}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
                {openCharges.length ? (
                  <button
                    className="button primary mt-4"
                    type="button"
                    disabled={allocate.isPending || draftTotal <= 0 || draftTotal > available}
                    onClick={() => allocate.mutate()}
                  >
                    {allocate.isPending
                      ? 'Allocating…'
                      : `Allocate ${financeMoney(payment.data?.currency, draftTotal)}`}
                  </button>
                ) : null}
              </FormSection>
            ) : null}
          </div>

          <aside className="space-y-4">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[14px] font-semibold text-slate-900">Receipt</h2>
                <StatusBadge value={financeText(receiptRow?.status) || 'NOT_ISSUED'} />
              </div>
              {receiptRow ? (
                <div className="mt-3 space-y-2 text-[13px] text-slate-700">
                  <p>Receipt {financeText(receiptRow.receiptNumber)}</p>
                  <p>Amount {financeMoney(receiptRow.currency, receiptRow.amount)}</p>
                  <p>Issued {formatDate(receiptRow.issuedAt)}</p>
                  <button className="button secondary mt-2 w-full" type="button" onClick={() => window.print()}>
                    Print receipt
                  </button>
                </div>
              ) : canReceipt ? (
                allocated > 0 ? (
                  <button
                    className="button primary mt-4 w-full"
                    type="button"
                    disabled={receipt.isPending}
                    onClick={() => receipt.mutate()}
                  >
                    {receipt.isPending ? 'Issuing…' : 'Issue receipt'}
                  </button>
                ) : (
                  <p className="mt-3 text-[13px] text-slate-500">
                    Allocate this payment to an open charge before issuing a receipt.
                  </p>
                )
              ) : (
                <p className="mt-3 text-[13px] text-slate-500">Receipt is not issued yet.</p>
              )}
            </section>
          </aside>
        </div>
      )}
    </FinanceShell>
  );
}
