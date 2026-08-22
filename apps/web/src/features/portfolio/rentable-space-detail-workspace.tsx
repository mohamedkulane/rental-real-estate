'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ErrorState, LoadingState, StatusBadge } from '@/components/shared/ui';
import { api, apiCached, userFacingError } from '@/lib/phase3-api';
import { RentableSpaceOperations, type SpaceOperationRecord } from './rentable-space-operations';
import { PortfolioDetailShell, usePortfolioPrincipal } from './detail-shell';

type SpaceDetail = SpaceOperationRecord & {
  property: {
    id?: string;
    name?: string;
    propertyCode?: string;
    branchAssignments?: Array<{
      branchId: string;
      effectiveFrom: string;
      effectiveTo: string | null;
    }>;
  };
  building?: { id: string; name: string; buildingCode: string } | null;
};
type SpaceType = { id: string; code: string; name: string };

export function RentableSpaceDetailWorkspace() {
  const params = useParams<{ spaceId: string }>();
  const { principal, error: sessionError } = usePortfolioPrincipal();
  const [record, setRecord] = useState<SpaceDetail | null>(null);
  const [types, setTypes] = useState<SpaceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [space, catalog] = await Promise.all([
        api<SpaceDetail>('/rentable-spaces/' + params.spaceId),
        apiCached<SpaceType[]>('/rentable-spaces/types'),
      ]);
      setRecord(space);
      setTypes(catalog);
    } catch (cause) {
      setError(userFacingError(cause, 'Rentable Space details could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (principal) void load();
  }, [params.spaceId, principal]);

  return (
    <PortfolioDetailShell
      principal={principal}
      activeItem="spaces:overview"
      breadcrumbs={['Portfolio', 'Rentable Spaces', record?.name ?? 'Space']}
    >
      {sessionError ? <ErrorState message={sessionError} /> : null}
      {loading ? <LoadingState label="Loading Rentable Space details" /> : null}
      {!loading && error && !record ? <ErrorState message={error} /> : null}
      {record && principal ? (
        <div className="space-y-5">
          <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                  {record.spaceCode}
                </p>
                <h1 className="truncate text-2xl font-bold text-slate-950">{record.name}</h1>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600">
                  {record.property.id ? (
                    <a
                      className="font-semibold text-[#0D47A1] hover:underline"
                      href={'/portfolio/properties/' + record.property.id}
                    >
                      {record.property.propertyCode ? record.property.propertyCode + ' - ' : ''}
                      {record.property.name}
                    </a>
                  ) : (
                    <span>{record.property.name}</span>
                  )}
                  {record.building ? (
                    <a
                      className="font-semibold text-[#0D47A1] hover:underline"
                      href={'/portfolio/buildings/' + record.building.id}
                    >
                      {record.building.buildingCode} - {record.building.name}
                    </a>
                  ) : (
                    <span>Property-level Space</span>
                  )}
                </div>
              </div>
              <StatusBadge value={record.status} />
            </div>
          </header>
          {error ? <ErrorState message={error} /> : null}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <RentableSpaceOperations
              principal={principal}
              initialSelectedId={record.id}
              spaces={[record]}
              typeCatalog={types}
              onSaved={load}
            />
          </section>
        </div>
      ) : null}
    </PortfolioDetailShell>
  );
}
