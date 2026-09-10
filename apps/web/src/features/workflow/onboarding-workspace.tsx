'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ApiError, api, type Principal, userFacingError } from '@/lib/phase3-api';
import { PageHeader, StatusBadge } from '@/components/shared/ui';
import { OperationsShell } from '@/features/leasing/operations-shell';
import { EntityDocuments } from '@/features/portfolio/entity-documents';
import { OnboardingCreate } from './onboarding-create';
import { WorkflowCancel } from './workflow-cancel';
import { RecordPicker } from './record-picker';
import { workflowSteps, type WorkflowPayload, type WorkflowRecord } from './workflow-types';

const object = (value: unknown) =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
const ownerOption = (row: Record<string, unknown>) => ({
  id: String(row.partyId ?? row.id),
  label: String(row.displayName ?? object(row.party).displayName ?? row.ownerNumber),
});
const propertyOption = (row: Record<string, unknown>) => ({
  id: String(row.id),
  label: String(row.name),
});
const engagementOption = (row: Record<string, unknown>) => ({
  id: String(row.id),
  label: `${String(row.engagementNumber)} · ${String(row.serviceModel).replaceAll('_', ' ')}`,
});

export function OnboardingWorkspace({
  row,
  principal,
  onSaved,
}: {
  row: WorkflowRecord;
  principal: Principal;
  onSaved: (row: WorkflowRecord) => void;
}) {
  const router = useRouter();
  const [payload, setPayload] = useState<WorkflowPayload>(row.payload);
  const [busy, setBusy] = useState(false);
  const [commandBusy, setCommandBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const pending = busy || commandBusy;
  const [error, setError] = useState('');
  const completionKey = useRef<string | null>(null);
  const preparedCompletion = useRef<WorkflowRecord | null>(null);
  const versionRef = useRef(row.version);
  const step = row.currentStep;
  useEffect(() => {
    versionRef.current = row.version;
  }, [row.version]);
  const owner = useQuery({
    queryKey: ['workflow-owner-context', payload.ownerPartyId],
    enabled: Boolean(payload.ownerPartyId),
    queryFn: () => api<Record<string, unknown>>(`/owners/${payload.ownerPartyId}`),
  });
  const property = useQuery({
    queryKey: ['workflow-property-context', payload.propertyId],
    enabled: Boolean(payload.propertyId),
    queryFn: () => api<Record<string, unknown>>(`/properties/${payload.propertyId}`),
  });
  const ownerName = owner.data
    ? ownerOption(owner.data).label
    : payload.ownerPartyId
      ? 'Saved owner'
      : 'Not selected';
  const propertyName = property.data
    ? String(property.data.name)
    : payload.propertyId
      ? 'Saved property'
      : 'New property';
  const plan = payload.ownershipPlan ?? {
    effectiveFrom: principal.businessDate,
    reason: 'Initial property onboarding',
    shares: [
      { ownerPartyId: payload.ownerPartyId ?? '', ownershipPercent: '100', payoutPercent: '100' },
    ],
  };
  const updated = (record: WorkflowRecord) => {
    versionRef.current = record.version;
    setPayload(record.payload);
    setError('');
    onSaved(record);
  };
  async function patchDraft(nextStep: number, expectedVersion: number, body: WorkflowPayload) {
    return api<WorkflowRecord>(`/workflows/${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        expectedVersion,
        currentStep: nextStep,
        payload: body,
      }),
    });
  }
  async function save(nextStep: number, leave = false) {
    setBusy(true);
    setError('');
    const draft = step === 2 ? { ...payload, ownershipPlan: plan } : payload;
    try {
      const saved = await patchDraft(nextStep, versionRef.current, draft);
      updated(saved);
      if (leave) router.push('/workflows');
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        try {
          const latest = await api<WorkflowRecord>(`/workflows/${row.id}`);
          versionRef.current = latest.version;
          const retried = await patchDraft(nextStep, latest.version, draft);
          updated(retried);
          if (leave) router.push('/workflows');
          return;
        } catch (retryCause) {
          setError(userFacingError(retryCause));
          return;
        }
      }
      setError(userFacingError(cause));
    } finally {
      setBusy(false);
    }
  }
  async function finish() {
    setBusy(true);
    setError('');
    completionKey.current ??= crypto.randomUUID();
    try {
      let current = preparedCompletion.current;
      if (!current) {
        current = await api<WorkflowRecord>(`/workflows/${row.id}`);
        if (current.status === 'COMPLETED') {
          updated(current);
          return;
        }
        for (const command of [
          'ACTIVATE_PROPERTY',
          ...(current.payload.serviceEngagementId ? ['ACTIVATE_SERVICE'] : []),
        ]) {
          current = await api<WorkflowRecord>(`/workflows/${row.id}/commands`, {
            method: 'POST',
            body: JSON.stringify({
              command,
              expectedVersion: current.version,
              idempotencyKey: `${completionKey.current}:${command}`,
            }),
          });
          updated(current);
        }
        current = await api<WorkflowRecord>(`/workflows/${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            expectedVersion: current.version,
            currentStep: 8,
            payload: current.payload,
          }),
        });
        preparedCompletion.current = current;
        updated(current);
      }
      await api(`/workflows/${row.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          expectedVersion: current.version,
          idempotencyKey: completionKey.current,
        }),
      });
      updated(await api<WorkflowRecord>(`/workflows/${row.id}`));
    } catch (cause) {
      setError(userFacingError(cause));
    } finally {
      setBusy(false);
    }
  }
  const changeShare = (
    index: number,
    key: 'ownerPartyId' | 'ownershipPercent' | 'payoutPercent',
    value: string,
  ) =>
    setPayload({
      ...payload,
      ownershipPlan: {
        ...plan,
        shares: plan.shares.map((share, position) =>
          position === index ? { ...share, [key]: value } : share,
        ),
      },
    });
  return (
    <OperationsShell principal={principal} activeItem="incomplete-work">
      <PageHeader
        eyebrow="Start New"
        title="Onboard Property"
        description="Register the owner, property and services together. Save your progress at any step."
        action={<StatusBadge value={row.status} />}
      />
      <div className="mt-5 grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Onboarding steps">
          <ol className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-1">
            {workflowSteps.PROPERTY_ONBOARDING.map((item, index) => (
              <li
                key={item.label}
                aria-current={index + 1 === step ? 'step' : undefined}
                className={`rounded-lg border px-3 py-3 text-sm ${step === index + 1 ? 'border-blue-400 bg-blue-50 font-semibold text-blue-900' : 'border-slate-200 bg-white text-slate-600'}`}
              >
                <span className="mr-2 tabular-nums">{index + 1}.</span>
                {item.label}
              </li>
            ))}
          </ol>
        </nav>
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-5 border-b border-slate-100 pb-4">
            <h2 className="text-xl font-semibold">
              {workflowSteps.PROPERTY_ONBOARDING[step - 1]?.label}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {ownerName} · {propertyName}
            </p>
          </div>
          {error ? (
            <div role="alert" className="feedback feedback-error mb-4">
              {error}{' '}
              <button
                type="button"
                className="underline"
                onClick={() => {
                  setError('');
                  void api<WorkflowRecord>(`/workflows/${row.id}`)
                    .then(updated)
                    .catch((cause) => setError(userFacingError(cause)));
                }}
              >
                Reload saved version
              </button>
            </div>
          ) : null}
          {step === 1 ? (
            <RecordPicker
              label="Existing owner"
              path="/owners"
              value={payload.ownerPartyId ?? ''}
              selectedLabel={ownerName}
              map={ownerOption}
              onChange={(record) => {
                const next = { ...payload };
                if (record) next.ownerPartyId = record.id;
                else delete next.ownerPartyId;
                setPayload(next);
              }}
            />
          ) : null}
          {step === 2 ? (
            <div className="grid gap-4">
              <p className="text-sm text-slate-600">
                Set ownership and payout shares before creating the property. Both totals must equal
                100%.
              </p>
              <label className="grid gap-1 text-sm">
                Effective date
                <input
                  type="date"
                  value={plan.effectiveFrom}
                  onChange={(event) =>
                    setPayload({
                      ...payload,
                      ownershipPlan: { ...plan, effectiveFrom: event.target.value },
                    })
                  }
                  required
                />
              </label>
              {plan.shares.map((share, index) => (
                <fieldset key={index} className="grid gap-3 rounded-xl border border-slate-200 p-4">
                  <legend className="px-1 text-sm font-semibold">Owner {index + 1}</legend>
                  <RecordPicker
                    label="Owner"
                    path="/owners"
                    value={share.ownerPartyId}
                    selectedLabel={index === 0 ? ownerName : 'Saved co-owner'}
                    map={ownerOption}
                    onChange={(record) => changeShare(index, 'ownerPartyId', record?.id ?? '')}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm">
                      Ownership %
                      <input
                        type="number"
                        min="0.01"
                        max="100"
                        step="0.01"
                        value={share.ownershipPercent}
                        onChange={(event) =>
                          changeShare(index, 'ownershipPercent', event.target.value)
                        }
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      Payout entitlement %
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={share.payoutPercent}
                        onChange={(event) =>
                          changeShare(index, 'payoutPercent', event.target.value)
                        }
                      />
                    </label>
                  </div>
                  {index > 0 ? (
                    <button
                      type="button"
                      className="button secondary justify-self-start"
                      onClick={() =>
                        setPayload({
                          ...payload,
                          ownershipPlan: {
                            ...plan,
                            shares: plan.shares.filter((_, position) => position !== index),
                          },
                        })
                      }
                    >
                      Remove co-owner
                    </button>
                  ) : null}
                </fieldset>
              ))}
              <button
                type="button"
                className="button secondary justify-self-start"
                disabled={plan.shares.length >= 20}
                onClick={() =>
                  setPayload({
                    ...payload,
                    ownershipPlan: {
                      ...plan,
                      shares: [
                        ...plan.shares,
                        { ownerPartyId: '', ownershipPercent: '0', payoutPercent: '0' },
                      ],
                    },
                  })
                }
              >
                Add co-owner
              </button>
            </div>
          ) : null}
          {step === 3 && !payload.propertyId ? (
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-blue-800">
                Use a property already registered
              </summary>
              <div className="mt-3">
                <RecordPicker
                  label="Property"
                  path={`/properties?branchId=${row.branchId}`}
                  value={payload.propertyId ?? ''}
                  map={propertyOption}
                  onChange={(record) => {
                    if (record) setPayload({ ...payload, propertyId: record.id });
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Save Draft after selecting an existing property, then confirm its ownership.
              </p>
            </details>
          ) : null}
          {step === 4 ? (
            <p className="text-sm text-slate-600">
              Add each building or structure. A standalone property can continue without a building.{' '}
              {payload.buildingIds?.length ?? 0} added.
            </p>
          ) : null}
          {step === 5 ? (
            <p className="text-sm text-slate-600">
              Add the spaces that can be rented independently.{' '}
              {payload.rentableSpaceIds?.length ?? 0} added.
            </p>
          ) : null}
          {step === 6 ? (
            <div className="grid gap-4">
              <p className="text-sm text-slate-600">
                Select the service agreed with the owner. You can leave this step empty when no
                service has been agreed yet.
              </p>
              <RecordPicker
                label="Company service"
                path={`/service-engagements?propertyId=${payload.propertyId}`}
                value={payload.serviceEngagementId ?? ''}
                map={engagementOption}
                onChange={(record) => {
                  const next = { ...payload };
                  if (record) next.serviceEngagementId = record.id;
                  else delete next.serviceEngagementId;
                  setPayload(next);
                }}
              />
            </div>
          ) : null}
          {step === 7 && payload.propertyId ? (
            <EntityDocuments
              entityType="Property"
              entityId={payload.propertyId}
              canManage={principal.permissions.includes('portfolio.document.manage')}
              onUploaded={(documentId) =>
                setPayload((current) => ({
                  ...current,
                  documentIds: [...new Set([...(current.documentIds ?? []), documentId])],
                }))
              }
            />
          ) : null}
          {step === 8 ? (
            <div className="grid gap-4">
              <p className="text-sm text-slate-600">
                Review the saved records before finishing. Completion preserves the property and its
                ownership, buildings, spaces and documents.
              </p>
              <dl className="grid gap-4 sm:grid-cols-2">
                {[
                  ['Owner', ownerName],
                  ['Property', propertyName],
                  ['Ownership', payload.ownershipId ? 'Recorded' : 'Missing'],
                  ['Buildings', String(payload.buildingIds?.length ?? 0)],
                  ['Rentable spaces', String(payload.rentableSpaceIds?.length ?? 0)],
                  ['Company service', payload.serviceEngagementId ? 'Selected' : 'Not requested'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-xs text-slate-500">{label}</dt>
                    <dd className="mt-1 text-sm font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
              {payload.propertyId ? (
                <Link
                  href={`/portfolio/properties/${payload.propertyId}`}
                  className="text-sm text-blue-800 underline"
                >
                  Open property details
                </Link>
              ) : null}
            </div>
          ) : null}
          <OnboardingCreate
            key={`${row.id}-${step}-${payload.propertyId ?? ''}-${payload.ownershipId ?? ''}`}
            row={{ ...row, payload, version: versionRef.current }}
            principal={principal}
            onSaved={updated}
            onBusyChange={setCommandBusy}
          />
          <footer className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:flex-wrap sm:justify-end">
            {principal.permissions.includes('workflow.draft.cancel') &&
            ['DRAFT', 'IN_PROGRESS', 'FAILED'].includes(row.status) ? (
              <button
                type="button"
                className="button danger sm:mr-auto"
                disabled={pending}
                onClick={() => setCancelOpen(true)}
              >
                Cancel workflow
              </button>
            ) : null}
            <button
              className="button secondary"
              disabled={pending}
              onClick={() => void save(step, true)}
            >
              Save & resume later
            </button>
            <button
              className="button secondary"
              disabled={pending || step === 1}
              onClick={() => void save(step - 1)}
            >
              Back
            </button>
            <button className="button secondary" disabled={pending} onClick={() => void save(step)}>
              Save Draft
            </button>
            {step < 8 ? (
              <button
                className="button primary"
                disabled={pending || (step === 3 && !payload.ownershipId)}
                onClick={() => void save(step + 1)}
              >
                {busy ? 'Saving…' : 'Continue'}
              </button>
            ) : (
              <button className="button primary" disabled={pending} onClick={() => void finish()}>
                {busy ? 'Completing…' : 'Complete onboarding'}
              </button>
            )}
          </footer>
        </section>
      </div>
      {cancelOpen ? (
        <WorkflowCancel row={row} onClose={() => setCancelOpen(false)} onSaved={updated} />
      ) : null}
    </OperationsShell>
  );
}
