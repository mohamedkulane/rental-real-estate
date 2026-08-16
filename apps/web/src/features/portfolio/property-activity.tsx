import { GitBranch, Users } from 'lucide-react';
import { EmptyState } from '@/components/shared/ui';
import type { PropertyRecord } from './pages/property-registry';
import { propertyTimeline } from './portfolio-ia';

export function PropertyActivity({ property }: { property: PropertyRecord }) {
  const records = propertyTimeline(property);
  if (!records.length)
    return (
      <EmptyState
        title="No activity yet"
        description="Effective-dated property changes will appear here."
      />
    );

  return (
    <ol className="space-y-3" aria-label="Property activity timeline">
      {records.map((record) => {
        const Icon = record.kind === 'branch' ? GitBranch : Users;
        return (
          <li key={record.key} className="flex gap-3 rounded-lg border border-slate-200 p-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900">{record.label}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
                  new Date(record.date),
                )}{' '}
                · {record.detail}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
