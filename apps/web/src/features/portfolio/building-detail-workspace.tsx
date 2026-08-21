'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Building2, Edit3, MoreHorizontal, Plus, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { DetailTabs } from '@/components/shared/detail-tabs';
import { CursorPaginationControls } from '@/components/shared/pagination';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/shared/ui';
import {
  api,
  canPerformAcrossBranches,
  hasCompanyPermission,
  type CursorPage,
  type Principal,
  userFacingError,
} from '@/lib/phase3-api';
import { humanize } from '@/lib/presentation';
import { PortfolioDetailShell, usePortfolioPrincipal } from './detail-shell';

type BuildingRecord = {
  id: string;
  buildingCode: string;
  name: string;
  numberOfFloors: number | null;
  status: 'ACTIVE' | 'INACTIVE' | 'RETIRED';
  property: {
    id: string;
    propertyCode: string;
    name: string;
    branchAssignments?: Array<{
      branchId: string;
      effectiveFrom: string;
      effectiveTo: string | null;
    }>;
  };
  spaces: Array<{
    id: string;
    spaceCode: string;
    name: string;
    status: string;
    type: { name: string };
    versions: Array<{
      floorNumber: number | null;
      usableArea: string | null;
      areaUnit: string | null;
    }>;
  }>;
  _count: { spaces: number };
};

type ActivityRecord = { id: string; action: string; reason: string | null; occurredAt: string };
const formText = (form: FormData, key: string) => {
  const entry = form.get(key);
  return typeof entry === 'string' ? entry.trim() : '';
};
const tabs = [
  { key: 'details', label: 'Building Details' },
  { key: 'spaces', label: 'Rentable Spaces' },
  { key: 'activity', label: 'Activity' },
] as const;
type Tab = (typeof tabs)[number]['key'];

function activeBranchIds(record: BuildingRecord, principal: Principal) {
  return (record.property.branchAssignments ?? [])
    .filter(
      (assignment) =>
        assignment.effectiveFrom.slice(0, 10) <= principal.businessDate &&
        (!assignment.effectiveTo || assignment.effectiveTo.slice(0, 10) > principal.businessDate),
    )
    .map((assignment) => assignment.branchId);
}

export function BuildingDetailWorkspace() {
  const params = useParams<{ buildingId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { principal, error: sessionError } = usePortfolioPrincipal();
  const [record, setRecord] = useState<BuildingRecord | null>(null);
  const [tab, setTab] = useState<Tab>(
    tabs.some((item) => item.key === searchParams.get('tab'))
      ? (searchParams.get('tab') as Tab)
      : 'details',
  );
  const [editing, setEditing] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [activityPage, setActivityPage] = useState<CursorPage<ActivityRecord> | null>(null);
  const [activityHistory, setActivityHistory] = useState<Array<string | null>>([null]);
  const [activityIndex, setActivityIndex] = useState(0);
  const [activityLoading, setActivityLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setRecord(await api<BuildingRecord>('/buildings/' + params.buildingId));
    } catch (cause) {
      setError(userFacingError(cause, 'Building details could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (principal) void load();
  }, [params.buildingId, principal]);

  const canManage = useMemo(() => {
    if (!principal || !record) return false;
    const branchIds = activeBranchIds(record, principal);
    return branchIds.length
      ? canPerformAcrossBranches(principal, 'portfolio.building.manage', branchIds)
      : hasCompanyPermission(principal, 'portfolio.building.manage');
  }, [principal, record]);

  const createSpaceHref = record
    ? '/portfolio?section=spaces&view=overview&create=1&propertyId=' +
      encodeURIComponent(record.property.id) +
      '&buildingId=' +
      encodeURIComponent(record.id)
    : '#';

  async function loadActivity(cursor: string | null = null) {
    setActivityLoading(true);
    try {
      setActivityPage(
        await api<CursorPage<ActivityRecord>>(
          '/buildings/' +
            params.buildingId +
            '/activity?limit=25' +
            (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''),
        ),
      );
    } catch (cause) {
      setError(userFacingError(cause, 'Building activity could not be loaded.'));
    } finally {
      setActivityLoading(false);
    }
  }
  useEffect(() => {
    if (principal && tab === 'activity' && !activityPage && !activityLoading) void loadActivity();
  }, [activityLoading, activityPage, principal, tab]);

  async function mutate(path: string, method: 'PATCH' | 'POST', body: unknown) {
    setBusy(true);
    setError('');
    try {
      await api(path, { method, body: JSON.stringify(body) });
      await load();
      setEditing(false);
      setStatusOpen(false);
      toast.success('Building updated.');
    } catch (cause) {
      const message = userFacingError(cause, 'The Building change could not be saved.');
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortfolioDetailShell
      principal={principal}
      activeItem="properties:buildings"
      breadcrumbs={['Portfolio', 'Properties', 'Buildings', record?.name ?? 'Building']}
    >
      {sessionError ? <ErrorState message={sessionError} /> : null}
      {loading ? <LoadingState label="Loading Building details" /> : null}
      {!loading && error && !record ? <ErrorState message={error} /> : null}
      {record ? (
        <div className="space-y-5">
          <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#E3F2FD] text-[#0D47A1]">
                  <Building2 className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    {record.buildingCode}
                  </p>
                  <h1 className="truncate text-2xl font-bold text-slate-950">{record.name}</h1>
                  <a
                    className="mt-1 inline-block text-sm font-semibold text-[#0D47A1] hover:underline"
                    href={'/portfolio/properties/' + record.property.id}
                  >
                    {record.property.propertyCode} - {record.property.name}
                  </a>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={record.status} />
                {canManage ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700"
                    >
                      <Edit3 className="h-4 w-4" /> Edit Building
                    </button>
                    <a
                      href={createSpaceHref}
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#0D47A1] px-3 text-sm font-bold text-white"
                    >
                      <Plus className="h-4 w-4" /> Add Rentable Space
                    </a>
                    <button
                      type="button"
                      onClick={() => setStatusOpen((value) => !value)}
                      className="grid h-10 w-10 place-items-center rounded-lg border border-slate-300 text-slate-700"
                      aria-label="Building lifecycle actions"
                    >
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </header>

          {error ? <ErrorState message={error} /> : null}

          {statusOpen ? (
            <form
              className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_2fr_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void mutate('/buildings/' + record.id + '/status', 'POST', {
                  status: formText(form, 'status'),
                  reason: formText(form, 'reason'),
                });
              }}
            >
              <label className="text-sm font-semibold text-slate-700">
                New status
                <select
                  name="status"
                  className="mt-1 block h-11 w-full rounded-lg border border-slate-300 px-3"
                  defaultValue={record.status}
                >
                  {['ACTIVE', 'INACTIVE', 'RETIRED'].map((status) => (
                    <option key={status} value={status}>
                      {humanize(status)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Reason
                <input
                  name="reason"
                  required
                  minLength={3}
                  className="mt-1 block h-11 w-full rounded-lg border border-slate-300 px-3"
                />
              </label>
              <button
                disabled={busy}
                className="self-end rounded-lg bg-[#0D47A1] px-4 py-3 text-sm font-bold text-white"
              >
                Apply
              </button>
            </form>
          ) : null}

          <DetailTabs
            tabs={tabs}
            active={tab}
            onChange={(next) => {
              setTab(next);
              if (next === 'activity' && !activityPage) void loadActivity();
              router.replace('/portfolio/buildings/' + record.id + '?tab=' + next, {
                scroll: false,
              });
            }}
            label="Building detail sections"
          />

          {tab === 'details' ? (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              {editing ? (
                <form
                  className="grid gap-4 md:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    const floors = formText(form, 'numberOfFloors');
                    void mutate('/buildings/' + record.id, 'PATCH', {
                      name: formText(form, 'name'),
                      numberOfFloors: floors ? Number(floors) : null,
                    });
                  }}
                >
                  <label className="text-sm font-semibold">
                    Building name
                    <input
                      name="name"
                      required
                      defaultValue={record.name}
                      className="mt-1 block h-11 w-full rounded-lg border border-slate-300 px-3"
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Number of floors
                    <input
                      name="numberOfFloors"
                      type="number"
                      min={0}
                      defaultValue={record.numberOfFloors ?? ''}
                      className="mt-1 block h-11 w-full rounded-lg border border-slate-300 px-3"
                    />
                  </label>
                  <div className="flex gap-2 md:col-span-2 md:justify-end">
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold"
                    >
                      <X className="h-4 w-4" /> Cancel
                    </button>
                    <button
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#0D47A1] px-4 py-2 text-sm font-bold text-white"
                    >
                      <Save className="h-4 w-4" /> Save changes
                    </button>
                  </div>
                </form>
              ) : (
                <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    ['Building code', record.buildingCode],
                    ['Parent Property', record.property.name],
                    [
                      'Number of floors',
                      record.numberOfFloors == null
                        ? 'Not recorded'
                        : String(record.numberOfFloors),
                    ],
                    ['Rentable Spaces', String(record._count.spaces)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-slate-200 p-4">
                      <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        {label}
                      </dt>
                      <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          ) : null}

          {tab === 'spaces' ? (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
                <div>
                  <h2 className="font-bold text-slate-950">Rentable Spaces</h2>
                  <p className="text-sm text-slate-500">
                    Leasing and occupancy targets inside this Building.
                  </p>
                </div>
                {canManage ? (
                  <a
                    href={createSpaceHref}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#0D47A1] px-4 text-sm font-bold text-white"
                  >
                    <Plus className="h-4 w-4" /> Add Rentable Space
                  </a>
                ) : null}
              </div>
              {record.spaces.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Rentable Space</th>
                        <th className="px-4 py-3">Code</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Floor</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {record.spaces.map((space) => (
                        <tr key={space.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-semibold text-slate-900">{space.name}</td>
                          <td className="px-4 py-3 text-slate-600">{space.spaceCode}</td>
                          <td className="px-4 py-3 text-slate-600">{space.type.name}</td>
                          <td className="px-4 py-3 text-slate-600">
                            {space.versions[0]?.floorNumber ?? 'Not recorded'}
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
                    title="No rentable spaces have been created for this Building."
                    description="Create the first leasing or occupancy target inside this Building."
                    action={
                      canManage ? (
                        <a
                          href={createSpaceHref}
                          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#0D47A1] px-4 text-sm font-bold text-white"
                        >
                          <Plus className="h-4 w-4" /> Add Rentable Space
                        </a>
                      ) : undefined
                    }
                  />
                </div>
              )}
            </section>
          ) : null}

          {tab === 'activity' ? (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-4">
                <h2 className="font-bold text-slate-950">Building Activity</h2>
                <p className="text-sm text-slate-500">
                  Immutable changes recorded for this Building.
                </p>
              </div>
              {activityLoading ? (
                <LoadingState label="Loading Building activity" />
              ) : activityPage?.items.length ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Activity</th>
                          <th className="px-4 py-3">Occurred</th>
                          <th className="px-4 py-3">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activityPage.items.map((item) => (
                          <tr key={item.id} className="border-t border-slate-100">
                            <td className="px-4 py-3 font-semibold text-slate-900">
                              {humanize(item.action.replace('portfolio.building.', ''))}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {new Intl.DateTimeFormat('en-GB', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              }).format(new Date(item.occurredAt))}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {item.reason ?? 'No reason recorded'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <CursorPaginationControls
                    page={activityIndex + 1}
                    itemCount={activityPage.items.length}
                    hasPrevious={activityIndex > 0}
                    hasNext={activityPage.pageInfo.hasNextPage}
                    onPrevious={() => {
                      const next = Math.max(0, activityIndex - 1);
                      setActivityIndex(next);
                      void loadActivity(activityHistory[next] ?? null);
                    }}
                    onNext={() => {
                      if (activityPage.pageInfo.nextCursor) {
                        const history = [
                          ...activityHistory.slice(0, activityIndex + 1),
                          activityPage.pageInfo.nextCursor,
                        ];
                        setActivityHistory(history);
                        setActivityIndex(activityIndex + 1);
                        void loadActivity(activityPage.pageInfo.nextCursor);
                      }
                    }}
                  />
                </>
              ) : (
                <div className="p-5">
                  <EmptyState
                    title="No Building activity recorded yet."
                    description="Building changes will appear here automatically."
                  />
                </div>
              )}
            </section>
          ) : null}
        </div>
      ) : null}
    </PortfolioDetailShell>
  );
}
