'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download } from 'lucide-react';
import toast from '@/lib/toast';
import { AppShell } from '@/components/shared/app-shell';
import { PageSkeleton } from '@/components/shared/loading-system';
import { EmptyState, ErrorState, PageHeader } from '@/components/shared/ui';
import { useClientReady } from '@/lib/client-ready';
import { humanize } from '@/lib/presentation';
import {
  api,
  apiCached,
  clearApiCache,
  hasPermission,
  type Principal,
  userFacingError,
} from '@/lib/phase3-api';

type ReportSection = Record<string, number | string>;

type WorkspaceData = {
  portfolio: ReportSection;
  crm: ReportSection;
  rental: ReportSection;
  fullManagement: ReportSection;
  sales: ReportSection;
  operations: ReportSection;
  finance: ReportSection;
  construction: ReportSection;
  development: ReportSection;
  branch: { selectedBranchId: string | null; comparisonAvailable: boolean };
};

const sectionOrder = [
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'crm', label: 'CRM' },
  { key: 'rental', label: 'Rental' },
  { key: 'fullManagement', label: 'Full Management' },
  { key: 'sales', label: 'Sales' },
  { key: 'operations', label: 'Operations' },
  { key: 'finance', label: 'Finance' },
  { key: 'construction', label: 'Construction' },
  { key: 'development', label: 'Development' },
] as const;

function metricLabel(key: string): string {
  return humanize(key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' '));
}

function ReportCard({
  title,
  metrics,
  onExport,
  exporting,
}: {
  title: string;
  metrics: ReportSection;
  onExport: () => void;
  exporting: boolean;
}) {
  const entries = Object.entries(metrics).filter(([, value]) => value !== undefined && value !== null);
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
        <button
          type="button"
          className="button secondary inline-flex items-center gap-2 text-[13px]"
          disabled={exporting}
          onClick={onExport}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {exporting ? 'Exporting...' : 'Export'}
        </button>
      </header>
      {entries.length ? (
        <dl className="grid gap-3 p-5 sm:grid-cols-2">
          {entries.map(([key, value]) => (
            <div key={key} className="rounded-lg bg-slate-50 px-4 py-3">
              <dt className="text-[12px] font-semibold text-slate-500">{metricLabel(key)}</dt>
              <dd className="mt-1 text-lg font-bold text-slate-900">{String(value)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="p-5">
          <EmptyState title="No metrics" description="This report section has no data in your scope." />
        </div>
      )}
    </section>
  );
}

export function ReportsWorkspace() {
  const router = useRouter();
  const ready = useClientReady();
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportingSection, setExportingSection] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void apiCached<Principal>('/auth/me')
      .then(async (value) => {
        if (!live) return;
        if (!hasPermission(value, 'report.read')) {
          setError('You do not have permission to view reports.');
          setLoading(false);
          return;
        }
        setPrincipal(value);
        const data = await api<WorkspaceData>('/reports/workspace');
        if (live) setWorkspace(data);
      })
      .catch((cause) => {
        if (!live) return;
        if (cause instanceof Error && 'status' in cause && cause.status === 401) {
          clearApiCache();
          router.replace('/login');
          return;
        }
        setError(userFacingError(cause));
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [router]);

  const sections = useMemo(() => {
    if (!workspace) return [];
    return sectionOrder
      .map(({ key, label }) => ({
        key,
        label,
        metrics: workspace[key],
      }))
      .filter((section) => Object.keys(section.metrics).length > 0);
  }, [workspace]);

  async function exportSection(sectionKey: string) {
    setExportingSection(sectionKey);
    try {
      const data = await api<ReportSection>(`/reports/export/${sectionKey}`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${sectionKey}-report.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success('Report exported.');
    } catch (cause) {
      toast.error(userFacingError(cause));
    } finally {
      setExportingSection(null);
    }
  }

  if (!ready) return <PageSkeleton />;
  if (loading) return <PageSkeleton />;
  if (error && !principal) return <ErrorState message={error} />;

  return (
    <AppShell
      active="administration"
      activeItem="reports"
      accessMode={principal!.accessMode}
      accessBranches={principal!.branches}
      permissions={principal!.permissions}
      onLogout={() => {
        void api('/auth/logout', { method: 'POST' }).finally(() => {
          clearApiCache();
          router.replace('/login');
        });
      }}
    >
      <PageHeader
        eyebrow="Reporting"
        title="Reports workspace"
        description="Branch-aware operational and financial summaries for your authorized scope."
      />
      {error ? <ErrorState message={error} /> : null}
      {sections.length ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          {sections.map((section) => (
            <ReportCard
              key={section.key}
              title={section.label}
              metrics={section.metrics}
              exporting={exportingSection === section.key}
              onExport={() => void exportSection(section.key)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No report sections available"
          description="Report data will appear when records exist in your authorized scope."
        />
      )}
    </AppShell>
  );
}
