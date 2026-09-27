'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from '@/lib/toast';
import { FormSkeleton } from '@/components/shared/loading-system';
import { ErrorState, PageHeader, StatusBadge } from '@/components/shared/ui';
import { api, hasPermission, userFacingError } from '@/lib/phase3-api';
import { formatDate } from '@/lib/presentation';
import {
  FinanceField,
  TransitionPanel,
  financeMoney,
  financeNested,
  financeScalar,
  financeText,
  type FinanceRow,
} from '@/features/finance/finance-forms';
import { CommercialShell, useCommercialPrincipal } from './commercial-shell';
import { RecordPaymentDrawer, type CommissionPaymentContext } from '@/features/finance/record-payment-drawer';

const dealTransitions: Record<string, readonly string[]> = {
  DRAFT: ['NEGOTIATING', 'CANCELLED'],
  NEGOTIATING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['CLOSED', 'CANCELLED'],
};

export function BrokerageDealDetailWorkspace() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { principal } = useCommercialPrincipal();
  const canRead = Boolean(principal && hasPermission(principal, 'brokerage-deal.read'));
  const canManage = Boolean(principal && hasPermission(principal, 'brokerage-deal.manage'));
  const canRecordPayment = Boolean(principal && hasPermission(principal, 'payment.create'));
  const [paymentContext, setPaymentContext] = useState<CommissionPaymentContext | null>(null);

  const query = useQuery({
    queryKey: ['brokerage-deal', params.id],
    enabled: canRead && Boolean(params.id),
    queryFn: () => api<FinanceRow>(`/brokerage-deals/${params.id}`),
  });

  const transition = useMutation({
    mutationFn: ({ status, reason }: { status: string; reason: string }) =>
      api(`/brokerage-deals/${params.id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ status, reason }),
      }),
    onSuccess: () => {
      toast.success('Deal updated.');
      void queryClient.invalidateQueries({ queryKey: ['brokerage-deal', params.id] });
    },
    onError: (error) => toast.error(userFacingError(error)),
  });

  const status = financeText(query.data?.status);
  const linkedLeaseNumber = financeText(financeNested(query.data ?? {}, 'lease', 'leaseNumber'));
  const receivables = (query.data?.commissionReceivables as Array<Record<string, unknown>> | undefined) ?? [];
  const propertyName = financeText(financeNested(query.data ?? {}, 'rentableSpace', 'property', 'name'));
  const dealNumber = financeText(query.data?.dealNumber);
  const branchId = financeText(query.data?.branchId);
  const propertyId = financeText(financeNested(query.data ?? {}, 'rentableSpace', 'property', 'id'));
  const leadId = financeText(query.data?.leadId);
  const leaseId = financeText(query.data?.leaseId);
  const agreementNumber = financeText(financeNested(query.data ?? {}, 'rentalAgreement', 'agreementNumber'));
  const ownerName = financeText(financeNested(query.data ?? {}, 'rentalAgreement', 'owner', 'displayName'));
  const customerName = financeText(financeNested(query.data ?? {}, 'rentalAgreement', 'customer', 'displayName'));
  const moveInStatus = financeText(financeNested(query.data ?? {}, 'lease', 'moveIn', 'status'));
  const ownerReceivable = receivables.find((row) => financeText(row.side) === 'OWNER');
  const tenantReceivable = receivables.find((row) => financeText(row.side) === 'TENANT');
  const ownerOutstanding = Number(financeScalar(ownerReceivable?.outstanding));
  const tenantOutstanding = Number(financeScalar(tenantReceivable?.outstanding));
  const workflowSteps = [
    { label: 'Agreement confirmed', complete: Boolean(financeText(query.data?.rentalAgreementId)) },
    { label: 'Lease linked', complete: Boolean(financeText(query.data?.leaseId)) },
    { label: 'Owner commission collected', complete: ownerOutstanding <= 0 },
    { label: 'Tenant commission collected', complete: tenantOutstanding <= 0 },
    { label: 'Deal closed', complete: status === 'CLOSED' },
  ];
  const nextAction = status === 'CLOSED'
    ? 'This placement is complete.'
    : !financeText(query.data?.leaseId)
      ? 'Create the lease from the confirmed agreement; it will link automatically.'
      : ownerOutstanding > 0 || tenantOutstanding > 0
        ? 'Record the outstanding owner and tenant commission payments.'
        : 'Close the operational brokerage deal.';

  return (
    <CommercialShell principal={principal} activeItem="commercial:rental-brokerage">
      <PageHeader
        eyebrow="Commercial"
        title={financeText(query.data?.dealNumber) || 'Brokerage Deal'}
        description="Placement commission lifecycle from draft through close."
        action={
          <Link className="button secondary" href="/commercial/rental-brokerage">
            Back to brokerage
          </Link>
        }
      />
      {principal && !canRead ? (
        <ErrorState message="Your current access does not include brokerage deal details." />
      ) : query.isLoading ? (
        <FormSkeleton />
      ) : query.isError ? (
        <ErrorState message={userFacingError(query.error)} />
      ) : (
        <>
        <section className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-800">Placement workflow</p>
              <h2 className="mt-1 text-base font-semibold text-slate-900">One clear path from agreement to collection</h2>
              <p className="mt-1 text-sm text-slate-600">Next action: {nextAction}</p>
            </div>
            <StatusBadge value={status} />
          </div>
          <ol className="mt-5 grid gap-3 sm:grid-cols-5">
            {workflowSteps.map((step, index) => (
              <li key={step.label} className="flex items-start gap-2 text-sm sm:block">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${step.complete ? 'bg-emerald-700 text-white' : 'border border-slate-300 bg-white text-slate-500'}`}>
                  {step.complete ? 'OK' : index + 1}
                </span>
                <span className={`mt-1 block leading-snug sm:mt-2 ${step.complete ? 'font-semibold text-emerald-900' : 'text-slate-600'}`}>{step.label}</span>
              </li>
            ))}
          </ol>
        </section>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-slate-900">Deal summary</h2>
              <StatusBadge value={status} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FinanceField
                label="Rentable space"
                value={`${financeText(financeNested(query.data ?? {}, 'rentableSpace', 'spaceCode'))} — ${financeText(financeNested(query.data ?? {}, 'rentableSpace', 'name'))}`}
              />
              <FinanceField
                label="Linked lease"
                value={linkedLeaseNumber !== 'Not recorded' ? linkedLeaseNumber : 'Not linked yet'}
              />
              <FinanceField label="Owner" value={ownerName} />
              <FinanceField label="Customer" value={customerName} />
              <FinanceField label="Agreement" value={agreementNumber} />
              <FinanceField label="Move-In" value={moveInStatus} />
              <FinanceField label="Commission" value={financeMoney(query.data?.currency, query.data?.grossCommission)} />
              <FinanceField label="Rent basis" value={financeMoney(query.data?.currency, query.data?.rentBasis)} />
              <FinanceField label="Closed" value={formatDate(query.data?.closedAt)} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              {propertyId !== 'Not recorded' ? <Link className="button secondary" href={`/portfolio/properties/${propertyId}`}>Open Property</Link> : null}
              {leadId !== 'Not recorded' ? <Link className="button secondary" href={`/rental/customers/${leadId}`}>Open Customer</Link> : null}
              {leaseId !== 'Not recorded' ? <Link className="button secondary" href={`/leasing/leases/${leaseId}`}>Open Lease</Link> : null}
            </div>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-[15px] font-semibold text-slate-900">Commission collection</h2>
            <p className="mt-1 text-xs text-slate-500">Contractual revenue and cash received are tracked separately.</p>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {receivables.map((receivable) => {
                const side = financeText(receivable.side) as 'OWNER' | 'TENANT';
                const expected = financeScalar(receivable.expected);
                const received = financeScalar(receivable.received);
                const outstanding = financeScalar(receivable.outstanding);
                const debtor = receivable.debtor as Record<string, unknown> | undefined;
                const payerPartyId = financeText(debtor?.id);
                const payerName = financeText(debtor?.displayName);
                const currency = financeText(receivable.currency);
                return (
                  <article key={financeText(receivable.id)} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-slate-900">{side === 'OWNER' ? 'Owner Commission' : 'Tenant Commission'}</h3>
                      <StatusBadge value={financeText(receivable.status)} />
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-3 text-xs">
                      <div><dt className="text-slate-500">Expected</dt><dd className="mt-1 font-semibold text-slate-900">{financeMoney(currency, expected)}</dd></div>
                      <div><dt className="text-slate-500">Received</dt><dd className="mt-1 font-semibold text-slate-900">{financeMoney(currency, received)}</dd></div>
                      <div><dt className="text-slate-500">Outstanding</dt><dd className="mt-1 font-semibold text-slate-900">{financeMoney(currency, outstanding)}</dd></div>
                    </dl>
                    {canRecordPayment && Number(outstanding) > 0 ? (
                      <button className="button primary mt-4 w-full" type="button" onClick={() => setPaymentContext({
                        chargeId: financeText(receivable.id), branchId, payerPartyId, payerName, side,
                        propertyName, dealNumber, currency, expected, received, outstanding,
                      })}>
                        Record {side === 'OWNER' ? 'Owner' : 'Tenant'} Payment
                      </button>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
          </div>
          <div className="space-y-6">
            {canManage ? (
              <TransitionPanel
                currentStatus={status}
                transitions={(dealTransitions[status] ?? []).filter(
                  (nextStatus) =>
                    nextStatus !== 'CLOSED' ||
                    (ownerOutstanding <= 0 && tenantOutstanding <= 0),
                )}
                busy={transition.isPending}
                onTransition={(nextStatus, reason) => transition.mutate({ status: nextStatus, reason })}
              />
            ) : null}
          </div>
        </div>
        </>
      )}
      {principal ? <RecordPaymentDrawer open={Boolean(paymentContext)} onClose={() => setPaymentContext(null)} principal={principal} context={paymentContext} /> : null}
    </CommercialShell>
  );
}
