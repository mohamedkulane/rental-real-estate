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
  FinanceField,
  FinanceFormPanel,
  FinanceRecordSelect,
  FinanceTextField,
  TransitionPanel,
  financeMoney,
  financeNested,
  financePickerMap,
  financeScalar,
  financeText,
  previousCalendarMonth,
  type FinanceRow,
} from './finance-forms';
import { FinanceAccessDenied } from './finance-shared';
import { FinanceShell, useFinancePrincipal } from './finance-shell';

const payoutTransitions: Record<string, readonly string[]> = {
  DRAFT: ['REVIEW', 'CANCELLED'],
  REVIEW: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['QUEUED', 'HELD', 'CANCELLED'],
  QUEUED: ['PROCESSING', 'FAILED', 'CANCELLED'],
  PROCESSING: ['PAID', 'FAILED'],
  PAID: ['RECONCILED'],
  HELD: ['REVIEW', 'CANCELLED'],
  FAILED: ['QUEUED', 'CANCELLED'],
};

export function OwnerPayoutCreateWorkspace() {
  const router = useRouter();
  const { principal, error: principalError } = useFinancePrincipal();
  const allowed = Boolean(principal && hasPermission(principal, 'payout.manage'));
  const [property, setProperty] = useState<PickRecord | null>(null);
  const [engagement, setEngagement] = useState<PickRecord | null>(null);
  const lastMonth = previousCalendarMonth();
  const [periodStart, setPeriodStart] = useState(lastMonth.start);
  const [periodEnd, setPeriodEnd] = useState(lastMonth.end);
  const [currency, setCurrency] = useState('USD');
  const [otherDeductions, setOtherDeductions] = useState('0');

  const create = useMutation({
    mutationFn: () =>
      api<{ id: string }>('/owner-payouts', {
        method: 'POST',
        body: JSON.stringify({
          propertyId: property?.id,
          serviceEngagementId: engagement?.id,
          periodStart,
          periodEnd,
          currency,
          otherDeductions: otherDeductions || undefined,
        }),
      }),
    onSuccess: (payout: { id: string }) => {
      toast.success('Owner payout prepared.');
      router.push(`/finance/owner-payouts/${payout.id}`);
    },
    onError: (error) => toast.error(userFacingError(error)),
  });

  return (
    <FinanceShell principal={principal} principalError={principalError} activeItem="finance:owner-payouts">
      <PageHeader
        eyebrow="Finance"
        title="Prepare Owner Payout"
        description="Calculate net owner payout from collected income, management fees, and approved expenses."
        action={
          <Link className="button secondary" href="/finance/owner-payouts">
            Back to payouts
          </Link>
        }
      />
      {principal && !allowed ? (
        <FinanceAccessDenied description="Owner payout preparation requires payout.manage permission." />
      ) : (
        <FinanceFormPanel
          title="Payout period"
          description="Net payout is calculated from collected income, management fees, and approved expenses."
          submitLabel="Prepare payout"
          busy={create.isPending}
          disabled={!property?.id || !engagement?.id || !periodStart || !periodEnd}
          onSubmit={() => {
            if (!property?.id || !engagement?.id || !periodStart || !periodEnd) {
              toast.error('Choose a property, Full Management engagement, and payout period.');
              return;
            }
            create.mutate();
          }}
        >
          <FinanceRecordSelect
            label="Property"
            path="/properties?status=ACTIVE"
            value={property?.id ?? ''}
            map={financePickerMap.property}
            onChange={setProperty}
            required
          />
          <FinanceRecordSelect
            label="Full Management engagement"
            path={
              property?.id
                ? `/service-engagements?status=ACTIVE&propertyId=${property.id}&serviceModel=FULL_MANAGEMENT`
                : '/service-engagements?status=ACTIVE&serviceModel=FULL_MANAGEMENT'
            }
            value={engagement?.id ?? ''}
            map={financePickerMap.engagement}
            onChange={setEngagement}
            required
            enabled={Boolean(property?.id)}
            emptyHint={
              property?.id
                ? 'No active Full Management engagement for this property. Recurring owner payouts require that service model.'
                : 'Choose a property first.'
            }
          />
          <FinanceTextField label="Period start" type="date" value={periodStart} onChange={setPeriodStart} required />
          <FinanceTextField label="Period end" type="date" value={periodEnd} onChange={setPeriodEnd} required />
          <FinanceTextField
            label="Currency"
            value={currency}
            onChange={(value) => setCurrency(value.toUpperCase())}
            maxLength={3}
            required
          />
          <FinanceTextField label="Other deductions" value={otherDeductions} onChange={setOtherDeductions} />
        </FinanceFormPanel>
      )}
    </FinanceShell>
  );
}

export function OwnerPayoutDetailWorkspace() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { principal, error: principalError } = useFinancePrincipal();
  const canRead = Boolean(principal && hasPermission(principal, 'payout.read'));
  const canManage = Boolean(principal && hasPermission(principal, 'payout.manage'));

  const query = useQuery({
    queryKey: ['owner-payout', params.id],
    enabled: canRead && Boolean(params.id),
    queryFn: () => api<FinanceRow>(`/owner-payouts/${params.id}`),
  });

  const transition = useMutation({
    mutationFn: ({ status, reason }: { status: string; reason: string }) =>
      api(`/owner-payouts/${params.id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ status, reason }),
      }),
    onSuccess: () => {
      toast.success('Payout updated.');
      void queryClient.invalidateQueries({ queryKey: ['owner-payout', params.id] });
    },
    onError: (error) => toast.error(userFacingError(error)),
  });

  const status = financeText(query.data?.status);
  const lines = (query.data?.lines as Array<Record<string, unknown>> | undefined) ?? [];

  return (
    <FinanceShell principal={principal} principalError={principalError} activeItem="finance:owner-payouts">
      <PageHeader
        eyebrow="Finance"
        title={financeText(query.data?.payoutNumber) || 'Owner Payout'}
        description="Owner payout calculation, ownership share, and lifecycle transitions."
        action={
          <Link className="button secondary" href="/finance/owner-payouts">
            Back to payouts
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
              <h2 className="text-[15px] font-semibold text-slate-900">Payout summary</h2>
              <StatusBadge value={status} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FinanceField
                label="Owner"
                value={financeText(financeNested(query.data ?? {}, 'owner', 'displayName'))}
              />
              <FinanceField
                label="Property"
                value={financeText(financeNested(query.data ?? {}, 'property', 'name'))}
              />
              <FinanceField
                label="Period"
                value={`${formatDate(query.data?.periodStart)} — ${formatDate(query.data?.periodEnd)}`}
              />
              <FinanceField label="Net payable" value={financeMoney(query.data?.currency, query.data?.netPayable)} />
              <FinanceField
                label="Collected income"
                value={financeMoney(query.data?.currency, query.data?.collectedIncome)}
              />
              <FinanceField
                label="Management fee"
                value={financeMoney(query.data?.currency, query.data?.managementFee)}
              />
              <FinanceField
                label="Approved expenses"
                value={financeMoney(query.data?.currency, query.data?.expenseDeductions)}
              />
              <FinanceField
                label="Other deductions"
                value={financeMoney(query.data?.currency, query.data?.otherDeductions)}
              />
            </div>
            {lines.length ? (
              <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-left text-[14px]">
                  <thead className="bg-slate-50 text-[12px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Owner line</th>
                      <th className="px-4 py-2">Share</th>
                      <th className="px-4 py-2">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={financeText(line.id)} className="border-t border-slate-100">
                        <td className="px-4 py-2">{financeText(financeNested(line, 'owner', 'displayName'))}</td>
                        <td className="px-4 py-2">{financeScalar(line.sharePercent)}%</td>
                        <td className="px-4 py-2">{financeMoney(query.data?.currency, line.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
          {canManage ? (
            <TransitionPanel
              currentStatus={status}
              transitions={payoutTransitions[status] ?? []}
              busy={transition.isPending}
              onTransition={(nextStatus, reason) => transition.mutate({ status: nextStatus, reason })}
            />
          ) : null}
        </div>
      )}
    </FinanceShell>
  );
}
