'use client';

import { SearchableSelect } from '@/components/shared/searchable-select';
import { EntityDocuments } from './entity-documents';
import { DetailTabs } from '@/components/shared/detail-tabs';

import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import toast from '@/lib/toast';
import {
  api,
  canPerformAcrossBranches,
  hasCompanyPermission,
  type Principal,
  userFacingError,
} from '@/lib/phase3-api';
import { EmptyState, LoadingState, StatusBadge } from '@/components/shared/ui';
import { humanize } from '@/lib/presentation';
import styles from './portfolio-console.module.css';
import { RENTABLE_SPACE_DETAIL_TABS, rentableSpaceActionAccess } from './portfolio-ia';

export type RentableSpaceDetailTab = (typeof RENTABLE_SPACE_DETAIL_TABS)[number]['key'];

export const RENTABLE_SPACE_RETIREMENT_CONFIRMATION =
  'Retire this rentable space? This lifecycle action is permanent for normal operations.';

export function confirmRentableSpaceRetirement(
  confirmAction: (message: string) => boolean,
): boolean {
  return confirmAction(RENTABLE_SPACE_RETIREMENT_CONFIRMATION);
}

export interface SpaceOperationRecord {
  id: string;
  propertyId: string;
  spaceCode: string;
  name: string;
  status: string;
  type: { code: string; name: string };
  childRelations: {
    parentSpaceId: string;
    effectiveFrom?: string;
    effectiveTo: string | null;
    parent?: { name: string; spaceCode: string };
  }[];
  parentRelations?: {
    effectiveFrom: string;
    effectiveTo: string | null;
    child?: { id: string; name: string; spaceCode: string; type?: { name: string } };
  }[];
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
  residentialProfile?: {
    bedrooms: number | null;
    bathrooms: string | null;
    kitchens: number | null;
    livingRooms: number | null;
    balconies: number | null;
    furnishedStatus: string | null;
  } | null;
  commercialProfile?: { frontageMeters: string | null; classification: string | null } | null;
  landProfile?: {
    dimensions: string | null;
    permittedUse: string;
    currentUse: string | null;
    boundaryDescription: string | null;
    roadAccess: string | null;
    fenced: boolean | null;
  } | null;
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
  initialSelectedId = '',
  initialTab = 'overview',
}: {
  principal: Principal;
  spaces: SpaceOperationRecord[];
  typeCatalog: Array<{ id: string; code: string; name: string }>;
  onSaved: () => Promise<void>;
  initialSelectedId?: string;
  initialTab?: RentableSpaceDetailTab;
}) {
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [activeTab, setActiveTab] = useState<RentableSpaceDetailTab>(initialTab);
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

  async function load(id: string, resetTab = true) {
    setSelectedId(id);
    if (resetTab) setActiveTab(initialTab);
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
      const [catalog] = await Promise.all([
        can('portfolio.amenity.read') ? api<Amenity[]>('/amenities') : Promise.resolve([]),
      ]);
      setDetail(record);
      setAmenities(catalog);
    } catch (cause) {
      setError(userFacingError(cause, 'Rentable-space details could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialSelectedId) void load(initialSelectedId);
  }, [initialSelectedId]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);
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
      if (selectedId) await load(selectedId, false);
      toast.success('Rentable space updated.');
    } catch (cause) {
      const message = userFacingError(cause, 'The change could not be saved.');
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const branchIds = (detail?.property?.branchAssignments ?? [])
    .filter(
      (assignment) =>
        assignment.effectiveFrom.slice(0, 10) <= principal.businessDate &&
        (!assignment.effectiveTo || assignment.effectiveTo.slice(0, 10) > principal.businessDate),
    )
    .map((assignment) => assignment.branchId);
  const canAccess = (permission: string) =>
    branchIds.length
      ? canPerformAcrossBranches(principal, permission, branchIds)
      : hasCompanyPermission(principal, permission);

  const actionAccess = rentableSpaceActionAccess(canAccess);
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
        <h2 className="text-base font-bold text-slate-900">Rentable space details</h2>
        <p className="text-sm text-slate-500">
          Review each part of the space in a dedicated, history-preserving section.
        </p>
      </div>
      {!initialSelectedId ? (
        <label className="block text-sm font-semibold">
          Rentable space
          <SearchableSelect
            searchable
            value={selectedId}
            onChange={(event) => void load(event.target.value)}
          >
            <option value="">Choose a space</option>
            {spaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.spaceCode} — {space.name}
              </option>
            ))}
          </SearchableSelect>
        </label>
      ) : null}{' '}
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

          <DetailTabs
            tabs={RENTABLE_SPACE_DETAIL_TABS.map((tab) =>
              tab.key === 'profile'
                ? {
                    ...tab,
                    label: detail.landProfile
                      ? 'Land Details'
                      : detail.commercialProfile
                        ? 'Commercial Details'
                        : detail.residentialProfile
                          ? 'Residential Details'
                          : 'Profile',
                  }
                : tab,
            )}
            active={activeTab}
            onChange={setActiveTab}
            label="Rentable space detail sections"
          />

          {activeTab === 'overview' ? (
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                ['Name', detail.name],
                ['Code', detail.spaceCode],
                ['Type', detail.type.name],
                ['Property', detail.property?.name || 'Property record unavailable'],
                ['Building', detail.building?.name || 'Standalone / no building'],
                [
                  'Parent space',
                  detail.childRelations.find((relation) => !relation.effectiveTo)?.parent?.name ||
                    'No parent space',
                ],
                ['Status', humanize(detail.status)],
                [
                  'Usable area',
                  currentVersion?.usableArea
                    ? `${currentVersion.usableArea} ${currentVersion.areaUnit ?? ''}`.trim()
                    : 'Not recorded',
                ],
                [
                  'Total area',
                  currentVersion?.totalArea
                    ? `${currentVersion.totalArea} ${currentVersion.areaUnit ?? ''}`.trim()
                    : 'Not recorded',
                ],
                ['Floor', currentVersion?.floorNumber?.toString() ?? 'Not recorded'],
                ['Capacity', currentVersion?.capacity?.toString() ?? 'Not recorded'],
              ].map(([term, content]) => (
                <div key={term} className="rounded-lg border border-slate-200 p-3">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {term}
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-800">{content}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {activeTab === 'hierarchy' ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <p className="font-bold text-slate-900">{detail.property?.name || 'Property'}</p>
                {detail.building ? (
                  <p className="ml-4 mt-2 border-l-2 border-slate-300 pl-3">
                    {detail.building.name}
                  </p>
                ) : null}
                <p className="ml-8 mt-2 border-l-2 border-[#90CAF9] pl-3 font-bold text-[#0D47A1]">
                  {detail.name}
                </p>
                {(detail.parentRelations ?? [])
                  .filter((relation) => !relation.effectiveTo)
                  .map((relation) => (
                    <p
                      key={`${relation.child?.id}-${relation.effectiveFrom}`}
                      className="ml-12 mt-2 border-l-2 border-slate-300 pl-3"
                    >
                      {relation.child?.name || 'Child space'}
                      {relation.child?.type?.name ? ` · ${relation.child.type.name}` : ''}
                    </p>
                  ))}
              </div>
              {!detail.childRelations.find((relation) => !relation.effectiveTo) &&
              !(detail.parentRelations ?? []).some((relation) => !relation.effectiveTo) ? (
                <EmptyState
                  title="Standalone space"
                  description="This space has no active parent or child relationships."
                />
              ) : null}
            </div>
          ) : null}

          {activeTab === 'measurements' ? (
            <div className="space-y-4">
              <section className="rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-bold text-slate-900">Current measurement</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Usable {currentVersion?.usableArea ?? 'not recorded'}{' '}
                  {currentVersion?.areaUnit ?? ''} · Total{' '}
                  {currentVersion?.totalArea ?? 'not recorded'} {currentVersion?.areaUnit ?? ''}
                </p>
              </section>
              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900">Measurement history</h3>
                {detail.versions.length ? (
                  detail.versions.map((version) => (
                    <div
                      key={version.id}
                      className="rounded-lg border border-slate-200 p-3 text-sm"
                    >
                      <strong>
                        {version.usableArea ?? 'Area not recorded'} {version.areaUnit ?? ''}
                      </strong>
                      <p className="text-xs text-slate-500">
                        Effective {version.effectiveFrom.slice(0, 10)}
                        {version.effectiveTo
                          ? ` to ${version.effectiveTo.slice(0, 10)}`
                          : ' to present'}
                      </p>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="No measurements"
                    description="No measurement history is recorded for this space."
                  />
                )}
              </section>
            </div>
          ) : null}

          {activeTab === 'profile' ? (
            <div>
              {detail.residentialProfile ? (
                <dl className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['Bedrooms', detail.residentialProfile.bedrooms],
                    ['Bathrooms', detail.residentialProfile.bathrooms],
                    ['Kitchens', detail.residentialProfile.kitchens],
                    ['Living rooms', detail.residentialProfile.livingRooms],
                    ['Balconies', detail.residentialProfile.balconies],
                    [
                      'Furnishing',
                      detail.residentialProfile.furnishedStatus
                        ? humanize(detail.residentialProfile.furnishedStatus)
                        : null,
                    ],
                  ].map(([term, content]) => (
                    <div key={term as string} className="rounded-lg border border-slate-200 p-3">
                      <dt className="text-xs font-bold text-slate-500">{term}</dt>
                      <dd className="mt-1 text-sm font-semibold">{content ?? 'Not recorded'}</dd>
                    </div>
                  ))}
                </dl>
              ) : detail.commercialProfile ? (
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <dt className="text-xs font-bold text-slate-500">Frontage</dt>
                    <dd className="mt-1 text-sm font-semibold">
                      {detail.commercialProfile.frontageMeters
                        ? `${detail.commercialProfile.frontageMeters} m`
                        : 'Not recorded'}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <dt className="text-xs font-bold text-slate-500">Classification</dt>
                    <dd className="mt-1 text-sm font-semibold">
                      {detail.commercialProfile.classification || 'Not recorded'}
                    </dd>
                  </div>
                </dl>
              ) : detail.landProfile ? (
                <dl className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['Dimensions', detail.landProfile.dimensions],
                    ['Permitted use', detail.landProfile.permittedUse],
                    ['Current use', detail.landProfile.currentUse],
                    ['Road access', detail.landProfile.roadAccess],
                    [
                      'Fenced',
                      detail.landProfile.fenced == null
                        ? null
                        : detail.landProfile.fenced
                          ? 'Yes'
                          : 'No',
                    ],
                    ['Boundary', detail.landProfile.boundaryDescription],
                  ].map(([term, content]) => (
                    <div key={term as string} className="rounded-lg border border-slate-200 p-3">
                      <dt className="text-xs font-bold text-slate-500">{term}</dt>
                      <dd className="mt-1 text-sm font-semibold">{content ?? 'Not recorded'}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <EmptyState
                  title="No specialized profile"
                  description="This space type has no residential, commercial, or land profile data."
                />
              )}
            </div>
          ) : null}

          {activeTab === 'history' ? (
            <div className="space-y-3">
              {[
                ...detail.versions.map((version) => ({
                  key: version.id,
                  date: version.effectiveFrom,
                  label: 'Measurement became effective',
                  detail:
                    `${version.usableArea ?? 'Area not recorded'} ${version.areaUnit ?? ''}`.trim(),
                })),
                ...detail.childRelations.map((relation) => ({
                  key: `${relation.parentSpaceId}-${relation.effectiveFrom}`,
                  date: relation.effectiveFrom ?? '',
                  label: relation.effectiveTo
                    ? 'Parent assignment completed'
                    : 'Parent assignment became effective',
                  detail: relation.parent?.name ?? 'Parent space',
                })),
              ]
                .filter((item) => item.date)
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((item) => (
                  <div key={item.key} className="rounded-lg border border-slate-200 p-3">
                    <p className="text-sm font-bold">{item.label}</p>
                    <p className="text-xs text-slate-500">
                      {item.date.slice(0, 10)} · {item.detail}
                    </p>
                  </div>
                ))}
            </div>
          ) : null}
          {activeTab === 'measurements' && detail.status !== 'RETIRED' && actionAccess.update ? (
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
                  <SearchableSelect
                    name="areaUnit"
                    defaultValue={currentVersion?.areaUnit ?? 'SQM'}
                  >
                    <option>SQM</option>
                    <option>SQFT</option>
                    <option>ACRE</option>
                    <option>HECTARE</option>
                  </SearchableSelect>
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

          {activeTab === 'hierarchy' && detail.status !== 'RETIRED' && actionAccess.update ? (
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
                <SearchableSelect searchable name="parentSpaceId" required>
                  <option value="">Choose a parent</option>
                  {parentOptions.map((space) => (
                    <option key={space.id} value={space.id}>
                      {space.spaceCode} — {space.name}
                    </option>
                  ))}
                </SearchableSelect>
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

          {activeTab === 'hierarchy' && detail.status !== 'RETIRED' && actionAccess.partition ? (
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
                  <SearchableSelect name="typeCode" required>
                    {typeCatalog.map((type) => (
                      <option key={type.id} value={type.code}>
                        {type.name}
                      </option>
                    ))}
                  </SearchableSelect>
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
                  <SearchableSelect
                    name="areaUnit"
                    defaultValue={currentVersion?.areaUnit ?? 'SQM'}
                  >
                    <option>SQM</option>
                    <option>SQFT</option>
                    <option>ACRE</option>
                    <option>HECTARE</option>
                  </SearchableSelect>
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

          <div className={activeTab === 'amenities' ? styles.form : 'hidden'}>
            <h3>Amenities</h3>
            <div className="flex flex-wrap gap-2">
              {assignedAmenities.length ? (
                assignedAmenities.map((amenity) => (
                  <span
                    key={amenity.id}
                    className="rounded-full bg-[#E3F2FD] px-3 py-1 text-xs font-bold text-[#0D47A1]"
                  >
                    {amenity.name}{' '}
                    {actionAccess.manageAmenities ? (
                      <button
                        type="button"
                        aria-label={`Remove ${amenity.name}`}
                        disabled={busy}
                        className="ml-1 rounded-full p-0.5 hover:bg-[#E3F2FD]"
                        onClick={() =>
                          void mutate(
                            null,
                            `/rentable-spaces/${detail.id}/amenities/${amenity.id}`,
                            'DELETE',
                          )
                        }
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">No amenities assigned.</span>
              )}
            </div>
            {actionAccess.manageAmenities && availableAmenities.length ? (
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  const form = new FormData(event.currentTarget);
                  void mutate(event, `/rentable-spaces/${detail.id}/amenities`, 'POST', {
                    amenityId: value(form, 'amenityId'),
                  });
                }}
              >
                <SearchableSelect searchable name="amenityId" required>
                  <option value="">Choose amenity</option>
                  {availableAmenities.map((amenity) => (
                    <option key={amenity.id} value={amenity.id}>
                      {amenity.name}
                    </option>
                  ))}
                </SearchableSelect>
                <button disabled={busy}>Assign</button>
              </form>
            ) : null}
          </div>

          <div className={activeTab === 'documents' ? styles.form : 'hidden'}>
            <h3>Documents</h3>
            {detail && activeTab === 'documents' ? (
              <EntityDocuments
                entityType="RentableSpace"
                entityId={detail.id}
                canManage={actionAccess.manageDocuments}
              />
            ) : null}
            <div className="hidden">
              {documents.length ? (
                documents.map((document) => (
                  <article key={document.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex justify-between gap-2">
                      <div>
                        <strong>{document.displayName}</strong>
                        <p className="text-xs text-slate-500">
                          {humanize(document.categoryCode)} · {humanize(document.accessClass)} ·{' '}
                          {document.versions.length} version
                          {document.versions.length === 1 ? '' : 's'}
                        </p>
                      </div>
                      <StatusBadge value={document.status} />
                    </div>
                    <form
                      className={
                        actionAccess.manageDocuments ? 'mt-3 grid gap-2 md:grid-cols-4' : 'hidden'
                      }
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
                      <label>
                        <span>Document name</span>
                        <input name="displayName" defaultValue={document.displayName} required />
                      </label>
                      <label>
                        <span>Category</span>
                        <input name="categoryCode" defaultValue={document.categoryCode} required />
                      </label>
                      <label>
                        <span>Access</span>
                        <SearchableSelect name="accessClass" defaultValue={document.accessClass}>
                          <option value="INTERNAL">Internal</option>
                          <option value="CONFIDENTIAL">Confidential</option>
                          <option value="RESTRICTED">Restricted</option>
                        </SearchableSelect>
                      </label>
                      <label>
                        <span>Status</span>
                        <SearchableSelect
                          searchable={false}
                          name="status"
                          defaultValue={document.status}
                        >
                          <option value="PENDING">Pending</option>
                          <option value="ACTIVE">Active</option>
                          <option value="ARCHIVED">Archived</option>
                        </SearchableSelect>
                      </label>
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
          </div>

          {activeTab === 'lifecycle' ? (
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-bold text-slate-900">Lifecycle status</h3>
              <p className="mt-2 text-sm text-slate-600">
                {detail.status === 'RETIRED'
                  ? 'This rentable space is retired. Its hierarchy, measurements, documents, and history remain preserved.'
                  : actionAccess.update
                    ? 'Retirement is permanent for normal operations. Confirm active children first and provide an effective date and reason.'
                    : 'You have read-only access to this lifecycle record.'}
              </p>
            </section>
          ) : null}
          {activeTab === 'lifecycle' && detail.status !== 'RETIRED' && actionAccess.update ? (
            <form
              className="space-y-4 rounded-xl border border-red-200 bg-red-50 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!confirmRentableSpaceRetirement((message) => window.confirm(message))) return;
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
