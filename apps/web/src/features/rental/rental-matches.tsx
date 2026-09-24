'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import toast from '@/lib/toast';
import { TableActionButton, TableActionGroup } from '@/components/shared/data-table';
import {
  WorkspaceFormDrawer,
  WorkspaceFormDrawerFooter,
} from '@/components/shared/workspace-form-drawer';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/shared/ui';
import { api, hasPermission, type CursorPage, type Principal, userFacingError } from '@/lib/phase3-api';
import { AsyncSelect, can, requestPath } from '@/features/crm/crm-data';
import type { LeadDetail } from '@/features/crm/crm-types';
import {
  nextPlacementStep,
  readPlacementProgress,
  writePlacementProgress,
  isInterestedViewingOutcome,
  isNotInterestedViewingOutcome,
  viewingInterestLabel,
  type PlacementProgress,
  type PlacementStep,
} from './rental-placement';

type MatchItem = {
  listingType: 'RENTAL' | 'SALE';
  score: number;
  reasons: string[];
  matchSource?: 'PUBLISHED_LISTING' | 'INVENTORY';
  canScheduleViewing?: boolean;
  listing: {
    id: string;
    listingNumber: string;
    title: string;
    status: string;
    askingRent?: string | number | null;
    currency: string;
    rentableSpace?: {
      id: string;
      spaceCode: string;
      name: string;
      property?: {
        id: string;
        name: string;
        propertyCode: string;
        city?: string;
        district?: string | null;
        serviceIntent?: 'RENTAL_BROKERAGE' | 'FULL_MANAGEMENT' | 'SALE' | 'CONSTRUCTION' | null;
      };
    };
  };
};

type ViewingRow = {
  id: string;
  status: string;
  outcome?: string | null;
  version: number;
  rentalListingId?: string | null;
  rentableSpaceId?: string | null;
  rentalListing?: { id: string; listingNumber: string; title: string; rentableSpaceId?: string } | null;
  rentableSpace?: { id: string; spaceCode: string; name: string; propertyId: string } | null;
};

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/15';

/** Equal-height date fields; constrains oversized native calendar icons (esp. Windows). */
const dateInputClass =
  'box-border h-11 w-full min-h-[2.75rem] max-h-11 rounded-lg border border-slate-200 px-3 py-0 text-sm leading-none shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:w-4 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70';

const STEP_LABELS: Record<Exclude<PlacementStep, 'declined'>, string> = {
  viewing: '1. Viewing',
  negotiate: '2. Agree with owner',
  fees: '3. Company fee',
  lease: '4. Lease',
};

function matchKeys(item: MatchItem): string[] {
  const spaceId = item.listing.rentableSpace?.id;
  return [item.listing.id, spaceId].filter((value): value is string => Boolean(value));
}

function PipelineSteps({ active }: { active: PlacementStep }) {
  if (active === 'declined') {
    return <p className="mt-2 text-xs font-semibold text-slate-500">Not interested — try another unit</p>;
  }
  const order: Array<Exclude<PlacementStep, 'declined'>> = [
    'viewing',
    'negotiate',
    'fees',
    'lease',
  ];
  const activeIndex = order.indexOf(active);
  return (
    <ol className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
      {order.map((step, index) => {
        const done = index < activeIndex;
        const current = step === active;
        return (
          <li
            key={step}
            className={
              current
                ? 'rounded-md bg-[#215E61] px-2 py-1 text-white'
                : done
                  ? 'rounded-md bg-emerald-50 px-2 py-1 text-emerald-800'
                  : 'rounded-md bg-slate-100 px-2 py-1 text-slate-500'
            }
          >
            {STEP_LABELS[step]}
          </li>
        );
      })}
    </ol>
  );
}
export function RentalCustomerMatches({
  lead,
  principal,
}: {
  lead: LeadDetail;
  principal: Principal;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [viewingFor, setViewingFor] = useState<MatchItem | null>(null);
  const [assignedAgentId, setAssignedAgentId] = useState(
    () => lead.currentAssignee?.id ?? '',
  );
  const [negotiateFor, setNegotiateFor] = useState<MatchItem | null>(null);
  const [feesFor, setFeesFor] = useState<MatchItem | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, PlacementProgress>>({});

  const allowed = can(principal, 'listing.match', lead.responsibleBranch.id);
  const query = useQuery({
    queryKey: ['rental-listing-matches', lead.id],
    enabled: allowed && lead.intent === 'RENT',
    retry: false,
    queryFn: () => api<CursorPage<MatchItem>>(`/listing-matches?leadId=${lead.id}&limit=25`),
  });

  const viewings = useQuery({
    queryKey: ['rental-customer-viewings', lead.id],
    enabled: allowed && lead.intent === 'RENT',
    queryFn: () => api<CursorPage<ViewingRow>>(`/viewings?leadId=${lead.id}&limit=50`),
  });

  useEffect(() => {
    const items = query.data?.items ?? [];
    if (!items.length) return;
    const next: Record<string, PlacementProgress> = {};
    for (const item of items) {
      next[item.listing.id] = readPlacementProgress(lead.id, item.listing.id);
    }
    setProgressMap(next);
  }, [lead.id, query.data?.items]);

  const viewingByKey = useMemo(() => {
    const map = new Map<string, ViewingRow>();
    for (const row of viewings.data?.items ?? []) {
      const keys = [
        row.rentalListingId,
        row.rentalListing?.id,
        row.rentableSpaceId,
        row.rentableSpace?.id,
        row.rentalListing?.rentableSpaceId,
      ].filter((value): value is string => Boolean(value));
      for (const key of keys) {
        const existing = map.get(key);
        if (!existing || row.status === 'COMPLETED') map.set(key, row);
      }
    }
    return map;
  }, [viewings.data?.items]);

  const markInterested = useMutation({
    mutationFn: () =>
      api(`/crm/leads/${lead.id}/matching`, {
        method: 'POST',
        body: JSON.stringify({
          expectedVersion: lead.version,
          reason: 'Customer interested in a matched property',
        }),
      }),
    onSuccess: () => {
      toast.success('Customer marked as interested.');
      void queryClient.invalidateQueries({ queryKey: ['rental-customer', lead.id] });
    },
    onError: (cause) => toast.error(userFacingError(cause)),
  });

  const scheduleViewing = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<ViewingRow>('/viewings', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (row) => {
      toast.success('Viewing scheduled.');
      if (viewingFor) {
        setProgressMap((current) => ({
          ...current,
          [viewingFor.listing.id]: writePlacementProgress(lead.id, viewingFor.listing.id, {
            viewingId: row.id,
            declined: false,
          }),
        }));
      }
      setViewingFor(null);
      void queryClient.invalidateQueries({ queryKey: ['rental-customer-viewings', lead.id] });
    },
    onError: (cause) => toast.error(userFacingError(cause)),
  });

  const completeViewing = useMutation({
    mutationFn: async (row: ViewingRow) => {
      let current = row;
      if (current.status === 'SCHEDULED') {
        current = await api<ViewingRow>(`/viewings/${current.id}/transition`, {
          method: 'POST',
          body: JSON.stringify({
            status: 'CONFIRMED',
            expectedVersion: current.version,
            reason: 'Customer attended viewing',
          }),
        });
      }
      if (current.status === 'CONFIRMED') {
        current = await api<ViewingRow>(`/viewings/${current.id}/transition`, {
          method: 'POST',
          body: JSON.stringify({
            status: 'COMPLETED',
            expectedVersion: current.version,
            reason: 'Viewing completed',
            outcome: 'INTERESTED',
          }),
        });
      }
      return current;
    },
    onSuccess: (row) => {
      toast.success('Viewing completed as interested. Agree rent with the owner next.');
      const key =
        row.rentalListingId ??
        row.rentalListing?.id ??
        row.rentableSpaceId ??
        row.rentableSpace?.id;
      if (key) {
        setProgressMap((current) => ({
          ...current,
          [key]: writePlacementProgress(lead.id, key, { viewingId: row.id, declined: false }),
        }));
      }
      void queryClient.invalidateQueries({ queryKey: ['rental-customer-viewings', lead.id] });
    },
    onError: (cause) => toast.error(userFacingError(cause)),
  });

  const confirmAgreement = useMutation({
    mutationFn: async ({
      body,
      viewing,
    }: {
      body: Record<string, unknown>;
      viewing: ViewingRow;
    }) => {
      let ready = viewing;
      if (isNotInterestedViewingOutcome(ready.outcome)) {
        throw new Error('This viewing was marked not interested. Match another unit.');
      }
      if (ready.status === 'COMPLETED' && !isInterestedViewingOutcome(ready.outcome)) {
        ready = await api<ViewingRow>(`/viewings/${ready.id}/transition`, {
          method: 'POST',
          body: JSON.stringify({
            status: 'COMPLETED',
            expectedVersion: ready.version,
            reason: 'Customer confirmed interest before agreement',
            outcome: 'INTERESTED',
          }),
        });
      }
      const agreement = await api<{ id: string; version: number }>(
        '/rental/commands/rental-agreements',
        { method: 'POST', body: JSON.stringify(body) },
      );
      return api<{ id: string }>(`/rental/commands/rental-agreements/${agreement.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          expectedVersion: agreement.version,
          reason: 'Final rental terms confirmed',
        }),
      });
    },
    onSuccess: (agreement) => {
      toast.success('Agreement confirmed. Lease terms are ready.');
      router.push(`/rental/leases/new?agreementId=${agreement.id}`);
    },
    onError: (cause) => toast.error(userFacingError(cause)),
  });

  const declineViewing = useMutation({
    mutationFn: (row: ViewingRow) =>
      api<ViewingRow>(`/viewings/${row.id}/transition`, {
        method: 'POST',
        body: JSON.stringify({
          status: 'COMPLETED',
          expectedVersion: row.version,
          reason: 'Customer is not interested in this unit',
          outcome: 'NOT_INTERESTED',
        }),
      }),
    onSuccess: (row) => {
      toast('Marked not interested. Match another unit.');
      const key =
        row.rentalListingId ??
        row.rentalListing?.id ??
        row.rentableSpaceId ??
        row.rentableSpace?.id;
      if (key) {
        setProgressMap((current) => ({
          ...current,
          [key]: writePlacementProgress(lead.id, key, {
            viewingId: row.id,
            declined: true,
          }),
        }));
      }
      void queryClient.invalidateQueries({ queryKey: ['rental-listing-matches', lead.id] });
      void queryClient.invalidateQueries({ queryKey: ['rental-customer', lead.id] });
      void queryClient.invalidateQueries({ queryKey: ['rental-customer-viewings', lead.id] });
    },
    onError: (cause) => toast.error(userFacingError(cause)),
  });

  if (lead.intent !== 'RENT') {
    return (
      <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
        Matching is available for rental customers only.
      </p>
    );
  }
  if (!allowed) {
    return (
      <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
        You cannot run property matching for this branch.
      </p>
    );
  }
  if (query.isPending) return <LoadingState label="Finding matching properties" />;
  if (query.isError) {
    return <ErrorState message={userFacingError(query.error)} onRetry={() => void query.refetch()} />;
  }

  const items = query.data?.items ?? [];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Matching Properties</h2>
          <p className="mt-1 text-sm text-slate-600">
            Schedule a viewing first. If the customer likes it, agree terms with the owner, collect
            the company fee, then create the lease. If not, try another unit.
          </p>
        </div>
        {hasPermission(principal, 'crm.lead.stage') ? (
          <button
            type="button"
            className="button secondary"
            disabled={markInterested.isPending}
            onClick={() => markInterested.mutate()}
          >
            Mark Interested
          </button>
        ) : null}
      </div>

      {!items.length ? (
        <EmptyState
          title="No matching properties yet"
          description="Available rental units that fit this customer's location and type preferences will appear here."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-[860px] w-full text-left">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {['Property', 'Rent', 'Location', 'Match / next step', 'Actions'].map((header) => (
                  <th
                    key={header}
                    className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const property = item.listing.rentableSpace?.property;
                const propertyId = property?.id;
                const spaceId = item.listing.rentableSpace?.id;
                const location = [property?.city, property?.district].filter(Boolean).join(', ');
                const published = item.matchSource === 'PUBLISHED_LISTING';
                const viewing =
                  matchKeys(item)
                    .map((key) => viewingByKey.get(key))
                    .find(Boolean) ?? undefined;
                const progress = progressMap[item.listing.id] ?? {};
                const step = nextPlacementStep({
                  viewingStatus: viewing?.status ?? null,
                  viewingOutcome: viewing?.outcome ?? null,
                  progress,
                });
                if (step === 'declined') {
                  return (
                    <tr
                      key={item.listing.id}
                      className="border-b border-slate-100 bg-slate-50/70 text-sm last:border-0"
                    >
                      <td className="px-4 py-3 text-slate-500">
                        {property?.name ?? item.listing.title} ·{' '}
                        {item.listing.rentableSpace?.name ?? item.listing.listingNumber}
                      </td>
                      <td className="px-4 py-3 text-slate-400">—</td>
                      <td className="px-4 py-3 text-slate-400">{location || '—'}</td>
                      <td className="px-4 py-3">
                        <PipelineSteps active="declined" />
                      </td>
                      <td className="px-4 py-3">
                        <TableActionButton
                          tone="neutral"
                          onClick={() =>
                            setProgressMap((current) => ({
                              ...current,
                              [item.listing.id]: writePlacementProgress(lead.id, item.listing.id, {
                                declined: false,
                              }),
                            }))
                          }
                        >
                          Consider again
                        </TableActionButton>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={item.listing.id} className="border-b border-slate-100 text-sm last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">
                        {property?.name ?? item.listing.title}
                      </p>
                      <p className="text-slate-500">
                        {item.listing.rentableSpace?.name ?? item.listing.listingNumber}
                      </p>
                      {item.matchSource === 'INVENTORY' ? (
                        <p className="mt-1">
                          <StatusBadge value="Registered unit" />
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {progress.agreedRent
                        ? `${progress.currency ?? item.listing.currency} ${progress.agreedRent} (agreed)`
                        : item.listing.askingRent == null || item.listing.askingRent === ''
                          ? 'Not set'
                          : `${item.listing.currency} ${String(item.listing.askingRent)}`}
                    </td>
                    <td className="px-4 py-3">{location || '—'}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#215E61]">{item.score}% Match</p>
                      <PipelineSteps active={step} />
                      {viewing ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Viewing:{' '}
                          {viewingInterestLabel(viewing.outcome) ??
                            viewing.status.replaceAll('_', ' ')}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <TableActionGroup>
                        {propertyId ? (
                          <TableActionButton
                            tone="view"
                            href={`/rental/properties/${propertyId}`}
                          >
                            View Property
                          </TableActionButton>
                        ) : null}
                        {hasPermission(principal, 'viewing.create') &&
                        step === 'viewing' &&
                        !viewing ? (
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
                        {hasPermission(principal, 'viewing.complete') &&
                        viewing &&
                        (viewing.status === 'SCHEDULED' || viewing.status === 'CONFIRMED') ? (
                          <TableActionButton
                            tone="edit"
                            onClick={() => completeViewing.mutate(viewing)}
                          >
                            Complete Viewing
                          </TableActionButton>
                        ) : null}
                        {step === 'negotiate' ? (
                          <>
                            <TableActionButton tone="edit" onClick={() => setNegotiateFor(item)}>
                              Agree with owner
                            </TableActionButton>
                            <TableActionButton
                              tone="neutral"
                              disabled={declineViewing.isPending}
                              onClick={() => {
                                if (viewing) declineViewing.mutate(viewing);
                              }}
                            >
                              Not interested
                            </TableActionButton>
                          </>
                        ) : null}
                        {step === 'fees' ? (
                          <TableActionButton tone="edit" onClick={() => setFeesFor(item)}>
                            Collect company fee
                          </TableActionButton>
                        ) : null}
                        {hasPermission(principal, 'lease.create') &&
                        propertyId &&
                        step === 'lease' ? (
                          <TableActionButton
                            tone="agreement"
                            href={`/rental/leases/new?leadId=${lead.id}&propertyId=${propertyId}&rentableSpaceId=${encodeURIComponent(spaceId ?? '')}&rent=${encodeURIComponent(progress.agreedRent ?? String(item.listing.askingRent ?? ''))}&viewingId=${encodeURIComponent(viewing?.id ?? progress.viewingId ?? '')}`}
                          >
                            Create Lease
                          </TableActionButton>
                        ) : null}
                      </TableActionGroup>
                      {step !== 'lease' ? (
                        <p className="mt-2 text-xs text-slate-500">
                          Next: {STEP_LABELS[step].replace(/^\d+\.\s*/, '')}
                        </p>
                      ) : null}
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
          eyebrow="Placement"
          title="Schedule Viewing"
          description="No brokerage start needed. View the unit first; continue only if the customer is interested."
          onClose={() => setViewingFor(null)}
          size="md"
          footer={
            <WorkspaceFormDrawerFooter
              formId="schedule-rental-viewing"
              onCancel={() => setViewingFor(null)}
              submitLabel="Schedule"
              loadingLabel="Saving…"
              isPending={scheduleViewing.isPending}
            />
          }
        >
          <form
            id="schedule-rental-viewing"
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!assignedAgentId) {
                toast.error('Choose the agent who will attend the viewing.');
                return;
              }
              const form = new FormData(event.currentTarget);
              const spaceId = viewingFor.listing.rentableSpace?.id ?? viewingFor.listing.id;
              scheduleViewing.mutate({
                leadId: lead.id,
                assignedEmployeeId: assignedAgentId,
                scheduledAt: String(form.get('scheduledAt') ?? ''),
                notes: String(form.get('notes') ?? '').trim() || undefined,
                rentableSpaceId: spaceId,
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

      {negotiateFor ? (
        <WorkspaceFormDrawer
          open
          eyebrow="Placement"
          title="Agree rent with owner"
          description="Customer is interested. Finalize the monthly rent with the owner. If they cannot agree, mark not interested and match another unit."
          onClose={() => setNegotiateFor(null)}
          size="md"
          footer={
            <WorkspaceFormDrawerFooter
              formId="negotiate-rental-rent"
              onCancel={() => setNegotiateFor(null)}
              submitLabel="Save agreed rent"
              isPending={false}
            />
          }
        >
          <form
            id="negotiate-rental-rent"
            className="space-y-4"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const agreedRent = String(form.get('agreedRent') ?? '').trim();
              if (!agreedRent) return;
              setProgressMap((current) => ({
                ...current,
                [negotiateFor.listing.id]: writePlacementProgress(
                  lead.id,
                  negotiateFor.listing.id,
                  {
                    agreedRent,
                    currency: negotiateFor.listing.currency || 'USD',
                    declined: false,
                  },
                ),
              }));
              toast.success('Rent agreed. Collect the company fee next.');
              setNegotiateFor(null);
            }}
          >
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
              Agreed monthly rent ({negotiateFor.listing.currency || 'USD'})
              <input
                name="agreedRent"
                required
                inputMode="decimal"
                defaultValue={
                  progressMap[negotiateFor.listing.id]?.agreedRent ??
                  String(negotiateFor.listing.askingRent ?? '')
                }
                className={inputClass}
              />
            </label>
          </form>
        </WorkspaceFormDrawer>
      ) : null}

      {feesFor ? (
        <WorkspaceFormDrawer
          open
          eyebrow="Placement"
          title="Confirm agreement"
          description="Record final rental terms and placement commissions. The lease is created only after this agreement is confirmed."
          onClose={() => setFeesFor(null)}
          size="md"
          footer={
            <WorkspaceFormDrawerFooter
              formId="collect-company-fee"
              onCancel={() => setFeesFor(null)}
              submitLabel="Confirm agreement"
              isPending={confirmAgreement.isPending}
            />
          }
        >
          <form
            id="collect-company-fee"
            className="space-y-4"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const space = feesFor.listing.rentableSpace;
              const viewing = matchKeys(feesFor).map((key) => viewingByKey.get(key)).find(Boolean);
              if (!space?.property?.id || !viewing?.id) {
                toast.error('A completed viewing and property are required.');
                return;
              }
              const ownerCommission = String(form.get('ownerCommission') ?? '').trim();
              const tenantCommission = String(form.get('tenantCommission') ?? '').trim();
              confirmAgreement.mutate({
                viewing,
                body: {
                  leadId: lead.id,
                  propertyId: space.property.id,
                  rentableSpaceId: space.id,
                  viewingId: viewing.id,
                  finalRent: String(form.get('finalRent') ?? '').trim(),
                  leaseStartDate: String(form.get('leaseStartDate') ?? '').trim(),
                  ...(String(form.get('leaseEndDate') ?? '').trim()
                    ? { leaseEndDate: String(form.get('leaseEndDate') ?? '').trim() }
                    : {}),
                  ...(space.property.serviceIntent === 'RENTAL_BROKERAGE'
                    ? {
                        ownerCommission: {
                          method: String(form.get('ownerCommissionMethod') ?? 'PERCENT'),
                          value: ownerCommission,
                        },
                        tenantCommission: {
                          method: String(form.get('tenantCommissionMethod') ?? 'PERCENT'),
                          value: tenantCommission,
                        },
                      }
                    : tenantCommission
                      ? {
                          tenantCommission: {
                            method: String(form.get('tenantCommissionMethod') ?? 'FIXED'),
                            value: tenantCommission,
                          },
                        }
                      : {}),
                },
              });
            }}
          >
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
              Final agreed rent ({feesFor.listing.currency || 'USD'})
              <input
                name="finalRent"
                required
                inputMode="decimal"
                defaultValue={progressMap[feesFor.listing.id]?.agreedRent ?? String(feesFor.listing.askingRent ?? '')}
                className={inputClass}
              />
            </label>
            <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
              <label className="block min-w-0 space-y-1.5 text-sm font-semibold text-slate-700">
                Lease start
                <input
                  name="leaseStartDate"
                  type="date"
                  required
                  className={dateInputClass}
                />
              </label>
              <label className="block min-w-0 space-y-1.5 text-sm font-semibold text-slate-700">
                Lease end (optional)
                <input name="leaseEndDate" type="date" className={dateInputClass} />
                <span className="mt-1 block text-xs font-normal leading-snug text-slate-500">
                  Leave blank for an open-ended lease.
                </span>
              </label>
            </div>
            {feesFor.listing.rentableSpace?.property?.serviceIntent === 'RENTAL_BROKERAGE' ? <label className="block space-y-1.5 text-sm font-semibold text-slate-700">Owner commission<input name="ownerCommission" required inputMode="decimal" className={inputClass} /><input name="ownerCommissionMethod" type="hidden" value="PERCENT" /></label> : null}
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">Tenant brokerage fee {feesFor.listing.rentableSpace?.property?.serviceIntent === 'RENTAL_BROKERAGE' ? '' : '(optional)'}<input name="tenantCommission" required={feesFor.listing.rentableSpace?.property?.serviceIntent === 'RENTAL_BROKERAGE'} inputMode="decimal" className={inputClass} /><input name="tenantCommissionMethod" type="hidden" value="PERCENT" /></label>
          </form>
        </WorkspaceFormDrawer>
      ) : null}
    </section>
  );
}
