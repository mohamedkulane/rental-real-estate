'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FormSkeleton } from '@/components/shared/loading-system';
import { ErrorState, PageHeader, StatusBadge } from '@/components/shared/ui';
import { api, hasPermission, userFacingError } from '@/lib/phase3-api';
import { formatDate, humanize } from '@/lib/presentation';
import type { PickRecord } from '@/features/workflow/record-picker';
import {
  BranchSelect,
  FinanceField,
  FinanceFormPanel,
  FinanceRecordSelect,
  FinanceStaticSelect,
  FinanceTextArea,
  FinanceTextField,
  TransitionPanel,
  financeMoney,
  financeNested,
  financePickerMap,
  financeText,
  type FinanceRow,
} from './finance-forms';
import { FinanceAccessDenied } from './finance-shared';
import { FinanceShell, useFinancePrincipal } from './finance-shell';

const expenseTransitions: Record<string, readonly string[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['REVIEW', 'CANCELLED'],
  REVIEW: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['POSTED', 'CANCELLED'],
  POSTED: ['PAID'],
  PAID: ['RECONCILED'],
};

export function ExpenseCreateWorkspace() {
  const router = useRouter();
  const { principal, error: principalError } = useFinancePrincipal();
  const allowed = Boolean(principal && hasPermission(principal, 'expense.manage'));
  const [branchId, setBranchId] = useState('');
  const [property, setProperty] = useState<PickRecord | null>(null);
  const [space, setSpace] = useState<PickRecord | null>(null);
  const [vendor, setVendor] = useState<PickRecord | null>(null);
  const [engagement, setEngagement] = useState<PickRecord | null>(null);
  const [categoryCode, setCategoryCode] = useState('MAINTENANCE');
  const [responsibility, setResponsibility] = useState<'COMPANY' | 'OWNER' | 'TENANT'>('COMPANY');
  const [owner, setOwner] = useState<PickRecord | null>(null);
  const [currency, setCurrency] = useState('USD');
  const [amount, setAmount] = useState('');
  const [businessDate, setBusinessDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');

  const ready =
    Boolean(branchId && categoryCode && Number(amount) > 0 && businessDate) &&
    (responsibility !== 'OWNER' || Boolean(owner?.id));

  const create = useMutation({
    mutationFn: () =>
      api<{ id: string }>('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          branchId,
          propertyId: property?.id,
          rentableSpaceId: space?.id,
          vendorPartyId: vendor?.partyId ?? vendor?.id,
          serviceEngagementId: engagement?.id,
          ownerPartyId: responsibility === 'OWNER' ? owner?.id : undefined,
          categoryCode,
          responsibility,
          currency,
          amount,
          businessDate,
          description: description || undefined,
        }),
      }),
    onSuccess: (expense: { id: string }) => {
      toast.success('Expense created.');
      router.push(`/finance/expenses/${expense.id}`);
    },
    onError: (error) => toast.error(userFacingError(error)),
  });

  return (
    <FinanceShell principal={principal} principalError={principalError} activeItem="finance:expenses">
      <PageHeader
        eyebrow="Finance"
        title="Create Expense"
        description="Record a property or vendor expense, then move it through review and posting."
        action={
          <Link className="button secondary" href="/finance/expenses">
            Back to expenses
          </Link>
        }
      />
      {principal && !allowed ? (
        <FinanceAccessDenied description="Expense creation requires expense.manage permission." />
      ) : (
        <FinanceFormPanel
          title="Expense details"
          description="Save a draft, then submit it for review from the expense detail page."
          submitLabel="Save draft expense"
          busy={create.isPending}
          disabled={!ready}
          onSubmit={() => {
            if (!ready) {
              toast.error('Enter a branch, amount, and owner when the expense is owner-responsible.');
              return;
            }
            create.mutate();
          }}
        >
          {principal ? (
            <BranchSelect branches={principal.branches} value={branchId} onChange={setBranchId} />
          ) : null}
          <FinanceRecordSelect
            label="Property"
            path="/properties?status=ACTIVE"
            value={property?.id ?? ''}
            map={financePickerMap.property}
            onChange={(record) => {
              setProperty(record);
              setSpace(null);
            }}
          />
          {property ? (
            <FinanceRecordSelect
              label="Rentable space"
              path={`/rentable-spaces?propertyId=${property.id}`}
              value={space?.id ?? ''}
              map={financePickerMap.space}
              onChange={setSpace}
            />
          ) : null}
          <FinanceRecordSelect
            label="Vendor"
            path="/vendors"
            value={vendor?.id ?? ''}
            map={financePickerMap.vendor}
            onChange={setVendor}
          />
          <FinanceRecordSelect
            label="Service engagement"
            path={
              property?.id
                ? `/service-engagements?status=ACTIVE&propertyId=${property.id}`
                : '/service-engagements?status=ACTIVE'
            }
            value={engagement?.id ?? ''}
            map={financePickerMap.engagement}
            onChange={setEngagement}
          />
          <FinanceStaticSelect
            label="Category"
            value={categoryCode}
            onChange={setCategoryCode}
            required
            options={['MAINTENANCE', 'UTILITIES', 'VENDOR', 'MARKETING', 'OFFICE', 'PAYROLL', 'BANK_CHARGES', 'OTHER'].map(
              (code) => ({ value: code, label: humanize(code) }),
            )}
          />
          <FinanceStaticSelect
            label="Responsibility"
            value={responsibility}
            onChange={(value) => setResponsibility(value as typeof responsibility)}
            required
            options={[
              { value: 'COMPANY', label: 'Company' },
              { value: 'OWNER', label: 'Owner' },
              { value: 'TENANT', label: 'Tenant' },
            ]}
          />
          {responsibility === 'OWNER' ? (
            <FinanceRecordSelect
              label="Owner"
              path="/owners"
              value={owner?.id ?? ''}
              map={financePickerMap.owner}
              onChange={setOwner}
              required
            />
          ) : null}
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
            label="Business date"
            type="date"
            value={businessDate}
            onChange={setBusinessDate}
            required
          />
          <FinanceTextArea label="Notes" value={description} onChange={setDescription} />
        </FinanceFormPanel>
      )}
    </FinanceShell>
  );
}

export function ExpenseDetailWorkspace() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { principal, error: principalError } = useFinancePrincipal();
  const canRead = Boolean(principal && hasPermission(principal, 'expense.read'));
  const canManage = Boolean(principal && hasPermission(principal, 'expense.manage'));

  const query = useQuery({
    queryKey: ['expense', params.id],
    enabled: canRead && Boolean(params.id),
    queryFn: () => api<FinanceRow>(`/expenses/${params.id}`),
  });

  const transition = useMutation({
    mutationFn: ({ status, reason }: { status: string; reason: string }) =>
      api(`/expenses/${params.id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ status, reason }),
      }),
    onSuccess: () => {
      toast.success('Expense updated.');
      void queryClient.invalidateQueries({ queryKey: ['expense', params.id] });
    },
    onError: (error) => toast.error(userFacingError(error)),
  });

  const status = financeText(query.data?.status);
  const nextStatuses = expenseTransitions[status] ?? [];

  return (
    <FinanceShell principal={principal} principalError={principalError} activeItem="finance:expenses">
      <PageHeader
        eyebrow="Finance"
        title={financeText(query.data?.expenseNumber) || 'Expense'}
        description="Expense lifecycle from draft through posting."
        action={
          <Link className="button secondary" href="/finance/expenses">
            Back to expenses
          </Link>
        }
      />
      {principal && !canRead ? (
        <FinanceAccessDenied />
      ) : query.isLoading ? (
        <FormSkeleton />
      ) : query.isError ? (
        <ErrorState message={userFacingError(query.error)} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-slate-900">Expense summary</h2>
              <StatusBadge value={status} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FinanceField label="Category" value={humanize(financeText(query.data?.categoryCode))} />
              <FinanceField label="Amount" value={financeMoney(query.data?.currency, query.data?.amount)} />
              <FinanceField label="Business date" value={formatDate(query.data?.businessDate)} />
              <FinanceField label="Responsibility" value={humanize(financeText(query.data?.responsibility))} />
              <FinanceField
                label="Property"
                value={financeText(financeNested(query.data ?? {}, 'property', 'name')) || 'Not linked'}
              />
              <FinanceField
                label="Vendor"
                value={financeText(financeNested(query.data ?? {}, 'vendor', 'displayName')) || 'Not linked'}
              />
              <FinanceField label="Description" value={financeText(query.data?.description) || '—'} />
            </div>
          </section>
          {canManage ? (
            <TransitionPanel
              currentStatus={status}
              transitions={nextStatuses}
              busy={transition.isPending}
              onTransition={(nextStatus, reason) => transition.mutate({ status: nextStatus, reason })}
            />
          ) : null}
        </div>
      )}
    </FinanceShell>
  );
}
