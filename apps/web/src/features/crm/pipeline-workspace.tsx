'use client';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { PageHeader, ErrorState, LoadingState, EmptyState } from '@/components/shared/ui';
import { CursorPaginationControls } from '@/components/shared/pagination';
import { api } from '@/lib/phase3-api';
import { humanize } from '@/lib/presentation';
import { CrmShell, useCrmPrincipal } from './crm-shell';
import { AccessDenied, LeadCards } from './crm-shared';
import { can, crmError, requestPath, useUrlFilters } from './crm-data';
import { LeadFilters, leadFilterValues } from './lead-register';
import { leadStages, type LeadPage, type LeadStage, type PipelinePage } from './crm-types';
import { appendCursor } from './crm-model';

function Lane({
  stage,
  basePath,
  initial,
}: {
  stage: LeadStage;
  basePath: string;
  initial: LeadPage;
}) {
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: ['crm', basePath, stage, cursors[page]],
    enabled: page > 0,
    retry: false,
    queryFn: () =>
      api<PipelinePage>(
        requestPath(basePath, { limit: '25', pipelineStage: stage, cursor: cursors[page] }),
      ),
  });
  const data = page === 0 ? initial : query.data?.groups[stage];
  return (
    <section
      className="min-w-0 rounded-xl border border-slate-200 bg-white p-4"
      aria-labelledby={`lane-${stage}`}
    >
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 id={`lane-${stage}`} className="text-lg">
          {humanize(stage)}
        </h2>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-800">
          {initial.totalCount.toLocaleString()}
        </span>
      </header>
      {query.isError && page > 0 ? (
        <>
          <ErrorState message={crmError(query.error)} onRetry={() => void query.refetch()} />
          <button
            type="button"
            className="button secondary mt-3"
            onClick={() => {
              setCursors([undefined]);
              setPage(0);
            }}
          >
            Start from first stage page
          </button>
        </>
      ) : !data ? (
        <LoadingState compact label="Loading stage page" />
      ) : data.items.length ? (
        <LeadCards items={data.items} />
      ) : (
        <EmptyState
          title="No Leads in this stage"
          description="Leads enter this stage through the named actions on their detail page."
        />
      )}
      <CursorPaginationControls
        page={page + 1}
        itemCount={data?.items.length ?? 0}
        hasPrevious={page > 0}
        hasNext={Boolean(data?.pageInfo.hasNextPage)}
        busy={page > 0 && query.isFetching}
        onPrevious={() => setPage(Math.max(0, page - 1))}
        onNext={() => {
          const next = data?.pageInfo.nextCursor;
          if (next) {
            setCursors(appendCursor(cursors, page, next));
            setPage(page + 1);
          }
        }}
      />
    </section>
  );
}
export function PipelineWorkspace() {
  const { principal, error } = useCrmPrincipal();
  const { params } = useUrlFilters();
  const allowed = Boolean(principal && can(principal, 'crm.lead.read'));
  const path = requestPath('/crm/pipeline', leadFilterValues(params));
  const query = useQuery({
    queryKey: ['crm', path],
    enabled: allowed,
    retry: false,
    queryFn: () => api<PipelinePage>(requestPath(path, { limit: '25' })),
  });
  return (
    <CrmShell principal={principal} principalError={error} activeItem="crm:pipeline">
      <PageHeader
        eyebrow="CRM workspace"
        title="Pipeline"
        description="Each stage has its own complete, independently paged queue. Matching is a readiness stage, not evidence that matching has run."
      />
      {principal && !allowed ? (
        <AccessDenied />
      ) : (
        <>
          <LeadFilters purpose="PIPELINE" principal={principal} />
          {query.isPending ? (
            <LoadingState label="Loading pipeline" />
          ) : query.isError ? (
            <ErrorState message={crmError(query.error)} onRetry={() => void query.refetch()} />
          ) : (
            <>
              <p className="mb-4 text-sm font-semibold text-slate-600">
                {query.data.totalCount.toLocaleString()} Leads across all stages
              </p>
              <div className="space-y-5">
                {leadStages.map((stage) => (
                  <Lane
                    key={`${path}-${stage}`}
                    stage={stage}
                    basePath={path}
                    initial={
                      query.data.groups[stage] ?? {
                        items: [],
                        totalCount: 0,
                        pageInfo: { hasNextPage: false, nextCursor: null },
                      }
                    }
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </CrmShell>
  );
}
