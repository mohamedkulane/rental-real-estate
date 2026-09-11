'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { api, userFacingError } from '@/lib/phase3-api';
import type { WorkflowRecord } from './workflow-types';

export function WorkflowCancel({
  row,
  onClose,
  onSaved,
}: {
  row: WorkflowRecord;
  onClose: () => void;
  onSaved: (row: WorkflowRecord) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => previous?.focus();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const rawReason = new FormData(event.currentTarget).get('reason');
    const reason = typeof rawReason === 'string' ? rawReason.trim() : '';
    if (!reason) {
      setError('Enter a reason for cancellation.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const saved = await api<WorkflowRecord>(`/workflows/${row.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ expectedVersion: row.version, reason }),
      });
      onSaved(saved);
      onClose();
    } catch (cause) {
      setError(userFacingError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl backdrop:bg-slate-950/50"
    >
      <h2 id={titleId} className="text-xl font-semibold">
        Cancel this workflow?
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        This closes the draft. Owners, properties and other records already saved will not be
        deleted.
      </p>
      <form className="mt-5 grid gap-4" onSubmit={(event) => void submit(event)}>
        {error ? (
          <p role="alert" className="feedback feedback-error">
            {error}
          </p>
        ) : null}
        <label className="grid gap-1 text-sm">
          Reason
          <textarea name="reason" required maxLength={500} disabled={busy} />
        </label>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="button secondary" disabled={busy} onClick={onClose}>
            Keep working
          </button>
          <button className="button danger" disabled={busy}>
            {busy ? 'Cancelling…' : 'Cancel workflow'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
