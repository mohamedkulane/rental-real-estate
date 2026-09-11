'use client';
import { useState } from 'react';
import { hasCompanyPermission } from '@/lib/phase3-api';
import { PageHeader, StatusBadge } from '@/components/shared/ui';
import { CrmShell, useCrmPrincipal } from './crm-shell';
import { AccessDenied } from './crm-shared';
import {
  CommandDialog,
  formText,
  PagedResults,
  ReasonField,
  requestPath,
  useCrmPage,
  useUrlFilters,
} from './crm-data';
import type { LeadSourceRecord } from './crm-types';

export function sourceBody(form: FormData, source?: LeadSourceRecord): Record<string, unknown> {
  return {
    ...(source
      ? { expectedVersion: source.version }
      : { code: formText(form, 'code').toUpperCase() }),
    label: formText(form, 'label'),
    ...(formText(form, 'description')
      ? { description: formText(form, 'description') }
      : source
        ? { description: null }
        : {}),
    sortOrder: Number(formText(form, 'sortOrder') || '0'),
  };
}
export function LeadSourcesWorkspace() {
  const { principal, error } = useCrmPrincipal();
  const { params, set, clear } = useUrlFilters();
  const [command, setCommand] = useState<{
    kind: 'create' | 'edit' | 'deactivate' | 'reactivate';
    source?: LeadSourceRecord;
  } | null>(null);
  const allowed = Boolean(principal && hasCompanyPermission(principal, 'crm.source.manage'));
  const query = useCrmPage<LeadSourceRecord>(
    requestPath('/crm/lead-sources', {
      search: params.get('search') ?? '',
      status: params.get('status') ?? '',
    }),
    allowed,
  );
  const lifecycle = command?.kind === 'deactivate' || command?.kind === 'reactivate';
  return (
    <CrmShell principal={principal} principalError={error} activeItem="crm:sources">
      <PageHeader
        eyebrow="CRM administration"
        title="Lead Sources"
        description="Company-wide attribution categories. Inactive Sources remain attached to historical Leads."
        action={
          allowed ? (
            <button className="button primary" onClick={() => setCommand({ kind: 'create' })}>
              Create Source
            </button>
          ) : undefined
        }
      />
      {principal && !allowed ? (
        <AccessDenied description="Lead Source management needs an explicit Company Wide grant." />
      ) : (
        <>
          <section className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                set({ search: formText(new FormData(event.currentTarget), 'search') });
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
                  placeholder="Source code or label"
                />
              </label>
              <label>
                Status
                <select
                  value={params.get('status') ?? ''}
                  onChange={(event) => set({ status: event.target.value })}
                >
                  <option value="">All statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </label>
              <button className="button primary">Search</button>
              <button type="button" className="button secondary" onClick={clear}>
                Clear filters
              </button>
            </form>
          </section>
          <PagedResults<LeadSourceRecord>
            query={query}
            filtered={Boolean(params.size)}
            empty="Create a Lead Source before staff start intake."
          >
            {(items) => (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {items.map((source) => (
                  <article
                    key={source.id}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex justify-between gap-3">
                      <div>
                        <h2 className="text-base">{source.label}</h2>
                        <p className="text-xs text-slate-500">{source.code}</p>
                      </div>
                      <StatusBadge value={source.status} />
                    </div>
                    <p className="mt-3 text-sm text-slate-600">
                      {source.description || 'No description'}
                    </p>
                    <p className="mt-3 text-xs text-slate-500">
                      {source.usageCount.toLocaleString()} historical Leads · Display order{' '}
                      {source.sortOrder}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        className="button secondary"
                        onClick={() => setCommand({ kind: 'edit', source })}
                      >
                        Edit
                      </button>
                      <button
                        className="button secondary"
                        onClick={() =>
                          setCommand({
                            kind: source.status === 'ACTIVE' ? 'deactivate' : 'reactivate',
                            source,
                          })
                        }
                      >
                        {source.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </PagedResults>
        </>
      )}
      {command ? (
        <CommandDialog
          title={
            command.kind === 'create'
              ? 'Create Source'
              : command.kind === 'edit'
                ? 'Save Source'
                : command.kind === 'deactivate'
                  ? 'Deactivate Source'
                  : 'Reactivate Source'
          }
          description={
            lifecycle
              ? 'This changes availability for new intake, not historical attribution. Existing Lead Sources are never deleted or repurposed.'
              : 'The code is permanent. Labels, descriptions and ordering can be maintained.'
          }
          path={`/crm/lead-sources${command.source ? `/${command.source.id}${lifecycle ? `/${command.kind}` : ''}` : ''}`}
          method={command.kind === 'edit' ? 'PATCH' : 'POST'}
          onClose={() => setCommand(null)}
          danger={command.kind === 'deactivate'}
          build={(form) =>
            lifecycle
              ? { expectedVersion: command.source!.version, reason: formText(form, 'reason') }
              : sourceBody(form, command.source)
          }
        >
          {lifecycle ? (
            <>
              <p className="font-semibold">{command.source?.label}</p>
              <ReasonField />
            </>
          ) : (
            <>
              {command.kind === 'create' ? (
                <label>
                  Permanent Source code
                  <input
                    name="code"
                    required
                    minLength={2}
                    maxLength={50}
                    pattern="[A-Za-z][A-Za-z0-9_]{1,49}"
                  />
                  <span className="mt-1 block text-xs font-normal text-slate-500">
                    Letters, numbers and underscores. Stored in uppercase.
                  </span>
                </label>
              ) : (
                <p className="text-sm">
                  Permanent code: <strong>{command.source?.code}</strong>
                </p>
              )}
              <label>
                Display label
                <input name="label" required maxLength={120} defaultValue={command.source?.label} />
              </label>
              <label>
                Description
                <textarea
                  name="description"
                  rows={3}
                  maxLength={500}
                  defaultValue={command.source?.description ?? ''}
                />
              </label>
              <label>
                Display order
                <input
                  name="sortOrder"
                  type="number"
                  required
                  min={0}
                  max={1000000}
                  step={1}
                  defaultValue={command.source?.sortOrder ?? 0}
                />
              </label>
            </>
          )}
        </CommandDialog>
      ) : null}
    </CrmShell>
  );
}
