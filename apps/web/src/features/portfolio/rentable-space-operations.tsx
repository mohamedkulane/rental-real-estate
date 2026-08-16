'use client';

import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  api,
  canPerformAcrossBranches,
  hasCompanyPermission,
  type CursorPage,
  type Principal,
  userFacingError,
} from '@/lib/phase3-api';
import { EmptyState, LoadingState, StatusBadge } from '@/components/shared/ui';
import styles from './portfolio-console.module.css';

export interface SpaceOperationRecord {
  id: string;
  propertyId: string;
  spaceCode: string;
  name: string;
  status: string;
  type: { code: string; name: string };
  childRelations: { parentSpaceId: string; effectiveTo: string | null }[];
  property?: {
    name?: string;
    branchAssignments?: Array<{
      branchId: string;
      effectiveFrom: string;
      effectiveTo: string | null;
    }>;
  };
}
interface Amenity {
  id: string;
  name: string;
  active: boolean;
}
interface SpaceDetail extends SpaceOperationRecord {
  building?: { name: string } | null;
  versions: Array<{
    id: string;
    effectiveFrom: string;
    effectiveTo: string | null;
    usableArea: string | null;
    totalArea: string | null;
    areaUnit: string | null;
    floorNumber: number | null;
    capacity: number | null;
  }>;
  amenities: Array<{ amenity: Amenity }>;
}
interface DocumentRecord {
  id: string;
  displayName: string;
  categoryCode: string;
  accessClass: string;
  status: string;
  versions: Array<{ id: string; sequence: number; mimeType: string; sizeBytes: string }>;
}

const value = (form: FormData, key: string) => {
  const entry = form.get(key);
  return typeof entry === 'string' ? entry.trim() : '';
};

export function RentableSpaceOperations({
  principal,
  spaces,
  typeCatalog,
  onSaved,
}: {
  principal: Principal;
  spaces: SpaceOperationRecord[];
  typeCatalog: Array<{ id: string; code: string; name: string }>;
  onSaved: () => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<SpaceDetail | null>(null);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const selected = spaces.find((space) => space.id === selectedId);
  const isDescendant = (candidateId: string) => {
    let cursor: string | undefined = candidateId;
    const visited = new Set<string>();
    while (cursor && !visited.has(cursor)) {
      if (cursor === selectedId) return true;
      visited.add(cursor);
      const record = spaces.find((space) => space.id === cursor);
      cursor = record?.childRelations.find((relation) => !relation.effectiveTo)?.parentSpaceId;
    }
    return false;
  };
  const parentOptions = useMemo(
    () =>
      selected
        ? spaces.filter(
            (candidate) =>
              candidate.id !== selected.id &&
              candidate.propertyId === selected.propertyId &&
              candidate.status !== 'RETIRED' &&
              !isDescendant(candidate.id),
          )
        : [],
    // selectedId is the graph root used by isDescendant.
    [selected, selectedId, spaces],
  );

  async function load(id: string) {
    setSelectedId(id);
    setDetail(null);
    setDocuments([]);
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const record = await api<SpaceDetail>(`/rentable-spaces/${id}`);
      const branchIds = (record.property?.branchAssignments ?? [])
        .filter(
          (assignment) =>
            assignment.effectiveFrom.slice(0, 10) <= principal.businessDate &&
            (!assignment.effectiveTo ||
              assignment.effectiveTo.slice(0, 10) > principal.businessDate),
        )
        .map((assignment) => assignment.branchId);
      const can = (permission: string) =>
        branchIds.length
          ? canPerformAcrossBranches(principal, permission, branchIds)
          : hasCompanyPermission(principal, permission);
      const [catalog, page] = await Promise.all([
        can('portfolio.amenity.read') ? api<Amenity[]>('/amenities') : Promise.resolve([]),
        can('portfolio.document.read')
          ? api<CursorPage<DocumentRecord>>(
              `/portfolio-documents?entityType=RentableSpace&entityId=${id}`,
            )
          : Promise.resolve({ items: [], pageInfo: { nextCursor: null, hasNextPage: false } }),
      ]);
      setDetail(record);
      setAmenities(catalog);
      setDocuments(page.items);
    } catch (cause) {
      setError(userFacingError(cause, 'Rentable-space operations could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedId && !spaces.some((space) => space.id === selectedId)) {
      setSelectedId('');
      setDetail(null);
    }
  }, [selectedId, spaces]);

  async function mutate(
    event: FormEvent<HTMLFormElement> | null,
    path: string,
    method: 'POST' | 'PATCH' | 'DELETE',
    body?: unknown,
  ) {
    event?.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      await onSaved();
      if (selectedId) await load(selectedId);
      toast.success('Rentable space updated.');
    } catch (cause) {
      const message = userFacingError(cause, 'The change could not be saved.');
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const currentVersion =
    detail?.versions.find((version) => !version.effectiveTo) ?? detail?.versions[0];
  const assignedAmenities = detail?.amenities.map((item) => item.amenity) ?? [];
  const availableAmenities = amenities.filter(
    (amenity) =>
      amenity.active && !assignedAmenities.some((assigned) => assigned.id === amenity.id),
  );

  return (
    <section className="space-y-5 border-t border-slate-200 pt-5">
      <div>
        <h2 className="text-base font-bold text-slate-900">Manage a rentable space</h2>
        <p className="text-sm text-slate-500">
          Measurements, hierarchy, partitioning, amenities, documents, and retirement preserve
          business history.
        </p>
      </div>
      <label className="block text-sm font-semibold">
        Rentable space
        <select value={selectedId} onChange={(event) => void load(event.target.value)}>
          <option value="">Choose a space</option>
          {spaces.map((space) => (
            <option key={space.id} value={space.id}>
              {space.spaceCode} — {space.name}
            </option>
          ))}
        </select>
      </label>
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}
      {loading ? <LoadingState label="Loading rentable-space details" /> : null}
      {!loading && selectedId && !detail ? (
        <EmptyState
          title="Details unavailable"
          description="The selected rentable space could not be loaded."
        />
      ) : null}
      {detail ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between rounded-lg border border-slate-200 p-3">
            <div>
              <strong>{detail.name}</strong>
              <p className="text-xs text-slate-500">
                {detail.spaceCode} · {detail.type.name}
                {detail.building ? ` · ${detail.building.name}` : ''}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {currentVersion?.usableArea ?? 'Area not recorded'} {currentVersion?.areaUnit ?? ''}
              </p>
            </div>
            <StatusBadge value={detail.status} />
          </div>

          {detail.status !== 'RETIRED' ? (
            <form
              className={styles.form}
              onSubmit={(event) => {
                const form = new FormData(event.currentTarget);
                void mutate(event, `/rentable-spaces/${detail.id}/measurements`, 'POST', {
                  effectiveFrom: value(form, 'effectiveFrom'),
                  usableArea: value(form, 'usableArea'),
                  totalArea: value(form, 'totalArea') || undefined,
                  areaUnit: value(form, 'areaUnit'),
                  reason: value(form, 'reason'),
                });
              }}
            >
              <h3>Correct effective measurement</h3>
              <div className={styles.row}>
                <label>
                  Usable area
                  <input name="usableArea" inputMode="decimal" required />
                </label>
                <label>
                  Total area
                  <input name="totalArea" inputMode="decimal" />
                </label>
                <label>
                  Area unit
                  <select name="areaUnit" defaultValue={currentVersion?.areaUnit ?? 'SQM'}>
                    <option>SQM</option>
                    <option>SQFT</option>
                    <option>ACRE</option>
                    <option>HECTARE</option>
                  </select>
                </label>
              </div>
              <div className={styles.row}>
                <label>
                  Effective from
                  <input
                    name="effectiveFrom"
                    type="date"
                    min={principal.businessDate}
                    defaultValue={principal.businessDate}
                    required
                  />
                </label>
                <label>
                  Reason
                  <input name="reason" minLength={3} required />
                </label>
              </div>
              <button className={styles.submit} disabled={busy}>
                Save measurement
              </button>
            </form>
          ) : null}

          {detail.status !== 'RETIRED' ? (
            <form
              className={styles.form}
              onSubmit={(event) => {
                const form = new FormData(event.currentTarget);
                void mutate(event, `/rentable-spaces/${detail.id}/parent`, 'POST', {
                  parentSpaceId: value(form, 'parentSpaceId'),
                  effectiveFrom: value(form, 'effectiveFrom'),
                  reason: value(form, 'reason'),
                });
              }}
            >
              <h3>Change parent</h3>
              <label>
                Eligible parent
                <select name="parentSpaceId" required>
                  <option value="">Choose a parent</option>
                  {parentOptions.map((space) => (
                    <option key={space.id} value={space.id}>
                      {space.spaceCode} — {space.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-slate-500">
                Only non-retired spaces in the same property are shown; self and descendants are
                excluded.
              </p>
              <div className={styles.row}>
                <label>
                  Effective from
                  <input
                    name="effectiveFrom"
                    type="date"
                    min={principal.businessDate}
                    defaultValue={principal.businessDate}
                    required
                  />
                </label>
                <label>
                  Reason
                  <input name="reason" minLength={3} required />
                </label>
              </div>
              <button className={styles.submit} disabled={busy || !parentOptions.length}>
                Change parent
              </button>
            </form>
          ) : null}

          {detail.status !== 'RETIRED' ? (
            <form
              className={styles.form}
              onSubmit={(event) => {
                const form = new FormData(event.currentTarget);
                void mutate(event, `/rentable-spaces/${detail.id}/partition`, 'POST', {
                  effectiveFrom: value(form, 'effectiveFrom'),
                  areaUnit: value(form, 'areaUnit'),
                  reason: value(form, 'reason'),
                  children: [
                    {
                      typeCode: value(form, 'typeCode'),
                      spaceCode: value(form, 'spaceCode') || undefined,
                      name: value(form, 'name'),
                      usableArea: value(form, 'usableArea'),
                      totalArea: value(form, 'totalArea') || undefined,
                    },
                  ],
                });
              }}
            >
              <h3>Create one partition child</h3>
              <div className={styles.row}>
                <label>
                  Child type
                  <select name="typeCode" required>
                    {typeCatalog.map((type) => (
                      <option key={type.id} value={type.code}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Child code (optional)
                  <input name="spaceCode" />
                </label>
                <label>
                  Child name
                  <input name="name" required />
                </label>
              </div>
              <div className={styles.row}>
                <label>
                  Usable area
                  <input name="usableArea" inputMode="decimal" required />
                </label>
                <label>
                  Total area
                  <input name="totalArea" inputMode="decimal" />
                </label>
                <label>
                  Area unit
                  <select name="areaUnit" defaultValue={currentVersion?.areaUnit ?? 'SQM'}>
                    <option>SQM</option>
                    <option>SQFT</option>
                    <option>ACRE</option>
                    <option>HECTARE</option>
                  </select>
                </label>
              </div>
              <div className={styles.row}>
                <label>
                  Effective from
                  <input
                    name="effectiveFrom"
                    type="date"
                    min={principal.businessDate}
                    defaultValue={principal.businessDate}
                    required
                  />
                </label>
                <label>
                  Reason
                  <input name="reason" minLength={3} required />
                </label>
              </div>
              <button className={styles.submit} disabled={busy}>
                Create child atomically
              </button>
            </form>
          ) : null}

          <div className={styles.form}>
            <h3>Amenities</h3>
            <div className="flex flex-wrap gap-2">
              {assignedAmenities.length ? (
                assignedAmenities.map((amenity) => (
                  <span
                    key={amenity.id}
                    className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
                  >
                    {amenity.name}{' '}
                    <button
                      type="button"
                      aria-label={`Remove ${amenity.name}`}
                      disabled={busy}
                      onClick={() =>
                        void mutate(
                          null,
                          `/rentable-spaces/${detail.id}/amenities/${amenity.id}`,
                          'DELETE',
                        )
                      }
                    >
                      ×
                    </button>
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">No amenities assigned.</span>
              )}
            </div>
            {availableAmenities.length ? (
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  const form = new FormData(event.currentTarget);
                  void mutate(event, `/rentable-spaces/${detail.id}/amenities`, 'POST', {
                    amenityId: value(form, 'amenityId'),
                  });
                }}
              >
                <select name="amenityId" required>
                  <option value="">Choose amenity</option>
                  {availableAmenities.map((amenity) => (
                    <option key={amenity.id} value={amenity.id}>
                      {amenity.name}
                    </option>
                  ))}
                </select>
                <button disabled={busy}>Assign</button>
              </form>
            ) : null}
          </div>

          <div className={styles.form}>
            <h3>Documents</h3>
            {documents.length ? (
              documents.map((document) => (
                <article key={document.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex justify-between gap-2">
                    <div>
                      <strong>{document.displayName}</strong>
                      <p className="text-xs text-slate-500">
                        {document.categoryCode} · {document.versions.length} version
                        {document.versions.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <StatusBadge value={document.status} />
                  </div>
                  <form
                    className="mt-3 grid gap-2 md:grid-cols-4"
                    onSubmit={(event) => {
                      const form = new FormData(event.currentTarget);
                      void mutate(event, `/portfolio-documents/${document.id}`, 'PATCH', {
                        displayName: value(form, 'displayName'),
                        categoryCode: value(form, 'categoryCode'),
                        accessClass: value(form, 'accessClass'),
                        status: value(form, 'status'),
                      });
                    }}
                  >
                    <input
                      aria-label="Document name"
                      name="displayName"
                      defaultValue={document.displayName}
                      required
                    />
                    <input
                      aria-label="Category"
                      name="categoryCode"
                      defaultValue={document.categoryCode}
                      required
                    />
                    <select
                      aria-label="Access class"
                      name="accessClass"
                      defaultValue={document.accessClass}
                    >
                      <option>INTERNAL</option>
                      <option>CONFIDENTIAL</option>
                      <option>RESTRICTED</option>
                    </select>
                    <select aria-label="Status" name="status" defaultValue={document.status}>
                      <option>PENDING</option>
                      <option>ACTIVE</option>
                      <option>ARCHIVED</option>
                    </select>
                    <button className="md:col-span-4" disabled={busy}>
                      Save metadata
                    </button>
                  </form>
                </article>
              ))
            ) : (
              <EmptyState
                title="No documents"
                description="No documents are linked to this rentable space."
              />
            )}
          </div>

          {detail.status !== 'RETIRED' ? (
            <form
              className={styles.form}
              onSubmit={(event) => {
                const form = new FormData(event.currentTarget);
                void mutate(event, `/rentable-spaces/${detail.id}/retire`, 'POST', {
                  effectiveDate: value(form, 'effectiveDate'),
                  reason: value(form, 'reason'),
                });
              }}
            >
              <h3>Retire rentable space</h3>
              <p className="text-sm text-slate-500">
                Active children must be retired first. History and documents remain preserved.
              </p>
              <div className={styles.row}>
                <label>
                  Effective date
                  <input
                    name="effectiveDate"
                    type="date"
                    min={principal.businessDate}
                    defaultValue={principal.businessDate}
                    required
                  />
                </label>
                <label>
                  Reason
                  <input name="reason" minLength={3} required />
                </label>
              </div>
              <button className={styles.submit} disabled={busy}>
                Retire space
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
