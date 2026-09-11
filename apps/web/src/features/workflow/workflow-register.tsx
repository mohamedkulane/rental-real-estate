'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CursorPaginationControls } from '@/components/shared/pagination';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '@/components/shared/ui';
import { api, type CursorPage, userFacingError } from '@/lib/phase3-api';
import { OperationsShell, useOperationsPrincipal } from '@/features/leasing/operations-shell';
import { workflowLabels, workflowSteps, type WorkflowRecord } from './workflow-types';

export function WorkflowRegister() {
  const { principal, error } = useOperationsPrincipal();
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const [page, setPage] = useState(0);
  const path = `/workflows?limit=20${cursors[page] ? `&cursor=${cursors[page]}` : ''}`;
  const query = useQuery({
    queryKey: ['workflows', path],
    enabled: Boolean(principal),
    queryFn: () => api<CursorPage<WorkflowRecord> & { total: number }>(path),
  });
  return (
    <OperationsShell principal={principal} error={error} activeItem="incomplete-work">
      <PageHeader
        eyebrow="Workflows"
        title="Incomplete Work"
        description="Resume or safely cancel authorized guided workflows without losing completed canonical records."
        action={
          <Link className="button primary" href="/workflows/new">
            Start New
          </Link>
        }
      />
      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {query.isLoading ? (
          <div className="p-5">
            <LoadingState label="Loading draft workflows" />
          </div>
        ) : query.isError ? (
          <div className="p-5">
            <ErrorState
              message={userFacingError(query.error)}
              onRetry={() => void query.refetch()}
            />
          </div>
        ) : !query.data?.items.length ? (
          <EmptyState
            title="No incomplete work"
            description="New guided workflows will appear here when saved for later."
            action={
              <Link className="button primary" href="/workflows/new">
                Start New
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <th className="px-4 py-3">Workflow</th>
                  <th className="px-4 py-3">Current Step</th>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Last Updated</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 text-sm">
                    <td className="px-4 py-4 font-bold">{workflowLabels[row.type]}</td>
                    <td className="px-4 py-4">
                      {row.currentStep}. {workflowSteps[row.type][row.currentStep - 1]?.label}
                    </td>
                    <td className="px-4 py-4">
                      {row.branch ? `${row.branch.code} — ${row.branch.name}` : 'Authorized branch'}
                    </td>
                    <td className="px-4 py-4">{new Date(row.updatedAt).toLocaleString()}</td>
                    <td className="px-4 py-4">
                      <StatusBadge value={row.status} />
                    </td>
                    <td className="px-4 py-4">
                      <Link className="button secondary" href={`/workflows/${row.id}`}>
                        Continue
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <CursorPaginationControls
          page={page + 1}
          itemCount={query.data?.items.length ?? 0}
          hasPrevious={page > 0}
          hasNext={Boolean(query.data?.pageInfo.hasNextPage)}
          busy={query.isFetching}
          onPrevious={() => setPage((value) => Math.max(0, value - 1))}
          onNext={() => {
            const next = query.data?.pageInfo.nextCursor;
            if (!next) return;
            setCursors((current) => [...current.slice(0, page + 1), next]);
            setPage((value) => value + 1);
          }}
        />
      </section>
    </OperationsShell>
  );
}
