'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from '@/lib/toast';
import { FormSkeleton } from '@/components/shared/loading-system';
import { ErrorState, FormSection, PageHeader, StatusBadge } from '@/components/shared/ui';
import { api, hasPermission, userFacingError } from '@/lib/phase3-api';
import { formatDate, humanize } from '@/lib/presentation';
import { TransitionPanel } from '@/features/finance/finance-forms';
import { CommercialShell, useCommercialPrincipal } from './commercial-shell';

const offerTransitions: Record<string, readonly string[]> = {
  DRAFT: ['SUBMITTED', 'WITHDRAWN'],
  SUBMITTED: ['COUNTERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'],
  COUNTERED: ['ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'],
};

type SaleOfferDetail = Record<string, unknown> & {
  id: string;
  offerNumber?: string;
  status?: string;
  currency?: string;
  offerAmount?: string | number;
  offerDate?: string;
  expiresAt?: string;
  termsNotes?: string;
  events?: Array<Record<string, unknown>>;
};

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-[14px] font-medium text-slate-900">{value}</p>
    </div>
  );
}

export function OfferDetail() {
  const params = useParams<{ id: string }>();
  const offerId = params.id;
  const queryClient = useQueryClient();
  const { principal } = useCommercialPrincipal();
  const allowed = Boolean(principal && hasPermission(principal, 'sale-offer.read'));
  const canManage = Boolean(principal && hasPermission(principal, 'sale-offer.manage'));
  const [counterAmount, setCounterAmount] = useState('');

  const query = useQuery({
    queryKey: ['sale-offer', offerId],
    enabled: allowed && Boolean(offerId),
    queryFn: () => api<SaleOfferDetail>(`/sale-offers/${offerId}`),
  });

  const nested = (...keys: string[]) =>
    keys.reduce<unknown>(
      (value, key) =>
        value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined,
      query.data ?? {},
    );
  const text = (value: unknown) => (typeof value === 'string' ? value : 'Not set');

  const transition = useMutation({
    mutationFn: ({ status, reason }: { status: string; reason: string }) =>
      api(`/sale-offers/${offerId}/transition`, {
        method: 'POST',
        body: JSON.stringify({
          status,
          reason,
          counterAmount: status === 'COUNTERED' ? counterAmount : undefined,
        }),
      }),
    onSuccess: () => {
      toast.success('Offer updated.');
      void queryClient.invalidateQueries({ queryKey: ['sale-offer', offerId] });
    },
    onError: (error) => toast.error(userFacingError(error)),
  });

  return (
    <CommercialShell principal={principal} activeItem="commercial:offers">
      <PageHeader
        eyebrow="Commercial"
        title={query.data?.offerNumber ?? 'Sale Offer'}
        description="Offer terms, negotiation history, and settlement readiness."
        action={
          <Link className="button secondary" href="/commercial/offers">
            Back to Offers
          </Link>
        }
      />

      {principal && !allowed ? (
        <ErrorState message="Your current access does not include Sale Offer details." />
      ) : query.isLoading ? (
        <FormSkeleton />
      ) : query.isError ? (
        <ErrorState message={userFacingError(query.error)} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <FormSection title="Offer Summary" description="Core commercial terms for this buyer offer.">
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailField label="Status" value={humanize(query.data?.status)} />
              <DetailField
                label="Offer Amount"
                value={
                  query.data?.offerAmount
                    ? `${text(query.data.currency)} ${String(query.data.offerAmount)}`
                    : 'Not set'
                }
              />
              <DetailField label="Offer Date" value={formatDate(query.data?.offerDate)} />
              <DetailField label="Expires" value={formatDate(query.data?.expiresAt)} />
              <DetailField
                label="Property"
                value={`${text(nested('property', 'propertyCode'))} — ${text(nested('property', 'name'))}`}
              />
              <DetailField
                label="Buyer"
                value={text(nested('buyer', 'displayName'))}
              />
            </div>
            {query.data?.termsNotes ? (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[12px] font-semibold text-slate-500">Terms Notes</p>
                <p className="mt-1 text-[14px] text-slate-800">{text(query.data.termsNotes)}</p>
              </div>
            ) : null}
          </FormSection>

          <aside className="space-y-4">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[14px] font-semibold text-slate-900">Current Status</h2>
                <StatusBadge value={query.data?.status} />
              </div>
              <p className="mt-3 text-[13px] text-slate-600">
                Accepted offers can proceed to settlement without overwriting historical negotiation
                events.
              </p>
              {query.data?.status === 'ACCEPTED' ? (
                <Link className="button primary mt-4 w-full" href="/commercial/settlements">
                  View Settlements
                </Link>
              ) : null}
            </section>

            {canManage ? (
              <>
                {text(query.data?.status) === 'SUBMITTED' || text(query.data?.status) === 'COUNTERED' ? (
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-semibold text-slate-500">Counter amount</span>
                    <input
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px]"
                      value={counterAmount}
                      onChange={(event) => setCounterAmount(event.target.value)}
                    />
                  </label>
                ) : null}
                <TransitionPanel
                  currentStatus={text(query.data?.status)}
                  transitions={offerTransitions[text(query.data?.status)] ?? []}
                  busy={transition.isPending}
                  onTransition={(nextStatus, reason) => transition.mutate({ status: nextStatus, reason })}
                />
              </>
            ) : null}

            <FormSection title="Negotiation Timeline" description="Immutable offer events.">
              {query.data?.events?.length ? (
                <ul className="space-y-3">
                  {query.data.events.map((event) => (
                    <li
                      key={event.id as string}
                      className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5"
                    >
                      <p className="text-[13px] font-semibold text-slate-900">
                        {humanize(text(event.eventType))}
                      </p>
                      <p className="text-[12px] text-slate-500">{formatDate(event.occurredAt, true)}</p>
                      {event.notes ? (
                        <p className="mt-1 text-[13px] text-slate-700">{text(event.notes)}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-slate-500">No negotiation events recorded yet.</p>
              )}
            </FormSection>
          </aside>
        </div>
      )}
    </CommercialShell>
  );
}
