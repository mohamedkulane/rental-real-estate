'use client';

import { SearchableSelect } from '@/components/shared/searchable-select';
import { Download, Eye, FileText, History, Pencil, Upload, X } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { api, apiUrl, type CursorPage, userFacingError } from '@/lib/phase3-api';
import { documentTypeLabel, formatFileSize, humanize } from '@/lib/presentation';
import { EmptyState, LoadingState, StatusBadge } from '@/components/shared/ui';

interface DocumentVersionRecord {
  id: string;
  sequence: number;
  originalFilename: string;
  mimeType: string;
  sizeBytes: string;
  uploadedAt: string;
  expiresOn: string | null;
}

interface DocumentRecord {
  id: string;
  displayName: string;
  categoryCode: string;
  accessClass: string;
  status: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  versions: DocumentVersionRecord[];
}

const categories = [
  ['TITLE_DEED', 'Title Deed'],
  ['OWNERSHIP_CERTIFICATE', 'Ownership Certificate'],
  ['SURVEY', 'Survey'],
  ['PLAN', 'Plan'],
  ['REGISTRATION_DOCUMENT', 'Registration Document'],
  ['IDENTIFICATION', 'Identification'],
  ['OTHER', 'Other'],
] as const;

const value = (form: FormData, key: string) => {
  const entry = form.get(key);
  return typeof entry === 'string' ? entry.trim() : '';
};

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#0D47A1] focus:ring-2 focus:ring-[#E3F2FD]';

function ActionButton({
  children,
  onClick,
  href,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const className =
    'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-[#2196F3] hover:text-[#0D47A1]';
  return href ? (
    <a className={className} href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ) : (
    <button className={className} type="button" onClick={onClick}>
      {children}
    </button>
  );
}

export function EntityDocuments({
  entityType,
  entityId,
  canManage,
  onUploaded,
}: {
  entityType: 'Property' | 'RentableSpace' | 'Owner' | 'MaintenanceRequest' | 'WorkOrder' | 'Inspection' | 'DefectIssue' | 'Vendor';
  entityId: string;
  canManage: boolean;
  onUploaded?: (documentId: string) => void;
}) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState('');
  const [versionsId, setVersionsId] = useState('');
  const [newVersionId, setNewVersionId] = useState('');
  const [pageInfo, setPageInfo] = useState<CursorPage<DocumentRecord>['pageInfo']>({
    hasNextPage: false,
    nextCursor: null,
  });
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const [pageIndex, setPageIndex] = useState(0);

  const load = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      setError('');
      try {
        const page = await api<CursorPage<DocumentRecord>>(
          `/portfolio-documents?entityType=${entityType}&entityId=${entityId}&limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
        );
        setDocuments(page.items);
        setPageInfo(page.pageInfo);
        if (!cursor) {
          setPageIndex(0);
          setCursors([undefined]);
        }
      } catch (cause) {
        setError(userFacingError(cause, 'Documents could not be loaded.'));
      } finally {
        setLoading(false);
      }
    },
    [entityId, entityType],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    form.set('entityType', entityType);
    form.set('entityId', entityId);
    form.set('purpose', 'SUPPORTING_DOCUMENT');
    try {
      const uploaded = await api<DocumentRecord>('/portfolio-documents/upload', {
        method: 'POST',
        body: form,
      });
      onUploaded?.(uploaded.id);
      setShowUpload(false);
      setSelectedFile(null);
      await load();
    } catch (cause) {
      setError(userFacingError(cause, 'The document could not be uploaded.'));
    } finally {
      setBusy(false);
    }
  };

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
          notes: value(form, 'notes'),
        }),
      });
      setEditingId('');
      await load();
    } catch (cause) {
      setError(userFacingError(cause, 'Document metadata could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  const uploadVersion = async (event: FormEvent<HTMLFormElement>, documentId: string) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/portfolio-documents/${documentId}/versions`, {
        method: 'POST',
        body: new FormData(event.currentTarget),
      });
      setNewVersionId('');
      await load();
    } catch (cause) {
      setError(userFacingError(cause, 'The new document version could not be uploaded.'));
    } finally {
      setBusy(false);
    }
  };

  const archive = async (documentId: string) => {
    if (!window.confirm('Archive this document? Existing versions remain preserved.')) return;
    setBusy(true);
    setError('');
    try {
      await api(`/portfolio-documents/${documentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'ARCHIVED' }),
      });
      await load();
    } catch (cause) {
      setError(userFacingError(cause, 'The document could not be archived.'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label="Loading documents" />;

  const uploadButton = canManage ? (
    <button
      type="button"
      onClick={() => setShowUpload(true)}
      className="inline-flex items-center gap-2 rounded-lg bg-[#0D47A1] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#08376f]"
    >
      <Upload className="h-4 w-4" /> Upload document
    </button>
  ) : null;

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">Documents</h3>
          <p className="text-xs text-slate-500">
            Private files, immutable versions, and business-readable metadata.
          </p>
        </div>
        {uploadButton}
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      {showUpload ? (
        <form
          className="space-y-4 rounded-xl border border-[#90CAF9] bg-[#E3F2FD]/40 p-4"
          onSubmit={(event) => void upload(event)}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="font-bold text-slate-900">Upload document</h4>
              <p className="text-xs text-slate-500">
                PDF, image, Word, Excel, or text up to the configured secure limit.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close upload form"
              onClick={() => setShowUpload(false)}
              className="rounded-lg p-2 text-slate-500 hover:bg-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs font-bold text-slate-600">
              <span>Document title</span>
              <input className={inputClass} name="title" required placeholder="Title Deed" />
            </label>
            <label className="space-y-1 text-xs font-bold text-slate-600">
              <span>Category</span>
              <SearchableSelect className={inputClass} name="categoryCode" required>
                {categories.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </SearchableSelect>
            </label>
            <label className="space-y-1 text-xs font-bold text-slate-600">
              <span>Access</span>
              <SearchableSelect className={inputClass} name="accessClass" defaultValue="INTERNAL">
                <option value="INTERNAL">Internal</option>
                <option value="CONFIDENTIAL">Confidential</option>
                <option value="RESTRICTED">Restricted</option>
              </SearchableSelect>
            </label>
            <label className="space-y-1 text-xs font-bold text-slate-600">
              <span>File</span>
              <input
                className={inputClass}
                name="file"
                type="file"
                required
                accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx,.xls,.xlsx"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          {selectedFile ? (
            <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-600">
              {selectedFile.name} · {documentTypeLabel(selectedFile.type)} ·{' '}
              {formatFileSize(selectedFile.size)}
            </p>
          ) : null}
          <label className="block space-y-1 text-xs font-bold text-slate-600">
            <span>Notes (optional)</span>
            <textarea className={inputClass} name="notes" rows={2} />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowUpload(false)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold"
            >
              Cancel
            </button>
            <button
              disabled={busy}
              className="rounded-lg bg-[#0D47A1] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? 'Uploading...' : 'Upload document'}
            </button>
          </div>
        </form>
      ) : null}

      {documents.length ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="divide-y divide-slate-200">
            {documents.map((document) => {
              const current = document.versions[0];
              const contentPath = current
                ? `/portfolio-documents/${document.id}/versions/${current.id}/content`
                : '';
              return (
                <article key={document.id} className="p-4">
                  <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                    <div className="flex min-w-0 gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E3F2FD] text-[#0D47A1]">
                        <FileText className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-sm text-slate-950">{document.displayName}</strong>
                          <StatusBadge value={document.status} />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {current
                            ? `${documentTypeLabel(current.mimeType)} · ${formatFileSize(current.sizeBytes)} · Version ${current.sequence}`
                            : 'No file version'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Updated {document.updatedAt.slice(0, 10)} ·{' '}
                          {humanize(document.accessClass)} · {humanize(document.categoryCode)}
                        </p>
                        {current ? (
                          <p className="mt-1 truncate text-xs text-slate-400">
                            File: {current.originalFilename}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {current ? (
                        <>
                          <ActionButton href={apiUrl(contentPath + '?disposition=inline')}>
                            <Eye className="h-3.5 w-3.5" /> View
                          </ActionButton>
                          <ActionButton href={apiUrl(contentPath + '?disposition=attachment')}>
                            <Download className="h-3.5 w-3.5" /> Download
                          </ActionButton>
                        </>
                      ) : null}
                      <ActionButton
                        onClick={() => setVersionsId(versionsId === document.id ? '' : document.id)}
                      >
                        <History className="h-3.5 w-3.5" /> Versions
                      </ActionButton>
                      {canManage ? (
                        <>
                          <ActionButton
                            onClick={() =>
                              setEditingId(editingId === document.id ? '' : document.id)
                            }
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit metadata
                          </ActionButton>
                          <ActionButton
                            onClick={() =>
                              setNewVersionId(newVersionId === document.id ? '' : document.id)
                            }
                          >
                            <Upload className="h-3.5 w-3.5" /> New version
                          </ActionButton>
                          {document.status !== 'ARCHIVED' ? (
                            <ActionButton onClick={() => void archive(document.id)}>
                              Archive
                            </ActionButton>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </div>

                  {versionsId === document.id ? (
                    <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full min-w-[620px] text-left text-xs">
                        <thead className="bg-slate-50 uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-3 py-2">Version</th>
                            <th className="px-3 py-2">File</th>
                            <th className="px-3 py-2">Uploaded</th>
                            <th className="px-3 py-2">Size</th>
                            <th className="px-3 py-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {document.versions.map((version, index) => {
                            const path = `/portfolio-documents/${document.id}/versions/${version.id}/content`;
                            return (
                              <tr key={version.id} className="border-t border-slate-100">
                                <td className="px-3 py-2 font-bold">
                                  Version {version.sequence}
                                  {index === 0 ? ' - Current' : ''}
                                </td>
                                <td className="px-3 py-2">{version.originalFilename}</td>
                                <td className="px-3 py-2">{version.uploadedAt.slice(0, 10)}</td>
                                <td className="px-3 py-2">{formatFileSize(version.sizeBytes)}</td>
                                <td className="px-3 py-2">
                                  <a
                                    className="font-bold text-[#0D47A1]"
                                    href={apiUrl(path + '?disposition=attachment')}
                                  >
                                    Download
                                  </a>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : null}

                  {newVersionId === document.id ? (
                    <form
                      className="mt-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-end"
                      onSubmit={(event) => void uploadVersion(event, document.id)}
                    >
                      <label className="flex-1 space-y-1 text-xs font-bold text-slate-600">
                        <span>Choose replacement file</span>
                        <input
                          className={inputClass}
                          type="file"
                          name="file"
                          required
                          accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx,.xls,.xlsx"
                        />
                      </label>
                      <button
                        disabled={busy}
                        className="rounded-lg bg-[#0D47A1] px-4 py-2 text-sm font-bold text-white"
                      >
                        Upload new version
                      </button>
                    </form>
                  ) : null}

                  {editingId === document.id ? (
                    <form
                      className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2"
                      onSubmit={(event) => void update(event, document.id)}
                    >
                      <label className="space-y-1 text-xs font-bold text-slate-600">
                        <span>Document title</span>
                        <input
                          className={inputClass}
                          name="displayName"
                          defaultValue={document.displayName}
                          required
                        />
                      </label>
                      <label className="space-y-1 text-xs font-bold text-slate-600">
                        <span>Category</span>
                        <SearchableSelect
                          className={inputClass}
                          name="categoryCode"
                          defaultValue={document.categoryCode}
                        >
                          {categories.map(([code, label]) => (
                            <option key={code} value={code}>
                              {label}
                            </option>
                          ))}
                        </SearchableSelect>
                      </label>
                      <label className="space-y-1 text-xs font-bold text-slate-600">
                        <span>Access</span>
                        <SearchableSelect
                          className={inputClass}
                          name="accessClass"
                          defaultValue={document.accessClass}
                        >
                          <option value="INTERNAL">Internal</option>
                          <option value="CONFIDENTIAL">Confidential</option>
                          <option value="RESTRICTED">Restricted</option>
                        </SearchableSelect>
                      </label>
                      <label className="space-y-1 text-xs font-bold text-slate-600">
                        <span>Notes</span>
                        <input
                          className={inputClass}
                          name="notes"
                          defaultValue={document.notes ?? ''}
                        />
                      </label>
                      <div className="flex justify-end gap-2 sm:col-span-2">
                        <button
                          type="button"
                          onClick={() => setEditingId('')}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold"
                        >
                          Cancel
                        </button>
                        <button
                          disabled={busy}
                          className="rounded-lg bg-[#0D47A1] px-3 py-2 text-sm font-bold text-white"
                        >
                          Save metadata
                        </button>
                      </div>
                    </form>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState
          title={`No documents have been added to this ${entityType.toLowerCase()}.`}
          description={`Upload supporting ${entityType.toLowerCase()} records, plans, and other documents.`}
          action={uploadButton}
        />
      )}
      <nav aria-label="Document pages" className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          className="button secondary"
          disabled={loading || busy || pageIndex === 0}
          onClick={() => {
            const previous = pageIndex - 1;
            setPageIndex(previous);
            void load(cursors[previous]);
          }}
        >
          Previous documents
        </button>
        <span className="text-xs text-slate-500">
          Page {pageIndex + 1} · {documents.length} on this page
        </span>
        <button
          type="button"
          className="button secondary"
          disabled={loading || busy || !pageInfo.hasNextPage}
          onClick={() => {
            const cursor = pageInfo.nextCursor;
            if (!cursor) return;
            setCursors((current) => [...current.slice(0, pageIndex + 1), cursor]);
            setPageIndex(pageIndex + 1);
            void load(cursor);
          }}
        >
          Next documents
        </button>
      </nav>
    </section>
  );
}
