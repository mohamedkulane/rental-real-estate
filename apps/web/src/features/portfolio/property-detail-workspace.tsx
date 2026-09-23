'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Building2, Plus } from 'lucide-react';
import { DetailTabs } from '@/components/shared/detail-tabs';
import { TableActionButton, TableActionGroup } from '@/components/shared/data-table';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/shared/ui';
import { api, apiCached, pageItems, userFacingError, type CursorPage } from '@/lib/phase3-api';
import { humanize } from '@/lib/presentation';
import { PropertyOperations } from './property-operations';
import { PropertyActivity } from './property-activity';
import { PROPERTY_DETAIL_TABS } from './portfolio-ia';
import type { BranchOption, PropertyDetailTab, PropertyRecord } from './pages/property-registry';
import { OwnershipEditor, OwnershipWorkspace } from './ownership-workflow';
import type { OwnerOption, ReplaceOwnershipInput } from './ownership-model';
import { PortfolioDetailShell, usePortfolioPrincipal } from './detail-shell';
import { AddUnitDrawer } from './add-unit-drawer';
import { useCreateDrawerState } from '@/components/shared/use-create-drawer-state';

const formValue = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
};

type SpaceNode = NonNullable<PropertyRecord['spaces']>[number];

function spaceAskingRent(space: SpaceNode): string | null {
  const listingRent = space.rentalListings?.[0]?.askingRent;
  if (listingRent != null && listingRent !== '') return String(listingRent);
  const attrs = space.versions?.[0]?.attributes;
  const asking = attrs && typeof attrs === 'object' ? attrs.askingRent : null;
  return asking != null && asking !== '' ? String(asking) : null;
}

function spaceCurrency(space: SpaceNode): string {
  return space.rentalListings?.[0]?.currency ?? 'USD';
}

function isRented(space: SpaceNode): boolean {
  return Boolean(space.leases?.length);
}

function UnitsHierarchyPanel({
  spaces,
  onAddUnit,
  canAdd,
}: {
  spaces: SpaceNode[];
  onAddUnit: () => void;
  canAdd: boolean;
}) {
  const roots = spaces.filter((space) => {
    const activeParent = (space.childRelations ?? []).find((relation) => !relation.effectiveTo);
    return !activeParent?.parent?.id;
  });

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
        <div>
          <h2 className="font-bold text-slate-950">Units</h2>
          <p className="text-sm text-slate-500">Rental units under this property.</p>
        </div>
        {canAdd ? (
          <button
            type="button"
            onClick={onAddUnit}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#215E61] px-4 text-sm font-bold text-white hover:bg-[#1a4c4f]"
          >
            <Plus className="h-4 w-4" /> Add Unit
          </button>
        ) : null}
      </div>
      {roots.length ? (
        <div className="divide-y divide-slate-100">
          {roots.map((space) => {
            const rooms = (space.parentRelations ?? [])
              .filter((relation) => !relation.effectiveTo && relation.child)
              .map((relation) => relation.child!)
              .map((child) => spaces.find((item) => item.id === child.id) ?? child);
            const rentedRooms = rooms.filter((room) => isRented(room as SpaceNode)).length;
            const rent = spaceAskingRent(space);
            const rented = isRented(space);
            return (
              <div key={space.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{space.name}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {rooms.length
                        ? `${rooms.length} rooms · ${rentedRooms} rented / ${rooms.length - rentedRooms} available`
                        : rented
                          ? 'Rented'
                          : 'Available'}
                      {rent ? ` · ${spaceCurrency(space)} ${rent}/month` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge value={rented ? 'RENTED' : space.status} />
                    <TableActionButton
                      tone="open"
                      href={'/portfolio/rentable-spaces/' + space.id}
                    >
                      Open Unit
                    </TableActionButton>
                  </div>
                </div>
                {rooms.length ? (
                  <ul className="mt-3 space-y-2 border-l-2 border-slate-200 pl-4">
                    {rooms.map((room) => {
                      const roomNode = room as SpaceNode;
                      const roomRent = spaceAskingRent(roomNode);
                      const roomRented = isRented(roomNode);
                      return (
                        <li
                          key={roomNode.id}
                          className="flex flex-wrap items-center justify-between gap-2 text-sm"
                        >
                          <div>
                            <span className="font-medium text-slate-800">{roomNode.name}</span>
                            <span className="ml-2 text-slate-500">
                              {roomRented ? 'Rented' : 'Available'}
                              {roomRent ? ` · ${spaceCurrency(roomNode)} ${roomRent}/month` : ''}
                            </span>
                          </div>
                          <TableActionButton
                            tone="open"
                            href={'/portfolio/rentable-spaces/' + roomNode.id}
                          >
                            Open
                          </TableActionButton>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-5">
          <EmptyState
            title="No units have been added to this property."
            description="Add a unit so this property can be rented."
            action={
              canAdd ? (
                <button
                  type="button"
                  onClick={onAddUnit}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#215E61] px-4 text-sm font-bold text-white"
                >
                  <Plus className="h-4 w-4" /> Add Unit
                </button>
              ) : undefined
            }
          />
        </div>
      )}
    </section>
  );
}

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
  const activeTab = tab as string;
  const [record, setRecord] = useState<PropertyRecord | null>(null);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddBuilding, setShowAddBuilding] = useState(false);
  const [savingBuilding, setSavingBuilding] = useState(false);
  const [editingOwnership, setEditingOwnership] = useState(searchParams.get('manage') === '1');
  const [ownerOptions, setOwnerOptions] = useState<OwnerOption[]>([]);
  const [loadingOwners, setLoadingOwners] = useState(false);
  const [savingOwnership, setSavingOwnership] = useState(false);

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

  useEffect(() => {
    if (tab === 'ownership' && searchParams.get('manage') === '1') {
      setEditingOwnership(true);
    }
  }, [searchParams, tab]);

  async function openOwnershipEditor() {
    if (!principal?.permissions.includes('portfolio.ownership.manage')) return;
    setEditingOwnership(true);
    setLoadingOwners(true);
    try {
      const page = await api<CursorPage<OwnerOption>>('/owners?status=ACTIVE&limit=50');
      setOwnerOptions(pageItems(page));
    } catch (cause) {
      setError(userFacingError(cause, 'Owners could not be loaded.'));
      setEditingOwnership(false);
    } finally {
      setLoadingOwners(false);
    }
  }

  async function saveOwnership(input: ReplaceOwnershipInput) {
    if (!record) return;
    setSavingOwnership(true);
    setError('');
    try {
      await api(`/properties/${record.id}/ownership`, {
        method: 'PUT',
        body: JSON.stringify(input),
      });
      setEditingOwnership(false);
      router.replace('/portfolio/properties/' + record.id + '?tab=ownership', { scroll: false });
      await load();
    } catch (cause) {
      setError(userFacingError(cause, 'Ownership could not be saved.'));
    } finally {
      setSavingOwnership(false);
    }
  }

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
  const { createOpen, openCreate, closeCreate } = useCreateDrawerState('addUnit');
  const canAddUnit = Boolean(principal?.permissions.includes('portfolio.space.create'));

  return (
    <PortfolioDetailShell
      principal={principal}
      activeItem="properties"
      breadcrumbs={['Portfolio', 'Properties', record?.name ?? 'Property']}
    >
      {sessionError ? <ErrorState message={sessionError} /> : null}
      {loading ? <LoadingState label="Loading Property details" /> : null}
      {!loading && error && !record ? <ErrorState message={error} /> : null}
      {record && principal ? (
        <div className="space-y-5">
          <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-[#E8F3F3] text-[#215E61]">
                  <Building2 className="h-7 w-7" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#215E61]">
                    {record.propertyCode}
                  </p>
                  <h1 className="mt-1 text-[28px] font-bold leading-tight text-[#1D2128]">
                    {record.name}
                  </h1>
                  <p className="mt-2 text-[15px] font-medium text-slate-600">
                    {humanize(record.propertyType)}
                    {' · '}
                    {[record.city, record.district].filter(Boolean).join(', ') || 'Location not set'}
                    {' · '}
                    {currentBranch?.branch?.name ?? 'Company-wide'}
                  </p>
                  {currentOwners[0]?.owner?.displayName ? (
                    <p className="mt-1 text-sm text-slate-500">
                      Owner:{' '}
                      <span className="font-semibold text-[#1D2128]">
                        {currentOwners[0].owner.displayName}
                      </span>
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={record.status} />
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
            <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-[18px] font-semibold text-[#1D2128]">Property details</h2>
                <dl className="mt-4 divide-y divide-slate-100">
                  {[
                    ['Property type', humanize(record.propertyType)],
                    ['Status', humanize(record.status)],
                    ['Operating branch', currentBranch?.branch?.name ?? 'Company-wide'],
                    ['City', record.city || '—'],
                    ['District', record.district || 'Not recorded'],
                    ['Neighborhood', record.neighborhood || 'Not recorded'],
                    ['Address', record.addressLine1 || 'Not recorded'],
                    ['Landmark', record.landmark || 'Not recorded'],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="grid gap-1 py-3 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-baseline sm:gap-4"
                    >
                      <dt className="text-[13px] font-semibold text-slate-500">{label}</dt>
                      <dd className="text-[15px] font-semibold text-[#1D2128]">{value}</dd>
                    </div>
                  ))}
                </dl>
                {record.description ? (
                  <div className="mt-4 rounded-lg border border-slate-100 bg-[#F4F2F2] p-4">
                    <p className="text-[13px] font-semibold text-slate-500">Description</p>
                    <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-[#1D2128]">
                      {record.description}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-[18px] font-semibold text-[#1D2128]">At a glance</h2>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {[
                      ['Units', String(record.spaces?.length ?? 0)],
                      ['Owners', String(currentOwners.length)],
                      ['Buildings', String(record.buildings?.length ?? 0)],
                      ['City', record.city || '—'],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-slate-200 bg-[#F4F2F2] p-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                          {label}
                        </p>
                        <p className="mt-1 text-[22px] font-bold leading-none text-[#215E61]">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-[18px] font-semibold text-[#1D2128]">Owner</h2>
                    <button
                      type="button"
                      className="text-sm font-semibold text-[#215E61] hover:underline"
                      onClick={() => {
                        setTab('ownership');
                        router.replace('/portfolio/properties/' + record.id + '?tab=ownership', {
                          scroll: false,
                        });
                      }}
                    >
                      View
                    </button>
                  </div>
                  {currentOwners.length ? (
                    <ul className="mt-3 space-y-2">
                      {currentOwners.map((ownership) => (
                        <li
                          key={ownership.id}
                          className="rounded-lg border border-slate-100 px-3 py-2 text-sm font-semibold text-[#1D2128]"
                        >
                          {ownership.owner?.displayName ?? 'Owner'}
                          {ownership.ownershipPercent ? (
                            <span className="ml-2 font-medium text-slate-500">
                              {ownership.ownershipPercent}%
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">No current owner on record.</p>
                  )}
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-[18px] font-semibold text-[#1D2128]">Units</h2>
                    <button
                      type="button"
                      className="text-sm font-semibold text-[#215E61] hover:underline"
                      onClick={() => {
                        setTab('spaces');
                        router.replace('/portfolio/properties/' + record.id + '?tab=spaces', {
                          scroll: false,
                        });
                      }}
                    >
                      View all
                    </button>
                  </div>
                  {record.spaces?.length ? (
                    <ul className="mt-3 space-y-2">
                      {record.spaces.slice(0, 4).map((space) => (
                        <li
                          key={space.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm"
                        >
                          <span className="font-semibold text-[#1D2128]">{space.name}</span>
                          <StatusBadge value={space.status} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">No rental units yet.</p>
                  )}
                </div>
              </div>
            </section>
          ) : null}

          {activeTab === 'buildings' ? (
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
                              <TableActionGroup>
                                <TableActionButton
                                  tone="open"
                                  href={'/portfolio/buildings/' + building.id}
                                >
                                  Open Building
                                </TableActionButton>
                                <TableActionButton tone="create" href={addHref}>
                                  Add Rentable Space
                                </TableActionButton>
                              </TableActionGroup>
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
            <>
              <UnitsHierarchyPanel
                spaces={record.spaces ?? []}
                canAdd={canAddUnit}
                onAddUnit={openCreate}
              />
              {createOpen && principal ? (
                <AddUnitDrawer
                  open={createOpen}
                  onClose={closeCreate}
                  onCreated={() => void load()}
                  principal={principal}
                  propertyId={record.id}
                  buildings={record.buildings ?? []}
                  spaces={(record.spaces ?? []).map((space) => ({
                    id: space.id,
                    name: space.name,
                    spaceCode: space.spaceCode,
                  }))}
                />
              ) : null}
            </>
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
              onManage={() => {
                void openOwnershipEditor();
              }}
            />
          ) : null}

          {activeTab === 'amenities' || activeTab === 'documents' || activeTab === 'branch-history' ? (
            <PropertyOperations
              property={record}
              branches={branches}
              principal={principal}
              section={activeTab as import('./portfolio-ia').PropertyDetailSection}
            />
          ) : null}
          {tab === 'activity' ? <PropertyActivity property={record} /> : null}
          {editingOwnership && record ? (
            <div
              className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="manage-ownership-title"
            >
              <div className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl">
                <div className="mb-4">
                  <h2 id="manage-ownership-title" className="text-lg font-bold text-slate-950">
                    Manage ownership
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Assign owners for {record.name}. Ownership and payout must each total 100%.
                  </p>
                </div>
                {loadingOwners ? (
                  <LoadingState label="Loading owners" />
                ) : (
                  <OwnershipEditor
                    owners={ownerOptions}
                    current={currentOwners}
                    businessDate={principal.businessDate}
                    busy={savingOwnership}
                    onCancel={() => {
                      setEditingOwnership(false);
                      router.replace('/portfolio/properties/' + record.id + '?tab=ownership', {
                        scroll: false,
                      });
                    }}
                    onSave={saveOwnership}
                  />
                )}
              </div>
            </div>
          ) : null}
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
