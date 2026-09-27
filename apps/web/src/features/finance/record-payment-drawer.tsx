'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import toast, { notify } from '@/lib/toast';
import { WorkspaceFormDrawer, WorkspaceFormDrawerFooter } from '@/components/shared/workspace-form-drawer';
import { api, type Principal, userFacingError } from '@/lib/phase3-api';
import type { PickRecord } from '@/features/workflow/record-picker';
import { BranchSelect, FinanceRecordSelect, FinanceReferencePicker, FinanceTextArea, FinanceTextField, financePickerMap } from './finance-forms';

const FORM_ID = 'record-payment-drawer-form';
type PayerKind = 'tenant' | 'owner';

export type CommissionPaymentContext = {
  chargeId: string;
  branchId: string;
  payerPartyId: string;
  payerName: string;
  side: 'OWNER' | 'TENANT';
  propertyName: string;
  dealNumber: string;
  currency: string;
  expected: string;
  received: string;
  outstanding: string;
};

export type RentPaymentContext = {
  kind: 'RENT';
  chargeId: string;
  branchId: string;
  payerPartyId: string;
  payerName: string;
  propertyName: string;
  unitName: string;
  leaseNumber: string;
  chargeNumber: string;
  dueDate: string;
  currency: string;
  expected: string;
  received: string;
  outstanding: string;
};

type PaymentContext = CommissionPaymentContext | RentPaymentContext;

function isRentContext(context: PaymentContext): context is RentPaymentContext {
  return 'kind' in context && context.kind === 'RENT';
}

export function RecordPaymentDrawer({ open, onClose, principal, context }: {
  open: boolean;
  onClose: () => void;
  principal: Principal;
  context?: PaymentContext | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [branchId, setBranchId] = useState(principal.branches[0]?.id ?? '');
  const [payerKind, setPayerKind] = useState<PayerKind>('tenant');
  const [payer, setPayer] = useState<PickRecord | null>(null);
  const [methodId, setMethodId] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [amount, setAmount] = useState('');
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().slice(0, 10));
  const [externalRef, setExternalRef] = useState('');
  const [notes, setNotes] = useState('');
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (!context) return;
    setBranchId(context.branchId);
    setPayer({ id: context.payerPartyId, label: context.payerName });
    setPayerKind(!isRentContext(context) && context.side === 'OWNER' ? 'owner' : 'tenant');
    setCurrency(context.currency);
    setAmount(context.outstanding);
  }, [context]);

  const ready = Boolean(branchId && payer?.id && methodId && Number(amount) > 0);
  const create = useMutation({
    mutationFn: () => api<{ id: string }>('/payments', {
      method: 'POST',
      body: JSON.stringify({
        branchId,
        payerPartyId: payer?.id,
        methodId,
        chargeId: context?.chargeId,
        currency,
        amount,
        receivedAt,
        purpose: context ? undefined : 'GENERAL',
        externalRef: externalRef || undefined,
        notes: notes || undefined,
      }),
    }),
    onSuccess: (payment) => {
      notify.payment({
        title: 'Payment recorded',
        message: context
          ? `${isRentContext(context) ? 'Rent' : 'Commission'} payment recorded and allocated.`
          : 'General payment captured successfully.',
      });
      void queryClient.invalidateQueries({ queryKey: ['finance-register', 'payments'] });
      void queryClient.invalidateQueries({ queryKey: ['finance-overview'] });
      if (context && isRentContext(context)) {
        void queryClient.invalidateQueries({ queryKey: ['lease-detail'] });
      } else if (context) {
        void queryClient.invalidateQueries({ queryKey: ['brokerage-deal'] });
      }
      onClose();
      if (!context) router.push(`/finance/payments/${payment.id}`);
    },
    onError: (error) => toast.error(userFacingError(error)),
  });

  return (
    <WorkspaceFormDrawer
      open={open}
      eyebrow="Finance"
      title={context ? (isRentContext(context) ? 'Record Rent' : `Record ${context.side === 'OWNER' ? 'Owner' : 'Tenant'} Commission`) : 'Record General Payment'}
      description={context ? `Apply this payment to the existing ${isRentContext(context) ? 'rent' : 'commission'} amount due.` : 'Fallback entry for a payment that does not yet have a linked rent or commission amount.'}
      onClose={onClose}
      size="lg"
      footer={<WorkspaceFormDrawerFooter formId={FORM_ID} onCancel={onClose} submitLabel="Record payment" isPending={create.isPending} disabled={!ready} />}
    >
      <form id={FORM_ID} className="space-y-4" onSubmit={(event) => {
        event.preventDefault();
        if (!ready) {
          toast.error(context ? 'Choose a payment method and enter a valid amount.' : 'Choose a branch, payer, payment method, and amount.');
          return;
        }
        create.mutate();
      }}>
        {context && isRentContext(context) ? (
          <section className="grid gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 sm:grid-cols-2">
            <Summary label="Tenant" value={context.payerName} />
            <Summary label="Property / Unit" value={`${context.propertyName} / ${context.unitName}`} />
            <Summary label="Lease" value={context.leaseNumber} />
            <Summary label="Rent due" value={`${context.currency} ${context.expected}`} />
            <Summary label="Received" value={`${context.currency} ${context.received}`} />
            <Summary label="Outstanding" value={`${context.currency} ${context.outstanding}`} />
          </section>
        ) : context ? (
          <section className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
            <Summary label="Commission" value={`${context.side === 'OWNER' ? 'Owner' : 'Tenant'} Commission`} />
            <Summary label="Payer" value={context.payerName} />
            <Summary label="Property" value={context.propertyName} />
            <Summary label="Deal" value={context.dealNumber} />
            <Summary label="Expected" value={`${context.currency} ${context.expected}`} />
            <Summary label="Received / Outstanding" value={`${context.currency} ${context.received} / ${context.currency} ${context.outstanding}`} />
          </section>
        ) : (
          <>
            <BranchSelect branches={principal.branches} value={branchId} onChange={setBranchId} />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                Payer type
                <select className="w-full rounded-md border border-slate-200 px-3 py-2.5 text-sm shadow-sm" value={payerKind} onChange={(event) => {
                  setPayerKind(event.target.value as PayerKind);
                  setPayer(null);
                }}>
                  <option value="tenant">Tenant</option>
                  <option value="owner">Owner</option>
                </select>
              </label>
              <FinanceRecordSelect label="Payer" path={payerKind === 'owner' ? '/owners' : '/tenants'} value={payer?.id ?? ''} map={payerKind === 'owner' ? financePickerMap.owner : financePickerMap.tenant} onChange={setPayer} required />
            </div>
          </>
        )}
        <FinanceReferencePicker label="Payment method" path="/finance/selectors/payment-methods" value={methodId} onChange={(record) => setMethodId(record?.id ?? '')} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <FinanceTextField label="Amount received" type="number" min={0} {...(context ? { max: Number(context.outstanding) } : {})} step="0.01" value={amount} onChange={setAmount} required />
          <FinanceTextField label="Payment date" type="date" value={receivedAt} onChange={setReceivedAt} required />
        </div>
        <button type="button" className="text-sm font-semibold text-[var(--primary)]" onClick={() => setShowMore((current) => !current)}>
          {showMore ? 'Hide details' : '+ More details'}
        </button>
        {showMore ? (
          <div className="space-y-4 border-t border-slate-100 pt-4">
            {!context ? <FinanceTextField label="Currency" value={currency} onChange={(value) => setCurrency(value.toUpperCase())} maxLength={3} required /> : null}
            <FinanceTextField label="Reference" value={externalRef} onChange={setExternalRef} />
            <FinanceTextArea label="Notes" value={notes} onChange={setNotes} />
          </div>
        ) : null}
      </form>
    </WorkspaceFormDrawer>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-slate-500">{label}</p><p className="text-sm font-semibold text-slate-900">{value}</p></div>;
}
