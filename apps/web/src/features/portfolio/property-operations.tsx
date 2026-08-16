'use client';

import { SearchableSelect } from '@/components/shared/searchable-select';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  api,
  apiCached,
  canPerformAcrossBranches,
  hasCompanyPermission,
  type CursorPage,
  type Principal,
  userFacingError,
} from '@/lib/phase3-api';
import { documentTypeLabel, formatFileSize, humanize } from '@/lib/presentation';
import { EmptyState, LoadingState, StatusBadge } from '@/components/shared/ui';
import type { BranchOption, PropertyRecord } from './pages/property-registry';
import type { PropertyDetailSection } from './portfolio-ia';

interface BuildingRecord {
  id: string;
  buildingCode: string;
  name: string;
  numberOfFloors: number | null;
  status: 'ACTIVE' | 'INACTIVE' | 'RETIRED';
  spaces?: Array<{ id: string; name: string; status: string }>;
}
interface AmenityRecord {
  id: string;
  code: string;
  name: string;
  active: boolean;
}
interface DocumentRecord {
  id: string;
  displayName: string;
  categoryCode: string;
  accessClass: 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  status: 'PENDING' | 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  versions: Array<{
    id: string;
    sequence: number;
    mimeType: string;
    sizeBytes: string;
    effectiveFrom: string | null;
    expiresOn: string | null;
  }>;
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';
const value = (form: FormData, key: string) => {
  const entry = form.get(key);
  return typeof entry === 'string' ? entry.trim() : '';
};

export function PropertyOperations({
  property: initialProperty,
  branches,
  principal,
  section,
}: {
  property: PropertyRecord;
  branches: BranchOption[];
  principal: Principal;
  section: PropertyDetailSection;
}) {
  const [property, setProperty] = useState(initialProperty);
  const [buildings, setBuildings] = useState<BuildingRecord[]>([]);
  const [amenities, setAmenities] = useState<AmenityRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const branchScopeKey = property.branchAssignments
    .map((assignment) =>
      [assignment.branchId, assignment.effectiveFrom, assignment.effectiveTo ?? ''].join(':'),
    )
    .sort()
    .join('|');
  const branchIds = useMemo(
    () =>
      property.branchAssignments
        .filter(
          (assignment) =>
            assignment.effectiveFrom.slice(0, 10) <= principal.businessDate &&
            (!assignment.effectiveTo ||
              assignment.effectiveTo.slice(0, 10) > principal.businessDate),
        )
        .map((assignment) => assignment.branchId),
    // Keep permission callbacks stable when a refresh returns the same effective assignments.
    [branchScopeKey, principal.businessDate],
  );
  const can = useCallback(
    (permission: string) =>
      branchIds.length
        ? canPerformAcrossBranches(principal, permission, branchIds)
        : hasCompanyPermission(principal, permission),
    [branchIds, principal],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextProperty, nextBuildings, amenityCatalog, documentPage] = await Promise.all([
        api<PropertyRecord>(`/properties/${initialProperty.id}`),
        section === 'buildings' && can('portfolio.building.read')
          ? api<BuildingRecord[]>(`/properties/${initialProperty.id}/buildings`)
          : Promise.resolve([]),
        section === 'amenities' && can('portfolio.amenity.read')
          ? apiCached<AmenityRecord[]>('/amenities')
          : Promise.resolve([]),
        section === 'documents' && can('portfolio.document.read')
          ? api<CursorPage<DocumentRecord>>(
              `/portfolio-documents?entityType=Property&entityId=${initialProperty.id}`,
            )
          : Promise.resolve({ items: [], pageInfo: { nextCursor: null, hasNextPage: false } }),
      ]);
      setProperty(nextProperty);
      setBuildings(nextBuildings);
      setAmenities(amenityCatalog);
      setDocuments(documentPage.items);
    } catch (cause) {
      setError(userFacingError(cause, 'This property section could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [can, initialProperty.id, section]);

  useEffect(() => {
    void load();
  }, [load]);

  const mutate = async (path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) => {
    setBusy(true);
    setError('');
    try {
      await api(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      await load();
      toast.success('Property updated.');
    } catch (cause) {
      const message = userFacingError(cause, 'The change could not be saved.');
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label={`Loading ${section.replace('-', ' ')}`} />;
  const currentAssignment = property.branchAssignments.find(
    (assignment) =>
      assignment.effectiveFrom.slice(0, 10) <= principal.businessDate &&
      (!assignment.effectiveTo || assignment.effectiveTo.slice(0, 10) > principal.businessDate),
  );
  const historicalAssignments = property.branchAssignments.filter(
    (assignment) => assignment !== currentAssignment,
  );
  const assignedAmenities = property.amenities?.map((item) => item.amenity) ?? [];
  const availableAmenities = amenities.filter(
    (amenity) =>
      amenity.active && !assignedAmenities.some((assigned) => assigned.id === amenity.id),
  );

  return (
    <div className="space-y-6">
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      <section
        className={
          (section === 'branch-history' ? '' : 'hidden ') +
          'space-y-3 rounded-xl border border-slate-200 p-4'
        }
      >
        <div>
          <h3 className="font-bold text-slate-900">Operating branch</h3>
          <p className="text-xs text-slate-500">
            Current assignment and complete effective-dated history.
          </p>
        </div>
        <section className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Current operating branch
          </h4>
          {currentAssignment ? (
            <div className="flex flex-wrap justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
              <strong>{currentAssignment.branch?.name ?? 'Branch record unavailable'}</strong>
              <span>{currentAssignment.effectiveFrom.slice(0, 10)} — Present</span>
            </div>
          ) : (
            <EmptyState
              title="No current branch"
              description="This property has no effective operating branch assignment."
            />
          )}
        </section>
        <section className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Historical branch assignments
          </h4>
          {historicalAssignments.length ? (
            historicalAssignments.map((assignment) => (
              <div
                key={`${assignment.branchId}-${assignment.effectiveFrom}`}
                className="flex flex-wrap justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm"
              >
                <strong>{assignment.branch?.name ?? 'Branch record unavailable'}</strong>
                <span>
                  {assignment.effectiveFrom.slice(0, 10)} —{' '}
                  {assignment.effectiveTo?.slice(0, 10) ?? 'Scheduled / open'}
                </span>
              </div>
            ))
          ) : (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
              No historical branch assignments.
            </p>
          )}
        </section>
        {can('portfolio.property.update') ? (
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Transfer operating branch
          </h4>
        ) : null}{' '}
        {can('portfolio.property.update') ? (
          <form
            className="grid gap-3 md:grid-cols-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void mutate(`/properties/${property.id}/branch-transfers`, 'POST', {
                branchId: value(form, 'branchId'),
                effectiveFrom: value(form, 'effectiveFrom'),
                reason: value(form, 'reason'),
              });
            }}
          >
            <label className="text-sm font-semibold">
              New branch
              <SearchableSelect searchable className={inputClass} name="branchId" required>
                <option value="">Choose branch</option>
                {branches
                  .filter((branch) => !branchIds.includes(branch.id))
                  .map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
              </SearchableSelect>
            </label>
            <label className="text-sm font-semibold">
              Effective date
              <input
                className={inputClass}
                name="effectiveFrom"
                type="date"
                min={principal.businessDate}
                defaultValue={principal.businessDate}
                required
              />
            </label>
            <label className="text-sm font-semibold">
              Reason
              <input className={inputClass} name="reason" minLength={3} maxLength={500} required />
            </label>
            <button
              disabled={busy}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white md:col-span-3"
            >
              Transfer branch
            </button>
          </form>
        ) : null}
      </section>

      <section
        className={
          (section === 'buildings' ? '' : 'hidden ') +
          'space-y-3 rounded-xl border border-slate-200 p-4'
        }
      >
        <div>
          <h3 className="font-bold text-slate-900">Buildings</h3>
          <p className="text-xs text-slate-500">Create, update, and control building lifecycle.</p>
        </div>
        {!buildings.length ? (
          <EmptyState title="No buildings" description="This property has no building records." />
        ) : (
          buildings.map((building) => (
            <article key={building.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <strong>{building.name}</strong>
                  <p className="text-xs text-slate-500">
                    {building.buildingCode} · {building.numberOfFloors ?? 0} floors ·{' '}
                    {building.spaces?.length ?? 0} spaces
                  </p>
                </div>
                <StatusBadge value={building.status} />
              </div>
              {can('portfolio.building.manage') && building.status !== 'RETIRED' ? (
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <form
                    className="flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      void mutate(`/buildings/${building.id}`, 'PATCH', {
                        name: value(form, 'name'),
                        numberOfFloors: Number(value(form, 'floors')),
                      });
                    }}
                  >
                    <input
                      aria-label="Building name"
                      className={inputClass}
                      name="name"
                      defaultValue={building.name}
                      required
                    />
                    <input
                      aria-label="Floors"
                      className={inputClass}
                      name="floors"
                      type="number"
                      min="0"
                      defaultValue={building.numberOfFloors ?? 0}
                      required
                    />
                    <button
                      disabled={busy}
                      className="rounded-lg border border-slate-300 px-3 text-sm font-bold"
                    >
                      Save
                    </button>
                  </form>
                  <form
                    className="flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      void mutate(`/buildings/${building.id}/status`, 'POST', {
                        status: value(form, 'status'),
                        reason: value(form, 'reason'),
                      });
                    }}
                  >
                    <SearchableSelect
                      searchable={false}
                      aria-label="Building status"
                      className={inputClass}
                      name="status"
                      required
                    >
                      {building.status === 'ACTIVE' ? (
                        <option value="INACTIVE">Deactivate</option>
                      ) : (
                        <>
                          <option value="ACTIVE">Reactivate</option>
                          <option value="RETIRED">Retire</option>
                        </>
                      )}
                    </SearchableSelect>
                    <input
                      aria-label="Status reason"
                      className={inputClass}
                      name="reason"
                      minLength={3}
                      placeholder="Reason"
                      required
                    />
                    <button
                      disabled={busy}
                      className="rounded-lg border border-slate-300 px-3 text-sm font-bold"
                    >
                      Apply
                    </button>
                  </form>
                </div>
              ) : null}
            </article>
          ))
        )}
        {can('portfolio.building.manage') ? (
          <form
            className="grid gap-3 md:grid-cols-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void mutate(`/properties/${property.id}/buildings`, 'POST', {
                buildingCode: value(form, 'buildingCode'),
                name: value(form, 'name'),
                numberOfFloors: Number(value(form, 'numberOfFloors')),
              });
            }}
          >
            <label className="text-sm font-semibold">
              Building code
              <input className={inputClass} name="buildingCode" required />
            </label>
            <label className="text-sm font-semibold">
              Name
              <input className={inputClass} name="name" required />
            </label>
            <label className="text-sm font-semibold">
              Floors
              <input
                className={inputClass}
                name="numberOfFloors"
                type="number"
                min="0"
                defaultValue="0"
                required
              />
            </label>
            <button
              disabled={busy}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white md:col-span-3"
            >
              Add building
            </button>
          </form>
        ) : null}
      </section>

      <section
        className={
          (section === 'amenities' ? '' : 'hidden ') +
          'space-y-3 rounded-xl border border-slate-200 p-4'
        }
      >
        <div>
          <h3 className="font-bold text-slate-900">Amenities</h3>
          <p className="text-xs text-slate-500">
            Assign or remove catalog amenities from this property.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {assignedAmenities.length ? (
            assignedAmenities.map((amenity) => (
              <span
                key={amenity.id}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
              >
                {amenity.name}
                {can('portfolio.amenity.manage') ? (
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={`Remove ${amenity.name}`}
                    onClick={() =>
                      void mutate(`/properties/${property.id}/amenities/${amenity.id}`, 'DELETE')
                    }
                  >
                    ×
                  </button>
                ) : null}
              </span>
            ))
          ) : (
            <span className="text-sm text-slate-500">No amenities assigned.</span>
          )}
        </div>
        {can('portfolio.amenity.manage') && availableAmenities.length ? (
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void mutate(`/properties/${property.id}/amenities`, 'POST', {
                amenityId: value(form, 'amenityId'),
              });
            }}
          >
            <SearchableSelect
              searchable
              aria-label="Amenity"
              className={inputClass}
              name="amenityId"
              required
            >
              <option value="">Choose amenity</option>
              {availableAmenities.map((amenity) => (
                <option key={amenity.id} value={amenity.id}>
                  {amenity.name}
                </option>
              ))}
            </SearchableSelect>
            <button
              disabled={busy}
              className="rounded-lg border border-slate-300 px-4 text-sm font-bold"
            >
              Assign
            </button>
          </form>
        ) : null}
      </section>

      <section
        className={
          (section === 'documents' ? '' : 'hidden ') +
          'space-y-3 rounded-xl border border-slate-200 p-4'
        }
      >
        <div>
          <h3 className="font-bold text-slate-900">Documents</h3>
          <p className="text-xs text-slate-500">
            Review versions and maintain safe document metadata.
          </p>
        </div>
        {!can('portfolio.document.read') ? (
          <p className="text-sm text-slate-500">Document access is not authorized.</p>
        ) : !documents.length ? (
          <EmptyState
            title="No documents"
            description="No documents are linked to this property."
          />
        ) : (
          documents.map((document) => (
            <article key={document.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <strong>{document.displayName}</strong>
                  <p className="text-xs text-slate-500">
                    {humanize(document.categoryCode)} · {humanize(document.accessClass)} ·{' '}
                    {document.versions.length} version
                    {document.versions.length === 1 ? '' : 's'} · Added{' '}
                    {document.createdAt.slice(0, 10)}
                  </p>
                </div>
                <StatusBadge value={document.status} />
              </div>
              {document.versions.map((version) => (
                <p key={version.id} className="mt-2 text-xs text-slate-500">
                  Version {version.sequence} · {documentTypeLabel(version.mimeType)} ·{' '}
                  {formatFileSize(version.sizeBytes)}
                  {version.expiresOn ? ` · expires ${version.expiresOn.slice(0, 10)}` : ''}
                </p>
              ))}
              {can('portfolio.document.manage') ? (
                <form
                  className="mt-3 grid gap-2 md:grid-cols-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    void mutate(`/portfolio-documents/${document.id}`, 'PATCH', {
                      displayName: value(form, 'displayName'),
                      categoryCode: value(form, 'categoryCode'),
                      accessClass: value(form, 'accessClass'),
                      status: value(form, 'status'),
                    });
                  }}
                >
                  <label className="space-y-1 text-xs font-bold text-slate-600">
                    <span>Document name</span>
                    <input
                      className={inputClass}
                      name="displayName"
                      defaultValue={document.displayName}
                      required
                    />
                  </label>
                  <label className="space-y-1 text-xs font-bold text-slate-600">
                    <span>Category</span>
                    <input
                      className={inputClass}
                      name="categoryCode"
                      defaultValue={document.categoryCode}
                      required
                    />
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
                    <span>Status</span>
                    <SearchableSelect
                      searchable={false}
                      className={inputClass}
                      name="status"
                      defaultValue={document.status}
                    >
                      <option value="PENDING">Pending</option>
                      <option value="ACTIVE">Active</option>
                      <option value="ARCHIVED">Archived</option>
                    </SearchableSelect>
                  </label>
                  <button
                    disabled={busy}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold md:col-span-4"
                  >
                    Save metadata
                  </button>
                </form>
              ) : null}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
