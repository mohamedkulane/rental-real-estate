'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import toast, { notify } from '@/lib/toast';
import {
  WorkspaceFormDrawer,
  WorkspaceFormDrawerFooter,
} from '@/components/shared/workspace-form-drawer';
import { api, type Principal, userFacingError } from '@/lib/phase3-api';
import type { PickRecord } from '@/features/workflow/record-picker';
import {
  BranchSelect,
  FinanceRecordSelect,
  FinanceReferencePicker,
  FinanceTextArea,
  FinanceTextField,
  financePickerMap,
} from './finance-forms';

const FORM_ID = 'record-payment-drawer-form';

type PayerKind = 'tenant' | 'owner';
type PaymentPurpose = 'GENERAL' | 'OWNER_COMMISSION' | 'TENANT_COMMISSION';

export function RecordPaymentDrawer({
  open,
  onClose,
  principal,
}: {
  open: boolean;
  onClose: () => void;
  principal: Principal;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [branchId, setBranchId] = useState(principal.branches[0]?.id ?? '');
  const [payerKind, setPayerKind] = useState<PayerKind>('tenant');
  const [purpose, setPurpose] = useState<PaymentPurpose>('GENERAL');
  const [payer, setPayer] = useState<PickRecord | null>(null);
  const [methodId, setMethodId] = useState('');
  const [receivingAccountId, setReceivingAccountId] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [amount, setAmount] = useState('');
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().slice(0, 10));
  const [externalRef, setExternalRef] = useState('');
  const [notes, setNotes] = useState('');
  const [showMore, setShowMore] = useState(false);

  const ready = Boolean(
    branchId && payer?.id && methodId && receivingAccountId && Number(amount) > 0,
  );

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
          purpose,
          externalRef: externalRef || undefined,
          notes: notes || undefined,
        }),
      }),
    onSuccess: (payment) => {
      notify.payment({
        title: 'Payment recorded',
        message:
          purpose === 'GENERAL'
            ? 'Manual payment captured successfully.'
            : 'Commission payment recorded and allocated.',
      });
      void queryClient.invalidateQueries({ queryKey: ['finance-register', 'payments'] });
      onClose();
      router.push(`/finance/payments/${payment.id}`);
    },
    onError: (error) => toast.error(userFacingError(error)),
  });

  return (
    <WorkspaceFormDrawer
      open={open}
      eyebrow="Finance"
      title="Record Payment"
      description="Capture cash received from a tenant or owner. Commission payments create and settle the receivable automatically."
      onClose={onClose}
      size="lg"
      footer={
        <WorkspaceFormDrawerFooter
          formId={FORM_ID}
          onCancel={onClose}
          submitLabel="Record payment"
          isPending={create.isPending}
          disabled={!ready}
        />
      }
    >
      <form
        id={FORM_ID}
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!ready) {
            toast.error('Choose a branch, payer, payment method, receiving account, and amount.');
            return;
          }
          create.mutate();
        }}
      >
        <BranchSelect branches={principal.branches} value={branchId} onChange={setBranchId} />
        <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
          Payment for
          <select
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-[#215E61] focus:outline-none focus:ring-2 focus:ring-[#215E61]/15"
            value={purpose}
            onChange={(event) => {
              const next = event.target.value as PaymentPurpose;
              setPurpose(next);
              if (next === 'OWNER_COMMISSION') {
                setPayerKind('owner');
                setPayer(null);
              } else if (next === 'TENANT_COMMISSION') {
                setPayerKind('tenant');
                setPayer(null);
              }
            }}
          >
            <option value="GENERAL">Rent / general payment</option>
            <option value="OWNER_COMMISSION">Owner brokerage commission</option>
            <option value="TENANT_COMMISSION">Tenant brokerage commission</option>
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
            Payer type
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-[#215E61] focus:outline-none focus:ring-2 focus:ring-[#215E61]/15"
              value={payerKind}
              disabled={purpose !== 'GENERAL'}
              onChange={(event) => {
                setPayerKind(event.target.value as PayerKind);
                setPayer(null);
              }}
            >
              <option value="tenant">Tenant</option>
              <option value="owner">Owner</option>
            </select>
          </label>
          <FinanceRecordSelect
            label="Payer"
            path={payerKind === 'owner' ? '/owners' : '/tenants'}
            value={payer?.id ?? ''}
            map={payerKind === 'owner' ? financePickerMap.owner : financePickerMap.tenant}
            onChange={setPayer}
            required
          />
        </div>
        <FinanceReferencePicker
          label="Payment method"
          path="/finance/selectors/payment-methods"
          value={methodId}
          onChange={(record) => setMethodId(record?.id ?? '')}
          required
        />
        <div className="space-y-1.5">
          <FinanceReferencePicker
            label="Receiving account"
            path="/finance/selectors/receiving-accounts"
            value={receivingAccountId}
            onChange={(record) => setReceivingAccountId(record?.id ?? '')}
            required
          />
          <p className="text-[12px] text-slate-500">
            Lacagtu xagee ku dhacday? Choose Cash, Bank, or Mobile Money — not an income line.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
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
            label="Payment date"
            type="date"
            value={receivedAt}
            onChange={setReceivedAt}
            required
          />
        </div>
        <button
          type="button"
          className="text-sm font-semibold text-[#215E61]"
          onClick={() => setShowMore((current) => !current)}
        >
          {showMore ? 'Hide details' : '+ More Details'}
        </button>
        {showMore ? (
          <div className="space-y-4 border-t border-slate-100 pt-4">
            <FinanceTextField
              label="Currency"
              value={currency}
              onChange={(value) => setCurrency(value.toUpperCase())}
              maxLength={3}
              required
            />
            <FinanceTextField label="Reference" value={externalRef} onChange={setExternalRef} />
            <FinanceTextArea label="Notes" value={notes} onChange={setNotes} />
          </div>
        ) : null}
      </form>
    </WorkspaceFormDrawer>
  );
}
