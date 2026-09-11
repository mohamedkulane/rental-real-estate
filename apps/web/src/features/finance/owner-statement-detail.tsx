'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableHeaderCell, DataTableRow, DataTableScroll, DataTableSurface } from '@/components/shared/data-table';
import { PageSkeleton } from '@/components/shared/loading-system';
import { ErrorState, PageHeader, StatusBadge } from '@/components/shared/ui';
import { api, hasPermission, userFacingError } from '@/lib/phase3-api';
import { formatDate, humanize } from '@/lib/presentation';
import { FinanceAccessDenied } from './finance-shared';
import { FinanceShell, useFinancePrincipal } from './finance-shell';

type Statement = {
  id: string;
  statementNumber: string;
  status: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  owner?: { displayName?: string };
  property?: { name?: string; propertyCode?: string } | null;
  lines: Array<{ id: string; lineNo: number; lineCode: string; description: string; amount: string }>;
};

export function OwnerStatementDetail() {
  const params = useParams<{ id: string }>();
  const { principal, error } = useFinancePrincipal();
  const allowed = Boolean(principal && hasPermission(principal, 'owner-statement.read'));
  const query = useQuery({
    queryKey: ['owner-statement', params.id],
    enabled: allowed && Boolean(params.id),
    queryFn: () => api<Statement>(`/owner-statements/${params.id}`),
  });

  return (
    <FinanceShell principal={principal} principalError={error} activeItem="finance:owner-statements">
      <PageHeader
        eyebrow="Finance"
        title={query.data?.statementNumber ?? 'Owner Statement'}
        description="Issued snapshot of owner activity for the selected period. Posted totals are not edited in place."
        action={
          <Link className="text-sm font-semibold text-emerald-700" href="/finance/owner-statements">
            Back to register
          </Link>
        }
      />
      {principal && !allowed ? <FinanceAccessDenied /> : null}
      {query.isLoading ? <PageSkeleton /> : null}
      {query.isError ? <ErrorState message={userFacingError(query.error)} /> : null}
      {query.data ? (
        <div className="mt-6 space-y-4">
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-4">
            <div>
              <p className="text-[12px] font-semibold text-slate-500">Owner</p>
              <p>{query.data.owner?.displayName ?? '—'}</p>
            </div>
            <div>
              <p className="text-[12px] font-semibold text-slate-500">Property</p>
              <p>{query.data.property?.name ?? 'Portfolio'}</p>
            </div>
            <div>
              <p className="text-[12px] font-semibold text-slate-500">Period</p>
              <p>
                {formatDate(query.data.periodStart)} — {formatDate(query.data.periodEnd)}
              </p>
            </div>
            <div>
              <p className="text-[12px] font-semibold text-slate-500">Status</p>
              <StatusBadge value={query.data.status} />
            </div>
          </div>
          <DataTableSurface>
            <DataTableScroll>
              <DataTable>
                <DataTableHead>
                  <tr>
                    <DataTableHeaderCell>Line</DataTableHeaderCell>
                    <DataTableHeaderCell>Type</DataTableHeaderCell>
                    <DataTableHeaderCell>Description</DataTableHeaderCell>
                    <DataTableHeaderCell>Amount</DataTableHeaderCell>
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {query.data.lines.map((line) => (
                    <DataTableRow key={line.id}>
                      <DataTableCell>{line.lineNo}</DataTableCell>
                      <DataTableCell>{humanize(line.lineCode)}</DataTableCell>
                      <DataTableCell>{line.description}</DataTableCell>
                      <DataTableCell>
                        {query.data.currency} {line.amount}
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </DataTableScroll>
          </DataTableSurface>
        </div>
      ) : null}
    </FinanceShell>
  );
}
