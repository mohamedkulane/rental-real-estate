'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fragment, useMemo, useState, type FormEvent } from 'react';
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
  isInterestedViewingOutcome,
  isNotInterestedViewingOutcome,
  viewingInterestLabel,
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
  propertyId?: string | null;
  rentableSpaceId?: string | null;
  selectedRentableSpaceId?: string | null;
  rentalListing?: { id: string; listingNumber: string; title: string; rentableSpaceId?: string } | null;
  property?: { id: string; propertyCode: string; name: string } | null;
  rentableSpace?: { id: string; spaceCode: string; name: string; propertyId: string } | null;
  selectedRentableSpace?: { id: string; spaceCode: string; name: string; propertyId: string } | null;
};

type PropertyMatchGroup = {
  propertyId: string;
  property: NonNullable<NonNullable<MatchItem['listing']['rentableSpace']>['property']>;
  units: MatchItem[];
  score: number;
  minRent: number | null;
  maxRent: number | null;
  currency: string;
};

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/15';

/** Equal-height date fields; constrains oversized native calendar icons (esp. Windows). */
const dateInputClass =
  'box-border h-11 w-full min-h-[2.75rem] max-h-11 rounded-lg border border-slate-200 px-3 py-0 text-sm leading-none shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:w-4 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70';

function formText(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
}

const STEP_LABELS: Record<Exclude<PlacementStep, 'declined'>, string> = {
  viewing: '1. Viewing',
  agreement: '2. Agreement',
  lease: '3. Lease',
};

function groupMatches(items: MatchItem[]): PropertyMatchGroup[] {
  const groups = new Map<string, PropertyMatchGroup>();
  for (const item of items) {
    const property = item.listing.rentableSpace?.property;
    if (!property) continue;
    const rent = Number(item.listing.askingRent);
    const current = groups.get(property.id);
    if (current) {
      current.units.push(item);
      current.score = Math.max(current.score, item.score);
      if (Number.isFinite(rent)) {
        current.minRent = current.minRent == null ? rent : Math.min(current.minRent, rent);
        current.maxRent = current.maxRent == null ? rent : Math.max(current.maxRent, rent);
      }
      continue;
    }
    groups.set(property.id, {
      propertyId: property.id,
      property,
      units: [item],
      score: item.score,
      minRent: Number.isFinite(rent) ? rent : null,
      maxRent: Number.isFinite(rent) ? rent : null,
      currency: item.listing.currency || 'USD',
    });
  }
  return [...groups.values()].sort(
    (left, right) => right.score - left.score || left.property.name.localeCompare(right.property.name),
  );
}

function PipelineSteps({ active }: { active: PlacementStep }) {
  if (active === 'declined') {
    return <p className="mt-2 text-xs font-semibold text-slate-500">Not interested — try another unit</p>;
  }
  const order: Array<Exclude<PlacementStep, 'declined'>> = [
    'viewing',
    'agreement',
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
  const [viewingFor, setViewingFor] = useState<PropertyMatchGroup | null>(null);
  const [completeFor, setCompleteFor] = useState<{
    group: PropertyMatchGroup;
    viewing: ViewingRow;
  } | null>(null);
  const [expandedProperties, setExpandedProperties] = useState<Set<string>>(() => new Set());
  const [assignedAgentId, setAssignedAgentId] = useState(
    () => lead.currentAssignee?.id ?? '',
  );
  const [feesFor, setFeesFor] = useState<MatchItem | null>(null);

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

  const viewingByKey = useMemo(() => {
    const map = new Map<string, ViewingRow>();
    for (const row of viewings.data?.items ?? []) {
      const keys = [
        row.rentalListingId,
        row.rentalListing?.id,
        row.rentableSpaceId,
        row.rentableSpace?.id,
        row.rentalListing?.rentableSpaceId,
        row.propertyId,
        row.property?.id,
        row.selectedRentableSpaceId,
        row.selectedRentableSpace?.id,
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
    onSuccess: () => {
      toast.success('Viewing scheduled.');
      setViewingFor(null);
      void queryClient.invalidateQueries({ queryKey: ['rental-customer-viewings', lead.id] });
    },
    onError: (cause) => toast.error(userFacingError(cause)),
  });

  const completeViewing = useMutation({
    mutationFn: async ({
      row,
      selectedRentableSpaceId,
    }: {
      row: ViewingRow;
      selectedRentableSpaceId: string;
    }) => {
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
            selectedRentableSpaceId,
          }),
        });
      }
      return current;
    },
    onSuccess: () => {
      toast.success('Viewing completed as interested. Confirm the agreement next.');
      setCompleteFor(null);
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
      return api<ViewingRow>(`/viewings/${current.id}/transition`, {
        method: 'POST',
        body: JSON.stringify({
          status: 'COMPLETED',
          expectedVersion: current.version,
          reason: 'Customer is not interested in this property',
          outcome: 'NOT_INTERESTED',
        }),
      });
    },
    onSuccess: () => {
      toast('Marked not interested. Match another unit.');
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
  const groups = groupMatches(items);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Matching Properties</h2>
          <p className="mt-1 text-sm text-slate-600">
            Schedule a viewing first. If the customer is interested, confirm the agreement and then
            create the lease. If not, try another unit.
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
              {groups.map((group) => {
                const { property } = group;
                const location = [property.city, property.district].filter(Boolean).join(', ');
                const viewing =
                  viewingByKey.get(group.propertyId) ??
                  group.units
                    .flatMap((item) => [item.listing.id, item.listing.rentableSpace?.id])
                    .map((key) => (key ? viewingByKey.get(key) : undefined))
                    .find(Boolean);
                const step = nextPlacementStep({
                  viewingStatus: viewing?.status ?? null,
                  viewingOutcome: viewing?.outcome ?? null,
                });
                const selectedItem = group.units.find(
                  (item) =>
                    item.listing.rentableSpace?.id ===
                    (viewing?.selectedRentableSpaceId ?? viewing?.selectedRentableSpace?.id),
                );
                const expanded = expandedProperties.has(group.propertyId);
                const rentLabel =
                  group.minRent == null
                    ? 'Rent not set'
                    : group.minRent === group.maxRent
                      ? `${group.currency} ${group.minRent}`
                      : `${group.currency} ${group.minRent} - ${group.maxRent}`;
                return (
                  <Fragment key={group.propertyId}>
                    <tr
                      className={`border-b border-slate-100 text-sm ${step === 'declined' ? 'bg-slate-50/70' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{property.name}</p>
                        <p className="text-slate-500">
                          {group.units.length} available {group.units.length === 1 ? 'unit' : 'units'}
                        </p>
                        {selectedItem ? (
                          <p className="mt-1 text-xs font-medium text-emerald-700">
                            Selected: {selectedItem.listing.rentableSpace?.name}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">{rentLabel}</td>
                      <td className="px-4 py-3">{location || '—'}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#215E61]">{group.score}% Match</p>
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
                          <TableActionButton
                            tone="neutral"
                            onClick={() =>
                              setExpandedProperties((current) => {
                                const next = new Set(current);
                                if (next.has(group.propertyId)) next.delete(group.propertyId);
                                else next.add(group.propertyId);
                                return next;
                              })
                            }
                          >
                            {expanded ? 'Hide Units' : 'View Units'}
                          </TableActionButton>
                          <TableActionButton
                            tone="view"
                            href={`/rental/properties/${group.propertyId}`}
                          >
                            View Property
                          </TableActionButton>
                          {hasPermission(principal, 'viewing.create') &&
                          step === 'viewing' &&
                          !viewing ? (
                            <TableActionButton
                              tone="schedule"
                              onClick={() => {
                                setAssignedAgentId(lead.currentAssignee?.id ?? '');
                                setViewingFor(group);
                              }}
                            >
                              Schedule Viewing
                            </TableActionButton>
                          ) : null}
                          {hasPermission(principal, 'viewing.complete') &&
                          viewing &&
                          (viewing.status === 'SCHEDULED' || viewing.status === 'CONFIRMED') ? (
                            <>
                              <TableActionButton
                                tone="edit"
                                onClick={() => setCompleteFor({ group, viewing })}
                              >
                                Complete Viewing
                              </TableActionButton>
                              <TableActionButton
                                tone="neutral"
                                disabled={declineViewing.isPending}
                                onClick={() => declineViewing.mutate(viewing)}
                              >
                                Not interested
                              </TableActionButton>
                            </>
                          ) : null}
                          {step === 'agreement' && selectedItem ? (
                            <TableActionButton
                              tone="agreement"
                              onClick={() => setFeesFor(selectedItem)}
                            >
                              Confirm Agreement
                            </TableActionButton>
                          ) : null}
                        </TableActionGroup>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <td colSpan={5} className="px-4 py-3">
                          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                            {group.units.map((item) => (
                              <div
                                key={item.listing.rentableSpace?.id ?? item.listing.id}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                              >
                                <p className="font-semibold text-slate-900">
                                  {item.listing.rentableSpace?.name ?? item.listing.title}
                                </p>
                                <p className="mt-1 text-xs text-slate-600">
                                  {item.listing.askingRent == null || item.listing.askingRent === ''
                                    ? 'Rent not set'
                                    : `${item.listing.currency} ${String(item.listing.askingRent)}`}
                                  {' · '}Available
                                </p>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
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
          description={`Schedule one visit to ${viewingFor.property.name}. The customer can inspect all ${viewingFor.units.length} currently available units.`}
          onClose={() => setViewingFor(null)}
          size="md"
          layout="compact"
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
              scheduleViewing.mutate({
                leadId: lead.id,
                assignedEmployeeId: assignedAgentId,
                scheduledAt: formText(form, 'scheduledAt'),
                notes: formText(form, 'notes').trim() || undefined,
                propertyId: viewingFor.propertyId,
              });
            }}
          >
            <AsyncSelect
              label="Assigned agent"
              path={requestPath('/crm/selectors/employees', {
                purpose: 'VIEWING_ASSIGN',
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

      {completeFor ? (
        <WorkspaceFormDrawer
          open
          eyebrow="Viewing outcome"
          title="Customer is interested"
          description={`Choose the unit selected during the visit to ${completeFor.group.property.name}. Availability is checked again when you save.`}
          onClose={() => setCompleteFor(null)}
          size="md"
          layout="compact"
          footer={
            <WorkspaceFormDrawerFooter
              formId="complete-rental-viewing"
              onCancel={() => setCompleteFor(null)}
              submitLabel="Save selected unit"
              loadingLabel="Checking availability…"
              isPending={completeViewing.isPending}
            />
          }
        >
          <form
            id="complete-rental-viewing"
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const selectedRentableSpaceId = formText(
                new FormData(event.currentTarget),
                'selectedRentableSpaceId',
              );
              if (!selectedRentableSpaceId) {
                toast.error('Choose the unit the customer selected.');
                return;
              }
              completeViewing.mutate({
                row: completeFor.viewing,
                selectedRentableSpaceId,
              });
            }}
          >
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
              Customer is interested in
              <select
                name="selectedRentableSpaceId"
                required
                defaultValue={
                  completeFor.group.units.length === 1
                    ? completeFor.group.units[0]?.listing.rentableSpace?.id
                    : ''
                }
                className={inputClass}
              >
                <option value="">Choose available unit</option>
                {completeFor.group.units.map((item) => (
                  <option
                    key={item.listing.rentableSpace?.id ?? item.listing.id}
                    value={item.listing.rentableSpace?.id ?? ''}
                  >
                    {item.listing.rentableSpace?.name ?? item.listing.title}
                    {item.listing.askingRent == null || item.listing.askingRent === ''
                      ? ''
                      : ` · ${item.listing.currency} ${String(item.listing.askingRent)}`}
                  </option>
                ))}
              </select>
            </label>
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              The agreement and lease will use this exact unit. The system will never switch it
              silently.
            </p>
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
              const viewing = space?.property?.id
                ? (viewingByKey.get(space.property.id) ?? viewingByKey.get(space.id))
                : undefined;
              if (!space?.property?.id || !viewing?.id) {
                toast.error('A completed viewing and property are required.');
                return;
              }
              const ownerCommission = formText(form, 'ownerCommission').trim();
              const tenantCommission = formText(form, 'tenantCommission').trim();
              confirmAgreement.mutate({
                viewing,
                body: {
                  leadId: lead.id,
                  propertyId: space.property.id,
                  rentableSpaceId: space.id,
                  viewingId: viewing.id,
                  finalRent: formText(form, 'finalRent').trim(),
                  leaseStartDate: formText(form, 'leaseStartDate').trim(),
                  ...(formText(form, 'leaseEndDate').trim()
                    ? { leaseEndDate: formText(form, 'leaseEndDate').trim() }
                    : {}),
                  ...(space.property.serviceIntent === 'RENTAL_BROKERAGE'
                    ? {
                        ownerCommission: {
                          method: formText(form, 'ownerCommissionMethod') || 'PERCENT',
                          value: ownerCommission,
                        },
                        tenantCommission: {
                          method: formText(form, 'tenantCommissionMethod') || 'PERCENT',
                          value: tenantCommission,
                        },
                      }
                    : tenantCommission
                      ? {
                          tenantCommission: {
                            method: formText(form, 'tenantCommissionMethod') || 'FIXED',
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
                defaultValue={String(feesFor.listing.askingRent ?? '')}
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
            {feesFor.listing.rentableSpace?.property?.serviceIntent === 'RENTAL_BROKERAGE' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block min-w-0 space-y-1.5 text-sm font-semibold text-slate-700">
                  Owner commission
                  <div className="grid grid-cols-[minmax(0,1fr)_118px] gap-2">
                    <input name="ownerCommission" required inputMode="decimal" className={inputClass} placeholder="40" />
                    <select name="ownerCommissionMethod" defaultValue="FIXED" className={inputClass} aria-label="Owner commission method">
                      <option value="FIXED">Fixed USD</option>
                      <option value="PERCENT">Percent</option>
                    </select>
                  </div>
                  <span className="block text-xs font-normal text-slate-500">Choose Fixed USD for an agreed amount such as USD 40.</span>
                </label>
                <label className="block min-w-0 space-y-1.5 text-sm font-semibold text-slate-700">
                  Tenant commission
                  <div className="grid grid-cols-[minmax(0,1fr)_118px] gap-2">
                    <input name="tenantCommission" required inputMode="decimal" className={inputClass} placeholder="35" />
                    <select name="tenantCommissionMethod" defaultValue="FIXED" className={inputClass} aria-label="Tenant commission method">
                      <option value="FIXED">Fixed USD</option>
                      <option value="PERCENT">Percent</option>
                    </select>
                  </div>
                  <span className="block text-xs font-normal text-slate-500">Fixed USD keeps the agreed tenant fee separate from monthly rent.</span>
                </label>
              </div>
            ) : (
              <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                Tenant brokerage fee (optional)
                <div className="grid grid-cols-[minmax(0,1fr)_118px] gap-2">
                  <input name="tenantCommission" inputMode="decimal" className={inputClass} />
                  <select name="tenantCommissionMethod" defaultValue="FIXED" className={inputClass} aria-label="Tenant brokerage fee method">
                    <option value="FIXED">Fixed USD</option>
                    <option value="PERCENT">Percent</option>
                  </select>
                </div>
              </label>
            )}
          </form>
        </WorkspaceFormDrawer>
      ) : null}
    </section>
  );
}
