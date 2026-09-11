'use client';

import { useRef, useState, type FormEvent } from 'react';
import { api, type Principal, userFacingError } from '@/lib/phase3-api';
import type { WorkflowRecord } from './workflow-types';

export function WorkflowServiceCreate({
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
  const request = useRef<{ signature: string; key: string } | null>(null);
  if (row.payload.serviceEngagementId || !row.payload.propertyId) return null;
  const fixedModel =
    row.type === 'RENTAL_BROKERAGE'
      ? 'RENTAL_BROKERAGE'
      : row.type === 'FULL_MANAGEMENT'
        ? 'FULL_MANAGEMENT'
        : '';
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    onBusyChange(true);
    setError('');
    const data = new FormData(event.currentTarget);
    const read = (name: string) => {
      const value = data.get(name);
      return typeof value === 'string' ? value.trim() : '';
    };
    const model = fixedModel || read('serviceModel');
    const notes = read('notes');
    const values = {
      engagement: {
        serviceModel: model,
        propertyId: row.payload.propertyId,
        effectiveFrom: read('effectiveFrom'),
        ...(notes ? { notes } : {}),
      },
    };
    const signature = JSON.stringify(values);
    if (request.current?.signature !== signature)
      request.current = { signature, key: crypto.randomUUID() };
    try {
      const saved = await api<WorkflowRecord>(`/workflows/${row.id}/commands`, {
        method: 'POST',
        body: JSON.stringify({
          command: 'ENGAGEMENT',
          expectedVersion: row.version,
          idempotencyKey: request.current.key,
          ...values,
        }),
      });
      request.current = null;
      onSaved(saved);
    } catch (cause) {
      setError(userFacingError(cause));
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }
  return (
    <form
      className="mt-6 grid gap-4 border-t border-slate-200 pt-5"
      onSubmit={(event) => void submit(event)}
    >
      <h3 className="text-base font-semibold">Create the company service</h3>
      <p className="text-sm text-slate-600">
        The service covers the selected property. You can manage a narrower space scope later from
        Service Engagements.
      </p>
      {error ? (
        <p role="alert" className="feedback feedback-error">
          {error}
        </p>
      ) : null}
      {!fixedModel ? (
        <label className="grid gap-1 text-sm">
          Authority route
          <select name="serviceModel" required>
            <option value="SALE_BROKERAGE">Sale Brokerage — external owner</option>
            <option value="COMPANY_OWNED">Company Owned — company asset</option>
          </select>
        </label>
      ) : null}
      <label className="grid gap-1 text-sm">
        Effective date
        <input name="effectiveFrom" type="date" required defaultValue={principal.businessDate} />
      </label>
      <label className="grid gap-1 text-sm">
        Notes (optional)
        <textarea name="notes" maxLength={4000} rows={3} />
      </label>
      <button className="button primary justify-self-start" disabled={busy}>
        {busy ? 'Saving…' : 'Create company service'}
      </button>
    </form>
  );
}
