'use client';

import { SearchableSelect } from '@/components/shared/searchable-select';

import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  History,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { humanize } from '@/lib/presentation';
import { api, type CursorPage, userFacingError } from '@/lib/phase3-api';
import {
  effectivePayoutPercent,
  ownershipReadiness,
  partitionOwnership,
  shareTotals,
  validateOwnershipInput,
  type OwnerOption,
  type PropertyOwnershipRecord,
  type ReplaceOwnershipInput,
} from './ownership-model';

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0D47A1] focus:ring-2 focus:ring-[#E3F2FD] disabled:bg-slate-100';

function OwnerRows({
  records,
  label,
  businessDate,
}: {
  records: PropertyOwnershipRecord[];
  label: string;
  businessDate: string;
}) {
  if (!records.length)
    return (
      <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
        No {label.toLowerCase()} records.
      </p>
    );
  return (
    <div className="space-y-2">
      {records.map((record) => (
        <div key={record.id} className="rounded-lg border border-slate-200 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-slate-900">
                {record.owner?.displayName ?? 'Owner record unavailable'}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {record.owner?.owner?.ownerNumber ?? 'Owner number unavailable'} ·{' '}
                {humanize(record.owner?.kind ?? 'owner')} ·{' '}
                {humanize(record.owner?.owner?.status ?? 'status unavailable')}
              </p>
            </div>
            <span className="rounded-full bg-[#E3F2FD] px-2.5 py-1 text-xs font-bold text-[#0D47A1]">
              {record.ownershipPercent}% owned
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md bg-slate-50 p-2">
              <span className="text-slate-500">Payout</span>
              <strong className="ml-1 text-slate-800">
                {effectivePayoutPercent(record, businessDate)}%
              </strong>
            </div>
            <div className="rounded-md bg-slate-50 p-2">
              <span className="text-slate-500">Effective</span>
              <strong className="ml-1 text-slate-800">{record.effectiveFrom.slice(0, 10)}</strong>
            </div>
          </div>
          {record.effectiveTo ? (
            <p className="mt-2 text-xs text-slate-500">Ended {record.effectiveTo.slice(0, 10)}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  const valid = value === 100;
  return (
    <div
      className={
        'rounded-lg border p-3 ' +
        (valid ? 'border-[#90CAF9] bg-[#E3F2FD]' : 'border-amber-200 bg-amber-50')
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-600">{label}</span>
        <strong className={valid ? 'text-[#0D47A1]' : 'text-amber-700'}>{value}%</strong>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
        <div
          className={'h-full ' + (valid ? 'bg-[#2196F3]' : 'bg-amber-500')}
          style={{ width: Math.min(value, 100) + '%' }}
        />
      </div>
    </div>
  );
}

export function OwnershipEditor({
  owners,
  current,
  businessDate,
  busy,
  onCancel,
  onSave,
}: {
  owners: OwnerOption[];
  current: PropertyOwnershipRecord[];
  businessDate: string;
  busy: boolean;
  onCancel: () => void;
  onSave: (input: ReplaceOwnershipInput) => Promise<void>;
}) {
  const initialShares = current.length
    ? current.map((record) => ({
        ownerPartyId: record.ownerPartyId,
        ownershipPercent: record.ownershipPercent,
        payoutPercent: effectivePayoutPercent(record, businessDate),
      }))
    : [{ ownerPartyId: '', ownershipPercent: '100', payoutPercent: '100' }];
  const [shares, setShares] = useState(initialShares);
  const [ownerOptions, setOwnerOptions] = useState(owners);
  const [ownerLookupLoading, setOwnerLookupLoading] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState(businessDate);
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const totals = shareTotals(shares);
  const input = { effectiveFrom, shares, reason };
  const errors = validateOwnershipInput(input);
  const update = (index: number, key: keyof (typeof shares)[number], value: string) =>
    setShares((rows) =>
      rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)),
    );
  const searchOwners = async (query: string) => {
    setOwnerLookupLoading(true);
    try {
      const parameters = new URLSearchParams({ status: 'ACTIVE', limit: '20' });
      if (query.trim()) parameters.set('search', query.trim());
      const page = await api<CursorPage<OwnerOption>>(`/owners?${parameters.toString()}`);
      setOwnerOptions((current) => {
        const selectedIds = new Set(shares.map((share) => share.ownerPartyId).filter(Boolean));
        const selected = current.filter((owner) => selectedIds.has(owner.partyId));
        return [...selected, ...page.items.filter((owner) => !selectedIds.has(owner.partyId))];
      });
    } catch (cause) {
      toast.error(userFacingError(cause, 'Owners could not be loaded.'));
    } finally {
      setOwnerLookupLoading(false);
    }
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
        if (errors.length) return;
        void onSave(input);
      }}
    >
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        Saving creates a new effective-dated ownership set. Existing signed history is preserved.
      </div>
      <div className="space-y-3">
        {shares.map((share, index) => (
          <div key={index} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <strong className="text-sm">Owner {index + 1}</strong>
              {shares.length > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setShares((rows) => rows.filter((_, rowIndex) => rowIndex !== index));
                  }}
                  className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                  aria-label={'Remove owner ' + (index + 1)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <label className="space-y-1.5 text-xs font-bold text-slate-600">
              Owner
              <SearchableSelect
                searchable
                searchThreshold={0}
                loading={ownerLookupLoading}
                onSearchChange={(query) => {
                  void searchOwners(query);
                }}
                searchPlaceholder="Search by name or owner number"
                value={share.ownerPartyId}
                onChange={(event) => update(index, 'ownerPartyId', event.target.value)}
                required
                className={inputClass}
                aria-label={'Choose owner ' + (index + 1)}
              >
                <option value="">Choose by name or owner number</option>
                {ownerOptions
                  .filter((owner) => owner.status === 'ACTIVE')
                  .map((owner) => (
                    <option key={owner.partyId} value={owner.partyId}>
                      {owner.party.displayName} — {owner.ownerNumber} ({humanize(owner.party.kind)})
                    </option>
                  ))}
              </SearchableSelect>
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="space-y-1.5 text-xs font-bold text-slate-600">
                Ownership %
                <input
                  type="number"
                  min="0.000001"
                  max="100"
                  step="0.000001"
                  value={share.ownershipPercent}
                  onChange={(event) => update(index, 'ownershipPercent', event.target.value)}
                  className={inputClass}
                  required
                />
              </label>
              <label className="space-y-1.5 text-xs font-bold text-slate-600">
                Payout %
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.000001"
                  value={share.payoutPercent}
                  onChange={(event) => update(index, 'payoutPercent', event.target.value)}
                  className={inputClass}
                  required
                />
              </label>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            setShares((rows) => [
              ...rows,
              { ownerPartyId: '', ownershipPercent: '', payoutPercent: '' },
            ]);
          }}
          disabled={shares.length >= 20}
          className="inline-flex items-center gap-2 rounded-lg border border-dashed border-[#90CAF9] px-3 py-2 text-xs font-bold text-[#0D47A1] hover:bg-[#E3F2FD] disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add joint owner
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Total label="Ownership total" value={totals.ownership} />
        <Total label="Payout total" value={totals.payout} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-xs font-bold text-slate-600">
          Effective from
          <input
            type="date"
            value={effectiveFrom}
            onChange={(event) => setEffectiveFrom(event.target.value)}
            required
            className={inputClass}
          />
        </label>
        <label className="space-y-1.5 text-xs font-bold text-slate-600">
          Reason for change
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={3}
            maxLength={500}
            required
            className={inputClass}
            placeholder="Ownership agreement updated"
          />
        </label>
      </div>
      {submitted && errors.length ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <ul className="list-disc space-y-1 pl-5">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex gap-3 border-t border-slate-200 pt-4">
        <button
          disabled={busy}
          className="flex-1 rounded-lg bg-[#0D47A1] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Saving ownership…' : 'Save ownership change'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function OwnershipWorkspace({
  records,
  businessDate,
  canManage,
  onManage,
  activationContext,
}: {
  records: PropertyOwnershipRecord[];
  businessDate: string;
  canManage: boolean;
  onManage: () => void;
  activationContext: { branchAssigned: boolean; detailsComplete: boolean; isDraft: boolean };
}) {
  const groups = useMemo(() => partitionOwnership(records, businessDate), [businessDate, records]);
  const readiness = ownershipReadiness(records, businessDate);
  const activationChecks = [
    { label: 'Operating branch assigned', pass: activationContext.branchAssigned },
    { label: 'Property details complete', pass: activationContext.detailsComplete },
    {
      label: `Ownership total = ${readiness.totals.ownership}%`,
      pass: readiness.ownershipComplete,
    },
    {
      label: `Payout entitlement total = ${readiness.totals.payout}%`,
      pass: readiness.payoutComplete,
    },
    { label: 'All owners active', pass: readiness.activeOwners && readiness.hasOwners },
  ];
  const activationReady = activationChecks.every((check) => check.pass);
  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Current ownership
            </p>
            <h3 className="mt-1 text-base font-bold text-slate-900">
              {groups.current.length
                ? `${groups.current.length} active owner${groups.current.length === 1 ? '' : 's'}`
                : 'Ownership not configured'}
            </h3>
          </div>
          {canManage ? (
            <button
              type="button"
              onClick={onManage}
              className="rounded-lg bg-[#0D47A1] px-3 py-2 text-xs font-bold text-white hover:bg-[#0D47A1]"
            >
              Manage ownership
            </button>
          ) : null}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Total label="Ownership" value={readiness.totals.ownership} />
          <Total label="Payout" value={readiness.totals.payout} />
        </div>
      </section>
      <OwnerRows records={groups.current} label="Current ownership" businessDate={businessDate} />
      <section
        className={
          'rounded-xl border p-4 ' +
          (activationReady ? 'border-[#90CAF9] bg-[#E3F2FD]' : 'border-amber-200 bg-amber-50')
        }
      >
        <h3 className="text-sm font-bold text-slate-900">Activation readiness</h3>
        <ul className="mt-3 space-y-2">
          {activationChecks.map((check) => (
            <li
              key={check.label}
              className="flex items-center gap-2 text-xs font-semibold text-slate-700"
            >
              {check.pass ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0D47A1]" aria-hidden="true" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
              )}
              <span>{check.label}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-600">
          {activationReady
            ? activationContext.isDraft
              ? 'This draft has the ownership prerequisites required for activation.'
              : 'The ownership configuration is complete.'
            : 'Property cannot be activated yet. Complete every item above.'}
        </p>
      </section>
      {groups.scheduled.length ? (
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <CalendarClock className="h-4 w-4 text-blue-600" /> Scheduled ownership
          </h3>
          <OwnerRows
            records={groups.scheduled}
            label="Scheduled ownership"
            businessDate={businessDate}
          />
        </section>
      ) : null}
      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <History className="h-4 w-4 text-slate-500" /> Ownership history
        </h3>
        <OwnerRows
          records={groups.historical}
          label="Historical ownership"
          businessDate={businessDate}
        />
      </section>
    </div>
  );
}

export function OwnerPropertyPortfolio({
  ownerships,
  businessDate,
  mode = 'all',
}: {
  businessDate: string;
  mode?: 'all' | 'current' | 'history';
  ownerships: (PropertyOwnershipRecord & {
    property: {
      id: string;
      propertyCode: string;
      name: string;
      propertyType: string;
      status: string;
      city: string;
      branchAssignments?: {
        branch?: { name: string };
        effectiveFrom: string;
        effectiveTo: string | null;
      }[];
    };
  })[];
}) {
  const groups = partitionOwnership(ownerships, businessDate);
  const render = (records: typeof ownerships, empty: string) =>
    records.length ? (
      records.map((record) => {
        const branch = record.property.branchAssignments?.find(
          (assignment) => !assignment.effectiveTo,
        )?.branch?.name;
        return (
          <div key={record.id} className="rounded-lg border border-slate-200 p-3">
            <div className="flex justify-between gap-3">
              <div>
                <p className="text-sm font-bold">{record.property.name}</p>
                <p className="text-xs text-slate-500">
                  {record.property.propertyCode} · {humanize(record.property.propertyType)} ·{' '}
                  {branch ?? record.property.city}
                </p>
              </div>
              <div className="text-right">
                <strong className="text-sm text-[#0D47A1]">{record.ownershipPercent}% owned</strong>
                <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {humanize(record.property.status)}
                </span>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Payout {effectivePayoutPercent(record, businessDate)}% · Effective{' '}
              {record.effectiveFrom.slice(0, 10)}
              {record.effectiveTo ? ` to ${record.effectiveTo.slice(0, 10)}` : ''}
            </p>
          </div>
        );
      })
    ) : (
      <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">{empty}</p>
    );
  return (
    <div className="space-y-5">
      {mode !== 'history' ? (
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Users className="h-4 w-4 text-[#0D47A1]" /> Current properties
          </h3>
          {render(
            groups.current as typeof ownerships,
            'This owner has no current property ownership.',
          )}
        </section>
      ) : null}
      {mode !== 'current' ? (
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <History className="h-4 w-4 text-slate-500" /> Ownership history
          </h3>
          {render(
            [...groups.scheduled, ...groups.historical] as typeof ownerships,
            'No scheduled or historical ownership records.',
          )}
        </section>
      ) : null}
    </div>
  );
}
