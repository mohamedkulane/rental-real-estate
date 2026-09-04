'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { Principal } from '@/lib/phase3-api';
import { PageHeader, StatusBadge } from '@/components/shared/ui';
import { CrmShell, useCrmPrincipal } from './crm-shell';
import { AccessDenied } from './crm-shared';
import {
  AsyncSelect,
  can,
  formText,
  PagedResults,
  requestPath,
  useCrmPage,
  useUrlFilters,
} from './crm-data';
import { FollowUpCommand, type FollowUpAction } from './lead-commands';
import type { FollowUpRecord } from './crm-types';

export function dateTimeInputValue(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function FollowUpCards({
  items,
  principal,
  currentBranchId,
}: {
  items: FollowUpRecord[];
  principal: Principal;
  currentBranchId?: string;
}) {
  const [command, setCommand] = useState<{ action: FollowUpAction; item: FollowUpRecord } | null>(
    null,
  );
  const [successor, setSuccessor] = useState('');
  return (
    <>
      {successor ? (
        <p
          role="status"
          className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800"
        >
          Successor created for “{successor}”. The original is still open. Review the new task, then
          explicitly cancel the predecessor if appropriate.
        </p>
      ) : null}
      <div className="space-y-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge value={item.derivedStatus} />
                  <Link
                    className="text-sm font-bold text-blue-700"
                    href={`/crm/leads/${item.lead.id}`}
                  >
                    {item.lead.leadNumber} · {item.lead.displayName}
                  </Link>
                </div>
                <h3 className="mt-3 break-words text-base">{item.subject}</h3>
                <p className="mt-2 text-sm text-slate-600">
                  {item.responsibleEmployee.displayName} · Due{' '}
                  {new Date(item.dueAt).toLocaleString()}
                </p>
                {item.notes ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{item.notes}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-start gap-2">
                {item.state === 'OPEN' ? (
                  <>
                    {can(principal, 'crm.followup.complete', currentBranchId) ? (
                      <button
                        className="button primary"
                        onClick={() => setCommand({ item, action: 'complete' })}
                      >
                        Complete
                      </button>
                    ) : null}
                    {can(principal, 'crm.followup.update', currentBranchId) ? (
                      <button
                        className="button secondary"
                        onClick={() => setCommand({ item, action: 'update' })}
                      >
                        Reschedule
                      </button>
                    ) : null}
                    {can(principal, 'crm.followup.cancel', currentBranchId) ? (
                      <button
                        className="button secondary"
                        onClick={() => setCommand({ item, action: 'cancel' })}
                      >
                        Cancel
                      </button>
                    ) : null}
                  </>
                ) : null}
                {can(principal, 'crm.followup.create', currentBranchId) &&
                !['CONVERTED', 'LOST'].includes(item.lead.stage) ? (
                  <button
                    className="button secondary"
                    onClick={() => setCommand({ item, action: 'successor' })}
                  >
                    Linked successor
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
      {command ? (
        <FollowUpCommand
          leadId={command.item.lead.id}
          record={command.item}
          action={command.action}
          onClose={() => setCommand(null)}
          onSuccess={() => {
            if (command.action === 'successor') setSuccessor(command.item.subject);
          }}
        />
      ) : null}
    </>
  );
}
export function FollowUpsWorkspace() {
  const { principal, error } = useCrmPrincipal();
  const { params, set, clear } = useUrlFilters();
  const [open, setOpen] = useState(false);
  const allowed = Boolean(
    principal && can(principal, 'crm.lead.read') && can(principal, 'crm.followup.read'),
  );
  const path = requestPath('/crm/follow-ups', {
    search: params.get('search') ?? '',
    branchId: params.getAll('branchId'),
    derivedStatus: params.get('derivedStatus') ?? '',
    state: params.getAll('state'),
    dueFrom: params.get('dueFrom') ?? '',
    dueTo: params.get('dueTo') ?? '',
  });
  const query = useCrmPage<FollowUpRecord>(path, allowed);
  return (
    <CrmShell principal={principal} principalError={error} activeItem="crm:follow-ups">
      <PageHeader
        eyebrow="CRM workspace"
        title="Follow-ups"
        description="Future, overdue and completed tasks under the intersection of your Lead and Follow-up Branch access."
      />
      {principal && !allowed ? (
        <AccessDenied />
      ) : (
        <>
          <section className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                set({
                  search: formText(new FormData(event.currentTarget), 'search'),
                });
              }}
            >
              <label className="min-w-48 flex-1">
                Search
                <input
                  key={params.get('search')}
                  type="search"
                  name="search"
                  maxLength={120}
                  defaultValue={params.get('search') ?? ''}
                  placeholder="Lead or follow-up subject"
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
              <button type="button" className="button secondary" onClick={clear}>
                Clear filters
              </button>
            </form>
            {open ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <AsyncSelect
                  label="Branch"
                  path="/crm/selectors/branches?purpose=FOLLOW_UPS"
                  value={params.get('branchId') ?? ''}
                  onChange={(value) => set({ branchId: value })}
                />
                <label>
                  Due status
                  <select
                    value={params.get('derivedStatus') ?? ''}
                    onChange={(event) => set({ derivedStatus: event.target.value })}
                  >
                    <option value="">All due statuses</option>
                    <option value="OPEN">Open, not overdue</option>
                    <option value="OVERDUE">Overdue</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </label>
                <label>
                  Due from (inclusive)
                  <input
                    type="datetime-local"
                    value={dateTimeInputValue(params.get('dueFrom'))}
                    onChange={(event) =>
                      set({
                        dueFrom: event.target.value
                          ? new Date(event.target.value).toISOString()
                          : '',
                      })
                    }
                  />
                </label>
                <label>
                  Due before (exclusive)
                  <input
                    type="datetime-local"
                    value={dateTimeInputValue(params.get('dueTo'))}
                    onChange={(event) =>
                      set({
                        dueTo: event.target.value ? new Date(event.target.value).toISOString() : '',
                      })
                    }
                  />
                </label>
              </div>
            ) : null}
          </section>
          <PagedResults<FollowUpRecord>
            query={query}
            filtered={Boolean(params.size)}
            empty="Schedule future CRM work from a Lead detail page."
          >
            {(items) => <FollowUpCards items={items} principal={principal!} />}
          </PagedResults>
        </>
      )}
    </CrmShell>
  );
}
