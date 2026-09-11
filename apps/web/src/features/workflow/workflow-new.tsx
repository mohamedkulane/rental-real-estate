'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared/ui';
import { api, userFacingError } from '@/lib/phase3-api';
import { OperationsShell, useOperationsPrincipal } from '@/features/leasing/operations-shell';
import { workflowLabels, type WorkflowRecord, type WorkflowType } from './workflow-types';
import { RecordPicker } from './record-picker';

export function WorkflowNew() {
  const router = useRouter();
  const params = useSearchParams();
  const { principal, error } = useOperationsPrincipal();
  const requested = params.get('type') as WorkflowType | null;
  const [type, setType] = useState<WorkflowType>(
    requested && requested in workflowLabels ? requested : 'PROPERTY_ONBOARDING',
  );
  const [branchId, setBranchId] = useState('');
  const [message, setMessage] = useState('');
  const mutation = useMutation({
    mutationFn: () =>
      api<WorkflowRecord>('/workflows', {
        method: 'POST',
        body: JSON.stringify({
          branchId,
          type,
          payloadSchemaVersion: 1,
          payload: {
            structureRequired: false,
            rentableSpacesRequired: type === 'RENTAL_BROKERAGE' || type === 'FULL_MANAGEMENT',
            companyServiceRequired: type !== 'PROPERTY_ONBOARDING',
          },
        }),
      }),
    onSuccess: (record) => router.push(`/workflows/${record.id}`),
    onError: (cause) => setMessage(userFacingError(cause)),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    mutation.mutate();
  };
  return (
    <OperationsShell principal={principal} error={error} activeItem="workflow-new">
      <PageHeader
        eyebrow="Start New"
        title="Choose a guided workflow"
        description="Create a durable draft, complete one business step at a time, and resume safely later."
      />
      <form
        onSubmit={submit}
        className="mx-auto mt-6 grid max-w-2xl gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
      >
        {message ? (
          <div className="feedback feedback-error" role="alert">
            {message}
          </div>
        ) : null}
        <label>
          Workflow
          <select value={type} onChange={(event) => setType(event.target.value as WorkflowType)}>
            {Object.entries(workflowLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <RecordPicker
          label="Operating Branch"
          path="/workflows/branches"
          value={branchId}
          map={(row) => ({ id: String(row.id), label: String(row.name) })}
          onChange={(branch) => setBranchId(branch?.id ?? '')}
        />
        <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">
          This workflow reuses canonical Parties, Owners, Properties, Rentable Spaces, Service
          Engagements, and Documents. It never creates duplicate identity records.
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="button secondary" onClick={() => router.back()}>
            Cancel
          </button>
          <button
            type="submit"
            className="button primary"
            disabled={!branchId || mutation.isPending}
          >
            {mutation.isPending ? 'Starting…' : 'Start Workflow'}
          </button>
        </div>
      </form>
    </OperationsShell>
  );
}
