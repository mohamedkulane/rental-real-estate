'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck2, Check, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  DataTableEmpty,
  DataTableFilter,
  DataTableSearch,
  DataTableSurface,
  DataTableToolbar,
  TableActionButton,
  TableActionGroup,
} from '@/components/shared/data-table';
import { TableSkeleton } from '@/components/shared/loading-system';
import { PageHeader, StatusBadge } from '@/components/shared/ui';
import { api, hasPermission, type CursorPage, userFacingError } from '@/lib/phase3-api';
import { formatDate, humanize } from '@/lib/presentation';
import toast from '@/lib/toast';
import { RentalShell, useRentalPrincipal } from './rental-shell';
import {
  isInterestedViewingOutcome,
  viewingInterestLabel,
} from './rental-placement';

type ViewingRow = {
  id: string;
  version: number;
  status: string;
  outcome?: string | null;
  scheduledAt: string;
  lead?: { id: string; leadNumber: string; displayName: string; intent?: string } | null;
  rentableSpace?: {
    id: string;
    spaceCode: string;
    name: string;
    propertyId?: string;
    property?: { id: string; name: string } | null;
  } | null;
  rentalListing?: { id: string; title: string; listingNumber: string } | null;
  saleListing?: {
    id: string;
    title: string;
    listingNumber: string;
    property?: { id: string; name: string } | null;
  } | null;
  assignedEmployee?: {
    id: string;
    employeeNumber: string;
    party?: { displayName: string } | null;
  } | null;
};
type Period = 'ALL' | 'TODAY' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED';

function dayRange(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}
function targetLabel(row: ViewingRow) {
  if (row.rentableSpace)
    return `${row.rentableSpace.property?.name ? `${row.rentableSpace.property.name} - ` : ''}${row.rentableSpace.spaceCode} - ${row.rentableSpace.name}`;
  return row.rentalListing?.title ?? row.saleListing?.title ?? 'Property not available';
}
function propertyHref(row: ViewingRow) {
  const propertyId = row.rentableSpace?.propertyId ?? row.rentableSpace?.property?.id;
  if (propertyId) return `/portfolio/properties/${propertyId}`;
  return row.saleListing?.property?.id
    ? `/portfolio/properties/${row.saleListing.property.id}`
    : null;
}
function SummaryCard({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: number;
  tone?: 'slate' | 'teal' | 'amber' | 'red';
}) {
  const tones = {
    slate: 'border-slate-200 text-slate-900',
    teal: 'border-[#215E61]/30 text-[#215E61]',
    amber: 'border-amber-200 text-amber-800',
    red: 'border-red-200 text-red-700',
  };
  return (
    <div className={`rounded-lg border bg-white p-4 shadow-sm ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold leading-none">{value}</p>
    </div>
  );
}

export function CentralViewingsWorkspace() {
  const { principal, error } = useRentalPrincipal();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [intent, setIntent] = useState(() =>
    searchParams.get('intent') === 'BUY'
      ? 'BUY'
      : searchParams.get('intent') === 'RENT'
        ? 'RENT'
        : '',
  );
  const [period, setPeriod] = useState<Period>(() =>
    searchParams.get('period') === 'upcoming'
      ? 'UPCOMING'
      : searchParams.get('period') === 'today'
        ? 'TODAY'
        : 'ALL',
  );
  const [status, setStatus] = useState('');
  const [agentId, setAgentId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const canRead = Boolean(principal && hasPermission(principal, 'viewing.read'));
  const canComplete = Boolean(principal && hasPermission(principal, 'viewing.complete'));
  const query = useQuery({
    queryKey: ['central-viewings', search, intent, period, status, agentId, from, to],
    enabled: canRead,
    queryFn: () => {
      const params = new URLSearchParams({ limit: '100' });
      if (search.trim()) params.set('search', search.trim());
      if (intent) params.set('intent', intent);
      if (agentId) params.set('assignedEmployeeId', agentId);
      if (from) params.set('scheduledFrom', new Date(`${from}T00:00:00`).toISOString());
      if (to) params.set('scheduledTo', new Date(`${to}T23:59:59.999`).toISOString());
      if (period === 'COMPLETED') params.set('status', 'COMPLETED');
      else if (period === 'CANCELLED') params.set('status', 'CANCELLED');
      else if (status) params.set('status', status);
      const now = new Date();
      if (period === 'TODAY') {
        const range = dayRange(now);
        params.set('scheduledFrom', range.start.toISOString());
        params.set('scheduledTo', range.end.toISOString());
      }
      if (period === 'UPCOMING') {
        params.set('scheduledFrom', now.toISOString());
      }
      return api<CursorPage<ViewingRow>>(`/viewings?${params.toString()}`);
    },
  });
  const rows = query.data?.items ?? [];
  const agents = useMemo(
    () =>
      Array.from(
        new Map(
          rows
            .filter((row) => row.assignedEmployee)
            .map((row) => [row.assignedEmployee!.id, row.assignedEmployee!]),
        ).values(),
      ),
    [rows],
  );
  const today = dayRange(new Date());
  const summary = {
    today: rows.filter((row) => {
      const date = new Date(row.scheduledAt);
      return (
        date >= today.start &&
        date <= today.end &&
        !row.outcome?.toUpperCase().includes('NOT_INTERESTED')
      );
    }).length,
    upcoming: rows.filter(
      (row) =>
        new Date(row.scheduledAt) > new Date() &&
        ['SCHEDULED', 'CONFIRMED'].includes(row.status) &&
        !row.outcome?.toUpperCase().includes('NOT_INTERESTED'),
    ).length,
    interested: rows.filter((row) => isInterestedViewingOutcome(row.outcome)).length,
    needsOutcome: rows.filter(
      (row) =>
        row.status === 'CONFIRMED' ||
        (row.status === 'COMPLETED' && !viewingInterestLabel(row.outcome)),
    ).length,
  };
  const transition = useMutation({
    mutationFn: ({
      row,
      nextStatus,
      outcome,
    }: {
      row: ViewingRow;
      nextStatus: string;
      outcome?: string;
    }) =>
      api(`/viewings/${row.id}/transition`, {
        method: 'POST',
        body: JSON.stringify({
          status: nextStatus,
          expectedVersion: row.version,
          reason: outcome
            ? `Viewing recorded as ${humanize(outcome)}`
            : `Viewing marked ${humanize(nextStatus)}`,
          ...(outcome ? { outcome } : {}),
        }),
      }),
    onSuccess: (_, variables) => {
      toast.success(
        variables.outcome === 'INTERESTED'
          ? 'Interested outcome recorded. Continue from the customer or buyer workspace.'
          : 'Viewing updated.',
      );
      void queryClient.invalidateQueries({ queryKey: ['central-viewings'] });
    },
    onError: (cause) => toast.error(userFacingError(cause)),
  });
  return (
    <RentalShell principal={principal} principalError={error} activeItem="rental:viewings">
      <PageHeader
        eyebrow="Operations"
        title="Viewings"
        description="Rental and sales viewings in one operational register."
        action={
          <Link className="button secondary" href="/rental/customers">
            Open rental customers
          </Link>
        }
      />
      {!canRead ? (
        <p className="mt-6 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
          You cannot read viewings with your current access.
        </p>
      ) : null}
      {canRead ? (
        <>
          <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Today" value={summary.today} tone="teal" />
            <SummaryCard label="Upcoming" value={summary.upcoming} />
            <SummaryCard label="Interested" value={summary.interested} tone="amber" />
            <SummaryCard label="Needs Outcome" value={summary.needsOutcome} tone="red" />
          </section>
          <DataTableSurface className="mt-6">
            <DataTableToolbar>
              <DataTableSearch
                value={search}
                onChange={setSearch}
                placeholder="Search customer, buyer, property, unit, or lead number"
              />
              <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:grid-cols-4">
                <DataTableFilter
                  label="Type"
                  value={intent}
                  onChange={setIntent}
                  options={[
                    { value: '', label: 'All types' },
                    { value: 'RENT', label: 'Rental' },
                    { value: 'BUY', label: 'Sales' },
                  ]}
                />
                <DataTableFilter
                  label="Period"
                  value={period}
                  onChange={(value) => setPeriod(value as Period)}
                  options={[
                    { value: 'ALL', label: 'All viewings' },
                    { value: 'TODAY', label: 'Today' },
                    { value: 'UPCOMING', label: 'Upcoming' },
                    { value: 'COMPLETED', label: 'Completed' },
                    { value: 'CANCELLED', label: 'Cancelled' },
                  ]}
                />
                <DataTableFilter
                  label="Status"
                  value={status}
                  onChange={setStatus}
                  options={[
                    { value: '', label: 'All statuses' },
                    { value: 'SCHEDULED', label: 'Scheduled' },
                    { value: 'CONFIRMED', label: 'Confirmed' },
                    { value: 'NO_SHOW', label: 'No show' },
                  ]}
                />
                <DataTableFilter
                  label="Agent"
                  value={agentId}
                  onChange={setAgentId}
                  options={[
                    { value: '', label: 'All agents' },
                    ...agents.map((agent) => ({
                      value: agent.id,
                      label: agent.party?.displayName ?? agent.employeeNumber,
                    })),
                  ]}
                />
              </div>
              <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-[22rem]">
                <label className="block text-[12px] font-semibold text-slate-500">
                  From
                  <input
                    type="date"
                    value={from}
                    onChange={(event) => setFrom(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-[12px] font-semibold text-slate-500">
                  To
                  <input
                    type="date"
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>
            </DataTableToolbar>
            {query.isLoading ? <TableSkeleton columns={7} /> : null}
            {query.isError ? (
              <p className="p-4 text-sm text-red-700">{userFacingError(query.error)}</p>
            ) : null}
            {!query.isLoading && !query.isError && !rows.length ? (
              <DataTableEmpty
                title="No viewings match these filters"
                description="Schedule a viewing from a rental customer or buyer match."
              />
            ) : null}
            {rows.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-[940px] w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Customer / Buyer</th>
                      <th className="px-4 py-3">Property / Unit</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Agent</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const personHref =
                        row.lead?.intent === 'BUY'
                          ? `/sales/buyers/${row.lead.id}`
                          : row.lead?.id
                            ? `/rental/customers/${row.lead.id}`
                            : null;
                      const outcome = viewingInterestLabel(row.outcome);
                      const needsInterestChoice =
                        canComplete &&
                        (row.status === 'CONFIRMED' ||
                          (row.status === 'COMPLETED' && !outcome));
                      return (
                        <tr key={row.id} className="border-b border-slate-100 align-top">
                          <td className="whitespace-nowrap px-4 py-3">
                            {formatDate(row.scheduledAt)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            {new Date(row.scheduledAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900">
                              {row.lead?.displayName ?? '-'}
                            </p>
                            <p className="text-xs text-slate-500">{row.lead?.leadNumber}</p>
                          </td>
                          <td className="px-4 py-3">{targetLabel(row)}</td>
                          <td className="px-4 py-3">
                            {row.lead?.intent === 'BUY' ? 'Buy' : 'Rent'}
                          </td>
                          <td className="px-4 py-3">
                            {row.assignedEmployee?.party?.displayName ??
                              row.assignedEmployee?.employeeNumber ??
                              '-'}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge value={outcome ?? humanize(row.status)} />
                          </td>
                          <td className="px-4 py-3">
                            <TableActionGroup>
                              {personHref ? (
                                <TableActionButton tone="open" href={personHref}>
                                  Open {row.lead?.intent === 'BUY' ? 'buyer' : 'customer'}
                                </TableActionButton>
                              ) : null}
                              {propertyHref(row) ? (
                                <TableActionButton tone="open" href={propertyHref(row)!}>
                                  Open property
                                </TableActionButton>
                              ) : null}
                              {canComplete && row.status === 'SCHEDULED' ? (
                                <TableActionButton
                                  tone="manage"
                                  disabled={transition.isPending}
                                  onClick={() =>
                                    transition.mutate({ row, nextStatus: 'CONFIRMED' })
                                  }
                                >
                                  <CalendarCheck2 className="h-4 w-4" />
                                  Confirm
                                </TableActionButton>
                              ) : null}
                              {needsInterestChoice ? (
                                <>
                                  <TableActionButton
                                    tone="manage"
                                    disabled={transition.isPending}
                                    onClick={() =>
                                      transition.mutate({
                                        row,
                                        nextStatus: 'COMPLETED',
                                        outcome: 'INTERESTED',
                                      })
                                    }
                                  >
                                    <Check className="h-4 w-4" />
                                    Interested
                                  </TableActionButton>
                                  <TableActionButton
                                    tone="danger"
                                    disabled={transition.isPending}
                                    onClick={() =>
                                      transition.mutate({
                                        row,
                                        nextStatus: 'COMPLETED',
                                        outcome: 'NOT_INTERESTED',
                                      })
                                    }
                                  >
                                    <X className="h-4 w-4" />
                                    Not interested
                                  </TableActionButton>
                                </>
                              ) : null}
                            </TableActionGroup>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </DataTableSurface>
        </>
      ) : null}
    </RentalShell>
  );
}

export const RentalViewingsRegister = CentralViewingsWorkspace;
