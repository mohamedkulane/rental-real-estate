'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast, { notify } from '@/lib/toast';
import { FormSkeleton } from '@/components/shared/loading-system';
import { ErrorState, FormSection, PageHeader, StatusBadge } from '@/components/shared/ui';
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

const settlementTransitions: Record<string, readonly string[]> = {
  DRAFT: ['APPROVED', 'CANCELLED'],
  APPROVED: ['SETTLED', 'CANCELLED'],
};

export function SaleSettlementCreateWorkspace() {
  const router = useRouter();
  const { principal } = useCommercialPrincipal();
  const allowed = Boolean(principal && hasPermission(principal, 'sale-settlement.manage'));
  const [offer, setOffer] = useState<PickRecord | null>(null);
  const [salePrice, setSalePrice] = useState('');
  const [approvedDeductions, setApprovedDeductions] = useState('0');
  const [closingDate, setClosingDate] = useState(new Date().toISOString().slice(0, 10));

  const create = useMutation({
    mutationFn: () =>
      api<{ id: string }>('/sale-settlements', {
        method: 'POST',
        body: JSON.stringify({
          saleOfferId: offer?.id,
          salePrice,
          approvedDeductions: approvedDeductions || undefined,
          closingDate,
        }),
      }),
    onSuccess: (settlement: { id: string }) => {
      notify.payment({ title: 'Sale settlement created', message: 'Settlement amounts were saved for review.' });
      router.push(`/commercial/settlements/${settlement.id}`);
    },
    onError: (error) => toast.error(userFacingError(error)),
  });

  return (
    <CommercialShell principal={principal} activeItem="commercial:settlements">
      <PageHeader
        eyebrow="Commercial"
        title="Create Sale Settlement"
        description="Closing proceeds for accepted sale offers."
        action={
          <Link className="button secondary" href="/commercial/settlements">
            Back to settlements
          </Link>
        }
      />
      {principal && !allowed ? (
        <ErrorState message="Settlement creation requires sale-settlement.manage permission." />
      ) : (
        <FinanceFormPanel
          title="Settlement details"
          submitLabel="Create settlement"
          busy={create.isPending}
          disabled={!offer?.id || Number(salePrice) <= 0}
          onSubmit={() => {
            if (!offer?.id || Number(salePrice) <= 0) {
              toast.error('Choose an accepted offer and sale price.');
              return;
            }
            create.mutate();
          }}
        >
          <FinanceRecordSelect
            label="Accepted sale offer"
            path="/sale-offers?status=ACCEPTED"
            value={offer?.id ?? ''}
            map={financePickerMap.offer}
            onChange={setOffer}
            required
            emptyHint="No accepted sale offer. Accept an offer before creating a settlement."
          />
          <FinanceTextField
            label="Sale price"
            type="number"
            min={0}
            step="0.01"
            value={salePrice}
            onChange={setSalePrice}
            required
          />
          <FinanceTextField
            label="Approved deductions"
            type="number"
            min={0}
            step="0.01"
            value={approvedDeductions}
            onChange={setApprovedDeductions}
          />
          <FinanceTextField label="Closing date" type="date" value={closingDate} onChange={setClosingDate} />
        </FinanceFormPanel>
      )}
    </CommercialShell>
  );
}

export function SaleSettlementDetailWorkspace() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { principal } = useCommercialPrincipal();
  const canRead = Boolean(principal && hasPermission(principal, 'sale-settlement.read'));
  const canManage = Boolean(principal && hasPermission(principal, 'sale-settlement.manage'));

  const query = useQuery({
    queryKey: ['sale-settlement', params.id],
    enabled: canRead && Boolean(params.id),
    queryFn: () => api<FinanceRow>(`/sale-settlements/${params.id}`),
  });

  const transition = useMutation({
    mutationFn: ({ status, reason }: { status: string; reason: string }) =>
      api(`/sale-settlements/${params.id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ status, reason }),
      }),
    onSuccess: () => {
      toast.success('Settlement updated.');
      void queryClient.invalidateQueries({ queryKey: ['sale-settlement', params.id] });
    },
    onError: (error) => toast.error(userFacingError(error)),
  });

  const status = financeText(query.data?.status);
  const serviceModel = financeText(financeNested(query.data ?? {}, 'saleOffer', 'engagement', 'serviceModel'));

  return (
    <CommercialShell principal={principal} activeItem="commercial:settlements">
      <PageHeader
        eyebrow="Commercial"
        title={financeText(query.data?.settlementNumber) || 'Sale Settlement'}
        description="Seller or company net proceeds after commission and approved deductions."
        action={
          <Link className="button secondary" href="/commercial/settlements">
            Back to settlements
          </Link>
        }
      />
      {principal && !canRead ? (
        <ErrorState message="Your current access does not include settlement details." />
      ) : query.isLoading ? (
        <FormSkeleton />
      ) : query.isError ? (
        <ErrorState message={userFacingError(query.error)} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <FormSection title="Settlement breakdown">
            <div className="grid gap-4 sm:grid-cols-2">
              <FinanceField label="Status" value={humanize(status)} />
              <FinanceField label="Sale model" value={humanize(serviceModel)} />
              <FinanceField label="Gross sale price" value={financeMoney(query.data?.currency, query.data?.salePrice)} />
              <FinanceField
                label="Brokerage commission"
                value={financeMoney(query.data?.currency, query.data?.brokerageCommission)}
              />
              <FinanceField
                label="Approved deductions"
                value={financeMoney(query.data?.currency, query.data?.approvedDeductions)}
              />
              <FinanceField
                label={serviceModel === 'COMPANY_OWNED' ? 'Company net proceeds' : 'Seller net proceeds'}
                value={financeMoney(
                  query.data?.currency,
                  serviceModel === 'COMPANY_OWNED'
                    ? query.data?.companyNetProceeds
                    : query.data?.sellerNetProceeds,
                )}
              />
              <FinanceField label="Closing date" value={formatDate(query.data?.closingDate)} />
            </div>
          </FormSection>
          {canManage ? (
            <TransitionPanel
              currentStatus={status}
              transitions={settlementTransitions[status] ?? []}
              busy={transition.isPending}
              onTransition={(nextStatus, reason) => transition.mutate({ status: nextStatus, reason })}
            />
          ) : null}
        </div>
      )}
    </CommercialShell>
  );
}
