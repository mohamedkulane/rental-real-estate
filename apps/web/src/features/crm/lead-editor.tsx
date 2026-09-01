'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, type Principal } from '@/lib/phase3-api';
import { ErrorState, LoadingState, PageHeader } from '@/components/shared/ui';
import { CrmShell, useCrmPrincipal } from './crm-shell';
import { AccessDenied } from './crm-shared';
import { AsyncSelect, can, crmError, formText, ReasonField, requestPath } from './crm-data';
import { PreferenceFields, preferenceValidation, readPreference } from './crm-preferences';
import { leadIntents, type LeadDetail, type LeadIntent, type MutationAck } from './crm-types';

function LeadEditor({ principal, lead }: { principal: Principal; lead?: LeadDetail }) {
  const router = useRouter();
  const client = useQueryClient();
  const [intent, setIntent] = useState<LeadIntent>(lead?.intent ?? 'RENT');
  const [branchId, setBranchId] = useState(lead?.responsibleBranch.id ?? '');
  const [sourceId, setSourceId] = useState(lead?.source.id ?? '');
  const [partyId, setPartyId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [replacePreferences, setReplacePreferences] = useState(!lead);
  const existingAsset = lead?.rentableSpace ?? lead?.property;
  const [assetChoice, setAssetChoice] = useState(lead ? (existingAsset ? 'keep' : '') : 'clear');
  const [assetId, setAssetId] = useState('');
  const [error, setError] = useState('');
  const correction = Boolean(lead && intent !== lead.intent);
  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<MutationAck>(
        lead ? `/crm/leads/${lead.id}${correction ? '/intent-correction' : ''}` : '/crm/leads',
        { method: lead && !correction ? 'PATCH' : 'POST', body: JSON.stringify(body) },
      ),
    onSuccess: (ack) => {
      void client.invalidateQueries({ queryKey: ['crm'] });
      toast.success(lead ? 'Lead changes saved.' : 'Lead created.');
      router.push(
        can(principal, 'crm.lead.read', branchId) ? `/crm/leads/${ack.id}` : '/crm/leads',
      );
    },
    onError: (cause) => setError(crmError(cause)),
  });
  const context = lead
    ? { purpose: 'UPDATE_LEAD', leadId: lead.id }
    : { purpose: 'CREATE_LEAD', branchId };
  const permitted = can(
    principal,
    lead ? 'crm.lead.update' : 'crm.lead.create',
    lead?.responsibleBranch.id,
  );
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mutation.isPending) return;
    setError('');
    const form = new FormData(event.currentTarget);
    if (!lead && !partyId && !formText(form, 'phone') && !formText(form, 'email')) {
      setError('Provide a phone number or email, or link an existing Party.');
      return;
    }
    const preferences = readPreference(intent, form);
    if (replacePreferences || correction) {
      if (!assetChoice || (assetChoice === 'replace' && !assetId)) {
        setError(
          'Explicitly retain, replace, or clear the asset context before replacing preferences.',
        );
        return;
      }
      const linked =
        assetChoice === 'keep' ? existingAsset?.id : assetChoice === 'replace' ? assetId : '';
      if (linked) preferences[intent === 'RENT' ? 'rentableSpaceId' : 'propertyId'] = linked;
      const problem = preferenceValidation(preferences);
      if (problem) {
        setError(problem);
        return;
      }
    }
    const body: Record<string, unknown> = lead
      ? { expectedVersion: lead.version, reason: formText(form, 'reason') }
      : {
          intent,
          responsibleBranchId: branchId,
          sourceId,
          displayName: formText(form, 'displayName'),
          preference: preferences,
          ...(partyId ? { partyId } : {}),
          ...(employeeId ? { currentAssigneeEmployeeId: employeeId } : {}),
        };
    if (correction) {
      body.intent = intent;
      body.preference = preferences;
    } else {
      body.displayName = formText(form, 'displayName');
      if (!lead || sourceId !== lead.source.id) body.sourceId = sourceId;
      for (const field of ['phone', 'email']) {
        if (form.get(`clear.${field}`) === 'on') body[field] = null;
        else if (formText(form, field)) body[field] = formText(form, field);
      }
      if (replacePreferences) body.preference = preferences;
    }
    mutation.mutate(body);
  };
  if (!permitted)
    return (
      <AccessDenied description="Lead maintenance is not available under your current Branch permissions." />
    );
  return (
    <form className="mx-auto max-w-4xl space-y-6" onSubmit={submit}>
      {error ? (
        <div role="alert" className="feedback feedback-error">
          {error}
        </div>
      ) : null}
      <fieldset disabled={mutation.isPending} className="space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-lg">Intake and responsibility</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              Intent
              <select
                value={intent}
                disabled={Boolean(lead && !['NEW', 'CONTACTED'].includes(lead.stage))}
                onChange={(event) => {
                  setIntent(event.target.value as LeadIntent);
                  setAssetChoice('');
                  setAssetId('');
                  setReplacePreferences(true);
                }}
              >
                {leadIntents.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            {!lead ? (
              <AsyncSelect
                label="Responsible Branch"
                path="/crm/selectors/branches?purpose=CREATE_LEAD"
                value={branchId}
                onChange={(value) => {
                  setBranchId(value);
                  setEmployeeId('');
                  setPartyId('');
                  setAssetId('');
                }}
                required
              />
            ) : (
              <p className="self-center text-sm">
                Responsible Branch: <strong>{lead.responsibleBranch.name}</strong>. Use the transfer
                action to change it.
              </p>
            )}
            {!correction ? (
              <>
                <label>
                  Lead name
                  <input
                    name="displayName"
                    defaultValue={lead?.displayName}
                    required
                    maxLength={240}
                  />
                </label>
                <AsyncSelect
                  label="Lead Source"
                  path="/crm/lead-sources/options"
                  value={sourceId}
                  onChange={setSourceId}
                  initial={lead?.source}
                  required
                />
                <label>
                  {lead ? 'Replace phone (blank keeps current)' : 'Phone'}
                  <input name="phone" type="tel" minLength={5} maxLength={80} />
                  {lead ? (
                    <span className="mt-1 block text-xs font-normal">
                      <input
                        type="checkbox"
                        name="clear.phone"
                        aria-label="Explicitly clear phone snapshot"
                      />{' '}
                      Explicitly clear phone snapshot
                    </span>
                  ) : null}
                </label>
                <label>
                  {lead ? 'Replace email (blank keeps current)' : 'Email'}
                  <input name="email" type="email" maxLength={254} />
                  {lead ? (
                    <span className="mt-1 block text-xs font-normal">
                      <input
                        type="checkbox"
                        name="clear.email"
                        aria-label="Explicitly clear email snapshot"
                      />{' '}
                      Explicitly clear email snapshot
                    </span>
                  ) : null}
                </label>
              </>
            ) : (
              <p className="sm:col-span-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
                Intent correction replaces the complete typed preferences. Save ordinary
                Lead/contact changes separately.
              </p>
            )}
            {!lead && can(principal, 'party.read') ? (
              <AsyncSelect
                label="Existing Party (optional)"
                path={requestPath('/crm/selectors/parties', context)}
                disabled={!branchId}
                value={partyId}
                onChange={setPartyId}
              />
            ) : null}
            {!lead && can(principal, 'crm.assignment.manage', branchId) ? (
              <AsyncSelect
                label="Initial assignee (optional)"
                path={requestPath('/crm/selectors/employees', {
                  purpose: 'INITIAL_ASSIGNMENT',
                  branchId,
                })}
                disabled={!branchId}
                value={employeeId}
                onChange={setEmployeeId}
              />
            ) : null}
          </div>
        </section>
        {lead && !correction ? (
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-4">
            <input
              type="checkbox"
              checked={replacePreferences}
              onChange={(event) => setReplacePreferences(event.target.checked)}
            />{' '}
            Replace typed preferences and review asset context
          </label>
        ) : null}
        {replacePreferences || correction ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <PreferenceFields
              key={intent}
              intent={intent}
              defaults={lead && !correction ? lead.preference : {}}
            />
            <div className="mt-5 border-t border-slate-200 pt-5">
              <label>
                Asset context decision
                <select
                  value={assetChoice}
                  onChange={(event) => {
                    setAssetChoice(event.target.value);
                    setAssetId('');
                  }}
                  required
                >
                  <option value="">Choose an explicit decision</option>
                  {existingAsset && !correction ? (
                    <option value="keep">Retain {existingAsset.name}</option>
                  ) : null}
                  <option value="replace">Choose an authorized asset</option>
                  <option value="clear">
                    {lead
                      ? 'Explicitly clear any existing asset link'
                      : 'No linked asset — intake only'}
                  </option>
                </select>
              </label>
              {lead && !existingAsset ? (
                <p className="mt-2 text-sm text-amber-800">
                  An absent asset summary can mean no link or a protected link. Preference
                  replacement is disabled until you explicitly choose a new asset or clear existing
                  context.
                </p>
              ) : null}
              {assetChoice === 'replace' ? (
                <AsyncSelect
                  key={`${intent}-${branchId}`}
                  label={intent === 'RENT' ? 'Rentable Space' : 'Property'}
                  path={requestPath(
                    `/crm/selectors/${intent === 'RENT' ? 'spaces' : 'properties'}`,
                    { ...context, intent },
                  )}
                  disabled={!branchId}
                  value={assetId}
                  onChange={setAssetId}
                  required
                />
              ) : null}
            </div>
            {intent === 'CONSTRUCTION_SERVICE' ? (
              <p className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
                Construction Service is intake only. No project, agreement, payment plan, or
                milestone is created.
              </p>
            ) : null}
          </section>
        ) : null}
        {lead ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <ReasonField />
          </section>
        ) : null}
      </fieldset>
      <footer className="flex justify-end gap-2">
        <Link className="button secondary" href={lead ? `/crm/leads/${lead.id}` : '/crm/leads'}>
          Cancel
        </Link>
        <button
          className="button primary"
          disabled={mutation.isPending || (!lead && (!branchId || !sourceId))}
        >
          {mutation.isPending
            ? 'Saving…'
            : correction
              ? 'Correct intent'
              : lead
                ? 'Save Lead changes'
                : 'Create Lead'}
        </button>
      </footer>
    </form>
  );
}

export function LeadEditorWorkspace({ leadId }: { leadId?: string }) {
  const { principal, error } = useCrmPrincipal();
  const query = useQuery({
    queryKey: ['crm', `/crm/leads/${leadId}`],
    enabled: Boolean(leadId && principal && can(principal, 'crm.lead.read')),
    retry: false,
    queryFn: () => api<LeadDetail>(`/crm/leads/${leadId}`),
  });
  return (
    <CrmShell principal={principal} principalError={error} activeItem="crm:leads">
      <PageHeader
        eyebrow="CRM · Lead intake"
        title={leadId ? 'Edit Lead' : 'Create Lead'}
        description="Record only known information. The server validates branch authority and business prerequisites."
      />
      {principal ? (
        leadId ? (
          query.isPending ? (
            <LoadingState label="Loading Lead" />
          ) : query.isError ? (
            <ErrorState message={crmError(query.error)} onRetry={() => void query.refetch()} />
          ) : (
            <LeadEditor principal={principal} lead={query.data} />
          )
        ) : (
          <LeadEditor principal={principal} />
        )
      ) : null}
    </CrmShell>
  );
}
