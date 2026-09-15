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
  financeText,
  type FinanceRow,
} from '@/features/finance/finance-forms';
import { CommercialShell, useCommercialPrincipal } from './commercial-shell';

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
          <Link className="button secondary" href="/commercial/rental-brokerage">
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
                ? `/rentable-spaces?status=ACTIVE&propertyId=${String(engagement.propertyId)}`
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

  return (
    <CommercialShell principal={principal} activeItem="commercial:rental-brokerage">
      <PageHeader
        eyebrow="Commercial"
        title={financeText(query.data?.dealNumber) || 'Brokerage Deal'}
        description="Placement commission lifecycle from draft through close."
        action={
          <Link className="button secondary" href="/commercial/rental-brokerage">
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
              <FinanceField label="Commission" value={financeMoney(query.data?.currency, query.data?.grossCommission)} />
              <FinanceField label="Rent basis" value={financeMoney(query.data?.currency, query.data?.rentBasis)} />
              <FinanceField label="Closed" value={formatDate(query.data?.closedAt)} />
            </div>
          </section>
          {canManage ? (
            <TransitionPanel
              currentStatus={status}
              transitions={dealTransitions[status] ?? []}
              busy={transition.isPending}
              onTransition={(nextStatus, reason) => transition.mutate({ status: nextStatus, reason })}
            />
          ) : null}
        </div>
      )}
    </CommercialShell>
  );
}
