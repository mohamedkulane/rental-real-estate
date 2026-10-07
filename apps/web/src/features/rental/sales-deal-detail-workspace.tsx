'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Check,
  CircleDollarSign,
  FileCheck2,
  Flag,
  Handshake,
  Home,
  UserRound,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from '@/lib/toast';
import { CommercialShell, useCommercialPrincipal } from '@/features/commercial/commercial-shell';
import { ErrorState, PageHeader, StatusBadge } from '@/components/shared/ui';
import { GeneratedPdfButton } from '@/components/shared/generated-pdf-button';
import { FormSkeleton } from '@/components/shared/loading-system';
import { api, hasPermission, userFacingError } from '@/lib/phase3-api';
import { formatDate, humanize } from '@/lib/presentation';

type Settlement = {
  id: string;
  settlementNumber: string;
  status: string;
  salePrice: string;
  grossCommission: string;
  sellerProceeds: string;
  companyProceeds: string;
  approvedDeductions: string;
  currency: string;
  closingDate: string | null;
  settledAt: string | null;
};

type SaleDealDetail = {
  id: string;
  agreementNumber: string;
  status: string;
  version: number;
  originalAskingPrice: string;
  finalSalePrice: string;
  currency: string;
  companyOwned: boolean;
  sellerCommissionMethod: string | null;
  sellerCommissionValue: string | null;
  buyerCommissionMethod: string | null;
  buyerCommissionValue: string | null;
  notes: string | null;
  confirmedAt: string | null;
  buyer: { id: string; displayName: string; partyNumber: string };
  seller: { id: string; displayName: string; partyNumber: string };
  lead: { id: string; leadNumber: string; displayName: string };
  viewing: { id: string; scheduledAt: string; updatedAt: string; outcome: string | null };
  property: { id: string; propertyCode: string; name: string; city: string; status: string };
  serviceEngagement: { id: string; engagementNumber: string; serviceModel: string };
  saleOffer: {
    id: string;
    offerNumber: string;
    status: string;
    settlement: Settlement | null;
  } | null;
};

function money(currency: string, value: string | null | undefined) {
  const amount = Number(value ?? 0);
  return `${currency} ${new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(amount)}`;
}

function commissionLabel(method: string | null, value: string | null, currency: string) {
  if (!method || !value) return 'Not charged';
  return method === 'PERCENT' ? `${value}%` : money(currency, value);
}

function Step({ label, complete, active }: { label: string; complete: boolean; active: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${active ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}
    >
      <span
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${complete ? 'bg-[#087A63] text-white' : 'bg-slate-100 text-slate-400'}`}
      >
        {complete ? (
          <Check className="h-4 w-4" aria-hidden="true" />
        ) : (
          <span className="h-2 w-2 rounded-full bg-current" />
        )}
      </span>
      <span className="text-sm font-semibold text-slate-800">{label}</span>
    </div>
  );
}

export function SalesDealDetailWorkspace({ agreementId }: { agreementId: string }) {
  const { principal, error } = useCommercialPrincipal();
  const queryClient = useQueryClient();
  const canRead = Boolean(principal && hasPermission(principal, 'sale-offer.read'));
  const canManage = Boolean(principal && hasPermission(principal, 'sale-offer.manage'));
  const canSettle = Boolean(principal && hasPermission(principal, 'sale-settlement.manage'));
  const [approvedDeductions, setApprovedDeductions] = useState('0');
  const [closingDate, setClosingDate] = useState(new Date().toISOString().slice(0, 10));

  const query = useQuery({
    queryKey: ['sales-deal', agreementId],
    enabled: canRead,
    queryFn: () => api<SaleDealDetail>(`/rental/commands/sale-agreements/${agreementId}`),
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['sales-deal', agreementId] });
    void queryClient.invalidateQueries({ queryKey: ['sales-deals'] });
  };
  const confirm = useMutation({
    mutationFn: (deal: SaleDealDetail) =>
      api(`/rental/commands/sale-agreements/${deal.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          expectedVersion: deal.version,
          reason: 'Confirmed from Sales Deal',
        }),
      }),
    onSuccess: () => {
      toast.success('Sale agreement confirmed.');
      refresh();
    },
    onError: (cause) => toast.error(userFacingError(cause)),
  });
  const createSettlement = useMutation({
    mutationFn: (offerId: string) =>
      api('/sale-settlements', {
        method: 'POST',
        body: JSON.stringify({ saleOfferId: offerId, approvedDeductions, closingDate }),
      }),
    onSuccess: () => {
      toast.success('Settlement started.');
      refresh();
    },
    onError: (cause) => toast.error(userFacingError(cause)),
  });
  const transitionSettlement = useMutation({
    mutationFn: ({ settlementId, status }: { settlementId: string; status: string }) =>
      api(`/sale-settlements/${settlementId}/transition`, {
        method: 'POST',
        body: JSON.stringify({ status, reason: `${humanize(status)} from Sales Deal` }),
      }),
    onSuccess: (_, variables) => {
      toast.success(
        variables.status === 'SETTLED'
          ? 'Sale completed and property marked sold.'
          : 'Settlement updated.',
      );
      refresh();
    },
    onError: (cause) => toast.error(userFacingError(cause)),
  });

  const deal = query.data;
  const settlement = deal?.saleOffer?.settlement ?? null;
  const isSold = settlement?.status === 'SETTLED' || deal?.property.status === 'SOLD';

  return (
    <CommercialShell principal={principal} activeItem="sales:deals">
      <PageHeader
        eyebrow="Sales"
        title={deal?.agreementNumber ?? 'Sales Deal'}
        description={
          deal
            ? `${deal.property.propertyCode} — ${deal.property.name}`
            : 'Agreement, settlement, and sale completion.'
        }
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {deal ? (
              <GeneratedPdfButton
                path={`/generated-documents/sale-agreements/${deal.id}`}
                label="Agreement PDF"
              />
            ) : null}
            <Link className="button secondary" href="/sales/deals">
              Back to deals
            </Link>
          </div>
        }
      />
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      {!canRead ? (
        <ErrorState message="Sales deal access requires sale-offer.read permission." />
      ) : query.isLoading ? (
        <FormSkeleton />
      ) : query.isError ? (
        <ErrorState message={userFacingError(query.error)} onRetry={() => void query.refetch()} />
      ) : deal ? (
        <div className="mt-6 space-y-5">
          <section className="grid gap-2 sm:grid-cols-4" aria-label="Sale progress">
            <Step
              label="Agreement"
              complete={deal.status === 'CONFIRMED'}
              active={deal.status === 'DRAFT'}
            />
            <Step
              label="Deal"
              complete={Boolean(deal.saleOffer)}
              active={deal.status === 'CONFIRMED' && !settlement}
            />
            <Step
              label="Settlement"
              complete={Boolean(settlement && settlement.status !== 'DRAFT')}
              active={Boolean(settlement && settlement.status !== 'SETTLED')}
            />
            <Step label="Sold" complete={isSold} active={isSold} />
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-5">
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">Sale Agreement</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Final terms agreed after the interested viewing.
                    </p>
                  </div>
                  <StatusBadge value={deal.status} />
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Summary icon={UserRound} label="Buyer" value={deal.buyer.displayName} />
                  <Summary icon={UserRound} label="Seller" value={deal.seller.displayName} />
                  <Summary
                    icon={Home}
                    label="Property"
                    value={`${deal.property.propertyCode} — ${deal.property.name}`}
                  />
                  <Summary
                    icon={CircleDollarSign}
                    label="Asking price"
                    value={money(deal.currency, deal.originalAskingPrice)}
                  />
                  <Summary
                    icon={Handshake}
                    label="Final price"
                    value={money(deal.currency, deal.finalSalePrice)}
                  />
                  <Summary
                    icon={FileCheck2}
                    label="Viewing"
                    value={`${formatDate(deal.viewing.updatedAt ?? deal.viewing.scheduledAt)} · ${humanize(deal.viewing.outcome ?? 'interested')}`}
                  />
                </div>
                <div className="mt-5 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
                  <TextSummary
                    label="Sale model"
                    value={deal.companyOwned ? 'Company owned' : 'Owner brokerage'}
                  />
                  <TextSummary
                    label="Seller commission"
                    value={commissionLabel(
                      deal.sellerCommissionMethod,
                      deal.sellerCommissionValue,
                      deal.currency,
                    )}
                  />
                  <TextSummary
                    label="Buyer commission"
                    value={commissionLabel(
                      deal.buyerCommissionMethod,
                      deal.buyerCommissionValue,
                      deal.currency,
                    )}
                  />
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  These commission terms are locked into the agreement. Settlement calculates their
                  currency value from the final price and does not ask staff to enter them again.
                </p>
                {deal.status === 'DRAFT' && canManage ? (
                  <div className="mt-5 flex justify-end border-t border-slate-200 pt-4">
                    <button
                      className="button primary"
                      type="button"
                      disabled={confirm.isPending}
                      onClick={() => confirm.mutate(deal)}
                    >
                      {confirm.isPending ? 'Confirming...' : 'Confirm Agreement'}
                    </button>
                  </div>
                ) : null}
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">Settlement</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Close the sale without leaving the Sales workspace.
                    </p>
                  </div>
                  {settlement ? <StatusBadge value={settlement.status} /> : null}
                </div>
                {!deal.saleOffer ? (
                  <p className="mt-4 text-sm text-slate-600">
                    Confirm the agreement before starting settlement.
                  </p>
                ) : !settlement && canSettle ? (
                  <form
                    className="mt-5 grid gap-4 sm:grid-cols-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      createSettlement.mutate(deal.saleOffer!.id);
                    }}
                  >
                    <label className="text-sm font-semibold text-slate-700">
                      Approved deductions{' '}
                      <span className="font-normal text-slate-500">(optional)</span>
                      <input
                        className="input mt-1 w-full"
                        type="number"
                        min="0"
                        step="0.01"
                        value={approvedDeductions}
                        onChange={(event) => setApprovedDeductions(event.target.value)}
                      />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Closing date
                      <input
                        className="input mt-1 w-full"
                        type="date"
                        value={closingDate}
                        onChange={(event) => setClosingDate(event.target.value)}
                        required
                      />
                    </label>
                    <div className="sm:col-span-2 flex justify-end">
                      <button
                        className="button primary"
                        type="submit"
                        disabled={createSettlement.isPending}
                      >
                        {createSettlement.isPending ? 'Starting...' : 'Start Settlement'}
                      </button>
                    </div>
                  </form>
                ) : settlement ? (
                  <>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <TextSummary
                        label="Sale price"
                        value={money(settlement.currency, settlement.salePrice)}
                      />
                      <TextSummary
                        label="Commission retained by company"
                        value={money(settlement.currency, settlement.grossCommission)}
                      />
                      <TextSummary
                        label="Approved deductions"
                        value={money(settlement.currency, settlement.approvedDeductions)}
                      />
                      <TextSummary
                        label={deal.companyOwned ? 'Company proceeds' : 'Seller proceeds'}
                        value={money(
                          settlement.currency,
                          deal.companyOwned
                            ? settlement.companyProceeds
                            : settlement.sellerProceeds,
                        )}
                      />
                      <TextSummary
                        label="Closing date"
                        value={formatDate(settlement.closingDate)}
                      />
                      <TextSummary label="Settlement number" value={settlement.settlementNumber} />
                    </div>
                    {canSettle && settlement.status === 'DRAFT' ? (
                      <div className="mt-5 flex justify-end border-t border-slate-200 pt-4">
                        <button
                          className="button primary"
                          type="button"
                          disabled={transitionSettlement.isPending}
                          onClick={() =>
                            transitionSettlement.mutate({
                              settlementId: settlement.id,
                              status: 'APPROVED',
                            })
                          }
                        >
                          Approve Settlement
                        </button>
                      </div>
                    ) : null}
                    {canSettle && settlement.status === 'APPROVED' ? (
                      <div className="mt-5 flex justify-end border-t border-slate-200 pt-4">
                        <button
                          className="button primary"
                          type="button"
                          disabled={transitionSettlement.isPending}
                          onClick={() =>
                            transitionSettlement.mutate({
                              settlementId: settlement.id,
                              status: 'SETTLED',
                            })
                          }
                        >
                          <Flag className="h-4 w-4" aria-hidden="true" /> Mark Sale as Sold
                        </button>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-4 text-sm text-slate-600">
                    Settlement access is not available for your role.
                  </p>
                )}
              </section>
            </div>

            <aside className="space-y-4">
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-slate-950">Deal Context</h2>
                <dl className="mt-4 space-y-3">
                  <TextSummary label="Buyer record" value={deal.lead.leadNumber} />
                  <TextSummary
                    label="Sale service"
                    value={humanize(deal.serviceEngagement.serviceModel)}
                  />
                  <TextSummary
                    label="Service agreement"
                    value={deal.serviceEngagement.engagementNumber}
                  />
                  <TextSummary label="City" value={deal.property.city || 'Not recorded'} />
                </dl>
                <div className="mt-5 grid gap-2 border-t border-slate-200 pt-4">
                  <Link
                    className="button secondary justify-center"
                    href={`/sales/buyers/${deal.lead.id}`}
                  >
                    Open Buyer
                  </Link>
                  <Link
                    className="button secondary justify-center"
                    href={`/portfolio/properties/${deal.property.id}`}
                  >
                    Open Property
                  </Link>
                </div>
              </section>
            </aside>
          </div>
        </div>
      ) : null}
    </CommercialShell>
  );
}

function Summary({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#087A63]">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <TextSummary label={label} value={value} />
    </div>
  );
}

function TextSummary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
