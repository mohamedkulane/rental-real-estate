'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { SearchableSelect } from '@/components/shared/searchable-select';
import { ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/shared/ui';
import { api, pageItems, type CursorPage, userFacingError } from '@/lib/phase3-api';
import { OperationsShell, useOperationsPrincipal } from '@/features/leasing/operations-shell';
import { OnboardingWorkspace } from './onboarding-workspace';
import { Building2, UserRound } from 'lucide-react';
import { GuidedWorkflowFooter, GuidedWorkflowShell } from './guided-workflow-shell';
import { stepPresentation, workflowPresentation } from './workflow-presentation';
import { WorkflowOwnerPicker } from './workflow-owner-picker';
import { WorkflowPropertyPicker } from './workflow-property-picker';
import { EntityDocuments } from '@/features/portfolio/entity-documents';
import { WorkflowServiceCreate } from './workflow-service-create';
import { WorkflowCancel } from './workflow-cancel';
import {
  workflowLabels,
  workflowSteps,
  type WorkflowPayload,
  type WorkflowRecord,
  type WorkflowStepKind,
} from './workflow-types';

type Option = { id: string; label: string; propertyId?: string; ownerPartyId?: string };
const asRecord = (value: unknown) =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
const string = (value: unknown) => (typeof value === 'string' ? value : '');

function optionsFor(kind: WorkflowStepKind, rows: unknown[]): Option[] {
  return rows
    .map((raw) => {
      const row = asRecord(raw);
      const party = asRecord(row.party);
      const owner = asRecord(row.owner);
      const property = asRecord(row.property);
      const branch = asRecord(row.branch);
      const space = asRecord(row.rentableSpace);
      if (kind === 'owner')
        return {
          id: string(row.partyId || row.id),
          label: `${string(row.ownerNumber)} — ${string(party.displayName || row.displayName)}`,
        };
      if (kind === 'ownership')
        return {
          id: string(row.id),
          label: `${string(asRecord(owner.owner).ownerNumber || owner.ownerNumber)} — ${string(property.name)} (${string(row.ownershipPercent)}%)`,
          propertyId: string(row.propertyId),
          ownerPartyId: string(row.ownerPartyId),
        };
      if (kind === 'property')
        return { id: string(row.id), label: `${string(row.propertyCode)} — ${string(row.name)}` };
      if (kind === 'buildings')
        return {
          id: string(row.id),
          label: `${string(row.buildingCode)} — ${string(row.name)}${branch.name ? ` · ${string(branch.name)}` : ''}`,
        };
      if (kind === 'spaces')
        return { id: string(row.id), label: `${string(row.spaceCode)} — ${string(row.name)}` };
      if (kind === 'engagement')
        return {
          id: string(row.id),
          label: `${string(row.engagementNumber)} — ${string(row.serviceModel).replaceAll('_', ' ')}`,
        };
      if (kind === 'documents')
        return {
          id: string(row.id),
          label: `${string(row.displayName)} — ${string(row.categoryCode).replaceAll('_', ' ')}`,
        };
      return { id: string(row.id), label: string(space.name || row.name || row.id) };
    })
    .filter((option) => option.id);
}

export function WorkflowEditor({ workflowId }: { workflowId: string }) {
  const { principal, error: principalError } = useOperationsPrincipal();
  const client = useQueryClient();
  const [payload, setPayload] = useState<WorkflowPayload>({});
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [commandBusy, setCommandBusy] = useState(false);
  const completionIdempotencyKey = useRef<string | null>(null);
  const workflow = useQuery({
    queryKey: ['workflow', workflowId],
    enabled: Boolean(principal),
    queryFn: () => api<WorkflowRecord>(`/workflows/${workflowId}`),
  });
  useEffect(() => {
    if (workflow.data) setPayload(workflow.data.payload);
  }, [workflow.data]);
  const row = workflow.data;
  const step = row?.currentStep ?? 1;
  const steps = row ? workflowSteps[row.type] : workflowSteps.PROPERTY_ONBOARDING;
  const stepDefinition = steps[step - 1] ?? steps[0]!;
  const kind = stepDefinition.kind;
  const selectorPath = useMemo(() => {
    const q = encodeURIComponent(search);
    const branch = row?.branchId ? `&branchId=${row.branchId}` : '';
    if (kind === 'owner') return `/owners?limit=25&search=${q}`;
    if (kind === 'ownership')
      return `/property-ownerships?limit=25${payload.ownerPartyId ? `&ownerPartyId=${payload.ownerPartyId}` : ''}${payload.propertyId ? `&propertyId=${payload.propertyId}` : ''}&search=${q}`;
    if (kind === 'property') return `/properties?limit=25${branch}&status=ACTIVE&search=${q}`;
    if (kind === 'buildings')
      return `/buildings?limit=25${payload.propertyId ? `&propertyId=${payload.propertyId}` : ''}${branch}&search=${q}`;
    if (kind === 'spaces')
      return `/rentable-spaces?limit=25${payload.propertyId ? `&propertyId=${payload.propertyId}` : ''}${branch}&status=ACTIVE&search=${q}`;
    if (kind === 'engagement')
      return `/service-engagements?limit=25${payload.propertyId ? `&propertyId=${payload.propertyId}` : ''}&search=${q}`;
    if (kind === 'documents')
      return `/portfolio-documents?limit=25${payload.propertyId ? `&entityType=Property&entityId=${payload.propertyId}` : ''}&search=${q}`;
    return '';
  }, [kind, payload.ownerPartyId, payload.propertyId, row?.branchId, search]);
  const selector = useQuery({
    queryKey: ['workflow-selector', selectorPath],
    enabled: Boolean(principal && selectorPath && row?.type !== 'PROPERTY_ONBOARDING'),
    queryFn: () => api<CursorPage<unknown> | unknown[]>(selectorPath),
  });
  const options = optionsFor(kind, selector.data ? pageItems(selector.data) : []);
  const selected =
    kind === 'owner'
      ? payload.ownerPartyId
      : kind === 'ownership'
        ? payload.ownershipId
        : kind === 'property'
          ? payload.propertyId
          : kind === 'engagement'
            ? payload.serviceEngagementId
            : '';
  const setSelected = (value: string) => {
    const option = options.find((item) => item.id === value);
    if (kind === 'owner')
      setPayload((current) => {
        const next = { ...current };
        delete next.ownershipId;
        if (value) next.ownerPartyId = value;
        else delete next.ownerPartyId;
        return next;
      });
    if (kind === 'ownership')
      setPayload((current) => {
        const next = { ...current };
        if (value) next.ownershipId = value;
        else delete next.ownershipId;
        if (option?.propertyId) next.propertyId = option.propertyId;
        if (option?.ownerPartyId) next.ownerPartyId = option.ownerPartyId;
        return next;
      });
    if (kind === 'property')
      setPayload((current) => {
        const next = { ...current, buildingIds: [], rentableSpaceIds: [], documentIds: [] };
        delete next.serviceEngagementId;
        if (value) next.propertyId = value;
        else delete next.propertyId;
        return next;
      });
    if (kind === 'buildings' && value)
      setPayload((current) => ({
        ...current,
        buildingIds: [...new Set([...(current.buildingIds ?? []), value])],
        structureRequired: true,
      }));
    if (kind === 'spaces' && value)
      setPayload((current) => ({
        ...current,
        rentableSpaceIds: [...new Set([...(current.rentableSpaceIds ?? []), value])],
      }));
    if (kind === 'engagement')
      setPayload((current) => {
        const next = { ...current };
        if (value) next.serviceEngagementId = value;
        else delete next.serviceEngagementId;
        return next;
      });
    if (kind === 'documents' && value)
      setPayload((current) => ({
        ...current,
        documentIds: [...new Set([...(current.documentIds ?? []), value])],
      }));
  };
  const selectedIds =
    kind === 'buildings'
      ? (payload.buildingIds ?? [])
      : kind === 'spaces'
        ? (payload.rentableSpaceIds ?? [])
        : kind === 'documents'
          ? (payload.documentIds ?? [])
          : [];
  const removeSelected = (id: string) =>
    setPayload((current) =>
      kind === 'buildings'
        ? {
            ...current,
            buildingIds: (current.buildingIds ?? []).filter((item) => item !== id),
            structureRequired: (current.buildingIds ?? []).some((item) => item !== id),
          }
        : kind === 'spaces'
          ? {
              ...current,
              rentableSpaceIds: (current.rentableSpaceIds ?? []).filter((item) => item !== id),
            }
          : { ...current, documentIds: (current.documentIds ?? []).filter((item) => item !== id) },
    );
  const save = useMutation({
    mutationFn: (currentStep: number) =>
      api<WorkflowRecord>(`/workflows/${workflowId}`, {
        method: 'PATCH',
        body: JSON.stringify({ expectedVersion: row?.version, currentStep, payload }),
      }),
    onSuccess: (updated) => {
      setPayload(updated.payload);
      setSearch('');
      setMessage('');
      void client.setQueryData(['workflow', workflowId], updated);
      toast.success('Draft saved.');
    },
    onError: (cause) => setMessage(userFacingError(cause)),
  });
  const complete = useMutation({
    mutationFn: async () => {
      completionIdempotencyKey.current ??= crypto.randomUUID();
      let current = await api<WorkflowRecord>(`/workflows/${workflowId}`);
      if (current.payload.serviceEngagementId)
        current = await api<WorkflowRecord>(`/workflows/${workflowId}/commands`, {
          method: 'POST',
          body: JSON.stringify({
            command: 'ACTIVATE_SERVICE',
            expectedVersion: current.version,
            idempotencyKey: `${completionIdempotencyKey.current}:ACTIVATE_SERVICE`,
          }),
        });
      current = await api<WorkflowRecord>(`/workflows/${workflowId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          expectedVersion: current.version,
          currentStep: 8,
          payload: current.payload,
        }),
      });
      return api(`/workflows/${workflowId}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          expectedVersion: current.version,
          idempotencyKey: completionIdempotencyKey.current,
        }),
      });
    },
    onSuccess: () => {
      completionIdempotencyKey.current = null;
      toast.success('Workflow completed.');
      void workflow.refetch();
    },
    onError: (cause) => {
      setMessage(userFacingError(cause));
      void workflow.refetch();
    },
  });
  if (workflow.isLoading)
    return (
      <OperationsShell principal={principal} error={principalError} activeItem="incomplete-work">
        <LoadingState label="Opening workflow" />
      </OperationsShell>
    );
  if (workflow.isError || !row)
    return (
      <OperationsShell principal={principal} error={principalError} activeItem="incomplete-work">
        <ErrorState
          message={userFacingError(workflow.error)}
          onRetry={() => void workflow.refetch()}
        />
      </OperationsShell>
    );
  if (row.status === 'COMPLETED' || row.status === 'CANCELLED')
    return (
      <OperationsShell principal={principal} error={principalError} activeItem="incomplete-work">
        <PageHeader
          eyebrow="Workflow"
          title={workflowLabels[row.type]}
          description="This workflow is no longer editable."
        />
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <StatusBadge value={row.status} />
          <p className="mt-4 text-sm text-slate-600">
            Your saved records remain available in their workspaces.
          </p>
          <Link className="button secondary mt-4" href="/workflows">
            Return to Incomplete Work
          </Link>
          {row.payload.propertyId ? (
            <Link
              className="button primary mt-4 sm:ml-3"
              href={`/portfolio/properties/${row.payload.propertyId}`}
            >
              Open property
            </Link>
          ) : null}
        </div>
      </OperationsShell>
    );
  if (row.type === 'PROPERTY_ONBOARDING' && principal)
    return (
      <OnboardingWorkspace
        key={row.id}
        row={row}
        principal={principal}
        onSaved={(updated) => {
          client.setQueryData(['workflow', workflowId], updated);
        }}
      />
    );

  const presentation = workflowPresentation[row.type];
  const stepMeta = stepPresentation(row.type, step);
  const progressPercent = Math.round((step / steps.length) * 100);
  const pending = commandBusy || save.isPending || complete.isPending;
  const stepIcon =
    kind === 'property' ? (
      <Building2 size={20} />
    ) : kind === 'owner' ? (
      <UserRound size={20} />
    ) : undefined;

  const stepContent = (
    <>
      {message ? (
        <div className="feedback feedback-error mb-4" role="alert">
          {message}
        </div>
      ) : null}
      {kind === 'details' ? (
        <div className="guided-workflow__field">
          <label htmlFor="workflow-details">
            {row.type === 'FULL_MANAGEMENT' ? 'Management terms' : 'Readiness notes'}
          </label>
          <textarea
            id="workflow-details"
            rows={6}
            value={
              row.type === 'FULL_MANAGEMENT'
                ? (payload.managementTerms ?? '')
                : (payload.readinessNotes ?? '')
            }
            onChange={(event) =>
              setPayload((current) =>
                row.type === 'FULL_MANAGEMENT'
                  ? { ...current, managementTerms: event.target.value }
                  : { ...current, readinessNotes: event.target.value },
              )
            }
            maxLength={2000}
            placeholder="Describe listing readiness, marketing constraints, or launch notes."
          />
        </div>
      ) : kind === 'review' ? (
        <>
          {step === 8 ? (
            <p className="guided-workflow__muted">
              The server will re-check current permissions, Branch scope, canonical references,
              expected versions, and completion idempotency before finalizing.
            </p>
          ) : null}
          <dl className="guided-workflow__review-grid">
            {[
              ['Owner', payload.ownerPartyId ? 'Selected' : 'Not required'],
              ['Property', payload.propertyId ? 'Selected' : 'Missing'],
              ['Ownership evidence', payload.ownershipId ? 'Verified' : 'Not required'],
              ['Rentable spaces', `${payload.rentableSpaceIds?.length ?? 0} selected`],
              ['Company service', payload.serviceEngagementId ? 'Ready to activate' : 'Missing'],
              ['Documents', `${payload.documentIds?.length ?? 0} linked`],
            ].map(([key, value]) => (
              <div key={key} className="guided-workflow__review-item">
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : kind === 'documents' && payload.propertyId && principal ? (
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
      ) : kind === 'property' ? (
        <WorkflowPropertyPicker
          options={options}
          rows={selector.data ? pageItems(selector.data) : []}
          selectedId={selected ?? ''}
          loading={selector.isLoading}
          search={search}
          onSearchChange={setSearch}
          onSelect={setSelected}
        />
      ) : kind === 'owner' ? (
        <WorkflowOwnerPicker
          rows={selector.data ? pageItems(selector.data) : []}
          selectedId={selected ?? ''}
          loading={selector.isLoading}
          search={search}
          onSearchChange={setSearch}
          onSelect={setSelected}
          optional={row.type === 'PROPERTY_SALE'}
        />
      ) : (
        <div className="guided-workflow__picker">
          <label className="guided-workflow__field">
            {stepDefinition.label}
            <SearchableSelect
              aria-label={stepDefinition.label}
              searchable
              searchThreshold={1}
              searchPlaceholder={`Search ${stepDefinition.label}`}
              loading={selector.isLoading}
              value={selected ?? ''}
              onSearchChange={setSearch}
              onChange={(event) => setSelected(event.target.value)}
            >
              <option value="">
                {kind === 'buildings' || kind === 'documents'
                  ? 'Skip this optional step'
                  : `Choose ${stepDefinition.label}`}
              </option>
              {options
                .filter((option) => !selectedIds.includes(option.id))
                .map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
            </SearchableSelect>
          </label>
          {selectedIds.length ? (
            <ul className="guided-workflow__chips" aria-label={`Selected ${stepDefinition.label}`}>
              {selectedIds.map((id) => (
                <li key={id}>
                  <button type="button" onClick={() => removeSelected(id)}>
                    Selected · Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {kind === 'engagement' && principal ? (
            <WorkflowServiceCreate
              row={{ ...row, payload }}
              principal={principal}
              onBusyChange={setCommandBusy}
              onSaved={(updated) => {
                setPayload(updated.payload);
                client.setQueryData(['workflow', workflowId], updated);
              }}
            />
          ) : null}
        </div>
      )}
    </>
  );

  return (
    <OperationsShell principal={principal} error={principalError} activeItem="incomplete-work">
      <GuidedWorkflowShell
        breadcrumbs={presentation.breadcrumbs.map((crumb, index) =>
          index === presentation.breadcrumbs.length - 1 && row.status === 'DRAFT'
            ? { ...crumb, label: 'Draft' }
            : crumb,
        )}
        title={presentation.title}
        subtitle={presentation.subtitle}
        status={row.status}
        steps={presentation.steps}
        currentStep={step}
        stepTitle={stepMeta.title}
        stepDescription={stepMeta.description}
        progressPercent={progressPercent}
        stepIcon={stepIcon}
        footer={
          <GuidedWorkflowFooter
            cancelDisabled={pending}
            draftDisabled={pending}
            backDisabled={pending || step === 1}
            continueDisabled={pending}
            continuePending={save.isPending || complete.isPending}
            showBack={step > 1}
            continueLabel={
              step < 8 ? 'Continue' : complete.isPending ? 'Completing…' : 'Activate'
            }
            onCancel={() => setCancelOpen(true)}
            onSaveDraft={() => save.mutate(step)}
            onBack={() => save.mutate(Math.max(1, step - 1))}
            onContinue={() => (step < 8 ? save.mutate(step + 1) : complete.mutate())}
          />
        }
      >
        {stepContent}
      </GuidedWorkflowShell>
      {cancelOpen ? (
        <WorkflowCancel
          row={row}
          onClose={() => setCancelOpen(false)}
          onSaved={(updated) => client.setQueryData(['workflow', workflowId], updated)}
        />
      ) : null}
    </OperationsShell>
  );
}
