'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiError, api, type Principal } from '@/lib/phase3-api';
import { humanize } from '@/lib/presentation';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '@/components/shared/ui';
import { CrmShell, useCrmPrincipal } from './crm-shell';
import { AccessDenied } from './crm-shared';
import { can, canReadChild, crmError, PagedResults, requestPath, useCrmPage } from './crm-data';
import { legalStageActions, stageActionLabel } from './crm-model';
import { PreferenceSummary } from './crm-preferences';
import {
  ActivityCommand,
  FollowUpCommand,
  PartyCommand,
  ResponsibilityCommand,
  StageCommand,
} from './lead-commands';
import { FollowUpCards } from './follow-ups-workspace';
import { LeadMatches } from './lead-matches';
import type {
  ActivityRecord,
  AssignmentRecord,
  FollowUpRecord,
  HistoryRecord,
  LeadDetail,
} from './crm-types';

function ActivityTimeline({ lead, principal }: { lead: LeadDetail; principal: Principal }) {
  const [type, setType] = useState('');
  const [direction, setDirection] = useState('');
  const query = useCrmPage<ActivityRecord>(
    requestPath(`/crm/leads/${lead.id}/activities`, { type, direction }),
    true,
  );
  const [edit, setEdit] = useState<{ record?: ActivityRecord; voidRecord?: boolean } | null>(null);
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg">Activity timeline</h2>
        {can(principal, 'crm.activity.create', lead.responsibleBranch.id) ? (
          <button className="button primary" onClick={() => setEdit({})}>
            Add Activity
          </button>
        ) : null}
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <label>
          Type
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">All activity types</option>
            {['CALL', 'EMAIL', 'MESSAGE', 'MEETING', 'NOTE', 'OTHER'].map((value) => (
              <option key={value} value={value}>
                {humanize(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Direction
          <select value={direction} onChange={(event) => setDirection(event.target.value)}>
            <option value="">All directions</option>
            {['INBOUND', 'OUTBOUND', 'INTERNAL'].map((value) => (
              <option key={value} value={value}>
                {humanize(value)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <PagedResults<ActivityRecord>
        query={query}
        filtered={Boolean(type || direction)}
        empty="Record the first factual interaction or note."
      >
        {(items) => (
          <div className="space-y-3">
            {items.map((item) => (
              <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <StatusBadge
                      value={item.recordKind === 'ORIGINAL' ? item.type : item.recordKind}
                    />
                    <h3 className="mt-2 text-base">{item.summary}</h3>
                    <p className="text-xs text-slate-500">
                      {humanize(item.direction)} · {new Date(item.occurredAt).toLocaleString()}
                    </p>
                  </div>
                  {can(principal, 'crm.activity.correct', lead.responsibleBranch.id) &&
                  item.recordKind !== 'VOID' ? (
                    <div className="flex gap-2">
                      <button
                        className="button secondary"
                        onClick={() => setEdit({ record: item })}
                      >
                        Correct
                      </button>
                      <button
                        className="button secondary"
                        onClick={() => setEdit({ record: item, voidRecord: true })}
                      >
                        Void
                      </button>
                    </div>
                  ) : null}
                </div>
                {item.notes ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{item.notes}</p>
                ) : null}
                {item.correctionReason ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Correction reason: {item.correctionReason}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </PagedResults>
      {edit ? <ActivityCommand leadId={lead.id} {...edit} onClose={() => setEdit(null)} /> : null}
    </section>
  );
}
function LeadFollowUps({ lead, principal }: { lead: LeadDetail; principal: Principal }) {
  const query = useCrmPage<FollowUpRecord>(`/crm/leads/${lead.id}/follow-ups`);
  const [create, setCreate] = useState(false);
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg">Lead Follow-ups</h2>
        {can(principal, 'crm.followup.create', lead.responsibleBranch.id) &&
        !['CONVERTED', 'LOST'].includes(lead.stage) ? (
          <button className="button primary" onClick={() => setCreate(true)}>
            Schedule Follow-up
          </button>
        ) : null}
      </div>
      <PagedResults<FollowUpRecord> query={query} empty="Schedule the next action for this Lead.">
        {(items) => (
          <FollowUpCards
            items={items}
            principal={principal}
            currentBranchId={lead.responsibleBranch.id}
          />
        )}
      </PagedResults>
      {create ? (
        <FollowUpCommand leadId={lead.id} action="create" onClose={() => setCreate(false)} />
      ) : null}
    </section>
  );
}
function Assignments({ leadId }: { leadId: string }) {
  const query = useCrmPage<AssignmentRecord>(`/crm/leads/${leadId}/assignments`);
  return (
    <PagedResults<AssignmentRecord>
      query={query}
      empty="Assignment history appears after a Lead is assigned."
    >
      {(items) => (
        <div className="space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-base">{item.employee.displayName}</h3>
              <p className="mt-1 text-sm text-slate-600">
                {new Date(item.assignedFrom).toLocaleString()} →{' '}
                {item.assignedTo
                  ? new Date(item.assignedTo).toLocaleString()
                  : 'Current assignment'}
              </p>
              <p className="mt-2 text-sm text-slate-500">{item.reason}</p>
            </article>
          ))}
        </div>
      )}
    </PagedResults>
  );
}
function History({ leadId }: { leadId: string }) {
  const query = useCrmPage<HistoryRecord>(`/crm/leads/${leadId}/history`);
  return (
    <PagedResults<HistoryRecord>
      query={query}
      empty="Stage, intent and Branch history appears as the Lead changes."
    >
      {(items) => (
        <div className="space-y-3">
          {items.map((item) => (
            <article
              key={`${item.kind}-${item.id}`}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <h3 className="text-base">
                {item.kind === 'STAGE'
                  ? `${humanize(item.fromStage ?? 'Created')} → ${humanize(item.toStage)}`
                  : item.kind === 'INTENT'
                    ? `${humanize(item.fromIntent ?? 'Initial intent')} → ${humanize(item.toIntent)}`
                    : 'Branch responsibility recorded'}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {new Date(item.occurredAt).toLocaleString()}
                {item.kind === 'BRANCH'
                  ? item.assignedTo
                    ? ` · Ended ${new Date(item.assignedTo).toLocaleString()}`
                    : ' · Current interval'
                  : ''}
              </p>
              <p className="mt-2 text-sm text-slate-600">{item.reason}</p>
            </article>
          ))}
        </div>
      )}
    </PagedResults>
  );
}
export function LeadDetailWorkspace({ leadId }: { leadId: string }) {
  const { principal, error } = useCrmPrincipal();
  const [tab, setTab] = useState('summary');
  const [action, setAction] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['crm', `/crm/leads/${leadId}`],
    enabled: Boolean(principal && can(principal, 'crm.lead.read')),
    retry: false,
    queryFn: () => api<LeadDetail>(`/crm/leads/${leadId}`),
  });
  const lead = query.data;
  const branch = lead?.responsibleBranch.id;
  const tabs =
    principal && lead
      ? [
          'summary',
          ...(canReadChild(principal, 'crm.activity.read', branch!) ? ['activity'] : []),
          ...(canReadChild(principal, 'crm.followup.read', branch!) ? ['follow-ups'] : []),
          ...(canReadChild(principal, 'crm.assignment.read', branch!) ? ['assignment'] : []),
          ...(can(principal, 'listing.match', branch) &&
          (lead.intent === 'RENT' || lead.intent === 'BUY')
            ? ['matches']
            : []),
          'history',
        ]
      : [];
  return (
    <CrmShell principal={principal} principalError={error} activeItem="crm:leads">
      {principal && !can(principal, 'crm.lead.read') ? (
        <AccessDenied />
      ) : query.isPending ? (
        <LoadingState label="Loading Lead detail" />
      ) : query.isError ? (
        query.error instanceof ApiError && query.error.status === 404 ? (
          <EmptyState
            title="Lead not found"
            description="This Lead is missing or outside your authorized Company scope."
            action={
              <Link href="/crm/leads" className="button secondary">
                Lead Register
              </Link>
            }
          />
        ) : (
          <ErrorState message={crmError(query.error)} onRetry={() => void query.refetch()} />
        )
      ) : principal && lead ? (
        <>
          <Link href="/crm/leads" className="mb-4 inline-block text-sm font-bold text-blue-700">
            ← Lead Register
          </Link>
          <PageHeader
            eyebrow={lead.leadNumber}
            title={lead.displayName}
            description={`${humanize(lead.intent)} · ${lead.responsibleBranch.name}`}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={lead.stage} />
                <button
                  className="button secondary"
                  disabled={query.isFetching}
                  onClick={() => void query.refetch()}
                >
                  Refresh
                </button>
                {can(principal, 'crm.lead.update', branch) ? (
                  <Link className="button primary" href={`/crm/leads/${lead.id}/edit`}>
                    Edit Lead
                  </Link>
                ) : null}
              </div>
            }
          />
          <section className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-bold">Lead actions</h2>
            <div className="flex flex-wrap gap-2">
              {can(principal, 'crm.lead.stage', branch)
                ? legalStageActions(lead.stage, lead.intent).map((verb) => (
                    <button key={verb} className="button secondary" onClick={() => setAction(verb)}>
                      {stageActionLabel(verb)}
                    </button>
                  ))
                : null}
              {can(principal, 'crm.activity.create', branch) ? (
                <button className="button secondary" onClick={() => setAction('activity')}>
                  Add Activity
                </button>
              ) : null}
              {can(principal, 'crm.followup.create', branch) &&
              !['CONVERTED', 'LOST'].includes(lead.stage) ? (
                <button className="button secondary" onClick={() => setAction('follow-up')}>
                  Schedule Follow-up
                </button>
              ) : null}
              {can(principal, 'crm.assignment.manage', branch) ? (
                <>
                  <button
                    className="button secondary"
                    onClick={() => setAction(lead.currentAssignee ? 'reassign' : 'assign')}
                  >
                    {lead.currentAssignee ? 'Reassign' : 'Assign'}
                  </button>
                  {lead.currentAssignee &&
                  !['QUALIFIED', 'MATCHING', 'NURTURING'].includes(lead.stage) ? (
                    <button className="button secondary" onClick={() => setAction('unassign')}>
                      Unassign
                    </button>
                  ) : null}
                </>
              ) : null}
              {can(principal, 'crm.lead.branch.transfer', branch) ? (
                <button className="button secondary" onClick={() => setAction('branch-transfer')}>
                  Transfer Branch
                </button>
              ) : null}
            </div>
          </section>
          <nav
            className="mb-5 flex overflow-x-auto border-b border-slate-200"
            aria-label="Lead detail sections"
          >
            {tabs.map((item) => (
              <button
                key={item}
                className={`min-h-11 whitespace-nowrap border-b-2 px-4 text-sm font-bold ${item === tab ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}
                aria-current={item === tab ? 'page' : undefined}
                onClick={() => setTab(item)}
              >
                {humanize(item)}
              </button>
            ))}
          </nav>
          {tab === 'summary' ? (
            <div className="grid gap-5 lg:grid-cols-3">
              <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
                <h2 className="mb-4 text-lg">Requirements and preferences</h2>
                <PreferenceSummary intent={lead.intent} preference={lead.preference} />
                <div className="mt-5">
                  <h3 className="mb-3 font-bold">Listing matches</h3>
                  <LeadMatches lead={lead} principal={principal} />
                </div>
                {lead.property || lead.rentableSpace ? (
                  <p className="mt-4 text-sm">
                    Intake asset: <strong>{(lead.rentableSpace ?? lead.property)!.name}</strong>
                  </p>
                ) : null}
                {lead.outcomeSummary || lead.lostReason ? (
                  <section className="mt-5 border-t border-slate-200 pt-4">
                    <h3 className="font-bold">Terminal outcome</h3>
                    <p className="mt-2 text-sm">
                      {lead.outcomeSummary ?? humanize(lead.lostReason)}
                    </p>
                    {lead.lostNotes ? <p className="mt-2 text-sm">{lead.lostNotes}</p> : null}
                    {lead.externalReference ? (
                      <p className="mt-2 text-xs">External reference: {lead.externalReference}</p>
                    ) : null}
                  </section>
                ) : null}
              </section>
              <aside className="space-y-4">
                <section className="rounded-xl border border-slate-200 bg-white p-5">
                  <h2 className="text-base">Contact snapshot</h2>
                  <p className="mt-3 break-words text-sm">
                    {lead.contact?.phone ?? lead.contact?.phoneMasked ?? 'Phone not provided'}
                  </p>
                  <p className="mt-2 break-words text-sm">
                    {lead.contact?.email ?? lead.contact?.emailMasked ?? 'Email not provided'}
                  </p>
                  <p className="mt-3 text-xs text-slate-500">
                    Protected contact is revealed only with separate authorization and audit.
                  </p>
                </section>
                <section className="rounded-xl border border-slate-200 bg-white p-5">
                  <h2 className="text-base">Responsibility and Source</h2>
                  <p className="mt-3 text-sm">
                    {lead.currentAssignee?.displayName ?? 'Unassigned'}
                  </p>
                  <p className="mt-2 text-sm">{lead.responsibleBranch.name}</p>
                  <p className="mt-2 text-sm">
                    {lead.source.label}
                    {lead.source.status === 'INACTIVE' ? ' (Inactive)' : ''}
                  </p>
                </section>
                <section className="rounded-xl border border-slate-200 bg-white p-5">
                  <h2 className="text-base">Canonical Party</h2>
                  <p className="my-3 text-sm">
                    {lead.party?.displayName ?? 'No independently readable Party linked'}
                  </p>
                  {can(principal, 'crm.lead.update', branch) && can(principal, 'party.read') ? (
                    <button className="button secondary" onClick={() => setAction('party-link')}>
                      Link Party
                    </button>
                  ) : null}
                  {lead.party && can(principal, 'crm.lead.update', branch) ? (
                    <button className="button secondary" onClick={() => setAction('party-unlink')}>
                      Unlink Party
                    </button>
                  ) : null}
                </section>
              </aside>
            </div>
          ) : null}
          {tab === 'activity' && tabs.includes(tab) ? (
            <ActivityTimeline lead={lead} principal={principal} />
          ) : null}
          {tab === 'follow-ups' && tabs.includes(tab) ? (
            <LeadFollowUps lead={lead} principal={principal} />
          ) : null}
          {tab === 'assignment' && tabs.includes(tab) ? <Assignments leadId={lead.id} /> : null}
          {tab === 'matches' && tabs.includes(tab) ? (
            <section>
              <h2 className="mb-4 text-lg">Deterministic listing matches</h2>
              <LeadMatches lead={lead} principal={principal} />
            </section>
          ) : null}
          {tab === 'history' ? <History leadId={lead.id} /> : null}
          {action && legalStageActions(lead.stage, lead.intent).includes(action) ? (
            <StageCommand
              lead={lead}
              action={action}
              principal={principal}
              onClose={() => setAction(null)}
            />
          ) : null}
          {action === 'activity' ? (
            <ActivityCommand leadId={lead.id} onClose={() => setAction(null)} />
          ) : null}
          {action === 'follow-up' ? (
            <FollowUpCommand leadId={lead.id} action="create" onClose={() => setAction(null)} />
          ) : null}
          {action === 'assign' ||
          action === 'reassign' ||
          action === 'unassign' ||
          action === 'branch-transfer' ? (
            <ResponsibilityCommand lead={lead} action={action} onClose={() => setAction(null)} />
          ) : null}
          {action === 'party-link' || action === 'party-unlink' ? (
            <PartyCommand
              lead={lead}
              unlink={action === 'party-unlink'}
              onClose={() => setAction(null)}
            />
          ) : null}
        </>
      ) : null}
    </CrmShell>
  );
}
