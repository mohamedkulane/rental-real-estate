'use client';

import { SearchableSelect } from '@/components/shared/searchable-select';

import type { FormEvent, ReactNode } from 'react';
import {
  Archive,
  Building2,
  ChevronRight,
  CircleAlert,
  Edit3,
  Eye,
  ImageIcon,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { humanize } from '@/lib/presentation';
import type { Principal } from '@/lib/phase3-api';
import { PropertyOperations } from '../property-operations';
import { PaginationControls, usePagination } from '@/components/shared/pagination';
import { StatusBadge } from '@/components/shared/ui';
import { OwnershipEditor, OwnershipWorkspace } from '../ownership-workflow';
import type {
  OwnerOption,
  PropertyOwnershipRecord,
  ReplaceOwnershipInput,
} from '../ownership-model';

export type BranchOption = { id: string; code: string; name: string };
export type PropertyRecord = {
  id: string;
  propertyCode: string;
  name: string;
  propertyType: string;
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'RETIRED';
  description?: string | null;
  addressLine1?: string | null;
  city: string;
  district?: string | null;
  neighborhood?: string | null;
  landmark?: string | null;
  branchAssignments: {
    branchId: string;
    effectiveFrom: string;
    effectiveTo: string | null;
    branch?: BranchOption;
  }[];
  ownerships?: PropertyOwnershipRecord[];
  buildings?: unknown[];
  spaces?: {
    id: string;
    name: string;
    spaceCode: string;
    status: string;
    type?: { name: string };
  }[];
  amenities?: { amenity: { id: string; name: string } }[];
  _count?: { spaces: number; buildings: number };
};

type PropertyInput = {
  propertyCode?: string;
  name: string;
  propertyType: string;
  branchId: string;
  effectiveFrom: string;
  city: string;
  addressLine1?: string | undefined;
  district?: string | undefined;
  neighborhood?: string | undefined;
  landmark?: string | undefined;
  description?: string | undefined;
};

const field = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
};

function currentBranch(property: PropertyRecord, businessDate: string): BranchOption | undefined {
  const now = businessDate;
  return property.branchAssignments.find(
    (assignment) =>
      assignment.effectiveFrom.slice(0, 10) <= now &&
      (!assignment.effectiveTo || assignment.effectiveTo.slice(0, 10) > now),
  )?.branch;
}

function Metric({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: number;
  tone?: 'slate' | 'emerald' | 'amber';
}) {
  const color =
    tone === 'emerald'
      ? 'text-emerald-600'
      : tone === 'amber'
        ? 'text-amber-600'
        : 'text-slate-900';
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </span>
      <p className={'mt-1 text-xl font-bold ' + color}>{value}</p>
    </div>
  );
}

function Drawer({
  title,
  description,
  onClose,
  children,
  footer,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/35 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close panel"
        onClick={onClose}
      />
      <section className="relative flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl animate-in slide-in-from-right duration-200">
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
            aria-label="Close panel"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {footer ? (
          <footer className="border-t border-slate-200 bg-white p-5">{footer}</footer>
        ) : null}
      </section>
    </div>
  );
}

function FormField({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="space-y-1.5 text-sm font-semibold text-slate-700">
      <span>{label}</span>
      {children}
      {hint ? <span className="block text-xs font-normal text-slate-500">{hint}</span> : null}
    </label>
  );
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100';

export function PropertyRegistry({
  records,
  branches,
  principal,
  businessDate,
  busy,
  canCreate,
  creatableBranchIds,
  canUpdate,
  onCreate,
  onUpdate,
  onTransition,
  onDiscard,
  onLoadDetails,
  owners,
  canReadOwnership,
  canManageOwnership,
  onReplaceOwnership,
}: {
  records: PropertyRecord[];
  branches: BranchOption[];
  principal: Principal;
  businessDate: string;
  busy: boolean;
  canCreate: boolean;
  creatableBranchIds: string[];
  canUpdate: (record: PropertyRecord) => boolean;
  onCreate: (input: PropertyInput) => Promise<void>;
  onUpdate: (id: string, input: Partial<PropertyInput>) => Promise<void>;
  onTransition: (
    id: string,
    action: 'activate' | 'deactivate' | 'reactivate' | 'retire',
    reason: string,
  ) => Promise<void>;
  onDiscard: (id: string, reason: string) => Promise<void>;
  onLoadDetails: (id: string) => Promise<PropertyRecord>;
  owners: OwnerOption[];
  canReadOwnership: (record: PropertyRecord) => boolean;
  canManageOwnership: (record: PropertyRecord) => boolean;
  onReplaceOwnership: (id: string, input: ReplaceOwnershipInput) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [panel, setPanel] = useState<
    'create' | 'details' | 'edit' | 'status' | 'discard' | 'ownership' | null
  >(null);
  const [selected, setSelected] = useState<PropertyRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<
    'overview' | 'spaces' | 'ownership' | 'operations' | 'activity'
  >('overview');

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return records.filter((property) => {
      const branch = currentBranch(property, businessDate);
      const matchesSearch =
        !normalized ||
        [property.name, property.propertyCode, property.city, property.addressLine1, branch?.name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalized));
      return (
        matchesSearch &&
        (branchFilter === 'all' || branch?.id === branchFilter) &&
        (typeFilter === 'all' || property.propertyType === typeFilter) &&
        (statusFilter === 'all' || property.status === statusFilter)
      );
    });
  }, [branchFilter, query, records, statusFilter, typeFilter]);
  const pagination = usePagination(filtered);

  const openDetails = async (property: PropertyRecord) => {
    setSelected(property);
    setPanel('details');
    setDetailLoading(true);
    try {
      setSelected(await onLoadDetails(property.id));
    } finally {
      setDetailLoading(false);
    }
  };

  const propertyTypes = [...new Set(records.map((property) => property.propertyType))];
  const closePanel = () => {
    setPanel(null);
    setDetailTab('overview');
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            <span>Portfolio</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-700">Properties</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Property registry
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Find, review, and manage every property and its operating branch from one clear
            workspace.
          </p>
        </div>
        {canCreate ? (
          <button
            type="button"
            onClick={() => setPanel('create')}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" /> Add property
          </button>
        ) : null}
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Property summary">
        <Metric label="All properties" value={records.length} />
        <Metric
          label="Active"
          value={records.filter((record) => record.status === 'ACTIVE').length}
          tone="emerald"
        />
        <Metric
          label="Drafts"
          value={records.filter((record) => record.status === 'DRAFT').length}
        />
        <Metric
          label="Inactive or retired"
          value={records.filter((record) => ['INACTIVE', 'RETIRED'].includes(record.status)).length}
          tone="amber"
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-1 items-end gap-3 border-b border-slate-200 p-4 lg:grid-cols-[minmax(260px,1.2fr)_minmax(0,3fr)]">
          <label className="relative block min-w-0">
            <span className="sr-only">Search properties</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="search"
              placeholder="Search name, code, city, or branch..."
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-12 pr-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <div className="grid min-w-0 grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="relative">
              <span className="sr-only">Filter by branch</span>
              <SearchableSelect
                aria-label="Filter by branch"
                value={branchFilter}
                onChange={(event) => setBranchFilter(event.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-emerald-600"
              >
                <option value="all">All branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </SearchableSelect>
            </label>
            <label className="relative">
              <span className="sr-only">Filter by type</span>
              <SearchableSelect
                aria-label="Filter by type"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-emerald-600"
              >
                <option value="all">All types</option>
                {propertyTypes.map((type) => (
                  <option key={type} value={type}>
                    {humanize(type)}
                  </option>
                ))}
              </SearchableSelect>
            </label>
            <SearchableSelect
              searchable={false}
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-emerald-600"
            >
              <option value="all">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="RETIRED">Retired</option>
            </SearchableSelect>
          </div>
        </div>

        {filtered.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  {['Property', 'Code', 'Branch', 'Type', 'Spaces', 'Status', 'Actions'].map(
                    (header) => (
                      <th
                        key={header}
                        className={
                          'px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 ' +
                          (header === 'Actions' ? 'text-right' : '')
                        }
                      >
                        {header}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagination.pageItems.map((property) => {
                  const branch = currentBranch(property, businessDate);
                  return (
                    <tr key={property.id} className="group transition-colors hover:bg-slate-50/80">
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => void openDetails(property)}
                          className="flex items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-400">
                            <ImageIcon className="h-5 w-5" />
                          </span>
                          <span>
                            <strong className="block text-sm font-bold text-slate-900 group-hover:text-emerald-700">
                              {property.name}
                            </strong>
                            <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                              <MapPin className="h-3 w-3" />
                              {property.addressLine1 || property.city}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td className="px-5 py-4 text-xs font-bold text-slate-600">
                        {property.propertyCode}
                      </td>
                      <td className="px-5 py-4 text-xs font-semibold text-slate-600">
                        {branch?.name ?? 'Branch not current'}
                      </td>
                      <td className="px-5 py-4 text-xs font-semibold text-slate-600">
                        {humanize(property.propertyType)}
                      </td>
                      <td className="px-5 py-4 text-center text-xs font-bold text-slate-800">
                        {property._count?.spaces ?? property.spaces?.length ?? 0}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge value={property.status} />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <details className="relative inline-block text-left">
                          <summary
                            className="flex cursor-pointer list-none rounded-lg p-2 text-slate-400 hover:bg-white hover:text-emerald-700 hover:shadow-sm"
                            aria-label={'Actions for ' + property.name}
                          >
                            <MoreHorizontal className="h-5 w-5" />
                          </summary>
                          <div className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white p-1.5 text-left shadow-xl">
                            <button
                              type="button"
                              onClick={() => void openDetails(property)}
                              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <Eye className="h-4 w-4" /> View details
                            </button>
                            {canUpdate(property) ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelected(property);
                                  setPanel('edit');
                                }}
                                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                <Edit3 className="h-4 w-4" /> Edit property
                              </button>
                            ) : null}
                            {canUpdate(property) ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelected(property);
                                  setPanel('status');
                                }}
                                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                <Archive className="h-4 w-4" /> Change status
                              </button>
                            ) : null}
                            {canUpdate(property) && property.status === 'DRAFT' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelected(property);
                                  setPanel('discard');
                                }}
                                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" /> Discard draft
                              </button>
                            ) : null}
                          </div>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <Building2 className="h-9 w-9 text-slate-300" />
            <h2 className="mt-3 text-base font-bold text-slate-800">No matching properties</h2>
            <p className="mt-1 text-sm text-slate-500">
              Change the filters or add the first property in this scope.
            </p>
          </div>
        )}
        <PaginationControls
          page={pagination.page}
          pageCount={pagination.pageCount}
          total={filtered.length}
          onPageChange={pagination.setPage}
        />
      </section>

      {panel === 'create' ? (
        <Drawer
          title="Add property"
          description="Create the property as a draft. Its property number is generated automatically."
          onClose={closePanel}
        >
          <form
            className="space-y-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void onCreate({
                name: field(form, 'name'),
                propertyType: field(form, 'propertyType'),
                branchId: field(form, 'branchId'),
                effectiveFrom: field(form, 'effectiveFrom'),
                city: field(form, 'city'),
                addressLine1: field(form, 'addressLine1') || undefined,
                district: field(form, 'district') || undefined,
                description: field(form, 'description') || undefined,
              })
                .then(closePanel)
                .catch(() => undefined);
            }}
          >
            <FormField label="Property name">
              <input
                name="name"
                required
                minLength={2}
                maxLength={200}
                className={inputClass}
                placeholder="Riverside Apartments"
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Property type">
                <SearchableSelect name="propertyType" required className={inputClass}>
                  <option value="HOUSE">House</option>
                  <option value="VILLA">Villa</option>
                  <option value="APARTMENT_BUILDING">Apartment building</option>
                  <option value="COMMERCIAL_BUILDING">Commercial building</option>
                  <option value="COMPOUND">Compound</option>
                  <option value="WAREHOUSE_PROPERTY">Warehouse property</option>
                  <option value="LAND">Land</option>
                  <option value="MIXED_USE">Mixed use</option>
                  <option value="OTHER">Other</option>
                </SearchableSelect>
              </FormField>
              <FormField label="Operating branch">
                <SearchableSelect name="branchId" required className={inputClass}>
                  <option value="">Choose a branch</option>
                  {branches
                    .filter((branch) => creatableBranchIds.includes(branch.id))
                    .map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                </SearchableSelect>
              </FormField>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Branch effective from">
                <input
                  name="effectiveFrom"
                  type="date"
                  defaultValue={businessDate}
                  required
                  className={inputClass}
                />
              </FormField>
              <FormField label="City">
                <input name="city" required className={inputClass} />
              </FormField>
            </div>
            <FormField label="Address">
              <input name="addressLine1" className={inputClass} placeholder="Street or location" />
            </FormField>
            <FormField label="District">
              <input name="district" className={inputClass} />
            </FormField>
            <FormField label="Description">
              <textarea name="description" rows={4} className={inputClass} />
            </FormField>
            <div className="flex gap-3 border-t border-slate-200 pt-5">
              <button
                disabled={busy}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {busy ? 'Saving...' : 'Create draft property'}
              </button>
              <button
                type="button"
                onClick={closePanel}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </Drawer>
      ) : null}

      {panel === 'edit' && selected ? (
        <Drawer
          title="Edit property"
          description="Update the property identity and location. Changes are recorded in the audit log."
          onClose={closePanel}
        >
          <form
            className="space-y-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void onUpdate(selected.id, {
                name: field(form, 'name'),
                city: field(form, 'city'),
                addressLine1: field(form, 'addressLine1'),
                district: field(form, 'district'),
                neighborhood: field(form, 'neighborhood'),
                landmark: field(form, 'landmark'),
                description: field(form, 'description'),
              })
                .then(closePanel)
                .catch(() => undefined);
            }}
          >
            <FormField
              label="Property code"
              hint="The permanent code cannot be changed after creation."
            >
              <input value={selected.propertyCode} disabled className={inputClass} />
            </FormField>
            <FormField label="Property name">
              <input name="name" defaultValue={selected.name} required className={inputClass} />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="City">
                <input name="city" defaultValue={selected.city} required className={inputClass} />
              </FormField>
              <FormField label="District">
                <input
                  name="district"
                  defaultValue={selected.district ?? ''}
                  className={inputClass}
                />
              </FormField>
            </div>
            <FormField label="Address">
              <input
                name="addressLine1"
                defaultValue={selected.addressLine1 ?? ''}
                className={inputClass}
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Neighborhood">
                <input
                  name="neighborhood"
                  defaultValue={selected.neighborhood ?? ''}
                  className={inputClass}
                />
              </FormField>
              <FormField label="Nearby landmark">
                <input
                  name="landmark"
                  defaultValue={selected.landmark ?? ''}
                  className={inputClass}
                />
              </FormField>
            </div>
            <FormField label="Description">
              <textarea
                name="description"
                defaultValue={selected.description ?? ''}
                rows={4}
                className={inputClass}
              />
            </FormField>
            <div className="flex gap-3 border-t border-slate-200 pt-5">
              <button
                disabled={busy}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                {busy ? 'Saving...' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={closePanel}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold"
              >
                Cancel
              </button>
            </div>
          </form>
        </Drawer>
      ) : null}

      {panel === 'status' && selected ? (
        <Drawer
          title="Change property status"
          description="Use Inactive or Retired to preserve history. Activation requires complete branch and ownership setup."
          onClose={closePanel}
        >
          <form
            className="space-y-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void onTransition(
                selected.id,
                field(form, 'action') as 'activate' | 'deactivate' | 'reactivate' | 'retire',
                field(form, 'reason'),
              )
                .then(closePanel)
                .catch(() => undefined);
            }}
          >
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="font-bold text-slate-900">{selected.name}</p>
              <p className="mt-1 text-xs text-slate-500">
                Current status: {humanize(selected.status)}
              </p>
            </div>
            <FormField label="Lifecycle action">
              <SearchableSelect name="action" className={inputClass} required>
                {selected.status === 'DRAFT' ? <option value="activate">Activate</option> : null}
                {selected.status === 'ACTIVE' ? (
                  <option value="deactivate">Deactivate</option>
                ) : null}
                {selected.status === 'INACTIVE' ? (
                  <>
                    <option value="reactivate">Reactivate</option>
                    <option value="retire">Retire permanently</option>
                  </>
                ) : null}
              </SearchableSelect>
            </FormField>
            <FormField label="Reason">
              <textarea
                name="reason"
                rows={3}
                minLength={3}
                maxLength={500}
                className={inputClass}
                required
              />
            </FormField>
            <button
              disabled={busy}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? 'Updating...' : 'Confirm lifecycle change'}
            </button>
          </form>
        </Drawer>
      ) : null}

      {panel === 'discard' && selected ? (
        <Drawer
          title="Discard draft property"
          description="This permanently removes only an unused draft. Drafts with related business records cannot be deleted."
          onClose={closePanel}
        >
          <form
            className="space-y-5"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const reason = field(new FormData(event.currentTarget), 'reason');
              void onDiscard(selected.id, reason)
                .then(closePanel)
                .catch(() => undefined);
            }}
          >
            <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-bold">Discard {selected.name}?</p>
                <p className="mt-1 text-sm">
                  This action cannot be undone. An audit record will keep the reason and property
                  identity.
                </p>
              </div>
            </div>
            <FormField label="Reason">
              <textarea
                name="reason"
                required
                minLength={3}
                rows={4}
                className={inputClass}
                placeholder="Why is this draft being discarded?"
              />
            </FormField>
            <button
              disabled={busy}
              className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {busy ? 'Discarding...' : 'Discard draft'}
            </button>
          </form>
        </Drawer>
      ) : null}

      {panel === 'details' && selected ? (
        <Drawer
          title={selected.name}
          description={selected.propertyCode + ' · ' + humanize(selected.propertyType)}
          onClose={closePanel}
        >
          {detailLoading ? (
            <div className="space-y-3">
              <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-40 animate-pulse rounded-lg bg-slate-100" />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500">
                    {selected.addressLine1 || selected.city}
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {currentBranch(selected, businessDate)?.name ?? 'No current branch'}
                  </p>
                </div>
                <StatusBadge value={selected.status} />
              </div>
              <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
                {(['overview', 'spaces', 'ownership', 'operations', 'activity'] as const).map(
                  (tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setDetailTab(tab)}
                      className={
                        'whitespace-nowrap border-b-2 px-3 py-2 text-xs font-bold capitalize ' +
                        (detailTab === tab
                          ? 'border-emerald-600 text-emerald-700'
                          : 'border-transparent text-slate-500 hover:text-slate-800')
                      }
                    >
                      {tab}
                    </button>
                  ),
                )}
              </div>
              {detailTab === 'overview' ? (
                <dl className="grid gap-4 sm:grid-cols-2">
                  {[
                    ['Property type', humanize(selected.propertyType)],
                    ['City', selected.city],
                    ['District', selected.district || 'Not recorded'],
                    [
                      'Buildings',
                      String(selected._count?.buildings ?? selected.buildings?.length ?? 0),
                    ],
                    [
                      'Rentable spaces',
                      String(selected._count?.spaces ?? selected.spaces?.length ?? 0),
                    ],
                    ['Description', selected.description || 'Not recorded'],
                  ].map(([term, value]) => (
                    <div key={term} className="rounded-lg border border-slate-200 p-3">
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {term}
                      </dt>
                      <dd className="mt-1 text-sm font-semibold text-slate-800">{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {detailTab === 'spaces' ? (
                <div className="space-y-2">
                  {selected.spaces?.length ? (
                    selected.spaces.map((space) => (
                      <div
                        key={space.id}
                        className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
                      >
                        <div>
                          <p className="text-sm font-bold">{space.name}</p>
                          <p className="text-xs text-slate-500">
                            {space.spaceCode} · {space.type?.name ?? 'Rentable space'}
                          </p>
                        </div>
                        <StatusBadge value={space.status} />
                      </div>
                    ))
                  ) : (
                    <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                      No rentable spaces have been added.
                    </p>
                  )}
                </div>
              ) : null}
              {detailTab === 'ownership' ? (
                canReadOwnership(selected) ? (
                  <OwnershipWorkspace
                    businessDate={businessDate}
                    records={selected.ownerships ?? []}
                    canManage={canManageOwnership(selected)}
                    activationContext={{
                      branchAssigned: Boolean(currentBranch(selected, businessDate)),
                      detailsComplete: Boolean(
                        selected.name && selected.propertyType && selected.city,
                      ),
                      isDraft: selected.status === 'DRAFT',
                    }}
                    onManage={() => setPanel('ownership')}
                  />
                ) : (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    You do not have permission to view property ownership in this branch.
                  </p>
                )
              ) : null}
              {detailTab === 'operations' ? (
                <PropertyOperations property={selected} branches={branches} principal={principal} />
              ) : null}
              {detailTab === 'activity' ? (
                <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                  Property changes are recorded in the Audit log under Oversight.
                </p>
              ) : null}
              {canUpdate(selected) ? (
                <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    onClick={() => setPanel('edit')}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
                  >
                    <Edit3 className="h-4 w-4" /> Edit property
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanel('status')}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700"
                  >
                    <Archive className="h-4 w-4" /> Change status
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </Drawer>
      ) : null}

      {panel === 'ownership' && selected ? (
        <Drawer
          title="Manage ownership"
          description={selected.name + ' ? Changes preserve effective-dated history'}
          onClose={() => {
            setPanel('details');
            setDetailTab('ownership');
          }}
        >
          <OwnershipEditor
            businessDate={businessDate}
            key={selected.id + ':' + (selected.ownerships?.length ?? 0)}
            owners={owners}
            current={(selected.ownerships ?? []).filter(
              (record) =>
                record.effectiveFrom.slice(0, 10) <= businessDate &&
                (!record.effectiveTo || record.effectiveTo.slice(0, 10) > businessDate),
            )}
            busy={busy}
            onCancel={() => {
              setPanel('details');
              setDetailTab('ownership');
            }}
            onSave={async (input) => {
              await onReplaceOwnership(selected.id, input);
              setSelected(await onLoadDetails(selected.id));
              setPanel('details');
              setDetailTab('ownership');
            }}
          />
        </Drawer>
      ) : null}
    </div>
  );
}
