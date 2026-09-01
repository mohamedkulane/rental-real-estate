'use client';

import Link from 'next/link';
import { AlertTriangle, Search } from 'lucide-react';
import { CursorPaginationControls } from '@/components/shared/pagination';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/shared/ui';
import { humanize } from '@/lib/presentation';
import type { LeadSummary } from './crm-types';
import type { WorkspaceState } from './crm-model';

export function CrmSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="relative block min-w-0 flex-1">
      <span className="sr-only">Search</span>
      <Search
        className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400"
        aria-hidden="true"
      />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full pl-9"
        type="search"
      />
    </label>
  );
}

export function AccessDenied({
  description = 'Your current access does not include this CRM workspace.',
}: {
  description?: string;
}) {
  return (
    <div className="state-card state-error" role="alert">
      <span className="state-icon">
        <AlertTriangle aria-hidden="true" />
      </span>
      <h3>CRM access required</h3>
      <p>{description} Ask an administrator to review your branch-scoped capabilities.</p>
    </div>
  );
}

export function WorkspaceBody({
  state,
  emptyTitle,
  emptyDescription,
  filteredDescription,
  error,
  retry,
  children,
}: {
  state: WorkspaceState;
  emptyTitle: string;
  emptyDescription: string;
  filteredDescription: string;
  error: string;
  retry: () => void;
  children: React.ReactNode;
}) {
  if (state === 'loading') return <LoadingState label={`Loading ${emptyTitle.toLowerCase()}`} />;
  if (state === 'error') return <ErrorState message={error} onRetry={retry} />;
  if (state === 'empty') return <EmptyState title={emptyTitle} description={emptyDescription} />;
  if (state === 'filtered-empty')
    return <EmptyState title="No matching records" description={filteredDescription} />;
  return children;
}

export function LeadCards({ items }: { items: LeadSummary[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((lead) => (
        <Link
          key={lead.id}
          href={`/crm/leads/${lead.id}`}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-blue-700">{lead.leadNumber}</p>
              <h3 className="truncate text-base font-bold">{lead.displayName}</h3>
            </div>
            <StatusBadge value={lead.stage} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs font-semibold text-slate-500">Intent</dt>
              <dd>{humanize(lead.intent)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500">Source</dt>
              <dd>
                {lead.source.label}
                {lead.source.status === 'INACTIVE' ? ' (Inactive)' : ''}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500">Assignee</dt>
              <dd>{lead.currentAssignee?.displayName ?? 'Unassigned'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500">Branch</dt>
              <dd>{lead.responsibleBranch.name}</dd>
            </div>
          </dl>
        </Link>
      ))}
    </div>
  );
}

export function CursorFooter(props: React.ComponentProps<typeof CursorPaginationControls>) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
      <CursorPaginationControls {...props} />
    </div>
  );
}
