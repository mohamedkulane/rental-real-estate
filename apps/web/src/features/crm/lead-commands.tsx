'use client';
import { useState } from 'react';
import { humanize } from '@/lib/presentation';
import { type Principal } from '@/lib/phase3-api';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/ui';
import { CursorPaginationControls } from '@/components/shared/pagination';
import {
  AsyncSelect,
  canReadChild,
  CommandDialog,
  crmError,
  EnumField,
  formText,
  ReasonField,
  requestPath,
  useCrmPage,
} from './crm-data';
import { stageActionLabel } from './crm-model';
import type { ActivityRecord, FollowUpRecord, LeadDetail } from './crm-types';

export const lostReasons = [
  'DUPLICATE',
  'UNREACHABLE',
  'NOT_QUALIFIED',
  'NO_LONGER_INTERESTED',
  'WRONG_INTENT',
  'OUT_OF_SCOPE',
  'OTHER',
] as const;
export function stageBody(
  action: string,
  form: FormData,
  expectedVersion: number,
  reference: string,
) {
  const body: Record<string, unknown> = { expectedVersion };
  const reason = formText(form, 'reason');
  if (!['lost', 'converted'].includes(action) && reason) body.reason = reason;
  if (action === 'contacted') {
    if (!reference) throw new Error('Choose a completed contact Activity.');
    body.activityId = reference;
  }
  if (action === 'nurturing') {
    if (!reference) throw new Error('Choose the next open Follow-up.');
    body.followUpId = reference;
  }
  if (action === 'matching') body.readinessLabel = formText(form, 'readinessLabel');
  if (action === 'converted') {
    body.outcomeSummary = formText(form, 'outcomeSummary');
    if (formText(form, 'externalReference'))
      body.externalReference = formText(form, 'externalReference');
  }
  if (action === 'lost') {
    body.lostReason = formText(form, 'lostReason');
    if (formText(form, 'lostNotes')) body.lostNotes = formText(form, 'lostNotes');
    if (body.lostReason === 'OTHER' && !body.lostNotes)
      throw new Error('Explain the Other lost reason in Notes.');
  }
  return body;
}

function StageReference({
  leadId,
  action,
  value,
  onChange,
  allowed,
}: {
  leadId: string;
  action: 'contacted' | 'nurturing';
  value: string;
  onChange: (value: string) => void;
  allowed: boolean;
}) {
  const query = useCrmPage<ActivityRecord | FollowUpRecord>(
    `/crm/leads/${leadId}/${action === 'contacted' ? 'activities' : 'follow-ups?state=OPEN'}`,
    allowed,
  );
  if (!allowed)
    return (
      <p role="alert" className="text-sm text-amber-800">
        This action needs a readable {action === 'contacted' ? 'Activity' : 'Follow-up'} reference.
        Ask for the relevant collection read permission.
      </p>
    );
  if (query.isPending) return <LoadingState compact label="Loading available references" />;
  if (query.isError)
    return <ErrorState message={crmError(query.error)} onRetry={() => void query.refetch()} />;
  const items = query.data.items.filter(
    (item) =>
      action !== 'contacted' ||
      ('type' in item &&
        ['CALL', 'EMAIL', 'MESSAGE', 'MEETING'].includes(item.type) &&
        item.recordKind !== 'VOID'),
  );
  return (
    <fieldset>
      <legend className="mb-2 font-semibold">
        {action === 'contacted' ? 'Completed contact Activity' : 'Next open Follow-up'}
      </legend>
      {items.length ? (
        <div className="max-h-60 space-y-2 overflow-y-auto">
          {items.map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3"
            >
              <input
                type="radio"
                name="reference"
                value={item.id}
                checked={value === item.id}
                onChange={() => onChange(item.id)}
                required
              />
              <span>
                <span className="block">{'summary' in item ? item.summary : item.subject}</span>
                <span className="text-xs font-normal text-slate-500">
                  {new Date('occurredAt' in item ? item.occurredAt : item.dueAt).toLocaleString()}
                </span>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No eligible reference on this page"
          description="Check another page, or add the required Activity or open Follow-up first."
        />
      )}
      <CursorPaginationControls {...query.controls} />
    </fieldset>
  );
}

export function StageCommand({
  lead,
  action,
  principal,
  onClose,
}: {
  lead: LeadDetail;
  action: string;
  principal: Principal;
  onClose: () => void;
}) {
  const [reference, setReference] = useState('');
  return (
    <CommandDialog
      title={stageActionLabel(action)}
      path={`/crm/leads/${lead.id}/${action}`}
      description={
        ['lost', 'converted'].includes(action)
          ? 'This closes the Lead and cancels every open Follow-up. No later-phase deal, lease, agreement, or project is created.'
          : action === 'qualified'
            ? 'Qualification requires an assignee and the intent-specific required preferences. The server checks the current Lead version and Branch permission.'
            : action === 'matching'
              ? 'This records readiness only; it does not run matching or create candidates. The server checks the current Lead version and prerequisites.'
              : action === 'nurturing'
                ? 'Choose an open Follow-up that already records the next step. The server checks the current Lead version and Branch permission.'
                : 'The server checks this Lead version, your current Branch permission, and every transition prerequisite.'
      }
      build={(form) => stageBody(action, form, lead.version, reference)}
      onClose={onClose}
      danger={action === 'lost'}
    >
      {action === 'contacted' || action === 'nurturing' ? (
        <StageReference
          leadId={lead.id}
          action={action}
          value={reference}
          onChange={setReference}
          allowed={canReadChild(
            principal,
            action === 'contacted' ? 'crm.activity.read' : 'crm.followup.read',
            lead.responsibleBranch.id,
          )}
        />
      ) : null}
      {action === 'matching' ? (
        <label>
          Readiness note
          <input name="readinessLabel" required maxLength={120} />
          <span className="mt-1 block text-xs font-normal text-slate-500">
            This only records readiness. Matching has not run and no candidates are created.
          </span>
        </label>
      ) : null}
      {action === 'converted' ? (
        <>
          <label>
            Outcome / handoff summary
            <textarea name="outcomeSummary" minLength={3} maxLength={1000} required rows={3} />
          </label>
          <label>
            External reference (optional)
            <input name="externalReference" maxLength={160} />
          </label>
        </>
      ) : action === 'lost' ? (
        <>
          <EnumField label="Lost reason" name="lostReason" values={lostReasons} required />
          <label>
            Notes (required for Other)
            <textarea name="lostNotes" rows={3} maxLength={500} />
          </label>
        </>
      ) : action === 'nurturing' ? (
        <ReasonField />
      ) : (
        <label>
          Reason (optional)
          <textarea name="reason" maxLength={500} rows={3} />
        </label>
      )}
    </CommandDialog>
  );
}

const localDateTime = (value: string) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
export function ActivityCommand({
  leadId,
  record,
  voidRecord = false,
  onClose,
}: {
  leadId: string;
  record?: ActivityRecord;
  voidRecord?: boolean;
  onClose: () => void;
}) {
  const title = voidRecord ? 'Void Activity' : record ? 'Correct Activity' : 'Add Activity';
  return (
    <CommandDialog
      title={title}
      description="Activities are append-only. Corrections and voids append history; the original record is preserved."
      path={`/crm/leads/${leadId}/activities${record ? `/${record.id}/${voidRecord ? 'void' : 'correction'}` : ''}`}
      onClose={onClose}
      danger={voidRecord}
      build={(form) => {
        if (voidRecord) return { reason: formText(form, 'reason') };
        const occurredAt = new Date(formText(form, 'occurredAt'));
        if (!Number.isFinite(occurredAt.getTime()) || occurredAt.getTime() > Date.now())
          throw new Error('Activity time must be valid and must not be in the future.');
        return {
          type: formText(form, 'type'),
          direction: formText(form, 'direction'),
          summary: formText(form, 'summary'),
          ...(formText(form, 'notes') ? { notes: formText(form, 'notes') } : {}),
          occurredAt: occurredAt.toISOString(),
          ...(record ? { reason: formText(form, 'reason') } : {}),
        };
      }}
    >
      {!voidRecord ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <EnumField
              label="Activity type"
              name="type"
              values={['CALL', 'EMAIL', 'MESSAGE', 'MEETING', 'NOTE', 'OTHER']}
              value={record?.type}
              required
            />
            <EnumField
              label="Direction"
              name="direction"
              values={['INBOUND', 'OUTBOUND', 'INTERNAL']}
              value={record?.direction ?? ''}
              required
            />
          </div>
          <label>
            Summary
            <input name="summary" required maxLength={500} defaultValue={record?.summary} />
          </label>
          <label>
            Details
            <textarea name="notes" rows={3} maxLength={2000} defaultValue={record?.notes ?? ''} />
          </label>
          <label>
            Occurred at
            <input
              name="occurredAt"
              type="datetime-local"
              required
              defaultValue={record ? localDateTime(record.occurredAt) : undefined}
            />
          </label>
        </>
      ) : (
        <p className="text-sm">Void “{record?.summary}”?</p>
      )}
      {record ? <ReasonField /> : null}
    </CommandDialog>
  );
}

export type FollowUpAction = 'create' | 'update' | 'complete' | 'cancel' | 'successor';
export function followUpBody(
  action: FollowUpAction,
  form: FormData,
  employeeId: string,
  record?: FollowUpRecord,
): Record<string, unknown> {
  if (action === 'complete' || action === 'cancel')
    return { expectedVersion: record!.version, reason: formText(form, 'reason') };
  const body: Record<string, unknown> = {
    subject: formText(form, 'subject'),
    dueAt: new Date(formText(form, 'dueAt')).toISOString(),
    ...(formText(form, 'notes') ? { notes: formText(form, 'notes') } : {}),
  };
  if (action === 'update')
    return { ...body, expectedVersion: record!.version, reason: formText(form, 'reason') };
  if (!employeeId) throw new Error('Choose the responsible employee.');
  body.responsibleEmployeeId = employeeId;
  if (action === 'successor') body.predecessorFollowUpId = record!.id;
  return body;
}
export function FollowUpCommand({
  leadId,
  action,
  record,
  onClose,
  onSuccess,
}: {
  leadId: string;
  action: FollowUpAction;
  record?: FollowUpRecord;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [employeeId, setEmployeeId] = useState('');
  const creating = action === 'create' || action === 'successor';
  const outcome = action === 'cancel' || action === 'complete';
  const title =
    action === 'create'
      ? 'Schedule Follow-up'
      : action === 'successor'
        ? 'Create linked successor'
        : action === 'update'
          ? 'Reschedule Follow-up'
          : `${humanize(action)} Follow-up`;
  return (
    <CommandDialog
      title={title}
      description={
        action === 'successor'
          ? 'Create the eligible successor FIRST. This does not cancel the predecessor. After creation, review and explicitly cancel the old task; Nurturing must retain an open next task.'
          : outcome
            ? `Confirm ${action === 'complete' ? 'completion' : 'cancellation'} of “${record?.subject}”. Closed tasks never reopen.`
            : 'Follow-up employee and historical Branch are immutable. Use a linked successor to change responsibility.'
      }
      path={`/crm/leads/${leadId}/follow-ups${creating ? '' : `/${record!.id}${outcome ? `/${action}` : ''}`}`}
      method={action === 'update' ? 'PATCH' : 'POST'}
      build={(form) => followUpBody(action, form, employeeId, record)}
      onClose={onClose}
      onSuccess={onSuccess}
      danger={action === 'cancel'}
    >
      {!outcome ? (
        <>
          <label>
            Subject
            <input name="subject" required maxLength={300} defaultValue={record?.subject} />
          </label>
          <label>
            Due at
            <input
              name="dueAt"
              type="datetime-local"
              required
              defaultValue={record ? localDateTime(record.dueAt) : undefined}
            />
          </label>
          <label>
            Notes
            <textarea name="notes" rows={3} maxLength={2000} defaultValue={record?.notes ?? ''} />
          </label>
          {creating ? (
            <AsyncSelect
              label="Responsible employee"
              path={requestPath('/crm/selectors/employees', {
                purpose: 'CREATE_FOLLOW_UP',
                leadId,
              })}
              value={employeeId}
              onChange={setEmployeeId}
              required
            />
          ) : (
            <p className="text-sm text-slate-600">
              Responsible employee: {record?.responsibleEmployee.displayName} (historical
              attribution retained)
            </p>
          )}
        </>
      ) : null}
      {!creating ? <ReasonField /> : null}
    </CommandDialog>
  );
}

export function ResponsibilityCommand({
  lead,
  action,
  onClose,
}: {
  lead: LeadDetail;
  action: 'assign' | 'reassign' | 'unassign' | 'branch-transfer';
  onClose: () => void;
}) {
  const [employeeId, setEmployeeId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [transferChoice, setTransferChoice] = useState('retain');
  const transfer = action === 'branch-transfer';
  return (
    <CommandDialog
      title={transfer ? 'Transfer Branch' : `${humanize(action)} Lead`}
      description="This reasoned, version-checked action preserves responsibility history. A Branch transfer requires authority over both Branches."
      path={`/crm/leads/${lead.id}/${action}`}
      onClose={onClose}
      build={(form) => {
        const body: Record<string, unknown> = {
          expectedVersion: lead.version,
          reason: formText(form, 'reason'),
        };
        if (transfer) {
          if (!branchId) throw new Error('Choose the destination Branch.');
          body.destinationBranchId = branchId;
          if (transferChoice === 'clear') body.clearAssignee = true;
          if (transferChoice === 'replace') {
            if (!employeeId) throw new Error('Choose the replacement employee.');
            body.replacementEmployeeId = employeeId;
          }
        } else if (action !== 'unassign') {
          if (!employeeId) throw new Error('Choose an employee.');
          body.employeeId = employeeId;
        }
        return body;
      }}
    >
      {transfer ? (
        <>
          <AsyncSelect
            label="Destination Branch"
            path={requestPath('/crm/selectors/branches', {
              purpose: 'TRANSFER_LEAD',
              leadId: lead.id,
            })}
            value={branchId}
            onChange={(value) => {
              setBranchId(value);
              setEmployeeId('');
            }}
            required
          />
          <label>
            Assignee decision
            <select
              value={transferChoice}
              onChange={(event) => {
                setTransferChoice(event.target.value);
                setEmployeeId('');
              }}
            >
              <option value="retain">Retain current assignee if eligible</option>
              <option value="replace">Replace with eligible employee</option>
              {!['QUALIFIED', 'MATCHING', 'NURTURING'].includes(lead.stage) ? (
                <option value="clear">Explicitly clear assignment</option>
              ) : null}
            </select>
          </label>
        </>
      ) : null}
      {action === 'assign' ||
      action === 'reassign' ||
      (transfer && transferChoice === 'replace') ? (
        <AsyncSelect
          key={branchId}
          label="Employee"
          path={requestPath(
            '/crm/selectors/employees',
            transfer
              ? { purpose: 'TRANSFER_REPLACEMENT', leadId: lead.id, destinationBranchId: branchId }
              : { purpose: action === 'assign' ? 'ASSIGN_LEAD' : 'REASSIGN_LEAD', leadId: lead.id },
          )}
          disabled={transfer && !branchId}
          value={employeeId}
          onChange={setEmployeeId}
          required
        />
      ) : null}
      <ReasonField />
    </CommandDialog>
  );
}

export function PartyCommand({
  lead,
  unlink = false,
  onClose,
}: {
  lead: LeadDetail;
  unlink?: boolean;
  onClose: () => void;
}) {
  const [partyId, setPartyId] = useState('');
  return (
    <CommandDialog
      title={unlink ? 'Unlink Party' : 'Link existing Party'}
      description="Lead contact snapshots are preserved. This action never merges or overwrites canonical Party data."
      path={`/crm/leads/${lead.id}/party-${unlink ? 'unlink' : 'link'}`}
      onClose={onClose}
      build={(form) => {
        if (!unlink && !partyId) throw new Error('Choose an existing Party.');
        return {
          expectedVersion: lead.version,
          reason: formText(form, 'reason'),
          ...(!unlink ? { partyId } : {}),
        };
      }}
    >
      {!unlink ? (
        <AsyncSelect
          label="Existing Party"
          path={requestPath('/crm/selectors/parties', { purpose: 'UPDATE_LEAD', leadId: lead.id })}
          value={partyId}
          onChange={setPartyId}
          required
        />
      ) : null}
      <ReasonField />
    </CommandDialog>
  );
}
