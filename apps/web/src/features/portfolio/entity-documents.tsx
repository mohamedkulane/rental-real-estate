'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { api, type CursorPage, userFacingError } from '@/lib/phase3-api';
import { EmptyState, LoadingState, StatusBadge } from '@/components/shared/ui';

interface DocumentRecord {
  id: string;
  displayName: string;
  categoryCode: string;
  accessClass: string;
  status: string;
  createdAt: string;
  versions: Array<{
    id: string;
    sequence: number;
    mimeType: string;
    sizeBytes: string;
    expiresOn: string | null;
  }>;
}
const value = (form: FormData, key: string) => {
  const entry = form.get(key);
  return typeof entry === 'string' ? entry.trim() : '';
};
const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600';

export function EntityDocuments({
  entityType,
  entityId,
  canManage,
}: {
  entityType: 'Property' | 'RentableSpace' | 'Owner';
  entityId: string;
  canManage: boolean;
}) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const page = await api<CursorPage<DocumentRecord>>(
        `/portfolio-documents?entityType=${entityType}&entityId=${entityId}`,
      );
      setDocuments(page.items);
    } catch (cause) {
      setError(userFacingError(cause, 'Documents could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType]);
  useEffect(() => {
    void load();
  }, [load]);
  const update = async (event: FormEvent<HTMLFormElement>, documentId: string) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await api(`/portfolio-documents/${documentId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: value(form, 'displayName'),
          categoryCode: value(form, 'categoryCode'),
          accessClass: value(form, 'accessClass'),
          status: value(form, 'status'),
        }),
      });
      await load();
    } catch (cause) {
      setError(userFacingError(cause, 'Document metadata could not be saved.'));
    } finally {
      setBusy(false);
    }
  };
  if (loading) return <LoadingState label="Loading documents" />;
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-bold text-slate-900">Documents</h3>
        <p className="text-xs text-slate-500">Linked records, versions, and safe metadata.</p>
      </div>
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}
      {documents.length ? (
        documents.map((document) => (
          <article key={document.id} className="rounded-lg border border-slate-200 p-3">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <strong>{document.displayName}</strong>
                <p className="text-xs text-slate-500">
                  {document.categoryCode} · {document.versions.length} version
                  {document.versions.length === 1 ? '' : 's'} · Added{' '}
                  {document.createdAt.slice(0, 10)}
                </p>
              </div>
              <StatusBadge value={document.status} />
            </div>
            {document.versions.map((version) => (
              <p key={version.id} className="mt-1 text-xs text-slate-500">
                Version {version.sequence} · {version.mimeType} · {version.sizeBytes} bytes
                {version.expiresOn ? ` · expires ${version.expiresOn.slice(0, 10)}` : ''}
              </p>
            ))}
            {canManage ? (
              <form
                className="mt-3 grid gap-2 sm:grid-cols-2"
                onSubmit={(event) => void update(event, document.id)}
              >
                <input
                  aria-label="Document name"
                  className={inputClass}
                  name="displayName"
                  defaultValue={document.displayName}
                  required
                />
                <input
                  aria-label="Category"
                  className={inputClass}
                  name="categoryCode"
                  defaultValue={document.categoryCode}
                  required
                />
                <select
                  aria-label="Access class"
                  className={inputClass}
                  name="accessClass"
                  defaultValue={document.accessClass}
                >
                  <option>INTERNAL</option>
                  <option>CONFIDENTIAL</option>
                  <option>RESTRICTED</option>
                </select>
                <select
                  aria-label="Status"
                  className={inputClass}
                  name="status"
                  defaultValue={document.status}
                >
                  <option>PENDING</option>
                  <option>ACTIVE</option>
                  <option>ARCHIVED</option>
                </select>
                <button
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold sm:col-span-2"
                  disabled={busy}
                >
                  Save metadata
                </button>
              </form>
            ) : null}
          </article>
        ))
      ) : (
        <EmptyState
          title="No documents"
          description={`No documents are linked to this ${entityType.toLowerCase()}.`}
        />
      )}
    </section>
  );
}
