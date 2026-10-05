'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { ErrorState, LoadingState, StatusBadge } from '@/components/shared/ui';
import {
  WorkspaceFormDrawer,
  WorkspaceFormDrawerFooter,
} from '@/components/shared/workspace-form-drawer';
import { api, apiCached, userFacingError } from '@/lib/phase3-api';
import { RentableSpaceOperations, type SpaceOperationRecord } from './rentable-space-operations';
import { PortfolioDetailShell, usePortfolioPrincipal } from './detail-shell';
import toast from '@/lib/toast';

type SpaceDetail = SpaceOperationRecord & {
  property: {
    id?: string;
    name?: string;
    propertyCode?: string;
    branchAssignments?: Array<{
      branchId: string;
      effectiveFrom: string;
      effectiveTo: string | null;
    }>;
  };
  building?: { id: string; name: string; buildingCode: string } | null;
  versions: Array<{
    id: string;
    effectiveFrom: string;
    effectiveTo: string | null;
    usableArea: string | null;
    totalArea: string | null;
    areaUnit: string | null;
    floorNumber: number | null;
    capacity: number | null;
    attributes?: Record<string, unknown> | null;
  }>;
  residentialProfile?: {
    bedrooms: number | null;
    bathrooms: string | null;
    kitchens: number | null;
    livingRooms: number | null;
    balconies: number | null;
    furnishedStatus: string | null;
  } | null;
};
type SpaceType = { id: string; code: string; name: string };
const EDIT_UNIT_FORM_ID = 'edit-unit-form';

const formText = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
};

export function RentableSpaceDetailWorkspace() {
  const params = useParams<{ spaceId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { principal, error: sessionError } = usePortfolioPrincipal();
  const [record, setRecord] = useState<SpaceDetail | null>(null);
  const [types, setTypes] = useState<SpaceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(searchParams.get('edit') === '1');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [space, catalog] = await Promise.all([
        api<SpaceDetail>('/rentable-spaces/' + params.spaceId),
        apiCached<SpaceType[]>('/rentable-spaces/types'),
      ]);
      setRecord(space);
      setTypes(catalog);
    } catch (cause) {
      setError(userFacingError(cause, 'Rentable Space details could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (principal) void load();
  }, [params.spaceId, principal]);

  async function saveUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!record || !principal) return;
    const form = new FormData(event.currentTarget);
    const optional = (key: string) => formText(form, key) || undefined;
    const integer = (key: string) => {
      const raw = formText(form, key);
      return raw === '' ? undefined : Number(raw);
    };
    setSaving(true);
    try {
      await api(`/rentable-spaces/${record.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: formText(form, 'name'),
          typeCode: formText(form, 'typeCode'),
          effectiveFrom: formText(form, 'effectiveFrom'),
          usableArea: optional('usableArea'),
          totalArea: optional('totalArea'),
          areaUnit: optional('areaUnit'),
          floorNumber: integer('floorNumber'),
          capacity: integer('capacity'),
          askingRent: optional('askingRent'),
          currency: optional('currency'),
          description: optional('description'),
          residential: {
            bedrooms: integer('bedrooms'),
            bathrooms: optional('bathrooms'),
          },
          reason: formText(form, 'reason'),
        }),
      });
      toast.success('Unit updated.');
      setEditing(false);
      router.replace(`/portfolio/rentable-spaces/${record.id}`, { scroll: false });
      await load();
    } catch (cause) {
      toast.error(userFacingError(cause, 'The unit could not be updated.'));
    } finally {
      setSaving(false);
    }
  }

  const currentVersion =
    record?.versions.find((version) => !version.effectiveTo) ?? record?.versions[0];
  const attributes = currentVersion?.attributes ?? {};

  return (
    <PortfolioDetailShell
      principal={principal}
      activeItem="spaces:overview"
      breadcrumbs={['Portfolio', 'Rentable Spaces', record?.name ?? 'Space']}
      backHref={
        record?.property.id ? `/portfolio/properties/${record.property.id}` : '/rental/properties'
      }
      backLabel={`Back to ${record?.property.name ?? 'Properties'}`}
    >
      {sessionError ? <ErrorState message={sessionError} /> : null}
      {loading ? <LoadingState label="Loading Rentable Space details" /> : null}
      {!loading && error && !record ? <ErrorState message={error} /> : null}
      {record && principal ? (
        <div className="space-y-5">
          <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                  {record.spaceCode}
                </p>
                <h1 className="truncate text-2xl font-bold text-slate-950">{record.name}</h1>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600">
                  {record.property.id ? (
                    <a
                      className="font-semibold text-[#0D47A1] hover:underline"
                      href={'/portfolio/properties/' + record.property.id}
                    >
                      {record.property.propertyCode ? record.property.propertyCode + ' - ' : ''}
                      {record.property.name}
                    </a>
                  ) : (
                    <span>{record.property.name}</span>
                  )}
                  {record.building ? (
                    <a
                      className="font-semibold text-[#0D47A1] hover:underline"
                      href={'/portfolio/buildings/' + record.building.id}
                    >
                      {record.building.buildingCode} - {record.building.name}
                    </a>
                  ) : (
                    <span>Property-level Space</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={record.status} />
                {record.status !== 'RETIRED' &&
                principal.permissions.includes('portfolio.space.update') ? (
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setEditing(true)}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Edit Unit
                  </button>
                ) : null}
              </div>
            </div>
          </header>
          {error ? <ErrorState message={error} /> : null}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <RentableSpaceOperations
              principal={principal}
              initialSelectedId={record.id}
              spaces={[record]}
              typeCatalog={types}
              onSaved={load}
            />
          </section>
          <WorkspaceFormDrawer
            open={editing}
            eyebrow="Portfolio"
            title="Edit Unit"
            description="Update current physical details and create an effective-dated unit version."
            onClose={() => setEditing(false)}
            size="lg"
            footer={
              <WorkspaceFormDrawerFooter
                formId={EDIT_UNIT_FORM_ID}
                onCancel={() => setEditing(false)}
                submitLabel="Save Unit"
                loadingLabel="Saving…"
                isPending={saving}
              />
            }
          >
            <form id={EDIT_UNIT_FORM_ID} className="grid gap-4 sm:grid-cols-2" onSubmit={saveUnit}>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                Unit name
                <input
                  className="input mt-1 w-full"
                  name="name"
                  defaultValue={record.name}
                  required
                  minLength={2}
                  maxLength={160}
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Unit type
                <select
                  className="input mt-1 w-full"
                  name="typeCode"
                  defaultValue={record.type.code}
                  required
                >
                  {types.map((type) => (
                    <option key={type.id} value={type.code}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Effective from
                <input
                  className="input mt-1 w-full"
                  name="effectiveFrom"
                  type="date"
                  min={principal.businessDate}
                  defaultValue={principal.businessDate}
                  required
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Usable area
                <input
                  className="input mt-1 w-full"
                  name="usableArea"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={currentVersion?.usableArea ?? ''}
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Total area
                <input
                  className="input mt-1 w-full"
                  name="totalArea"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={currentVersion?.totalArea ?? ''}
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Area unit
                <select
                  className="input mt-1 w-full"
                  name="areaUnit"
                  defaultValue={currentVersion?.areaUnit ?? 'SQM'}
                >
                  <option value="SQM">Square metres</option>
                  <option value="SQFT">Square feet</option>
                  <option value="ACRE">Acres</option>
                  <option value="HECTARE">Hectares</option>
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Floor
                <input
                  className="input mt-1 w-full"
                  name="floorNumber"
                  type="number"
                  defaultValue={currentVersion?.floorNumber ?? ''}
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Bedrooms
                <input
                  className="input mt-1 w-full"
                  name="bedrooms"
                  type="number"
                  min="0"
                  defaultValue={record.residentialProfile?.bedrooms ?? ''}
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Bathrooms
                <input
                  className="input mt-1 w-full"
                  name="bathrooms"
                  type="number"
                  min="0"
                  step="0.5"
                  defaultValue={record.residentialProfile?.bathrooms ?? ''}
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Asking rent
                <input
                  className="input mt-1 w-full"
                  name="askingRent"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={String(attributes.askingRent ?? '')}
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Currency
                <input
                  className="input mt-1 w-full uppercase"
                  name="currency"
                  defaultValue={String(attributes.currency ?? 'USD')}
                  minLength={3}
                  maxLength={3}
                />
              </label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                Description
                <textarea
                  className="input mt-1 w-full"
                  name="description"
                  rows={3}
                  defaultValue={String(attributes.description ?? '')}
                  maxLength={2000}
                />
              </label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                Change reason
                <input
                  className="input mt-1 w-full"
                  name="reason"
                  required
                  minLength={3}
                  maxLength={500}
                  placeholder="Why are these unit details changing?"
                />
              </label>
            </form>
          </WorkspaceFormDrawer>
        </div>
      ) : null}
    </PortfolioDetailShell>
  );
}
