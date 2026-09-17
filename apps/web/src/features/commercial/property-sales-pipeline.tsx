'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { DashboardSkeleton } from '@/components/shared/loading-system';
import { ErrorState, PageHeader, StatusBadge } from '@/components/shared/ui';
import { api, hasPermission, type CursorPage, userFacingError } from '@/lib/phase3-api';
import { formatDate, humanize } from '@/lib/presentation';
import { CommercialShell, useCommercialPrincipal } from './commercial-shell';

type OfferRow = Record<string, unknown> & {
  id: string;
  offerNumber?: string;
  status?: string;
  offerAmount?: string | number;
  currency?: string;
  offerDate?: string;
};

const pipelineStages = [
  'SUBMITTED',
  'COUNTERED',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
  'EXPIRED',
] as const;

export function PropertySalesPipeline() {
  const { principal } = useCommercialPrincipal();
  const allowed = Boolean(principal && hasPermission(principal, 'sale-offer.read'));

  const query = useQuery({
    queryKey: ['property-sales-pipeline'],
    enabled: allowed,
    queryFn: () => api<CursorPage<OfferRow>>('/sale-offers?limit=100'),
  });

  const grouped = pipelineStages.map((stage) => ({
    stage,
    items: (query.data?.items ?? []).filter((item) => item.status === stage),
  }));

  const nested = (row: OfferRow, ...keys: string[]) =>
    keys.reduce<unknown>(
      (value, key) =>
        value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined,
      row,
    );
  const text = (value: unknown) => (typeof value === 'string' ? value : '');

  return (
    <CommercialShell principal={principal} activeItem="commercial:property-sales-pipeline">
      <PageHeader
        eyebrow="Commercial"
        title="Property Sales Pipeline"
        description="Offer progression from submission through acceptance and settlement readiness."
        action={
          <div className="flex flex-row flex-wrap items-center justify-end gap-2">
            <Link className="button secondary shrink-0 whitespace-nowrap" href="/commercial/property-sales">
              Property Sale
            </Link>
            <Link className="button secondary shrink-0 whitespace-nowrap" href="/commercial/offers">
              Offer Register
            </Link>
          </div>
        }
      />

      {principal && !allowed ? (
        <ErrorState message="Your current access does not include the Property Sales pipeline." />
      ) : query.isLoading ? (
        <DashboardSkeleton />
      ) : query.isError ? (
        <ErrorState message={userFacingError(query.error)} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-6">
          {grouped.map(({ stage, items }) => (
            <section
              key={stage}
              className="flex min-h-[280px] flex-col rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <header className="border-b border-slate-100 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-[13px] font-semibold text-slate-900">{humanize(stage)}</h2>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                    {items.length}
                  </span>
                </div>
              </header>
              <ul className="flex-1 space-y-2 p-3">
                {items.length ? (
                  items.map((offer) => (
                    <li key={offer.id}>
                      <Link
                        href={`/commercial/offers/${offer.id}`}
                        className="block rounded-lg border border-slate-100 bg-slate-50/80 p-3 transition hover:border-emerald-200 hover:bg-white"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-slate-900">
                              {text(offer.offerNumber)}
                            </p>
                            <p className="truncate text-[12px] text-slate-500">
                              {text(nested(offer, 'property', 'name'))}
                            </p>
                          </div>
                          <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <p className="text-[12px] font-medium text-slate-700">
                            {offer.offerAmount
                              ? `${text(offer.currency)} ${String(offer.offerAmount)}`
                              : 'Amount pending'}
                          </p>
                          <StatusBadge value={offer.status} />
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">{formatDate(offer.offerDate)}</p>
                      </Link>
                    </li>
                  ))
                ) : (
                  <li className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-[12px] text-slate-400">
                    No offers in this stage
                  </li>
                )}
              </ul>
            </section>
          ))}
        </div>
      )}
    </CommercialShell>
  );
}
