'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  ArrowUpRight,
  CalendarCheck2,
  CalendarDays,
  Check,
  CircleAlert,
  Clock3,
  Handshake,
  KeyRound,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react';
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
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  icon: LucideIcon;
  tone: 'blue' | 'green' | 'amber' | 'red';
}) {
  return (
    <div className={`viewing-kpi viewing-kpi-${tone}`}>
      <span className="viewing-kpi-icon">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
      <ArrowUpRight className="viewing-kpi-arrow h-4 w-4" aria-hidden="true" />
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
  const resetFilters = () => {
    setSearch('');
    setIntent('');
    setPeriod('ALL');
    setStatus('');
    setAgentId('');
    setFrom('');
    setTo('');
  };
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
      <div className="viewings-hero">
        <PageHeader
          eyebrow="Operations"
          title="Viewings"
          description="Keep rental and sales appointments, outcomes, and next actions in one operational register."
          action={
            <Link className="button primary" href="/rental/customers">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Open rental customers
            </Link>
          }
        />
      </div>
      {!canRead ? (
        <p className="mt-6 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
          You cannot read viewings with your current access.
        </p>
      ) : null}
      {canRead ? (
        <>
          <section className="viewings-kpis mt-6">
            <SummaryCard label="Today" value={summary.today} hint="Viewings scheduled today" icon={CalendarDays} tone="blue" />
            <SummaryCard label="Upcoming" value={summary.upcoming} hint="Next scheduled viewings" icon={Clock3} tone="green" />
            <SummaryCard label="Interested" value={summary.interested} hint="Customers interested" icon={Handshake} tone="amber" />
            <SummaryCard label="Needs outcome" value={summary.needsOutcome} hint="Viewings pending result" icon={CircleAlert} tone="red" />
          </section>
          <DataTableSurface className="mt-6">
            <DataTableToolbar
              footer={
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" className="button ghost text-[13px]" onClick={resetFilters}>
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Reset
                  </button>
                  <button type="button" className="button primary text-[13px]" onClick={() => void query.refetch()}>
                    <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                    Filter
                  </button>
                </div>
              }
            >
              <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2">
                <div className="min-w-[240px] flex-1">
                  <DataTableSearch
                    value={search}
                    onChange={setSearch}
                    placeholder="Search customer, buyer, property, or unit..."
                  />
                </div>
                <DataTableFilter
                  label="Type"
                  value={intent}
                  onChange={setIntent}
                  className="w-full sm:w-36"
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
                  className="w-full sm:w-36"
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
                  className="w-full sm:w-36"
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
                  className="w-full sm:w-40"
                  options={[
                    { value: '', label: 'All agents' },
                    ...agents.map((agent) => ({
                      value: agent.id,
                      label: agent.party?.displayName ?? agent.employeeNumber,
                    })),
                  ]}
                />
                <label className="block w-full sm:w-36 text-[12px] font-semibold text-slate-500">
                  From
                  <input
                    type="date"
                    value={from}
                    onChange={(event) => setFrom(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/15"
                  />
                </label>
                <label className="block w-full sm:w-36 text-[12px] font-semibold text-slate-500">
                  To
                  <input
                    type="date"
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/15"
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
                            <span className="inline-flex items-center gap-1.5">
                              <CalendarDays className="h-3.5 w-3.5 text-[var(--primary)]" aria-hidden="true" />
                              {formatDate(row.scheduledAt)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span className="inline-flex items-center gap-1.5">
                              <Clock3 className="h-3.5 w-3.5 text-[var(--primary)]" aria-hidden="true" />
                              {new Date(row.scheduledAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-start gap-2">
                              <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" aria-hidden="true" />
                              <div>
                                <p className="font-semibold text-slate-900">{row.lead?.displayName ?? '-'}</p>
                                <p className="text-xs text-slate-500">{row.lead?.leadNumber}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-start gap-1.5">
                              <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--primary)]" aria-hidden="true" />
                              {targetLabel(row)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--primary-soft)] px-2 py-1 text-xs font-medium text-[var(--primary)]">
                              {row.lead?.intent === 'BUY' ? (
                                <Handshake className="h-3.5 w-3.5" aria-hidden="true" />
                              ) : (
                                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                              )}
                              {row.lead?.intent === 'BUY' ? 'Buy' : 'Rent'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5">
                              <UserRound className="h-3.5 w-3.5 text-[var(--primary)]" aria-hidden="true" />
                              {row.assignedEmployee?.party?.displayName ??
                                row.assignedEmployee?.employeeNumber ??
                                '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge value={outcome ?? humanize(row.status)} />
                          </td>
                          <td className="px-4 py-3">
                            <TableActionGroup>
                              {personHref ? (
                                <TableActionButton
                                  tone="open"
                                  href={personHref}
                                  icon={UserRound}
                                  className="w-8 justify-center px-0 [&>span]:sr-only"
                                  title={`Open ${row.lead?.intent === 'BUY' ? 'buyer' : 'customer'}`}
                                  aria-label={`Open ${row.lead?.intent === 'BUY' ? 'buyer' : 'customer'}`}
                                >
                                  Open {row.lead?.intent === 'BUY' ? 'buyer' : 'customer'}
                                </TableActionButton>
                              ) : null}
                              {propertyHref(row) ? (
                                <TableActionButton
                                  tone="property"
                                  href={propertyHref(row)!}
                                  className="w-8 justify-center px-0 [&>span]:sr-only"
                                  title="Open property"
                                  aria-label="Open property"
                                >
                                  Open property
                                </TableActionButton>
                              ) : null}
                              {canComplete && row.status === 'SCHEDULED' ? (
                                <TableActionButton
                                  tone="manage"
                                  disabled={transition.isPending}
                                  icon={CalendarCheck2}
                                  onClick={() =>
                                    transition.mutate({ row, nextStatus: 'CONFIRMED' })
                                  }
                                >
                                  Confirm
                                </TableActionButton>
                              ) : null}
                              {needsInterestChoice ? (
                                <>
                                  <TableActionButton
                                    tone="manage"
                                    disabled={transition.isPending}
                                    icon={Check}
                                    onClick={() =>
                                      transition.mutate({
                                        row,
                                        nextStatus: 'COMPLETED',
                                        outcome: 'INTERESTED',
                                      })
                                    }
                                  >
                                    Interested
                                  </TableActionButton>
                                  <TableActionButton
                                    tone="danger"
                                    disabled={transition.isPending}
                                    icon={X}
                                    onClick={() =>
                                      transition.mutate({
                                        row,
                                        nextStatus: 'COMPLETED',
                                        outcome: 'NOT_INTERESTED',
                                      })
                                    }
                                  >
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
