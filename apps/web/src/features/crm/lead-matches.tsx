'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api, type CursorPage, type Principal } from '@/lib/phase3-api';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/shared/ui';
import { can, crmError } from './crm-data';
import type { LeadDetail } from './crm-types';

type MatchItem = {
  listingType: 'RENTAL' | 'SALE';
  score: number;
  reasonKeys?: string[];
  reasons: string[];
  listing: {
    id: string;
    listingNumber: string;
    title: string;
    status: string;
    askingRent?: string | number | null;
    askingPrice?: string | number | null;
    currency: string;
    rentableSpace?: { spaceCode: string; name: string; property?: { name: string } };
    property?: { propertyCode: string; name: string };
  };
};

export function LeadMatches({ lead, principal }: { lead: LeadDetail; principal: Principal }) {
  const allowed = can(principal, 'listing.match', lead.responsibleBranch.id);
  const matchingIntent = lead.intent === 'RENT' || lead.intent === 'BUY';
  const query = useQuery({
    queryKey: ['listing-matches', lead.id],
    enabled: allowed && matchingIntent,
    retry: false,
    queryFn: () => api<CursorPage<MatchItem>>(`/listing-matches?leadId=${lead.id}&limit=25`),
  });

  if (lead.intent === 'CONSTRUCTION_SERVICE') {
    return (
      <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
        Construction Service is intake only. No project, agreement, or payment plan is created.
      </p>
    );
  }
  if (lead.intent === 'SELL') {
    return (
      <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
        Seller Leads do not receive rental or buyer matching. Use Property Sale workflow when
        authority exists.
      </p>
    );
  }
  if (!allowed) {
    return (
      <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
        Matching exists for this Lead, but your current access cannot run listing matches.
      </p>
    );
  }
  if (query.isPending) return <LoadingState label="Loading listing matches" />;
  if (query.isError) {
    return <ErrorState message={crmError(query.error)} onRetry={() => void query.refetch()} />;
  }
  const items = query.data?.items ?? [];
  if (!items.length) {
    return (
      <EmptyState
        title="No published listings match this Lead"
        description="Matching shows only published listings in the Lead branch that are still available — occupied rented spaces and sold properties are excluded."
      />
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[720px] w-full border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-3 py-3">Listing</th>
            <th className="px-3 py-3">Target</th>
            <th className="px-3 py-3">Ask</th>
            <th className="px-3 py-3">Why it matched</th>
            <th className="px-3 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const target =
              item.listingType === 'RENTAL'
                ? `${item.listing.rentableSpace?.spaceCode ?? ''} — ${item.listing.rentableSpace?.name ?? item.listing.rentableSpace?.property?.name ?? 'Rentable Space'}`
                : `${item.listing.property?.propertyCode ?? ''} — ${item.listing.property?.name ?? 'Property'}`;
            const ask =
              item.listingType === 'RENTAL'
                ? item.listing.askingRent
                : item.listing.askingPrice;
            const href =
              item.listingType === 'RENTAL' ? '/rental/properties' : '/marketing/sale-listings';
            return (
              <tr key={item.listing.id} className="border-b border-slate-100 text-sm last:border-0">
                <td className="px-3 py-3">
                  <Link className="font-semibold text-blue-800 underline" href={href}>
                    {item.listing.listingNumber}
                  </Link>
                  <p className="text-slate-600">{item.listing.title}</p>
                </td>
                <td className="px-3 py-3">{target}</td>
                <td className="px-3 py-3">
                  {ask == null || ask === '' ? 'Not set' : `${item.listing.currency} ${String(ask)}`}
                </td>
                <td className="px-3 py-3">
                  <ul className="list-disc pl-4 text-slate-600">
                    {item.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </td>
                <td className="px-3 py-3">
                  <StatusBadge value={item.listing.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-slate-500">
        Score is explainable from published-branch and preference rules, not a hidden ranking model.
      </p>
    </div>
  );
}
