'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, userFacingError, type Principal } from '@/lib/phase3-api';
import { humanize } from '@/lib/presentation';
import { RecordPicker } from './record-picker';
import type { WorkflowRecord } from './workflow-types';

const text = (data: FormData, name: string) => {
  const value = data.get(name);
  return typeof value === 'string' ? value.trim() : '';
};
const partyOption = (row: Record<string, unknown>) => ({
  id: String(row.id),
  label: String(row.displayName),
});

export function OnboardingCreate({
  row,
  principal,
  onSaved,
  onBusyChange,
}: {
  row: WorkflowRecord;
  principal: Principal;
  onSaved: (row: WorkflowRecord) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('existing');
  const [partyId, setPartyId] = useState(row.payload.partyId ?? '');
  const [buildingId, setBuildingId] = useState('');
  const request = useRef<{ signature: string; key: string } | null>(null);
  const types = useQuery({
    queryKey: ['space-types'],
    enabled: row.currentStep === 5,
    queryFn: () => api<Array<{ code: string; name: string }>>('/rentable-spaces/types'),
  });
  async function command(command: string, values: Record<string, unknown> = {}, current = row) {
    const signature = JSON.stringify({ command, ...values });
    if (request.current?.signature !== signature)
      request.current = { signature, key: crypto.randomUUID() };
    const updated = await api<WorkflowRecord>(`/workflows/${row.id}/commands`, {
      method: 'POST',
      body: JSON.stringify({
        command,
        ...values,
        expectedVersion: current.version,
        idempotencyKey: request.current.key,
      }),
    });
    onSaved(updated);
    request.current = null;
    return updated;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    onBusyChange(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      if (row.currentStep === 1) {
        let current = row;
        let selectedParty = row.payload.partyId ?? partyId;
        if (mode !== 'existing' && !row.payload.partyId) {
          const person = mode === 'person';
          current = await command('PARTY', {
            party: {
              branchId: row.branchId,
              kind: person ? 'PERSON' : 'ORGANIZATION',
              displayName: person
                ? `${text(data, 'givenName')} ${text(data, 'familyName')}`
                : text(data, 'legalName'),
              ...(person
                ? {
                    person: {
                      givenName: text(data, 'givenName'),
                      familyName: text(data, 'familyName'),
                    },
                  }
                : { organization: { legalName: text(data, 'legalName') } }),
            },
          });
          selectedParty = current.payload.partyId ?? '';
          setPartyId(selectedParty);
        }
        if (!selectedParty) throw new Error('Choose a person or organization first.');
        await command('OWNER', { owner: { partyId: selectedParty } }, current);
      }
      if (row.currentStep === 3) {
        let current = row;
        if (!row.payload.propertyId)
          current = await command('PROPERTY', {
            property: {
              branchId: row.branchId,
              name: text(data, 'name'),
              propertyType: text(data, 'propertyType'),
              city: text(data, 'city'),
              effectiveFrom: row.payload.ownershipPlan?.effectiveFrom ?? principal.businessDate,
              ...(text(data, 'addressLine1') ? { addressLine1: text(data, 'addressLine1') } : {}),
            },
          });
        else {
          current = await api<WorkflowRecord>(`/workflows/${row.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              expectedVersion: row.version,
              currentStep: row.currentStep,
              payload: row.payload,
            }),
          });
          onSaved(current);
        }
        if (!current.payload.ownershipId) await command('OWNERSHIP', {}, current);
      }
      if (row.currentStep === 4)
        await command('BUILDING', {
          building: {
            name: text(data, 'name'),
            ...(text(data, 'numberOfFloors')
              ? { numberOfFloors: Number(text(data, 'numberOfFloors')) }
              : {}),
          },
        });
      if (row.currentStep === 5)
        await command('SPACE', {
          space: {
            propertyId: row.payload.propertyId,
            name: text(data, 'name'),
            typeCode: text(data, 'typeCode'),
            effectiveFrom: principal.businessDate,
            ...(buildingId ? { buildingId } : {}),
            ...(text(data, 'usableArea')
              ? { usableArea: text(data, 'usableArea'), areaUnit: 'SQM' }
              : {}),
            ...(text(data, 'typeCode') === 'LAND'
              ? { land: { permittedUse: text(data, 'permittedUse') } }
              : {}),
          },
        });
      if (row.currentStep === 6)
        await command('ENGAGEMENT', {
          engagement: {
            propertyId: row.payload.propertyId,
            serviceModel: text(data, 'serviceModel'),
            effectiveFrom: principal.businessDate,
          },
        });
      form.reset();
    } catch (cause) {
      setError(userFacingError(cause, cause instanceof Error ? cause.message : undefined));
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }
  if (
    ![1, 3, 4, 5, 6].includes(row.currentStep) ||
    (row.currentStep === 6 && row.payload.serviceEngagementId) ||
    (row.currentStep === 1 && row.payload.ownerPartyId)
  )
    return null;
  if (row.currentStep === 3 && row.payload.propertyId && row.payload.ownershipId)
    return (
      <p role="status" className="mt-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-900">
        Property and ownership are saved. Continue to add its structure.
      </p>
    );
  const label =
    row.currentStep === 1
      ? 'Add owner'
      : row.currentStep === 3
        ? row.payload.propertyId
          ? 'Save ownership'
          : 'Create property'
        : row.currentStep === 4
          ? 'Add building'
          : row.currentStep === 6
            ? 'Add company service'
            : 'Add rentable space';
  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="mt-6 grid gap-4 border-t border-slate-200 pt-5"
    >
      <h3 className="text-base font-semibold">{label}</h3>
      {error ? (
        <div role="alert" className="feedback feedback-error">
          {error}
        </div>
      ) : null}
      <fieldset disabled={busy} className="grid gap-4">
        {row.currentStep === 6 ? (
          <label className="grid gap-1">
            Agreed service
            <select name="serviceModel" required>
              <option value="">Choose service</option>
              <option value="RENTAL_BROKERAGE">Rental Brokerage — tenant placement only</option>
              <option value="FULL_MANAGEMENT">Full Management — ongoing property management</option>
              <option value="SALE_BROKERAGE">Sale Brokerage</option>
              <option value="COMPANY_OWNED">Company Owned — company ownership required</option>
            </select>
          </label>
        ) : null}
        {row.currentStep === 1 ? (
          <>
            {row.payload.partyId ? (
              <p className="text-sm text-blue-800">
                Person or organization saved. Finish adding the Owner profile.
              </p>
            ) : (
              <>
                <label className="grid gap-1">
                  Person or organization
                  <select
                    aria-label="Person or organization"
                    value={mode}
                    onChange={(event) => setMode(event.target.value)}
                  >
                    <option value="existing">Use an existing record</option>
                    <option value="person">Create a person</option>
                    <option value="organization">Create an organization</option>
                  </select>
                </label>
                {mode === 'existing' ? (
                  <RecordPicker
                    label="Person or organization"
                    path="/parties"
                    value={partyId}
                    map={partyOption}
                    onChange={(record) => setPartyId(record?.id ?? '')}
                  />
                ) : mode === 'person' ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-1">
                      Given name
                      <input name="givenName" required maxLength={120} />
                    </label>
                    <label className="grid gap-1">
                      Family name
                      <input name="familyName" required maxLength={120} />
                    </label>
                  </div>
                ) : (
                  <label className="grid gap-1">
                    Legal name
                    <input name="legalName" required minLength={2} maxLength={240} />
                  </label>
                )}
                <p className="text-xs text-slate-500">
                  Search existing records first to avoid registering the same person twice.
                </p>
              </>
            )}
          </>
        ) : null}
        {row.currentStep === 3 && !row.payload.propertyId ? (
          <>
            <label className="grid gap-1">
              Property name
              <input name="name" required minLength={2} maxLength={200} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1">
                Property type
                <select aria-label="Property type" name="propertyType" required>
                  {[
                    'APARTMENT_BUILDING',
                    'VILLA',
                    'COMMERCIAL_BUILDING',
                    'MIXED_USE',
                    'LAND',
                    'OTHER',
                  ].map((value) => (
                    <option key={value} value={value}>
                      {humanize(value)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                City
                <input name="city" required minLength={2} maxLength={100} />
              </label>
            </div>
            <label className="grid gap-1">
              Address
              <input name="addressLine1" maxLength={200} />
            </label>
          </>
        ) : null}
        {row.currentStep === 4 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1">
              Building name
              <input name="name" required minLength={2} maxLength={160} />
            </label>
            <label className="grid gap-1">
              Number of floors
              <input type="number" name="numberOfFloors" min={0} max={500} />
            </label>
          </div>
        ) : null}
        {row.currentStep === 5 ? (
          <>
            <label className="grid gap-1">
              Space name
              <input name="name" required minLength={2} maxLength={160} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1">
                Space type
                <select aria-label="Space type" name="typeCode" required>
                  <option value="">Choose type</option>
                  {types.data?.map((type) => (
                    <option key={type.code} value={type.code}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                Usable area (m²)
                <input name="usableArea" type="number" min="0.01" step="0.01" />
              </label>
            </div>
            <RecordPicker
              label="Building"
              path={`/buildings?propertyId=${row.payload.propertyId}`}
              value={buildingId}
              map={(building) => ({ id: String(building.id), label: String(building.name) })}
              onChange={(building) => setBuildingId(building?.id ?? '')}
            />
            <p className="text-xs text-slate-500">
              Leave Building unselected for a standalone space.
            </p>
            <label className="grid gap-1">
              Permitted use (for land)
              <input name="permittedUse" maxLength={200} />
            </label>
            {types.isError ? (
              <p role="alert">
                Could not load space types.{' '}
                <button type="button" onClick={() => void types.refetch()}>
                  Retry
                </button>
              </p>
            ) : null}
          </>
        ) : null}
        <div>
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? 'Saving…' : label}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
