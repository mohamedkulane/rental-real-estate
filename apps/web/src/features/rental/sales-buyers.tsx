'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { useState } from 'react';
import toast from '@/lib/toast';
import {
  DataTableEmpty,
  DataTableSurface,
  DataTableToolbar,
  TableActionButton,
  TableActionGroup,
} from '@/components/shared/data-table';
import { TableSkeleton } from '@/components/shared/loading-system';
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/shared/ui';
import { CommercialShell, useCommercialPrincipal } from '@/features/commercial/commercial-shell';
import { AsyncSelect, can, requestPath } from '@/features/crm/crm-data';
import type { LeadDetail } from '@/features/crm/crm-types';
import { api, hasPermission, type CursorPage, type Principal, userFacingError } from '@/lib/phase3-api';
import { humanize } from '@/lib/presentation';
import { AddBuyerDrawer } from './buyer-form';
import { useCreateDrawerState } from './use-create-drawer-state';
import {
  WorkspaceFormDrawer,
  WorkspaceFormDrawerFooter,
} from '@/components/shared/workspace-form-drawer';

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-[#215E61] focus:outline-none focus:ring-2 focus:ring-[#215E61]/15';

type BuyerRow = {
  id: string;
  leadNumber: string;
  displayName: string;
  stage: string;
  wantedType: string | null;
  preferredLocation: string | null;
  preferredLocations: string[];
  minPurchaseBudget: string | null;
  maxPurchaseBudget: string | null;
  currency: string;
};

type MatchItem = {
  listingType: 'RENTAL' | 'SALE';
  score: number;
  reasons: string[];
  listing: {
    id: string;
    listingNumber: string;
    title: string;
    status: string;
    askingRent?: string | number | null;
    askingPrice?: string | number | null;
    currency: string;
    propertyId?: string;
    property?: {
      id: string;
      name: string;
      propertyCode: string;
      propertyType?: string;
      city?: string;
    };
    rentableSpace?: {
      id: string;
      spaceCode: string;
      name: string;
      property?: { id: string; name: string; propertyCode: string; city?: string; propertyType?: string };
    };
  };
};

function buyerPreferenceSummary(lead: LeadDetail) {
  if (lead.preference.intent !== 'BUY') {
    return {
      areas: [] as string[],
      types: '—',
      budget: '—',
      bedrooms: null as string | null,
      bathrooms: null as string | null,
      minArea: null as string | null,
      notes: lead.preference.notes ?? null,
    };
  }
  const pref = lead.preference;
  const areas = pref.preferredAreaText ?? [];
  const types = pref.propertyTypeCodes?.map(humanize).join(', ') || '—';
  const budget =
    pref.minBudget != null && pref.maxBudget != null
      ? `${pref.currency ?? 'USD'} ${pref.minBudget}${
          pref.minBudget === pref.maxBudget ? '' : ` – ${pref.maxBudget}`
        }`
      : '—';
  return {
    areas,
    types,
    budget,
    bedrooms: pref.minBedrooms != null ? String(pref.minBedrooms) : null,
    bathrooms: pref.minBathrooms != null ? String(pref.minBathrooms) : null,
    minArea: pref.minArea != null ? String(pref.minArea) : null,
    notes: pref.notes ?? null,
  };
}

function matchProperty(item: MatchItem) {
  return item.listing.property ?? item.listing.rentableSpace?.property ?? null;
}

function matchPrice(item: MatchItem) {
  const price = item.listing.askingPrice ?? item.listing.askingRent;
  if (price == null || price === '') return 'Not set';
  return `${item.listing.currency} ${String(price)}`;
}

export function BuyerRegister() {
  const queryClient = useQueryClient();
  const { principal, error } = useCommercialPrincipal();
  const { createOpen, openCreate, closeCreate } = useCreateDrawerState();
  const [search, setSearch] = useState('');
  const allowed = Boolean(principal && hasPermission(principal, 'crm.lead.read'));
  const query = useQuery({
    queryKey: ['sales-buyers', search],
    enabled: allowed,
    queryFn: () => {
      const params = new URLSearchParams({ limit: '25' });
      if (search.trim()) params.set('search', search.trim());
      return api<CursorPage<BuyerRow>>(`/rental/buyers?${params.toString()}`);
    },
  });
  const canCreate = Boolean(principal && hasPermission(principal, 'crm.lead.create'));

  return (
    <CommercialShell principal={principal} activeItem="sales:buyers">
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      <PageHeader
        eyebrow="Sales"
        title="Buyers"
        description="People looking to buy. Open a buyer to see matching sale properties."
        action={
          canCreate ? (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-[#215E61] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#1a4c4e]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Buyer
            </button>
          ) : undefined
        }
      />
      <DataTableSurface className="mt-6">
        <DataTableToolbar>
          <label className="block min-w-0 flex-1">
            <span className="mb-1 block text-[12px] font-semibold text-slate-500">Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className={inputClass + ' pl-10'}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search buyers"
              />
            </div>
          </label>
        </DataTableToolbar>
        {query.isLoading ? (
          <TableSkeleton columns={5} />
        ) : !query.data?.items.length ? (
          <DataTableEmpty
            title="No buyers yet"
            description="Add someone looking to buy a property to start matching."
            action={
              canCreate ? (
                <button type="button" className="button primary" onClick={openCreate}>
                  Add Buyer
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {['Name', 'Wanted Type', 'Locations', 'Budget', 'Status', 'Actions'].map(
                    (header) => (
                      <th
                        key={header}
                        className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500"
                      >
                        {header}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((buyer) => (
                  <tr key={buyer.id} className="border-b border-slate-100 text-sm">
                    <td className="px-4 py-3 font-semibold text-slate-900">{buyer.displayName}</td>
                    <td className="px-4 py-3">
                      {buyer.wantedType ? humanize(buyer.wantedType) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {(buyer.preferredLocations?.length
                        ? buyer.preferredLocations
                        : buyer.preferredLocation
                          ? [buyer.preferredLocation]
                          : []
                      ).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {buyer.minPurchaseBudget
                        ? `${buyer.currency} ${buyer.minPurchaseBudget}${
                            buyer.maxPurchaseBudget &&
                            buyer.maxPurchaseBudget !== buyer.minPurchaseBudget
                              ? ` – ${buyer.maxPurchaseBudget}`
                              : ''
                          }`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={buyer.stage} />
                    </td>
                    <td className="px-4 py-3">
                      <TableActionButton tone="open" href={`/sales/buyers/${buyer.id}`}>
                        Open
                      </TableActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataTableSurface>
      {canCreate ? (
        <AddBuyerDrawer
          open={createOpen}
          onClose={closeCreate}
          onCreated={() => {
            closeCreate();
            void queryClient.invalidateQueries({ queryKey: ['sales-buyers'] });
          }}
        />
      ) : null}
    </CommercialShell>
  );
}

export function BuyerMatches({
  lead,
  principal,
}: {
  lead: LeadDetail;
  principal: Principal;
}) {
  const queryClient = useQueryClient();
  const [viewingFor, setViewingFor] = useState<MatchItem | null>(null);
  const [assignedAgentId, setAssignedAgentId] = useState(
    () => lead.currentAssignee?.id ?? '',
  );
  const allowed = can(principal, 'listing.match', lead.responsibleBranch.id);
  const query = useQuery({
    queryKey: ['buyer-listing-matches', lead.id],
    enabled: allowed && lead.intent === 'BUY',
    retry: false,
    queryFn: () => api<CursorPage<MatchItem>>(`/listing-matches?leadId=${lead.id}&limit=25`),
  });

  const markInterested = useMutation({
    mutationFn: () =>
      api(`/crm/leads/${lead.id}/matching`, {
        method: 'POST',
        body: JSON.stringify({
          expectedVersion: lead.version,
          reason: 'Buyer interested in a matched property',
        }),
      }),
    onSuccess: () => {
      toast.success('Buyer marked as interested.');
      void queryClient.invalidateQueries({ queryKey: ['sales-buyer', lead.id] });
    },
    onError: (cause) => toast.error(userFacingError(cause)),
  });

  const scheduleViewing = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api('/viewings', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Viewing scheduled.');
      setViewingFor(null);
    },
    onError: (cause) => toast.error(userFacingError(cause)),
  });

  if (lead.intent !== 'BUY') {
    return (
      <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
        Matching is available for buyers only.
      </p>
    );
  }
  if (!allowed) {
    return (
      <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
        You cannot run property matching for this buyer.
      </p>
    );
  }
  if (query.isPending) return <LoadingState label="Finding matching sale properties" />;
  if (query.isError) {
    return <ErrorState message={userFacingError(query.error)} onRetry={() => void query.refetch()} />;
  }

  const items = query.data?.items ?? [];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Best Matches</h2>
        {hasPermission(principal, 'crm.lead.stage') ? (
          <TableActionButton
            tone="manage"
            disabled={markInterested.isPending}
            onClick={() => markInterested.mutate()}
          >
            Mark Interested
          </TableActionButton>
        ) : null}
      </div>

      {!items.length ? (
        <EmptyState
          title="No matching sale properties yet"
          description="Eligible Sale-intent properties that fit this buyer’s budget and locations will appear here."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-[860px] w-full text-left">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {['Property', 'Location', 'Price', 'Property Type', 'Match', 'Actions'].map(
                  (header) => (
                    <th
                      key={header}
                      className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500"
                    >
                      {header}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const property = matchProperty(item);
                const propertyId = property?.id;
                return (
                  <tr key={item.listing.id} className="border-b border-slate-100 text-sm last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">
                        {property?.name ?? item.listing.title}
                      </p>
                      <p className="text-slate-500">{item.listing.listingNumber}</p>
                    </td>
                    <td className="px-4 py-3">{property?.city ?? '—'}</td>
                    <td className="px-4 py-3">{matchPrice(item)}</td>
                    <td className="px-4 py-3">
                      {property?.propertyType ? humanize(property.propertyType) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#215E61]">{item.score}% Match</p>
                      <ul className="mt-1 list-disc pl-4 text-xs text-slate-500">
                        {item.reasons.slice(0, 2).map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-3">
                      <TableActionGroup>
                        {propertyId ? (
                          <TableActionButton
                            tone="view"
                            href={`/portfolio/properties/${propertyId}`}
                          >
                            View Property
                          </TableActionButton>
                        ) : null}
                        {hasPermission(principal, 'viewing.create') ? (
                          <TableActionButton
                            tone="schedule"
                            onClick={() => {
                              setAssignedAgentId(lead.currentAssignee?.id ?? '');
                              setViewingFor(item);
                            }}
                          >
                            Schedule Viewing
                          </TableActionButton>
                        ) : null}
                        {hasPermission(principal, 'crm.lead.stage') ? (
                          <TableActionButton
                            tone="manage"
                            disabled={markInterested.isPending}
                            onClick={() => markInterested.mutate()}
                          >
                            Mark Interested
                          </TableActionButton>
                        ) : null}
                        {hasPermission(principal, 'sale-offer.create') && propertyId ? (
                          <TableActionButton
                            tone="agreement"
                            href={`/sales/deals/new?leadId=${lead.id}&propertyId=${propertyId}`}
                          >
                            Start Offer
                          </TableActionButton>
                        ) : null}
                      </TableActionGroup>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {viewingFor ? (
        <WorkspaceFormDrawer
          open
          eyebrow="Sales"
          title="Schedule Viewing"
          description={viewingFor.listing.title ?? 'Sale property viewing'}
          onClose={() => setViewingFor(null)}
          size="md"
          footer={
            <WorkspaceFormDrawerFooter
              formId="schedule-sale-viewing"
              onCancel={() => setViewingFor(null)}
              submitLabel="Schedule"
              loadingLabel="Scheduling…"
              isPending={scheduleViewing.isPending}
            />
          }
        >
          <form
            id="schedule-sale-viewing"
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!assignedAgentId) {
                toast.error('Choose the agent who will attend the viewing.');
                return;
              }
              const form = new FormData(event.currentTarget);
              const spaceId = viewingFor.listing.rentableSpace?.id;
              const propertyId = viewingFor.listing.propertyId ?? viewingFor.listing.property?.id;
              scheduleViewing.mutate({
                leadId: lead.id,
                assignedEmployeeId: assignedAgentId,
                scheduledAt: String(form.get('scheduledAt') ?? ''),
                notes: String(form.get('notes') ?? '').trim() || undefined,
                ...(spaceId ? { rentableSpaceId: spaceId } : propertyId ? { propertyId } : { saleListingId: viewingFor.listing.id }),
              });
            }}
          >
            <AsyncSelect
              label="Assigned agent"
              path={requestPath('/crm/selectors/employees', {
                purpose: 'ASSIGNMENT_READ',
                branchId: lead.responsibleBranch.id,
              })}
              value={assignedAgentId}
              onChange={setAssignedAgentId}
              required
              initial={
                lead.currentAssignee
                  ? {
                      id: lead.currentAssignee.id,
                      label: `${lead.currentAssignee.employeeNumber} — ${lead.currentAssignee.displayName}`,
                    }
                  : undefined
              }
            />
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
              Date and time
              <input name="scheduledAt" type="datetime-local" required className={inputClass} />
            </label>
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
              Notes
              <textarea name="notes" rows={2} className={inputClass} />
            </label>
          </form>
        </WorkspaceFormDrawer>
      ) : null}
    </section>
  );
}

export function BuyerDetailWorkspace({ leadId }: { leadId: string }) {
  const { principal, error } = useCommercialPrincipal();
  const query = useQuery({
    queryKey: ['sales-buyer', leadId],
    enabled: Boolean(principal),
    queryFn: () => api<LeadDetail>(`/rental/buyers/${leadId}`),
  });

  if (!principal) {
    return (
      <CommercialShell principal={null} activeItem="sales:buyers">
        <TableSkeleton columns={1} />
      </CommercialShell>
    );
  }

  const lead = query.data;
  const prefs = lead ? buyerPreferenceSummary(lead) : null;
  const phone = lead?.contact.phone ?? lead?.contact.phoneMasked ?? '—';

  return (
    <CommercialShell principal={principal} activeItem="sales:buyers">
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      {query.isLoading ? <TableSkeleton columns={1} /> : null}
      {query.isError ? (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{userFacingError(query.error)}</p>
      ) : null}
      {lead && prefs ? (
        <>
          <PageHeader
            eyebrow="Buyer"
            title={lead.displayName}
            description={`${humanize(lead.stage)} · Buying`}
            action={
              <Link className="button secondary" href="/sales/buyers">
                Back to buyers
              </Link>
            }
          />

          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Buyer information</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Name
                  </dt>
                  <dd className="mt-1 font-semibold text-slate-900">{lead.displayName}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Phone
                  </dt>
                  <dd className="mt-1 font-semibold text-slate-900">{phone}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Buying preferences</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Property type wanted
                  </dt>
                  <dd className="mt-1 font-semibold text-slate-900">{prefs.types}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Preferred locations
                  </dt>
                  <dd className="mt-2 flex flex-wrap gap-1.5">
                    {prefs.areas.length ? (
                      prefs.areas.map((area) => (
                        <span
                          key={area}
                          className="rounded-md bg-[#E8F3F3] px-2 py-1 text-[12px] font-semibold text-[#215E61]"
                        >
                          {area}
                        </span>
                      ))
                    ) : (
                      <span className="font-semibold text-slate-900">—</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Budget
                  </dt>
                  <dd className="mt-1 font-semibold text-slate-900">{prefs.budget}</dd>
                </div>
                {prefs.bedrooms || prefs.bathrooms || prefs.minArea || prefs.notes ? (
                  <div className="border-t border-slate-100 pt-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Optional preferences
                    </p>
                    <ul className="mt-2 space-y-1 text-slate-700">
                      {prefs.bedrooms ? <li>Bedrooms: {prefs.bedrooms}+</li> : null}
                      {prefs.bathrooms ? <li>Bathrooms: {prefs.bathrooms}+</li> : null}
                      {prefs.minArea ? <li>Minimum area: {prefs.minArea}</li> : null}
                      {prefs.notes ? <li>Notes: {prefs.notes}</li> : null}
                    </ul>
                  </div>
                ) : null}
              </dl>
            </div>
          </section>

          <section className="mt-8">
            <BuyerMatches lead={lead} principal={principal} />
          </section>
        </>
      ) : null}
    </CommercialShell>
  );
}
