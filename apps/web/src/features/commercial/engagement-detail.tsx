'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BriefcaseBusiness, Pencil, X } from 'lucide-react';
import toast from '@/lib/toast';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/shared/ui';
import { api, hasPermission, userFacingError } from '@/lib/phase3-api';
import { humanize } from '@/lib/presentation';
import { CommercialShell, useCommercialPrincipal } from './commercial-shell';
import {
  capabilityLabel,
  serviceModels,
  type EngagementDetail as EngagementDetailRecord,
} from './service-engagement-types';

const tabs = ['details', 'scope', 'capabilities', 'effective-history', 'activity'] as const;
type DetailTab = (typeof tabs)[number];

const formText = (form: FormData, key: string): string => {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
};

function ActionDialog({
  record,
  action,
  onClose,
}: {
  record: EngagementDetailRecord;
  action: 'activate' | 'deactivate' | 'cancel' | 'edit';
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (body: { reason?: string; notes?: string }) =>
      api(`/service-engagements/${record.id}${action === 'edit' ? '' : `/${action}`}`, {
        method: action === 'edit' ? 'PATCH' : 'POST',
        body: JSON.stringify({ version: record.version, ...body }),
      }),
    onSuccess: () => {
      toast.success(action === 'edit' ? 'Engagement notes updated.' : `Engagement ${action}d.`);
      void queryClient.invalidateQueries({ queryKey: ['service-engagement', record.id] });
      void queryClient.invalidateQueries({ queryKey: ['service-engagements'] });
      onClose();
    },
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    mutation.mutate(
      action === 'edit' ? { notes: formText(form, 'notes') } : { reason: formText(form, 'reason') },
    );
  };
  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/50 p-3"
      role="presentation"
    >
      <section
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="engagement-action-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
        }}
      >
        <header className="flex items-center justify-between border-b border-slate-200 p-5">
          <h2 id="engagement-action-title" className="text-lg font-bold">
            {action === 'edit' ? 'Edit Engagement notes' : `${humanize(action)} Engagement`}
          </h2>
          <button
            className="grid h-11 w-11 place-items-center rounded-lg hover:bg-slate-100"
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <form className="grid gap-4 p-5" onSubmit={submit}>
          {mutation.isError ? (
            <div className="feedback feedback-error" role="alert">
              {userFacingError(mutation.error)}
            </div>
          ) : null}
          {action === 'edit' ? (
            <label>
              Notes
              <textarea autoFocus name="notes" rows={5} defaultValue={record.notes ?? ''} />
            </label>
          ) : (
            <label>
              Reason
              <textarea
                autoFocus
                name="reason"
                rows={4}
                minLength={3}
                required
                placeholder="Record the business reason"
              />
            </label>
          )}
          <div className="flex justify-end gap-2">
            <button className="button secondary" type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              className={action === 'cancel' ? 'button danger' : 'button primary'}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function EngagementDetail({ engagementId }: { engagementId: string }) {
  const { principal, error: principalError } = useCommercialPrincipal();
  const [tab, setTab] = useState<DetailTab>('details');
  const [action, setAction] = useState<'activate' | 'deactivate' | 'cancel' | 'edit' | null>(null);
  const recordQuery = useQuery({
    queryKey: ['service-engagement', engagementId],
    enabled: Boolean(principal),
    queryFn: () => api<EngagementDetailRecord>(`/service-engagements/${engagementId}`),
  });
  const record = recordQuery.data;
  const serviceLabel = serviceModels.find((item) => item.value === record?.serviceModel)?.label;
  const can = (permission: string) => Boolean(principal && hasPermission(principal, permission));
  const allowedActions = record
    ? [
        ...(can('service-engagement.update') ? ['edit' as const] : []),
        ...(record.status === 'DRAFT' && can('service-engagement.activate')
          ? ['activate' as const]
          : []),
        ...(record.status === 'ACTIVE' &&
        record.period === 'CURRENT' &&
        can('service-engagement.deactivate')
          ? ['deactivate' as const]
          : []),
        ...((record.status === 'DRAFT' ||
          (record.status === 'ACTIVE' && record.period === 'SCHEDULED')) &&
        can('service-engagement.cancel')
          ? ['cancel' as const]
          : []),
      ]
    : [];
  return (
    <CommercialShell principal={principal} activeItem="engagement-register">
      {principalError ? <ErrorState message={principalError} /> : null}
      {recordQuery.isLoading ? <LoadingState label="Loading Service Engagement" /> : null}
      {recordQuery.isError ? (
        <ErrorState
          message={userFacingError(recordQuery.error)}
          onRetry={() => void recordQuery.refetch()}
        />
      ) : null}
      {record ? (
        <div className="space-y-5">
          <Link
            className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-[#0D47A1] hover:underline"
            href="/commercial/service-engagements"
          >
            <ArrowLeft className="h-4 w-4" /> Service Engagement Register
          </Link>
          <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#E3F2FD] text-[#0D47A1]">
                  <BriefcaseBusiness />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    {record.engagementNumber}
                  </p>
                  <h1 className="text-2xl font-bold text-slate-950">{serviceLabel}</h1>
                  <p className="mt-1 text-sm text-slate-600">
                    {record.rentableSpace
                      ? `${record.rentableSpace.spaceCode} — ${record.rentableSpace.name}`
                      : `${record.property.propertyCode} — ${record.property.name}`}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={record.period} />
                <StatusBadge value={record.status} />
                {allowedActions.map((item) => (
                  <button
                    key={item}
                    className={
                      item === 'cancel'
                        ? 'button danger'
                        : item === 'activate'
                          ? 'button primary'
                          : 'button secondary'
                    }
                    onClick={() => setAction(item)}
                  >
                    {item === 'edit' ? <Pencil className="h-4 w-4" /> : null}
                    {humanize(item)}
                  </button>
                ))}
              </div>
            </div>
          </header>
          <nav
            className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1"
            aria-label="Engagement detail sections"
          >
            {tabs.map((item) => (
              <button
                key={item}
                className={`min-h-11 shrink-0 rounded-lg px-4 text-sm font-bold ${tab === item ? 'bg-[#0D47A1] text-white' : 'text-slate-600 hover:bg-[#E3F2FD]'}`}
                onClick={() => setTab(item)}
              >
                {humanize(item)}
              </button>
            ))}
          </nav>
          {tab === 'details' ? (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ['Engagement number', record.engagementNumber],
                  ['Service model', serviceLabel ?? record.serviceModel],
                  ['Status', humanize(record.status)],
                  ['Effective from', record.effectiveFrom.slice(0, 10)],
                  ['Effective to', record.effectiveTo?.slice(0, 10) ?? 'Open ended'],
                  ['Notes', record.notes ?? 'Not recorded'],
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
          {tab === 'scope' ? (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold">Authorized scope</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase text-slate-500">Property</p>
                  <p className="mt-1 font-bold">
                    {record.property.propertyCode} — {record.property.name}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase text-slate-500">
                    Rentable Space policy
                  </p>
                  <p className="mt-1 font-bold">
                    {record.rentableSpace
                      ? `${record.rentableSpace.spaceCode} — ${record.rentableSpace.name}`
                      : 'Inherited by all Spaces unless overridden'}
                  </p>
                </div>
              </div>
            </section>
          ) : null}
          {tab === 'capabilities' ? (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold">Resolved capabilities</h2>
              <p className="text-sm text-slate-600">
                Calculated centrally for the current business date.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(record.resolvedCapabilities).map(([name, enabled]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
                  >
                    <span className="text-sm font-semibold">{capabilityLabel(name)}</span>
                    <StatusBadge value={enabled ? 'ALLOWED' : 'NOT ALLOWED'} />
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {tab === 'effective-history' ? (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold">Effective-dated policy</h2>
              <p className="mt-3 text-sm text-slate-600">
                This {record.period.toLowerCase()} Engagement applies from{' '}
                <strong>{record.effectiveFrom.slice(0, 10)}</strong>{' '}
                {record.effectiveTo ? (
                  <>
                    until <strong>{record.effectiveTo.slice(0, 10)}</strong>
                  </>
                ) : (
                  'with no scheduled end date'
                )}
                . Activated scope and policy fields are immutable; end-date and create a successor
                to change authority.
              </p>
            </section>
          ) : null}
          {tab === 'activity' ? (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-5">
                <h2 className="text-lg font-bold">Lifecycle activity</h2>
              </div>
              {record.history.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-[720px] w-full">
                    <thead>
                      <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                        <th className="px-4 py-3">When</th>
                        <th className="px-4 py-3">Action</th>
                        <th className="px-4 py-3">Transition</th>
                        <th className="px-4 py-3">Reason</th>
                        <th className="px-4 py-3">Actor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {record.history.map((item) => (
                        <tr className="border-t border-slate-100 text-sm" key={item.id}>
                          <td className="px-4 py-3">
                            {new Date(item.occurredAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 font-semibold">{humanize(item.action)}</td>
                          <td className="px-4 py-3">
                            {item.fromStatus ? humanize(item.fromStatus) : 'Created'} →{' '}
                            {humanize(item.toStatus)}
                          </td>
                          <td className="px-4 py-3">{item.reason ?? 'Not recorded'}</td>
                          <td className="px-4 py-3">
                            {item.actor.employee?.party.displayName ?? 'System'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  title="No lifecycle activity"
                  description="History appears when this Engagement changes state."
                />
              )}
            </section>
          ) : null}
        </div>
      ) : null}
      {record && action ? (
        <ActionDialog record={record} action={action} onClose={() => setAction(null)} />
      ) : null}
    </CommercialShell>
  );
}
