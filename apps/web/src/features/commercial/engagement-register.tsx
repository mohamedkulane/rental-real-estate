'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Filter, Plus, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { SearchableSelect } from '@/components/shared/searchable-select';
import { CursorPaginationControls } from '@/components/shared/pagination';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '@/components/shared/ui';
import {
  api,
  apiCached,
  canPerformInBranch,
  hasPermission,
  type CursorPage,
  userFacingError,
} from '@/lib/phase3-api';
import { CommercialShell, useCommercialPrincipal } from './commercial-shell';
import {
  serviceModels,
  type EngagementPage,
  type EngagementRecord,
  type PropertyOption,
  type ServiceModel,
  type SpaceOption,
} from './service-engagement-types';
import {
  appendCursor,
  engagementRequestPath,
  engagementWorkspaceState,
} from './service-engagement-workspace-model';

const dateValue = (date = new Date()) => date.toISOString().slice(0, 10);
const formText = (form: FormData, key: string): string => {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
};

function CreateEngagementDialog({
  open,
  onClose,
  properties,
  propertyLoading,
  onPropertySearch,
}: {
  open: boolean;
  onClose: () => void;
  properties: PropertyOption[];
  propertyLoading: boolean;
  onPropertySearch: (value: string) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [propertyId, setPropertyId] = useState('');
  const [spaceSearch, setSpaceSearch] = useState('');
  const [serviceModel, setServiceModel] = useState<ServiceModel>('FULL_MANAGEMENT');
  const [error, setError] = useState('');
  const spaceQuery = useQuery({
    queryKey: ['engagement-form-spaces', propertyId, spaceSearch],
    enabled: open && Boolean(propertyId),
    queryFn: () =>
      api<CursorPage<SpaceOption>>(
        `/rentable-spaces?limit=25&status=ACTIVE&propertyId=${propertyId}&search=${encodeURIComponent(spaceSearch)}`,
      ),
  });
  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<EngagementRecord>('/service-engagements', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (record) => {
      toast.success(`${record.engagementNumber} created.`);
      void queryClient.invalidateQueries({ queryKey: ['service-engagements'] });
      onClose();
      router.push(`/commercial/service-engagements/${record.id}`);
    },
    onError: (cause) => setError(userFacingError(cause, 'The Engagement could not be created.')),
  });
  useEffect(() => {
    if (!open) {
      setPropertyId('');
      setSpaceSearch('');
      setServiceModel('FULL_MANAGEMENT');
      setError('');
    }
  }, [open]);
  if (!open) return null;
  const propertyOnly = serviceModel === 'SALE_BROKERAGE' || serviceModel === 'COMPANY_OWNED';
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const rentableSpaceId = formText(form, 'rentableSpaceId');
    mutation.mutate({
      propertyId,
      serviceModel,
      ...(rentableSpaceId && !propertyOnly ? { rentableSpaceId } : {}),
      effectiveFrom: formText(form, 'effectiveFrom'),
      ...(formText(form, 'effectiveTo') ? { effectiveTo: formText(form, 'effectiveTo') } : {}),
      ...(formText(form, 'notes') ? { notes: formText(form, 'notes') } : {}),
    });
  };
  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/50 p-3 sm:p-6"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-engagement-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
        }}
        className="max-h-[calc(100vh-24px)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          <div>
            <h2 id="create-engagement-title" className="text-lg font-bold">
              Create Service Engagement
            </h2>
            <p className="mb-0 text-sm text-slate-500">
              Define commercial authority without changing the physical Property type.
            </p>
          </div>
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
            onClick={onClose}
            aria-label="Close create Engagement"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <form className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6" onSubmit={submit}>
          {error ? (
            <div className="feedback feedback-error sm:col-span-2" role="alert">
              {error}
            </div>
          ) : null}
          <label className="sm:col-span-2">
            Property
            <SearchableSelect
              searchable
              autoFocus
              searchThreshold={1}
              searchPlaceholder="Search Property name or code"
              loading={propertyLoading}
              value={propertyId}
              onSearchChange={onPropertySearch}
              onChange={(event) => setPropertyId(event.target.value)}
              required
              aria-label="Property"
            >
              <option value="">Choose a Property</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.propertyCode} — {property.name}
                </option>
              ))}
            </SearchableSelect>
          </label>
          <label>
            Service Model
            <select
              value={serviceModel}
              onChange={(event) => setServiceModel(event.target.value as ServiceModel)}
            >
              {serviceModels.map((model) => (
                <option key={model.value} value={model.value}>
                  {model.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Rentable Space <span className="font-normal text-slate-400">(optional override)</span>
            <SearchableSelect
              name="rentableSpaceId"
              searchable
              searchThreshold={1}
              searchPlaceholder="Search Space name or code"
              loading={spaceQuery.isLoading}
              disabled={!propertyId || propertyOnly}
              onSearchChange={setSpaceSearch}
              aria-label="Rentable Space"
            >
              <option value="">Use Property scope</option>
              {(spaceQuery.data?.items ?? []).map((space) => (
                <option key={space.id} value={space.id}>
                  {space.spaceCode} — {space.name}
                </option>
              ))}
            </SearchableSelect>
          </label>
          <label>
            Effective From
            <input name="effectiveFrom" type="date" defaultValue={dateValue()} required />
          </label>
          <label>
            Effective To <span className="font-normal text-slate-400">(optional)</span>
            <input name="effectiveTo" type="date" />
          </label>
          <label className="sm:col-span-2">
            Notes <span className="font-normal text-slate-400">(optional)</span>
            <textarea
              name="notes"
              rows={4}
              placeholder="Commercial context or authorizing agreement reference"
            />
          </label>
          <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 sm:col-span-2 sm:flex-row sm:justify-end">
            <button type="button" className="button secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={mutation.isPending || !propertyId}
            >
              {mutation.isPending ? 'Creating…' : 'Create Draft'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function TransitionDialog({
  record,
  action,
  onClose,
}: {
  record: EngagementRecord;
  action: 'activate' | 'deactivate' | 'cancel';
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const mutation = useMutation({
    mutationFn: () =>
      api(`/service-engagements/${record.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ reason, version: record.version }),
      }),
    onSuccess: () => {
      toast.success(`${record.engagementNumber} ${action}d.`);
      void queryClient.invalidateQueries({ queryKey: ['service-engagements'] });
      onClose();
    },
    onError: (cause) => setError(userFacingError(cause)),
  });
  return (
    <div className="fixed inset-0 z-[130] grid place-items-center bg-slate-950/50 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="transition-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
        }}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
      >
        <h2 id="transition-title" className="capitalize">
          {action} {record.engagementNumber}
        </h2>
        <p className="text-sm text-slate-500">
          This controlled lifecycle action is recorded in business history and audit evidence.
        </p>
        {error ? (
          <div className="feedback feedback-error" role="alert">
            {error}
          </div>
        ) : null}
        <label className="mt-4">
          Reason
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            minLength={3}
            maxLength={500}
            autoFocus
          />
        </label>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="button secondary" onClick={onClose}>
            Keep unchanged
          </button>
          <button
            type="button"
            className={action === 'cancel' ? 'button danger' : 'button primary'}
            disabled={reason.trim().length < 3 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Saving…' : action[0]!.toUpperCase() + action.slice(1)}
          </button>
        </div>
      </section>
    </div>
  );
}

export function EngagementRegister() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { principal, error: principalError } = useCommercialPrincipal();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [propertyId, setPropertyId] = useState(searchParams.get('propertyId') ?? '');
  const [rentableSpaceId, setRentableSpaceId] = useState(searchParams.get('rentableSpaceId') ?? '');
  const [serviceModel, setServiceModel] = useState(searchParams.get('serviceModel') ?? '');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [period, setPeriod] = useState(searchParams.get('period') ?? '');
  const [branchId, setBranchId] = useState(searchParams.get('branchId') ?? '');
  const [propertySearch, setPropertySearch] = useState('');
  const [spaceSearch, setSpaceSearch] = useState('');
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const [page, setPage] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [transition, setTransition] = useState<{
    record: EngagementRecord;
    action: 'activate' | 'deactivate' | 'cancel';
  } | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    setCursors([undefined]);
    setPage(0);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({
      search: debouncedSearch,
      propertyId,
      rentableSpaceId,
      serviceModel,
      status,
      period,
      branchId,
    }))
      if (value) params.set(key, value);
    router.replace(`/commercial/service-engagements${params.size ? `?${params.toString()}` : ''}`, {
      scroll: false,
    });
  }, [
    branchId,
    debouncedSearch,
    period,
    propertyId,
    rentableSpaceId,
    router,
    serviceModel,
    status,
  ]);
  const requestPath = useMemo(() => {
    return engagementRequestPath(
      {
        search: debouncedSearch,
        propertyId,
        rentableSpaceId,
        serviceModel,
        status,
        period,
        branchId,
      },
      cursors[page],
    );
  }, [
    branchId,
    cursors,
    debouncedSearch,
    page,
    period,
    propertyId,
    rentableSpaceId,
    serviceModel,
    status,
  ]);
  const listQuery = useQuery({
    queryKey: ['service-engagements', requestPath],
    enabled: Boolean(principal && hasPermission(principal, 'service-engagement.read')),
    queryFn: () => api<EngagementPage>(requestPath),
  });
  const propertiesQuery = useQuery({
    queryKey: ['engagement-properties', propertySearch],
    enabled: Boolean(principal),
    queryFn: () =>
      api<CursorPage<PropertyOption>>(
        `/properties?limit=25&status=ACTIVE&search=${encodeURIComponent(propertySearch)}`,
      ),
  });
  const branchesQuery = useQuery({
    queryKey: ['engagement-branches'],
    enabled: Boolean(principal),
    queryFn: () => apiCached<Array<{ id: string; name: string }>>('/branches'),
  });
  const spacesQuery = useQuery({
    queryKey: ['engagement-spaces', propertyId, spaceSearch],
    enabled: Boolean(principal && propertyId),
    queryFn: () =>
      api<CursorPage<SpaceOption>>(
        `/rentable-spaces?limit=25&status=ACTIVE&propertyId=${propertyId}&search=${encodeURIComponent(spaceSearch)}`,
      ),
  });
  const reset = () => {
    setSearch('');
    setPropertyId('');
    setRentableSpaceId('');
    setServiceModel('');
    setStatus('');
    setPeriod('');
    setBranchId('');
  };
  const workspaceState = engagementWorkspaceState({
    loading: listQuery.isLoading,
    error: listQuery.isError,
    itemCount: listQuery.data?.items.length ?? 0,
    filtered: Boolean(
      debouncedSearch ||
      propertyId ||
      rentableSpaceId ||
      serviceModel ||
      status ||
      period ||
      branchId,
    ),
  });
  const filterFields = (
    <>
      <label>
        Property
        <SearchableSelect
          searchable
          searchThreshold={1}
          searchPlaceholder="Search Properties"
          loading={propertiesQuery.isLoading}
          value={propertyId}
          onSearchChange={setPropertySearch}
          onChange={(event) => {
            setPropertyId(event.target.value);
            setRentableSpaceId('');
          }}
          aria-label="Filter by Property"
        >
          <option value="">All Properties</option>
          {(propertiesQuery.data?.items ?? []).map((property) => (
            <option key={property.id} value={property.id}>
              {property.propertyCode} — {property.name}
            </option>
          ))}
        </SearchableSelect>
      </label>
      <label>
        Rentable Space
        <SearchableSelect
          searchable
          searchThreshold={1}
          searchPlaceholder="Search Spaces"
          loading={spacesQuery.isLoading}
          disabled={!propertyId}
          value={rentableSpaceId}
          onSearchChange={setSpaceSearch}
          onChange={(event) => setRentableSpaceId(event.target.value)}
          aria-label="Filter by Rentable Space"
        >
          <option value="">All Spaces</option>
          {(spacesQuery.data?.items ?? []).map((space) => (
            <option key={space.id} value={space.id}>
              {space.spaceCode} — {space.name}
            </option>
          ))}
        </SearchableSelect>
      </label>
      <label>
        Service Model
        <select value={serviceModel} onChange={(event) => setServiceModel(event.target.value)}>
          <option value="">All Service Models</option>
          {serviceModels.map((model) => (
            <option key={model.value} value={model.value}>
              {model.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Status
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All Statuses</option>
          {['DRAFT', 'ACTIVE', 'INACTIVE', 'EXPIRED', 'CANCELLED'].map((value) => (
            <option key={value} value={value}>
              {value.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
      </label>
      <label>
        Period
        <select value={period} onChange={(event) => setPeriod(event.target.value)}>
          <option value="">All Periods</option>
          {['CURRENT', 'SCHEDULED', 'HISTORICAL'].map((value) => (
            <option key={value} value={value}>
              {value[0] + value.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </label>
      <label>
        Branch
        <select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
          <option value="">All Branches</option>
          {(branchesQuery.data ?? principal?.branches ?? []).map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </label>
    </>
  );
  if (principalError && !principal)
    return (
      <main className="workspace">
        <ErrorState message={principalError} />
      </main>
    );
  return (
    <CommercialShell principal={principal} activeItem="engagement-register">
      <PageHeader
        eyebrow="Commercial"
        title="Service Engagement Register"
        description="Define and manage the commercial relationship that determines which services the company may perform for each Property or Rentable Space."
        action={
          principal && hasPermission(principal, 'service-engagement.create') ? (
            <button className="button primary" onClick={() => setCreateOpen(true)}>
              <Plus /> Create Engagement
            </button>
          ) : undefined
        }
      />
      <section className="mt-6 overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-end">
          <label className="flex-1">
            Search
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="!pl-10"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Engagement number, Property, or Space"
              />
            </div>
          </label>
          <button
            type="button"
            className="button secondary md:!hidden"
            onClick={() => setFiltersOpen(true)}
          >
            <Filter /> Filters
          </button>
          <button type="button" className="button ghost" onClick={reset}>
            Reset
          </button>
        </div>
        <div className="hidden grid-cols-2 gap-4 border-b border-slate-200 p-4 md:grid lg:grid-cols-3 xl:grid-cols-6">
          {filterFields}
        </div>
        {workspaceState === 'loading' ? (
          <div className="p-5">
            <LoadingState label="Loading Service Engagements" />
          </div>
        ) : workspaceState === 'error' ? (
          <div className="p-5">
            <ErrorState
              message={userFacingError(listQuery.error)}
              onRetry={() => void listQuery.refetch()}
            />
          </div>
        ) : workspaceState === 'empty' || workspaceState === 'filtered-empty' ? (
          <EmptyState
            title={
              workspaceState === 'filtered-empty'
                ? 'No matching Service Engagements'
                : 'No Service Engagements yet'
            }
            description={
              workspaceState === 'filtered-empty'
                ? 'Clear or adjust the filters to review the complete authorized dataset.'
                : 'Create the first Engagement to define commercial authority.'
            }
            action={
              principal && hasPermission(principal, 'service-engagement.create') ? (
                <button className="button primary" onClick={() => setCreateOpen(true)}>
                  Create Engagement
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Engagement</th>
                  <th className="px-4 py-3">Scope</th>
                  <th className="px-4 py-3">Service Model</th>
                  <th className="px-4 py-3">Effective Period</th>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(listQuery.data?.items ?? []).map((record) => {
                  const branch = record.property.branchAssignments?.[0]?.branch;
                  const can = (permission: string) =>
                    Boolean(
                      principal && branch && canPerformInBranch(principal, permission, branch.id),
                    );
                  return (
                    <tr
                      key={record.id}
                      className="border-b border-slate-100 align-top text-sm last:border-0"
                    >
                      <td className="px-4 py-4">
                        <Link
                          className="font-bold text-[#0D47A1] hover:underline"
                          href={`/commercial/service-engagements/${record.id}`}
                        >
                          {record.engagementNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-4">
                        <strong className="block">
                          {record.rentableSpace
                            ? `${record.rentableSpace.spaceCode} — ${record.rentableSpace.name}`
                            : `${record.property.propertyCode} — ${record.property.name}`}
                        </strong>
                        <span className="text-xs text-slate-500">
                          {record.rentableSpace ? 'Rentable Space override' : 'Property scope'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {serviceModels.find((model) => model.value === record.serviceModel)?.label}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {record.effectiveFrom.slice(0, 10)} —{' '}
                        {record.effectiveTo?.slice(0, 10) ?? 'Open ended'}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge value={record.period} />
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge value={record.status} />
                      </td>
                      <td className="px-4 py-4">{branch?.name ?? 'Not assigned'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            className="button secondary !min-h-9 !px-3"
                            href={`/commercial/service-engagements/${record.id}`}
                          >
                            Open
                          </Link>
                          {record.status === 'DRAFT' && can('service-engagement.activate') ? (
                            <button
                              className="button primary !min-h-9 !px-3"
                              onClick={() => setTransition({ record, action: 'activate' })}
                            >
                              Activate
                            </button>
                          ) : null}
                          {record.status === 'ACTIVE' &&
                          record.period === 'CURRENT' &&
                          can('service-engagement.deactivate') ? (
                            <button
                              className="button secondary !min-h-9 !px-3"
                              onClick={() => setTransition({ record, action: 'deactivate' })}
                            >
                              Deactivate
                            </button>
                          ) : null}
                          {(record.status === 'DRAFT' ||
                            (record.status === 'ACTIVE' && record.period === 'SCHEDULED')) &&
                          can('service-engagement.cancel') ? (
                            <button
                              className="button danger !min-h-9 !px-3"
                              onClick={() => setTransition({ record, action: 'cancel' })}
                            >
                              Cancel
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500">
          {listQuery.data
            ? `${listQuery.data.totalCount} matching Engagement${listQuery.data.totalCount === 1 ? '' : 's'}`
            : 'Complete authorized dataset'}
        </div>
        <CursorPaginationControls
          page={page + 1}
          itemCount={listQuery.data?.items.length ?? 0}
          hasPrevious={page > 0}
          hasNext={Boolean(listQuery.data?.pageInfo.hasNextPage)}
          busy={listQuery.isFetching}
          onPrevious={() => setPage((value) => Math.max(0, value - 1))}
          onNext={() => {
            const next = listQuery.data?.pageInfo.nextCursor;
            if (!next) return;
            setCursors((values) => appendCursor(values, page, next));
            setPage((value) => value + 1);
          }}
        />
      </section>
      {filtersOpen ? (
        <div className="fixed inset-0 z-[110] bg-slate-950/50 md:hidden">
          <section
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-5"
            role="dialog"
            aria-modal="true"
            aria-label="Engagement filters"
            onKeyDown={(event) => {
              if (event.key === 'Escape') setFiltersOpen(false);
            }}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2>Filters</h2>
              <button
                className="grid h-11 w-11 place-items-center rounded-lg"
                onClick={() => setFiltersOpen(false)}
                aria-label="Close filters"
              >
                <X />
              </button>
            </div>
            <div className="grid gap-4">{filterFields}</div>
            <div className="sticky bottom-0 mt-5 flex gap-2 border-t border-slate-200 bg-white pt-4">
              <button className="button secondary flex-1" onClick={reset}>
                Reset
              </button>
              <button className="button primary flex-1" onClick={() => setFiltersOpen(false)}>
                Show Results
              </button>
            </div>
          </section>
        </div>
      ) : null}
      <CreateEngagementDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        properties={propertiesQuery.data?.items ?? []}
        propertyLoading={propertiesQuery.isLoading}
        onPropertySearch={setPropertySearch}
      />
      {transition ? (
        <TransitionDialog
          record={transition.record}
          action={transition.action}
          onClose={() => setTransition(null)}
        />
      ) : null}
    </CommercialShell>
  );
}
