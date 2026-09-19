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
          externalRef: externalRef || undefined,
          notes: notes || undefined,
        }),
      }),
    onSuccess: (payment) => {
      notify.payment({
        title: 'Payment recorded',
        message: 'Manual payment captured successfully.',
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
      description="Capture a manual payment. Allocate it to open charges on the next screen."
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
