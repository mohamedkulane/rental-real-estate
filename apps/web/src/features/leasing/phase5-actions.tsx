'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from '@/lib/toast';
import { X } from 'lucide-react';
import { TableActionButton } from '@/components/shared/data-table';
import { api, hasPermission, type Principal, userFacingError } from '@/lib/phase3-api';
import { requestPath } from '@/features/crm/crm-data';
import { RecordPicker, type PickRecord } from '@/features/workflow/record-picker';

export type OperationsMode = 'rental-listings' | 'sale-listings' | 'viewings' | 'applications' | 'reservations' | 'tenants' | 'leases' | 'renewals' | 'move-ins';
type Row = Record<string, unknown> & { id: string; status?: string; version?: number };
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
const record = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {});
const value = (row: Record<string, unknown>, key: string) => {
  const candidate = row[key];
  return typeof candidate === 'string' ? candidate : '';
};
const label = (row: Record<string, unknown>, number: string, name: string) => `${value(row, number)} — ${value(row, name)}`;
const dateInput = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const dateTimeInput = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 16);

const createPermissions: Partial<Record<OperationsMode, string>> = {
  'sale-listings': 'listing.create',
};
const createLabels: Record<OperationsMode, string> = {
  'rental-listings': 'Create Rental Listing', 'sale-listings': 'Create Sale Listing', viewings: 'Schedule Viewing', applications: 'Start Application', reservations: 'Create Reservation', tenants: 'Convert Approved Applicant', leases: 'Create Lease Contract', renewals: 'Start Renewal', 'move-ins': 'Schedule Move-In',
};

function pickerMap(kind: string) {
  return (raw: Record<string, unknown>): PickRecord => {
    const party = record(raw.party); const property = record(raw.property); const space = record(raw.rentableSpace);
    const listing = record(raw.rentalListing); const lead = record(raw.lead); const applicant = record(raw.applicantParty);
    if (kind === 'lead') return {
      id: value(raw, 'id'),
      label: label(raw, 'leadNumber', 'displayName'),
      branchId:
        value(raw, 'responsibleBranchId') || value(record(raw.responsibleBranch), 'id'),
      partyId: value(raw, 'partyId'),
    };
    if (kind === 'employee') {
      const name = value(party, 'displayName') || value(raw, 'displayName');
      return { id: value(raw, 'id'), label: `${value(raw, 'employeeNumber')} — ${name}` };
    }
    if (kind === 'space') return { id: value(raw, 'id'), label: `${value(raw, 'spaceCode')} — ${value(raw, 'name')}`, propertyId: value(raw, 'propertyId') || value(property, 'id') };
    if (kind === 'property') return { id: value(raw, 'id'), label: label(raw, 'propertyCode', 'name') };
    if (kind === 'engagement') return { id: value(raw, 'id'), label: `${value(raw, 'engagementNumber')} — ${value(raw, 'serviceModel').replaceAll('_', ' ')}` };
    if (kind === 'listing') return { id: value(raw, 'id'), label: `${value(raw, 'listingNumber')} — ${value(raw, 'title')}`, propertyId: value(property, 'id') || value(record(space.property), 'id') };
    if (kind === 'application') return { id: value(raw, 'id'), label: `${value(raw, 'applicationNumber')} — ${value(applicant, 'displayName') || value(lead, 'displayName')}`, applicantPartyId: value(applicant, 'id'), serviceEngagementId: value(listing, 'serviceEngagementId') };
    if (kind === 'tenant') return { id: value(raw, 'partyId') || value(raw, 'id'), label: `${value(raw, 'tenantNumber')} — ${value(party, 'displayName')}` };
    if (kind === 'owner') return { id: value(raw, 'partyId') || value(raw, 'id'), label: `${value(raw, 'ownerNumber')} — ${value(party, 'displayName')}` };
    if (kind === 'lease') return {
      id: value(raw, 'id'),
      label: `${value(raw, 'leaseNumber')} — ${value(space, 'name')}`,
      leaseEndDate: value(raw, 'leaseEndDate'),
      leaseStartDate: value(raw, 'leaseStartDate'),
      rentAmount:
        typeof raw.rentAmount === 'string' || typeof raw.rentAmount === 'number'
          ? String(raw.rentAmount)
          : '',
      currency: value(raw, 'currency') || 'USD',
    };
    return { id: value(raw, 'id'), label: value(raw, 'id') };
  };
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus();
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  return <div className="fixed inset-0 z-[130] grid place-items-center bg-slate-950/50 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="phase5-dialog-title" className="max-h-[calc(100dvh-24px)] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-7">
      <div className="mb-5 flex items-start justify-between gap-4"><div><p className="eyebrow">Guided operation</p><h2 id="phase5-dialog-title" className="mt-1">{title}</h2></div><button className="button ghost !p-2" onClick={onClose} aria-label="Close dialog"><X className="h-5 w-5" /></button></div>
      {children}
    </div>
  </div>;
}

export function Phase5CreateAction({ mode, principal, onSuccess }: { mode: OperationsMode; principal: Principal; onSuccess: () => void }) {
  const permission = createPermissions[mode];
  const [open, setOpen] = useState(false);
  if (!permission || !hasPermission(principal, permission)) return null;
  return <><button className="button primary" onClick={() => setOpen(true)}>{createLabels[mode]}</button>{open ? <CreateDialog mode={mode} onClose={() => setOpen(false)} onSuccess={onSuccess} /> : null}</>;
}

function CreateDialog({ mode, onClose, onSuccess }: { mode: OperationsMode; onClose: () => void; onSuccess: () => void }) {
  const [first, setFirst] = useState<PickRecord | null>(null); const [second, setSecond] = useState<PickRecord | null>(null); const [third, setThird] = useState<PickRecord | null>(null);
  const [listingType, setListingType] = useState<'rental' | 'sale'>('rental');
  const [title, setTitle] = useState(''); const [amount, setAmount] = useState(''); const [currency, setCurrency] = useState('USD'); const [notes, setNotes] = useState(''); const [start, setStart] = useState(dateInput(1)); const [end, setEnd] = useState(dateInput(366)); const [scheduled, setScheduled] = useState(dateTimeInput());
  useEffect(() => {
    if (mode !== 'renewals' || !first) return;
    const leaseEnd = value(first, 'leaseEndDate');
    if (!leaseEnd) return;
    const endDay = leaseEnd.slice(0, 10);
    setStart(endDay);
    const successorEnd = new Date(`${endDay}T00:00:00.000Z`);
    successorEnd.setUTCFullYear(successorEnd.getUTCFullYear() + 1);
    setEnd(successorEnd.toISOString().slice(0, 10));
    const rent = value(first, 'rentAmount');
    if (rent) setAmount(rent);
    const leaseCurrency = value(first, 'currency');
    if (leaseCurrency) setCurrency(leaseCurrency);
  }, [mode, first]);
  const mutation = useMutation({ mutationFn: async () => {
    if (mode === 'rental-listings') return api('/rental-listings', { method: 'POST', body: JSON.stringify({ rentableSpaceId: first?.id, serviceEngagementId: second?.id, title, askingRent: amount || undefined, currency, availableFrom: start }) });
    if (mode === 'sale-listings') return api('/sale-listings', { method: 'POST', body: JSON.stringify({ propertyId: first?.id, serviceEngagementId: second?.id, title, askingPrice: amount || undefined, currency }) });
    if (mode === 'viewings') return api('/viewings', { method: 'POST', body: JSON.stringify({ leadId: first?.id, ...(listingType === 'sale' ? { saleListingId: second?.id } : { rentalListingId: second?.id }), assignedEmployeeId: third?.id, scheduledAt: new Date(scheduled).toISOString(), notes: notes || undefined }) });
    if (mode === 'applications') return api('/applications', { method: 'POST', body: JSON.stringify({ leadId: first?.id, rentalListingId: second?.id }) });
    if (mode === 'reservations') return api('/reservations', { method: 'POST', body: JSON.stringify({ applicationId: first?.id, startsAt: new Date(start).toISOString(), expiresAt: new Date(end).toISOString() }) });
    if (mode === 'tenants') return api('/tenants/convert', { method: 'POST', body: JSON.stringify({ applicationId: first?.id }) });
    if (mode === 'leases') return api('/leases', { method: 'POST', body: JSON.stringify({ applicationId: first?.id, serviceEngagementId: value(first ?? {}, 'serviceEngagementId'), leaseStartDate: start, leaseEndDate: end, rentAmount: amount, currency, parties: [{ partyId: second?.id, role: 'TENANT' }, { partyId: third?.id, role: 'LANDLORD' }] }) });
    if (mode === 'renewals') return api('/renewals', { method: 'POST', body: JSON.stringify({ originalLeaseId: first?.id, proposedStartDate: start, proposedEndDate: end, proposedRent: amount, currency }) });
    return api('/move-ins', { method: 'POST', body: JSON.stringify({ leaseId: first?.id, scheduledDate: start, notes: notes || undefined }) });
  }, onSuccess: () => { toast.success(`${createLabels[mode]} saved.`); onSuccess(); onClose(); } });
  const overlap = mode === 'leases' && Boolean(second?.id) && second?.id === third?.id;
  const error = overlap
    ? 'The Tenant and Landlord must be different parties.'
    : mutation.isError
      ? userFacingError(mutation.error)
      : '';
  return <Modal title={createLabels[mode]} onClose={onClose}><form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); if (overlap) return; mutation.mutate(); }}>
    {mode === 'rental-listings' ? <><RecordPicker label="Rentable space" path="/rentable-spaces?status=ACTIVE" value={first?.id ?? ''} map={pickerMap('space')} onChange={setFirst} /><RecordPicker label="Service authority" path={`/service-engagements?status=ACTIVE${value(first ?? {}, 'propertyId') ? `&propertyId=${value(first ?? {}, 'propertyId')}` : ''}`} value={second?.id ?? ''} map={pickerMap('engagement')} onChange={setSecond} /></> : null}
    {mode === 'sale-listings' ? <><RecordPicker label="Property" path="/properties?status=ACTIVE" value={first?.id ?? ''} map={pickerMap('property')} onChange={setFirst} /><RecordPicker label="Sale authority" path={`/service-engagements?status=ACTIVE${first?.id ? `&propertyId=${first.id}` : ''}`} value={second?.id ?? ''} map={pickerMap('engagement')} onChange={setSecond} /></> : null}
    {mode === 'viewings' ? <><RecordPicker label="Lead" path="/crm/leads" value={first?.id ?? ''} map={pickerMap('lead')} onChange={setFirst} /><label>Listing type<select value={listingType} onChange={(event) => { setListingType(event.target.value as 'rental' | 'sale'); setSecond(null); }}><option value="rental">Rental listing</option><option value="sale">Sale listing</option></select></label><RecordPicker label={listingType === 'sale' ? 'Sale listing' : 'Rental listing'} path={listingType === 'sale' ? '/sale-listings?status=PUBLISHED' : '/rental-listings?status=PUBLISHED'} value={second?.id ?? ''} map={pickerMap('listing')} onChange={setSecond} /><RecordPicker label="Assigned agent" path={requestPath('/crm/selectors/employees', { purpose: 'ASSIGNMENT_READ', branchId: value(first ?? {}, 'branchId') })} value={third?.id ?? ''} map={pickerMap('employee')} onChange={setThird} /></> : null}
    {mode === 'applications' ? <><RecordPicker label="Rent lead" path="/crm/leads?intent=RENT" value={first?.id ?? ''} map={pickerMap('lead')} onChange={setFirst} /><RecordPicker label="Published rental listing" path="/rental-listings?status=PUBLISHED" value={second?.id ?? ''} map={pickerMap('listing')} onChange={setSecond} /><p className="text-[13px] text-slate-500">A property owner cannot apply to rent their own property.</p></> : null}
    {(mode === 'reservations' || mode === 'tenants' || mode === 'leases') ? <RecordPicker label="Approved application" path="/applications?status=APPROVED" value={first?.id ?? ''} map={pickerMap('application')} onChange={setFirst} /> : null}
    {mode === 'leases' ? <><RecordPicker label="Tenant" path="/tenants" value={second?.id ?? ''} map={pickerMap('tenant')} onChange={setSecond} /><RecordPicker label="Landlord" path="/owners" value={third?.id ?? ''} map={pickerMap('owner')} onChange={setThird} /><p className="text-[13px] text-slate-500">Tenant and landlord must be different parties. A property owner cannot rent their own property.</p></> : null}
    {(mode === 'renewals' || mode === 'move-ins') ? <RecordPicker label="Lease" path={mode === 'renewals' ? '/leases?status=ACTIVE' : '/leases?status=ACTIVE'} value={first?.id ?? ''} map={pickerMap('lease')} onChange={setFirst} /> : null}
    {(mode === 'rental-listings' || mode === 'sale-listings') ? <label>Business title<input required minLength={2} maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} /></label> : null}
    {(mode === 'rental-listings' || mode === 'sale-listings' || mode === 'leases' || mode === 'renewals') ? <div className="grid gap-4 sm:grid-cols-2"><label>{mode === 'sale-listings' ? 'Asking price' : mode === 'renewals' ? 'Proposed rent' : 'Rent amount'}<input required={mode === 'leases' || mode === 'renewals'} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>Currency<input required minLength={3} maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} /></label></div> : null}
    {mode === 'viewings' ? <label>Scheduled time<input required type="datetime-local" value={scheduled} onChange={(event) => setScheduled(event.target.value)} /></label> : null}
    {['rental-listings','reservations','leases','renewals','move-ins'].includes(mode) ? <div className="grid gap-4 sm:grid-cols-2"><label>{mode === 'reservations' ? 'Starts' : mode === 'move-ins' ? 'Move-in date' : mode === 'renewals' ? 'Proposed start' : mode === 'leases' ? 'Lease start' : 'Available from'}<input required type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label>{mode !== 'move-ins' && mode !== 'rental-listings' ? <label>{mode === 'reservations' ? 'Expires' : mode === 'renewals' ? 'Proposed end' : 'Lease end'}<input required type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></label> : null}</div> : null}
    {(mode === 'viewings' || mode === 'move-ins') ? <label>Notes<textarea rows={3} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} /></label> : null}
    {error ? <div className="feedback feedback-error" role="alert">{error}</div> : null}<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={mutation.isPending || overlap}>{mutation.isPending ? 'Saving…' : 'Save'}</button></div>
  </form></Modal>;
}

const nextStates: Partial<Record<OperationsMode, Record<string, string[]>>> = {
  'rental-listings': { DRAFT: ['PENDING_REVIEW'], PENDING_REVIEW: ['PUBLISHED'], PUBLISHED: ['PAUSED','UNPUBLISHED','CLOSED'], PAUSED: ['PUBLISHED','UNPUBLISHED','CLOSED'], UNPUBLISHED: ['ARCHIVED'], CLOSED: ['ARCHIVED'] },
  'sale-listings': { DRAFT: ['PENDING_REVIEW'], PENDING_REVIEW: ['PUBLISHED'], PUBLISHED: ['PAUSED','UNPUBLISHED','CLOSED'], PAUSED: ['PUBLISHED','UNPUBLISHED','CLOSED'], UNPUBLISHED: ['ARCHIVED'], CLOSED: ['ARCHIVED'] },
  viewings: { SCHEDULED: ['CONFIRMED','CANCELLED','NO_SHOW'], CONFIRMED: ['COMPLETED','CANCELLED','NO_SHOW'] },
  applications: { DRAFT: ['SUBMITTED','WITHDRAWN'], SUBMITTED: ['UNDER_REVIEW','WITHDRAWN'], UNDER_REVIEW: ['APPROVED','REJECTED','WITHDRAWN'] },
  reservations: { ACTIVE: ['EXPIRED','CANCELLED'] },
  leases: { DRAFT: ['PENDING_APPROVAL'], PENDING_APPROVAL: ['APPROVED','DRAFT'], APPROVED: ['PENDING_SIGNATURE'], PENDING_SIGNATURE: ['SIGNED'], SIGNED: ['ACTIVE','TERMINATED'], ACTIVE: ['ENDED','TERMINATED'], ENDED: ['ARCHIVED'], TERMINATED: ['ARCHIVED'] },
  renewals: { DRAFT: ['PROPOSED','CANCELLED'], PROPOSED: ['APPROVED','REJECTED','CANCELLED'], APPROVED: ['SIGNED','REJECTED'], SIGNED: ['ACTIVATED'] },
  'move-ins': { SCHEDULED: ['COMPLETED','CANCELLED'] },
};

export function Phase5RowAction({ mode, row, onSuccess }: { mode: OperationsMode; row: Row; onSuccess: () => void }) {
  const states = nextStates[mode]?.[row.status ?? ''] ?? [];
  const [open, setOpen] = useState(false); const [target, setTarget] = useState(states[0] ?? ''); const [reason, setReason] = useState('Operational review completed.'); const [summary, setSummary] = useState(''); const [signature, setSignature] = useState('');
  const canScreen = mode === 'applications' && ['SUBMITTED','UNDER_REVIEW'].includes(row.status ?? '');
  const [screen, setScreen] = useState(false);
  const endpoint = useMemo(() => {
    if (mode === 'rental-listings' || mode === 'sale-listings') {
      const action = {
        PENDING_REVIEW: 'submit',
        PUBLISHED: 'publish',
        PAUSED: 'pause',
        UNPUBLISHED: 'unpublish',
        CLOSED: 'close',
        ARCHIVED: 'archive',
      }[target];
      return `/${mode}/${row.id}/${action ?? target.toLowerCase()}`;
    }
    if (mode === 'viewings') return `/viewings/${row.id}/transition`;
    if (mode === 'applications') return `/applications/${row.id}/${screen ? 'screening' : 'transition'}`;
    return `/${mode}/${row.id}/transition`;
  }, [mode, row.id, screen, target]);
  const mutation = useMutation({
    mutationFn: () =>
      api(endpoint, {
        method: 'POST',
        body: JSON.stringify(
          screen
            ? {
                expectedVersion: row.version,
                screeningStatus: target,
                reason,
                summary: summary || undefined,
              }
            : mode === 'rental-listings' || mode === 'sale-listings'
              ? { expectedVersion: row.version, reason }
              : {
                  expectedVersion: row.version,
                  status: target,
                  reason,
                  ...(mode === 'leases' && target === 'SIGNED'
                    ? { signatureHash: signature }
                    : {}),
                  ...(mode === 'move-ins' && target === 'COMPLETED'
                    ? { completedDate: dateInput(0) }
                    : {}),
                },
        ),
      }),
    onSuccess: () => {
      toast.success('Record updated.');
      onSuccess();
      setOpen(false);
    },
  });
  if (!states.length && !canScreen && mode !== 'leases') {
    return <span className="text-xs text-slate-500">No action due</span>;
  }
  return (
    <>
      {mode === 'leases' ? (
        <TableActionButton tone="open" href={`/leasing/leases/${row.id}`}>
          Open
        </TableActionButton>
      ) : null}
      {states.length || canScreen ? (
        <TableActionButton
          tone="manage"
          onClick={() => {
            setScreen(false);
            setTarget(states[0] ?? '');
            setOpen(true);
          }}
        >
          Manage
        </TableActionButton>
      ) : null}
      {open ? (
        <Modal title={`Manage ${mode.replaceAll('-', ' ')}`} onClose={() => setOpen(false)}>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
    {canScreen ? <label className="flex items-center gap-2"><input className="!h-4 !w-4" type="checkbox" checked={screen} onChange={(event) => { setScreen(event.target.checked); setTarget(event.target.checked ? (row.screeningStatus === 'NOT_STARTED' ? 'IN_PROGRESS' : 'PASSED') : states[0] ?? ''); }} />Record screening outcome</label> : null}
            <label>{screen ? 'Screening outcome' : 'Next stage'}<select required value={target} onChange={(event) => setTarget(event.target.value)}>{(screen ? row.screeningStatus === 'NOT_STARTED' ? ['IN_PROGRESS','WAIVED'] : ['PASSED','FAILED','WAIVED'] : states).map((state) => <option key={state}>{state}</option>)}</select></label>
            {mode === 'leases' && target === 'SIGNED' ? <label>Signature evidence hash<input required minLength={3} maxLength={128} value={signature} onChange={(event) => setSignature(event.target.value)} /></label> : null}
            {screen ? <label>Restricted screening summary<textarea rows={3} maxLength={2000} value={summary} onChange={(event) => setSummary(event.target.value)} /></label> : null}
            <label>Reason<textarea required minLength={3} maxLength={500} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
            {mutation.isError ? <div className="feedback feedback-error" role="alert">{userFacingError(mutation.error)}</div> : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="button secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button className="button primary" disabled={mutation.isPending}>{mutation.isPending ? 'Updating…' : 'Confirm change'}</button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
