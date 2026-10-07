'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, CalendarClock, CircleDollarSign, FileCheck2, Wrench } from 'lucide-react';
import { api, userFacingError } from '@/lib/phase3-api';
import { formatDate, humanize } from '@/lib/presentation';

type TimelineEvent = {
  id: string;
  type: string;
  title: string;
  description: string;
  occurredAt: string;
};

function eventIcon(type: string) {
  if (type === 'PAYMENT') return CircleDollarSign;
  if (type === 'MAINTENANCE') return Wrench;
  if (type === 'VIEWING') return CalendarClock;
  if (type === 'AGREEMENT' || type === 'LEASE') return FileCheck2;
  return Activity;
}

export function ActivityTimelinePanel({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: string;
}) {
  const query = useQuery({
    queryKey: ['activity-timeline', entityType, entityId],
    queryFn: () =>
      api<TimelineEvent[]>(`/activity-timeline?entityType=${entityType}&entityId=${entityId}`),
    enabled: Boolean(entityId),
  });
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Activity timeline</h2>
          <p className="mt-1 text-sm text-slate-500">
            Business events from the canonical workflow.
          </p>
        </div>
        <Activity className="h-5 w-5 text-[var(--primary)]" aria-hidden="true" />
      </div>
      {query.isLoading ? <p className="mt-4 text-sm text-slate-500">Loading activity...</p> : null}
      {query.isError ? (
        <p className="mt-4 text-sm text-red-700">{userFacingError(query.error)}</p>
      ) : null}
      {!query.isLoading && !query.isError && !query.data?.length ? (
        <p className="mt-4 text-sm text-slate-500">No activity recorded yet.</p>
      ) : null}
      {query.data?.length ? (
        <ol className="mt-4 space-y-3">
          {query.data.map((event) => {
            const Icon = eventIcon(event.type);
            return (
              <li
                key={event.id}
                className="flex gap-3 border-l-2 border-[var(--primary-soft)] pl-3"
              >
                <Icon
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                  <p className="text-sm text-slate-600">{event.description}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatDate(event.occurredAt)} · {humanize(event.type)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
