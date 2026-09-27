'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from '@/lib/toast';
import { FormSkeleton } from '@/components/shared/loading-system';
import { ErrorState, PageHeader, StatusBadge } from '@/components/shared/ui';
import { api, hasPermission, userFacingError } from '@/lib/phase3-api';
import { formatDate } from '@/lib/presentation';
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
  type FinanceRow,
} from '@/features/finance/finance-forms';
import { CommercialShell, useCommercialPrincipal } from './commercial-shell';
import { RecordPaymentDrawer, type CommissionPaymentContext } from '@/features/finance/record-payment-drawer';

const dealTransitions: Record<string, readonly string[]> = {
  DRAFT: ['NEGOTIATING', 'CANCELLED'],
  NEGOTIATING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['CLOSED', 'CANCELLED'],
};

export function BrokerageDealCreateWorkspace() {
  const router = useRouter();
  const { principal } = useCommercialPrincipal();
  const allowed = Boolean(principal && hasPermission(principal, 'brokerage-deal.manage'));
  const [engagement, setEngagement] = useState<PickRecord | null>(null);
  const [space, setSpace] = useState<PickRecord | null>(null);
  const [lease, setLease] = useState<PickRecord | null>(null);
  const [lead, setLead] = useState<PickRecord | null>(null);
  const [grossCommission, setGrossCommission] = useState('');
  const [rentBasis, setRentBasis] = useState('');
  const [currency, setCurrency] = useState('USD');

  const create = useMutation({
    mutationFn: () =>
      api<{ id: string }>('/brokerage-deals', {
        method: 'POST',
        body: JSON.stringify({
          serviceEngagementId: engagement?.id,
          rentableSpaceId: space?.id,
          leaseId: lease?.id || undefined,
          leadId: lead?.id || undefined,
          grossCommission,
          rentBasis: rentBasis || undefined,
          currency,
        }),
      }),
    onSuccess: (deal: { id: string }) => {
      toast.success('Brokerage deal created.');
      router.push(`/commercial/rental-brokerage/${deal.id}`);
    },
    onError: (error) => toast.error(userFacingError(error)),
  });

  return (
    <CommercialShell principal={principal} activeItem="commercial:rental-brokerage">
      <PageHeader
        eyebrow="Commercial"
        title="Create Rental Brokerage Deal"
        description="Tenant placement commission workflow. No recurring Full Management billing."
        action={
          <Link className="button secondary" href="/commercial/rental-brokerage/deals">
            Back to deals
          </Link>
        }
      />
      {principal && !allowed ? (
        <ErrorState message="Brokerage deal creation requires brokerage-deal.manage permission." />
      ) : (
        <FinanceFormPanel
          title="Deal details"
          description="Placement commission only. This does not create recurring rent billing."
          submitLabel="Create deal"
          busy={create.isPending}
          disabled={!engagement?.id || !space?.id || Number(grossCommission) <= 0}
          onSubmit={() => {
            if (!engagement?.id || !space?.id || Number(grossCommission) <= 0) {
              toast.error('Choose an engagement, space, and commission amount.');
              return;
            }
            create.mutate();
          }}
        >
          <FinanceRecordSelect
            label="Rental brokerage engagement"
            path="/service-engagements?status=ACTIVE&serviceModel=RENTAL_BROKERAGE"
            value={engagement?.id ?? ''}
            map={financePickerMap.engagement}
            onChange={(record) => {
              setEngagement(record);
              setSpace(null);
            }}
            required
          />
          <FinanceRecordSelect
            label="Rentable space"
            path={
              engagement?.propertyId
                ? `/rentable-spaces?status=ACTIVE&propertyId=${financeScalar(engagement.propertyId)}`
                : '/rentable-spaces?status=ACTIVE'
            }
            value={space?.id ?? ''}
            map={financePickerMap.space}
            onChange={setSpace}
            required
            enabled={Boolean(engagement?.propertyId)}
            emptyHint={
              engagement?.propertyId
                ? 'No active space on this engagement’s property.'
                : 'Choose a rental brokerage engagement first.'
            }
          />
          <FinanceRecordSelect
            label="Lease (optional)"
            path="/leases?status=ACTIVE"
            value={lease?.id ?? ''}
            map={financePickerMap.lease}
            onChange={setLease}
          />
          <FinanceRecordSelect
            label="Lead (optional)"
            path="/crm/leads?intent=RENT"
            value={lead?.id ?? ''}
            map={financePickerMap.lead}
            onChange={setLead}
          />
          <FinanceTextField
            label="Gross commission"
            type="number"
            min={0}
            step="0.01"
            value={grossCommission}
            onChange={setGrossCommission}
            required
          />
          <FinanceTextField
            label="Rent basis"
            type="number"
            min={0}
            step="0.01"
            value={rentBasis}
            onChange={setRentBasis}
          />
          <FinanceTextField
            label="Currency"
            value={currency}
            onChange={(value) => setCurrency(value.toUpperCase())}
            maxLength={3}
            required
          />
        </FinanceFormPanel>
      )}
    </CommercialShell>
  );
}

export function BrokerageDealDetailWorkspace() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { principal } = useCommercialPrincipal();
  const canRead = Boolean(principal && hasPermission(principal, 'brokerage-deal.read'));
  const canManage = Boolean(principal && hasPermission(principal, 'brokerage-deal.manage'));
  const canRecordPayment = Boolean(principal && hasPermission(principal, 'payment.create'));
  const [selectedLease, setSelectedLease] = useState<PickRecord | null>(null);
  const [linkReason, setLinkReason] = useState('');
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

  const linkLease = useMutation({
    mutationFn: () =>
      api(`/brokerage-deals/${params.id}/lease`, {
        method: 'PATCH',
        body: JSON.stringify({ leaseId: selectedLease?.id, reason: linkReason }),
      }),
    onSuccess: () => {
      toast.success('Lease linked to deal.');
      setSelectedLease(null);
      setLinkReason('');
      void queryClient.invalidateQueries({ queryKey: ['brokerage-deal', params.id] });
    },
    onError: (error) => toast.error(userFacingError(error)),
  });

  const status = financeText(query.data?.status);
  const rentableSpaceId = financeText(query.data?.rentableSpaceId);
  const linkedLeaseNumber = financeText(financeNested(query.data ?? {}, 'lease', 'leaseNumber'));
  const canLinkLease =
    canManage &&
    !financeText(query.data?.leaseId) &&
    status !== 'CLOSED' &&
    status !== 'CANCELLED';
  const receivables = (query.data?.commissionReceivables as Array<Record<string, unknown>> | undefined) ?? [];
  const propertyName = financeText(financeNested(query.data ?? {}, 'rentableSpace', 'property', 'name'));
  const dealNumber = financeText(query.data?.dealNumber);
  const branchId = financeText(query.data?.branchId);

  return (
    <CommercialShell principal={principal} activeItem="commercial:rental-brokerage">
      <PageHeader
        eyebrow="Commercial"
        title={financeText(query.data?.dealNumber) || 'Brokerage Deal'}
        description="Placement commission lifecycle from draft through close."
        action={
          <Link className="button secondary" href="/commercial/rental-brokerage/deals">
            Back to deals
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
              <FinanceField label="Commission" value={financeMoney(query.data?.currency, query.data?.grossCommission)} />
              <FinanceField label="Rent basis" value={financeMoney(query.data?.currency, query.data?.rentBasis)} />
              <FinanceField label="Closed" value={formatDate(query.data?.closedAt)} />
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
            {canLinkLease ? (
              <FinanceFormPanel
                title="Link lease"
                description="Choose the signed lease for this rentable space before closing the deal."
                submitLabel="Link lease"
                busy={linkLease.isPending}
                disabled={!selectedLease?.id || linkReason.trim().length < 3}
                onSubmit={() => {
                  if (!selectedLease?.id || linkReason.trim().length < 3) {
                    toast.error('Choose a lease and enter a reason.');
                    return;
                  }
                  linkLease.mutate();
                }}
              >
                <FinanceRecordSelect
                  label="Lease"
                  path={
                    rentableSpaceId
                      ? `/leases?rentableSpaceId=${rentableSpaceId}&limit=50`
                      : '/leases?limit=50'
                  }
                  value={selectedLease?.id ?? ''}
                  map={financePickerMap.lease}
                  onChange={setSelectedLease}
                  required
                  emptyHint="No active lease on this rentable space yet. Create one under Leasing → Lease Contracts."
                />
                <FinanceTextField
                  label="Reason"
                  value={linkReason}
                  onChange={setLinkReason}
                  required
                />
              </FinanceFormPanel>
            ) : null}
            {canManage ? (
              <TransitionPanel
                currentStatus={status}
                transitions={dealTransitions[status] ?? []}
                busy={transition.isPending}
                onTransition={(nextStatus, reason) => transition.mutate({ status: nextStatus, reason })}
              />
            ) : null}
          </div>
        </div>
      )}
      {principal ? <RecordPaymentDrawer open={Boolean(paymentContext)} onClose={() => setPaymentContext(null)} principal={principal} context={paymentContext} /> : null}
    </CommercialShell>
  );
}
