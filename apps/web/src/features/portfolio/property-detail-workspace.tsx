'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Building2, Edit3, Plus } from 'lucide-react';
import { DetailTabs } from '@/components/shared/detail-tabs';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/shared/ui';
import { api, apiCached, userFacingError } from '@/lib/phase3-api';
import { humanize } from '@/lib/presentation';
import { PropertyOperations } from './property-operations';
import { PropertyActivity } from './property-activity';
import { PROPERTY_DETAIL_TABS } from './portfolio-ia';
import type { BranchOption, PropertyDetailTab, PropertyRecord } from './pages/property-registry';
import { OwnershipWorkspace } from './ownership-workflow';
import { PortfolioDetailShell, usePortfolioPrincipal } from './detail-shell';

const formValue = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
};

export function PropertyDetailWorkspace() {
  const params = useParams<{ propertyId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { principal, error: sessionError } = usePortfolioPrincipal();
  const requestedTab = searchParams.get('tab');
  const [tab, setTab] = useState<PropertyDetailTab>(
    PROPERTY_DETAIL_TABS.some((item) => item.key === requestedTab)
      ? (requestedTab as PropertyDetailTab)
      : 'overview',
  );
  const [record, setRecord] = useState<PropertyRecord | null>(null);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddBuilding, setShowAddBuilding] = useState(false);
  const [savingBuilding, setSavingBuilding] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [property, branchCatalog] = await Promise.all([
        api<PropertyRecord>('/properties/' + params.propertyId),
        apiCached<BranchOption[]>('/branches').catch(() => []),
      ]);
      setRecord(property);
      setBranches(branchCatalog);
    } catch (cause) {
      setError(userFacingError(cause, 'Property details could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (principal) void load();
  }, [params.propertyId, principal]);

  async function createBuilding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingBuilding(true);
    setError('');
    try {
      const form = new FormData(event.currentTarget);
      const floors = formValue(form, 'numberOfFloors');
      await api(`/properties/${params.propertyId}/buildings`, {
        method: 'POST',
        body: JSON.stringify({
          name: formValue(form, 'name'),
          ...(floors ? { numberOfFloors: Number(floors) } : {}),
        }),
      });
      setShowAddBuilding(false);
      await load();
    } catch (cause) {
      setError(userFacingError(cause, 'The Building could not be created.'));
    } finally {
      setSavingBuilding(false);
    }
  }

  const currentBranch = record?.branchAssignments.find(
    (assignment) =>
      principal &&
      assignment.effectiveFrom.slice(0, 10) <= principal.businessDate &&
      (!assignment.effectiveTo || assignment.effectiveTo.slice(0, 10) > principal.businessDate),
  );
  const currentOwners =
    record?.ownerships?.filter(
      (ownership) =>
        principal &&
        ownership.effectiveFrom.slice(0, 10) <= principal.businessDate &&
        (!ownership.effectiveTo || ownership.effectiveTo.slice(0, 10) > principal.businessDate),
    ) ?? [];
  const createSpaceHref = record
    ? '/portfolio?section=spaces&view=overview&create=1&propertyId=' + encodeURIComponent(record.id)
    : '#';

  return (
    <PortfolioDetailShell
      principal={principal}
      activeItem="properties:overview"
      breadcrumbs={['Portfolio', 'Properties', record?.name ?? 'Property']}
    >
      {sessionError ? <ErrorState message={sessionError} /> : null}
      {loading ? <LoadingState label="Loading Property details" /> : null}
      {!loading && error && !record ? <ErrorState message={error} /> : null}
      {record && principal ? (
        <div className="space-y-5">
          <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#E3F2FD] text-[#0D47A1]">
                  <Building2 className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    {record.propertyCode}
                  </p>
                  <h1 className="truncate text-2xl font-bold text-slate-950">{record.name}</h1>
                  <p className="mt-1 text-sm text-slate-600">
                    {humanize(record.propertyType)} ·{' '}
                    {currentBranch?.branch?.name ?? 'No current operating branch'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={record.status} />
                <a
                  href={'/portfolio?section=properties&edit=' + record.id}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-700"
                >
                  <Edit3 className="h-4 w-4" /> Edit Property
                </a>
              </div>
            </div>
          </header>
          {error ? <ErrorState message={error} /> : null}
          <DetailTabs
            tabs={PROPERTY_DETAIL_TABS}
            active={tab}
            onChange={(next) => {
              setTab(next);
              router.replace('/portfolio/properties/' + record.id + '?tab=' + next, {
                scroll: false,
              });
            }}
            label="Property detail sections"
          />

          {tab === 'overview' ? (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ['Property type', humanize(record.propertyType)],
                  ['Operating branch', currentBranch?.branch?.name ?? 'Not assigned'],
                  ['Buildings', String(record.buildings?.length ?? 0)],
                  ['Rentable Spaces', String(record.spaces?.length ?? 0)],
                  ['Current Owners', String(currentOwners.length)],
                  ['City', record.city],
                  ['District', record.district ?? 'Not recorded'],
                  ['Address', record.addressLine1 ?? 'Not recorded'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-slate-200 p-4">
                    <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      {label}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {tab === 'buildings' ? (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
                <div>
                  <h2 className="font-bold text-slate-950">Buildings</h2>
                  <p className="text-sm text-slate-500">
                    Physical structures belonging to this Property.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddBuilding(true)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#0D47A1] px-4 text-sm font-bold text-white"
                >
                  <Plus className="h-4 w-4" /> Add Building
                </button>
              </div>
              {record.buildings?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Building</th>
                        <th className="px-4 py-3">Code</th>
                        <th className="px-4 py-3">Property</th>
                        <th className="px-4 py-3">Rentable Spaces</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {record.buildings.map((building) => {
                        const spaceCount =
                          record.spaces?.filter((space) => space.building?.name === building.name)
                            .length ?? 0;
                        const addHref =
                          createSpaceHref + '&buildingId=' + encodeURIComponent(building.id);
                        return (
                          <tr key={building.id} className="border-t border-slate-100">
                            <td className="px-4 py-3 font-semibold text-slate-900">
                              {building.name}
                            </td>
                            <td className="px-4 py-3 text-slate-600">{building.buildingCode}</td>
                            <td className="px-4 py-3 text-slate-600">{record.name}</td>
                            <td className="px-4 py-3 text-slate-600">
                              {spaceCount || 'None created'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-3">
                                <a
                                  className="font-bold text-[#0D47A1] hover:underline"
                                  href={'/portfolio/buildings/' + building.id}
                                >
                                  Open Building
                                </a>
                                <a
                                  className="font-bold text-[#0D47A1] hover:underline"
                                  href={addHref}
                                >
                                  Add Rentable Space
                                </a>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-5">
                  <EmptyState
                    title="No Buildings have been added to this Property."
                    description="Add a Building, or create a Property-level Rentable Space for a standalone Property."
                  />
                </div>
              )}
            </section>
          ) : null}

          {tab === 'spaces' ? (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
                <div>
                  <h2 className="font-bold text-slate-950">Rentable Spaces</h2>
                  <p className="text-sm text-slate-500">
                    All leasing and occupancy targets under this Property.
                  </p>
                </div>
                <a
                  href={createSpaceHref}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#0D47A1] px-4 text-sm font-bold text-white"
                >
                  <Plus className="h-4 w-4" /> Add Rentable Space
                </a>
              </div>
              {record.spaces?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Rentable Space</th>
                        <th className="px-4 py-3">Code</th>
                        <th className="px-4 py-3">Building</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {record.spaces.map((space) => (
                        <tr key={space.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-semibold text-slate-900">{space.name}</td>
                          <td className="px-4 py-3 text-slate-600">{space.spaceCode}</td>
                          <td className="px-4 py-3 text-slate-600">
                            {space.building?.name ?? 'Property-level'}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {space.type?.name ?? 'Rentable Space'}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge value={space.status} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <a
                              className="font-bold text-[#0D47A1] hover:underline"
                              href={'/portfolio/rentable-spaces/' + space.id}
                            >
                              Open Space
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-5">
                  <EmptyState
                    title="No Rentable Spaces have been added to this Property."
                    description="Create the first leasing or occupancy target."
                    action={
                      <a
                        href={createSpaceHref}
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#0D47A1] px-4 text-sm font-bold text-white"
                      >
                        <Plus className="h-4 w-4" /> Add Rentable Space
                      </a>
                    }
                  />
                </div>
              )}
            </section>
          ) : null}

          {tab === 'ownership' ? (
            <OwnershipWorkspace
              businessDate={principal.businessDate}
              records={record.ownerships ?? []}
              canManage={principal.permissions.includes('portfolio.ownership.manage')}
              activationContext={{
                branchAssigned: Boolean(currentBranch),
                detailsComplete: Boolean(record.name && record.propertyType && record.city),
                isDraft: record.status === 'DRAFT',
              }}
              onManage={() =>
                router.push('/portfolio?section=properties&view=ownership&propertyId=' + record.id)
              }
            />
          ) : null}

          {tab === 'amenities' || tab === 'documents' || tab === 'branch-history' ? (
            <PropertyOperations
              property={record}
              branches={branches}
              principal={principal}
              section={tab}
            />
          ) : null}
          {tab === 'activity' ? <PropertyActivity property={record} /> : null}
          {showAddBuilding ? (
            <div
              className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-building-title"
            >
              <form
                onSubmit={(event) => {
                  void createBuilding(event);
                }}
                className="w-full max-w-lg space-y-4 rounded-xl bg-white p-5 shadow-2xl"
              >
                <div>
                  <h2 id="add-building-title" className="text-lg font-bold text-slate-950">
                    Add Building
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Create a Building inside {record.name}. Its BLD number is generated
                    automatically.
                  </p>
                </div>
                <label className="block text-sm font-bold text-slate-700">
                  Building name
                  <input
                    autoFocus
                    name="name"
                    required
                    maxLength={160}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0D47A1] focus:ring-2 focus:ring-[#E3F2FD]"
                  />
                </label>
                <label className="block text-sm font-bold text-slate-700">
                  Number of floors (optional)
                  <input
                    name="numberOfFloors"
                    type="number"
                    min="0"
                    max="500"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#0D47A1] focus:ring-2 focus:ring-[#E3F2FD]"
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddBuilding(false)}
                    className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={savingBuilding}
                    className="min-h-10 rounded-lg bg-[#0D47A1] px-4 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {savingBuilding ? 'Creating…' : 'Create Building'}
                  </button>
                </div>
              </form>
            </div>
          ) : null}
        </div>
      ) : null}
    </PortfolioDetailShell>
  );
}
