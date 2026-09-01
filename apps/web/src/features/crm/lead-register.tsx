'use client';
import Link from 'next/link';
import { useState } from 'react';
import { PageHeader } from '@/components/shared/ui';
import type { Principal } from '@/lib/phase3-api';
import { humanize } from '@/lib/presentation';
import { CrmShell, useCrmPrincipal } from './crm-shell';
import { AccessDenied, LeadCards } from './crm-shared';
import {
  AsyncSelect,
  can,
  canReadChild,
  formText,
  PagedResults,
  requestPath,
  useCrmPage,
  useUrlFilters,
} from './crm-data';
import { leadIntents, leadStages, type LeadSummary } from './crm-types';

export function LeadFilters({
  purpose = 'LEAD_REGISTER',
  principal,
}: {
  purpose?: 'LEAD_REGISTER' | 'PIPELINE';
  principal: Principal | null;
}) {
  const { params, set, clear } = useUrlFilters();
  const [open, setOpen] = useState(false);
  return (
    <section className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          set({ search: formText(new FormData(event.currentTarget), 'search') });
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <label className="min-w-48 flex-1">
          Search
          <input
            key={params.get('search')}
            name="search"
            type="search"
            maxLength={120}
            defaultValue={params.get('search') ?? ''}
            placeholder="Lead number, name, Source or exact contact"
          />
        </label>
        <button className="button primary">Search</button>
        <button
          type="button"
          className="button secondary"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          Filters
        </button>
        {params.size ? (
          <button type="button" className="button secondary" onClick={clear}>
            Clear filters
          </button>
        ) : null}
      </form>
      {open ? (
        <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 xl:grid-cols-3">
          <label>
            Stage
            <select
              value={params.get('stage') ?? ''}
              onChange={(event) => set({ stage: event.target.value })}
            >
              <option value="">All stages</option>
              {leadStages.map((stage) => (
                <option key={stage} value={stage}>
                  {humanize(stage)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Intent
            <select
              value={params.get('intent') ?? ''}
              onChange={(event) => set({ intent: event.target.value })}
            >
              <option value="">All intents</option>
              {leadIntents.map((intent) => (
                <option key={intent.value} value={intent.value}>
                  {intent.label}
                </option>
              ))}
            </select>
          </label>
          <AsyncSelect
            label="Branch"
            path={requestPath('/crm/selectors/branches', { purpose })}
            value={params.get('branchId') ?? ''}
            onChange={(value) => set({ branchId: value, assigneeEmployeeId: '' })}
          />
          {principal && can(principal, 'crm.source.read') ? (
            <AsyncSelect
              label="Lead Source"
              path="/crm/lead-sources/options"
              value={params.get('sourceId') ?? ''}
              onChange={(value) => set({ sourceId: value })}
            />
          ) : null}
          {principal &&
          params.get('branchId') &&
          canReadChild(principal, 'crm.assignment.read', params.get('branchId')!) ? (
            <AsyncSelect
              label="Assignee"
              path={requestPath('/crm/selectors/employees', {
                purpose: 'ASSIGNMENT_READ',
                branchId: params.get('branchId')!,
              })}
              value={params.get('assigneeEmployeeId') ?? ''}
              onChange={(value) => set({ assigneeEmployeeId: value })}
            />
          ) : null}
          <label>
            Created from
            <input
              type="date"
              value={params.get('createdFrom') ?? ''}
              onChange={(event) => set({ createdFrom: event.target.value })}
            />
          </label>
          <label>
            Created before
            <input
              type="date"
              value={params.get('createdTo') ?? ''}
              onChange={(event) => set({ createdTo: event.target.value })}
            />
          </label>
          <p className="text-xs text-slate-500 sm:col-span-2">
            Dates include the start and exclude the end. Search and filters apply to the complete
            authorized dataset. Search also finds assignee names and historical Source labels.
          </p>
        </div>
      ) : null}
    </section>
  );
}
export function leadFilterValues(
  params:
    URLSearchParams | { getAll: (key: string) => string[]; get: (key: string) => string | null },
) {
  return {
    search: params.get('search') ?? '',
    stage: params.getAll('stage'),
    intent: params.getAll('intent'),
    branchId: params.getAll('branchId'),
    sourceId: params.getAll('sourceId'),
    assigneeEmployeeId: params.get('assigneeEmployeeId') ?? '',
    createdFrom: params.get('createdFrom') ?? '',
    createdTo: params.get('createdTo') ?? '',
  };
}
export function LeadRegister() {
  const { principal, error } = useCrmPrincipal();
  const { params } = useUrlFilters();
  const allowed = Boolean(principal && can(principal, 'crm.lead.read'));
  const query = useCrmPage<LeadSummary>(
    requestPath('/crm/leads', leadFilterValues(params)),
    allowed,
  );
  return (
    <CrmShell principal={principal} principalError={error} activeItem="crm:leads">
      <PageHeader
        eyebrow="CRM workspace"
        title="Lead Register"
        description="Customer enquiries, requirements and next steps across your authorized Branches."
        action={
          principal && can(principal, 'crm.lead.create') ? (
            <Link className="button primary" href="/crm/leads/new">
              Create Lead
            </Link>
          ) : undefined
        }
      />
      {principal && !allowed ? (
        <AccessDenied />
      ) : (
        <>
          <LeadFilters principal={principal} />
          <PagedResults<LeadSummary>
            query={query}
            filtered={Boolean(params.size)}
            empty="Create a Lead to record a customer enquiry."
          >
            {(items) => <LeadCards items={items} />}
          </PagedResults>
        </>
      )}
    </CrmShell>
  );
}
