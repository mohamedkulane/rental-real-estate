'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from '@/lib/toast';
import { SearchableSelect } from '@/components/shared/searchable-select';
import { FormSection } from '@/components/shared/ui';
import { api, pageItems, type CursorPage, type Principal, userFacingError } from '@/lib/phase3-api';
import { humanize } from '@/lib/presentation';
import type { PickRecord } from '@/features/workflow/record-picker';

export type FinanceRow = Record<string, unknown> & { id: string; status?: string };

export const financeRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export const financeText = (value: unknown) => (typeof value === 'string' ? value : '');

export const financeScalar = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';

export const financeNested = (row: FinanceRow | Record<string, unknown>, ...keys: string[]): unknown =>
  keys.reduce<unknown>(
    (value, key) =>
      value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined,
    row,
  );

export const financeMoney = (currency: unknown, amount: unknown) =>
  financeScalar(amount) ? `${financeText(currency)} ${financeScalar(amount)}` : 'Not set';

export function previousCalendarMonth(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  const iso = (value: Date) =>
    `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  return { start: iso(start), end: iso(end) };
}

const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[14px] shadow-sm';

export function FinanceTextField({
  label,
  value,
  onChange,
  type = 'text',
  required,
  maxLength,
  min,
  max,
  step,
  placeholder,
  wide,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'date' | 'number';
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: string;
  placeholder?: string;
  wide?: boolean;
}) {
  return (
    <label className={`grid min-w-0 gap-1 ${wide ? 'md:col-span-2' : ''}`}>
      <span className="text-[13px] font-semibold text-slate-600">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      <input
        type={type}
        className={inputClass}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        min={min}
        max={max}
        step={step}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function FinanceTextArea({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="grid min-w-0 gap-1 md:col-span-2">
      <span className="text-[13px] font-semibold text-slate-600">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      <textarea
        className={`${inputClass} min-h-[88px]`}
        value={value}
        required={required}
        minLength={required ? 3 : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function FinanceStaticSelect({
  label,
  value,
  onChange,
  options,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
}) {
  return (
    <label className="grid min-w-0 gap-1">
      <span className="text-[13px] font-semibold text-slate-600">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      <SearchableSelect
        searchable
        searchThreshold={0}
        className={inputClass}
        aria-label={label}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      >
        {required ? null : <option value="">Select {label.toLowerCase()}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SearchableSelect>
    </label>
  );
}

export function BranchSelect({
  branches,
  value,
  onChange,
  label = 'Branch',
  optional = false,
}: {
  branches: Array<{ id: string; code: string; name: string }>;
  value: string;
  onChange: (branchId: string) => void;
  label?: string;
  /** When true, do not auto-select or require a branch (company-wide allowed). */
  optional?: boolean;
}) {
  const catalog = useQuery({
    queryKey: ['finance-branch-catalog'],
    enabled: branches.length === 0,
    queryFn: () => api<Array<{ id: string; code?: string; name: string }>>('/branches'),
  });
  const options = branches.length
    ? branches
    : (catalog.data ?? []).map((row) => ({
        id: row.id,
        code: row.code ?? '',
        name: row.name,
      }));

  useEffect(() => {
    if (optional) return;
    if (!value && options[0]?.id) onChange(options[0].id);
  }, [onChange, options, optional, value]);

  if (catalog.isError) {
    return (
      <div className="grid min-w-0 gap-1">
        <span className="text-[13px] font-semibold text-slate-600">{label}</span>
        <p className="text-[12px] text-red-700">{userFacingError(catalog.error)}</p>
      </div>
    );
  }

  if (!options.length) {
    return (
      <div className="grid min-w-0 gap-1">
        <span className="text-[13px] font-semibold text-slate-600">{label}</span>
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
          {catalog.isFetching
            ? 'Loading authorized branches…'
            : 'No authorized branch is available for this action.'}
        </p>
      </div>
    );
  }

  const selected = optional ? value : value || options[0]!.id;
  return (
    <label className="grid min-w-0 gap-1">
      <span className="text-[13px] font-semibold text-slate-600">
        {label}
        {optional ? null : <span className="text-red-600"> *</span>}
      </span>
      <SearchableSelect
        searchable
        searchThreshold={0}
        className={inputClass}
        aria-label={label}
        value={selected}
        required={!optional}
        onChange={(event) => onChange(event.target.value)}
      >
        {optional ? <option value="">Company-wide (no branch)</option> : null}
        {options.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </SearchableSelect>
    </label>
  );
}

export function FinanceRecordSelect({
  label,
  path,
  value,
  selectedLabel,
  map,
  onChange,
  required,
  enabled = true,
  emptyHint,
  filter,
}: {
  label: string;
  path: string;
  value: string;
  selectedLabel?: string;
  map: (row: Record<string, unknown>) => PickRecord;
  onChange: (record: PickRecord | null) => void;
  required?: boolean;
  enabled?: boolean;
  emptyHint?: string;
  filter?: (row: Record<string, unknown>) => boolean;
}) {
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const url = useMemo(() => {
    const params = new URLSearchParams({ limit: '40' });
    if (term) params.set('search', term);
    return `${path}${path.includes('?') ? '&' : '?'}${params}`;
  }, [path, term]);

  const query = useQuery({
    queryKey: ['finance-options', url],
    enabled,
    queryFn: () => api<CursorPage<Record<string, unknown>>>(url),
  });
  const options = (query.data ? pageItems(query.data) : [])
    .filter((row) => (filter ? filter(row) : true))
    .map(map)
    .filter((row) => row.id);
  const selected = options.find((row) => row.id === value);

  return (
    <div className="grid min-w-0 gap-1">
      <span className="text-[13px] font-semibold text-slate-600">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      <SearchableSelect
        searchable
        searchThreshold={0}
        className={inputClass}
        aria-label={label}
        searchPlaceholder={`Search ${label.toLowerCase()}`}
        loading={query.isFetching}
        value={value}
        required={required ? Boolean(value) : false}
        onSearchChange={setSearch}
        onChange={(event) => {
          const next = options.find((row) => row.id === event.target.value) ?? null;
          onChange(next);
        }}
      >
        <option value="">{`Select ${label.toLowerCase()}`}</option>
        {value && !selected ? <option value={value}>{selectedLabel ?? 'Selected record'}</option> : null}
        {options.map((row) => (
          <option key={row.id} value={row.id}>
            {row.label}
          </option>
        ))}
      </SearchableSelect>
      {query.isError ? (
        <p className="text-[12px] text-red-700">{userFacingError(query.error)}</p>
      ) : !enabled ? (
        emptyHint ? <p className="text-[12px] text-slate-500">{emptyHint}</p> : null
      ) : !query.isFetching && !options.length ? (
        <p className="text-[12px] text-slate-500">
          {term
            ? 'No matching records. Try another search.'
            : emptyHint ?? `No ${label.toLowerCase()} records are available yet.`}
        </p>
      ) : null}
    </div>
  );
}

export function FinanceReferencePicker({
  label,
  path,
  value,
  onChange,
  required,
}: {
  label: string;
  path: string;
  value: string;
  onChange: (record: PickRecord | null) => void;
  required?: boolean;
}) {
  return (
    <FinanceRecordSelect
      label={label}
      path={path}
      value={value}
      required={required}
      map={(row) => ({
        id: financeText(row.id),
        label: `${financeText(row.code)} — ${financeText(row.name)}`,
      })}
      onChange={onChange}
    />
  );
}

export const financePickerMap = {
  tenant: (raw: Record<string, unknown>): PickRecord => {
    const party = financeRecord(raw.party);
    return {
      id: financeText(raw.partyId) || financeText(raw.id),
      label: `${financeText(raw.tenantNumber)} — ${financeText(party.displayName)}`,
    };
  },
  owner: (raw: Record<string, unknown>): PickRecord => {
    const party = financeRecord(raw.party);
    return {
      id: financeText(raw.partyId) || financeText(raw.id),
      label: `${financeText(raw.ownerNumber)} — ${financeText(party.displayName)}`,
    };
  },
  party: (raw: Record<string, unknown>): PickRecord => ({
    id: financeText(raw.id),
    label: `${financeText(raw.partyNumber)} — ${financeText(raw.displayName)}`,
  }),
  property: (raw: Record<string, unknown>): PickRecord => ({
    id: financeText(raw.id),
    label: `${financeText(raw.propertyCode)} — ${financeText(raw.name)}`,
  }),
  space: (raw: Record<string, unknown>): PickRecord => ({
    id: financeText(raw.id),
    label: `${financeText(raw.spaceCode)} — ${financeText(raw.name)}`,
    propertyId: financeText(raw.propertyId),
  }),
  lease: (raw: Record<string, unknown>): PickRecord => {
    const space = financeRecord(raw.rentableSpace);
    return {
      id: financeText(raw.id),
      label: `${financeText(raw.leaseNumber)} — ${financeText(space.name) || financeText(raw.leaseNumber)}`,
      currency: financeText(raw.currency) || 'USD',
      rentAmount: financeScalar(raw.rentAmount),
      status: financeText(raw.status),
    };
  },
  engagement: (raw: Record<string, unknown>): PickRecord => ({
    id: financeText(raw.id),
    label: `${financeText(raw.engagementNumber)} — ${humanize(financeText(raw.serviceModel))}`,
    serviceModel: financeText(raw.serviceModel),
    propertyId: financeText(raw.propertyId),
  }),
  vendor: (raw: Record<string, unknown>): PickRecord => {
    const party = financeRecord(raw.party);
    return {
      id: financeText(raw.id),
      label: `${financeText(raw.vendorNumber)} — ${financeText(party.displayName)}`,
      partyId: financeText(raw.partyId),
    };
  },
  charge: (raw: Record<string, unknown>): PickRecord => ({
    id: financeText(raw.id),
    label: `${financeText(raw.chargeNumber)} — ${financeMoney(raw.currency, raw.outstandingAmount)}`,
    outstandingAmount: financeScalar(raw.outstandingAmount),
    currency: financeText(raw.currency),
    debtorPartyId: financeText(raw.debtorPartyId),
  }),
  offer: (raw: Record<string, unknown>): PickRecord => ({
    id: financeText(raw.id),
    label: `${financeText(raw.offerNumber)} — ${financeMoney(raw.currency, raw.offerAmount)}`,
  }),
  workOrder: (raw: Record<string, unknown>): PickRecord => ({
    id: financeText(raw.id),
    label: `${financeText(raw.workOrderNumber)} — ${financeText(raw.title) || financeText(raw.workOrderNumber)}`,
    propertyId: financeText(raw.propertyId),
  }),
  lead: (raw: Record<string, unknown>): PickRecord => ({
    id: financeText(raw.id),
    label: `${financeText(raw.leadNumber)} — ${financeText(raw.displayName)}`,
  }),
};

export function FinanceFormPanel({
  title,
  description,
  children,
  submitLabel,
  busy,
  disabled,
  onSubmit,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  submitLabel: string;
  busy?: boolean;
  disabled?: boolean;
  onSubmit: () => void;
}) {
  return (
    <FormSection title={title} {...(description ? { description } : {})}>
      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        {children}
        <div className="full">
          <button className="primary" type="submit" disabled={busy || disabled}>
            {busy ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>
    </FormSection>
  );
}

export function FinanceField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-[14px] font-medium text-slate-900">{value || '—'}</p>
    </div>
  );
}

export function useFinanceTransition(onSuccess: () => void) {
  return useMutation({
    mutationFn: ({ path, body }: { path: string; body: Record<string, unknown> }) =>
      api(path, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Status updated.');
      onSuccess();
    },
    onError: (error) => toast.error(userFacingError(error)),
  });
}

export function TransitionPanel({
  currentStatus,
  transitions,
  busy,
  onTransition,
}: {
  currentStatus: string;
  transitions: readonly string[];
  busy?: boolean;
  onTransition: (status: string, reason: string) => void;
}) {
  const [nextStatus, setNextStatus] = useState(transitions[0] ?? '');
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (transitions[0] && !transitions.includes(nextStatus)) setNextStatus(transitions[0]);
  }, [nextStatus, transitions]);
  if (!transitions.length) return null;
  return (
    <FormSection title="Lifecycle actions" description="Only approved backend transitions are available.">
      <div className="grid gap-3">
        <FinanceStaticSelect
          label="Next status"
          value={nextStatus}
          onChange={setNextStatus}
          required
          options={transitions.map((status) => ({ value: status, label: humanize(status) }))}
        />
        <FinanceTextArea label="Reason" value={reason} onChange={setReason} required />
        <button
          className="button primary"
          type="button"
          disabled={busy || reason.trim().length < 3}
          onClick={() => onTransition(nextStatus, reason.trim())}
        >
          {busy ? 'Updating…' : `Move to ${humanize(nextStatus)}`}
        </button>
        <p className="text-[12px] text-slate-500">Current status: {humanize(currentStatus)}</p>
      </div>
    </FormSection>
  );
}

export function canManageFinance(principal: Principal | null, permission: string) {
  return Boolean(principal?.permissions.includes(permission));
}
