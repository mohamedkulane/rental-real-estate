'use client';

import { useQuery } from '@tanstack/react-query';
import { Download, FileSpreadsheet, Filter, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/shared/app-shell';
import { DataTableEmpty, DataTableSurface, DataTableToolbar } from '@/components/shared/data-table';
import { PageSkeleton, TableSkeleton } from '@/components/shared/loading-system';
import { ErrorState, PageHeader, StatusBadge } from '@/components/shared/ui';
import { useClientReady } from '@/lib/client-ready';
import {
  api,
  apiCached,
  apiUrl,
  clearApiCache,
  hasPermission,
  type Principal,
  userFacingError,
} from '@/lib/phase3-api';
import { humanize } from '@/lib/presentation';
import toast from '@/lib/toast';

type ReportCell = string | number | null;
type DetailedReport = {
  section: string;
  title: string;
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, ReportCell>>;
  generatedAt: string;
};

const categories = [
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'rental', label: 'Rental' },
  { key: 'fullManagement', label: 'Full Management' },
  { key: 'sales', label: 'Sales' },
  { key: 'finance', label: 'Finance' },
  { key: 'operations', label: 'Operations' },
  { key: 'construction', label: 'Construction' },
  { key: 'development', label: 'Development' },
] as const;

type Category = (typeof categories)[number]['key'];

const statusOptions: Partial<Record<Category, string[]>> = {
  portfolio: ['DRAFT', 'ACTIVE', 'INACTIVE', 'DISPOSED'],
  rental: ['DRAFT', 'CONFIRMED', 'CANCELLED'],
  fullManagement: ['DRAFT', 'PENDING_APPROVAL', 'SIGNED', 'ACTIVE', 'ENDED', 'TERMINATED'],
  sales: ['DRAFT', 'CONFIRMED', 'CANCELLED'],
  finance: ['CAPTURED', 'VERIFIED', 'POSTED', 'PARTIALLY_ALLOCATED', 'FULLY_ALLOCATED', 'REVERSED'],
  operations: ['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
  construction: ['DRAFT', 'PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'],
  development: ['PLANNING', 'APPROVED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'],
};

const inputClass =
  'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10';

function fileNameFrom(response: Response, fallback: string) {
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? fallback;
}

export function ReportsWorkspace() {
  const router = useRouter();
  const ready = useClientReady();
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [authError, setAuthError] = useState('');
  const [category, setCategory] = useState<Category>('rental');
  const [branchId, setBranchId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [exporting, setExporting] = useState<'xlsx' | 'csv' | null>(null);

  useEffect(() => {
    let live = true;
    void apiCached<Principal>('/auth/me')
      .then((value) => {
        if (!live) return;
        if (!hasPermission(value, 'report.read')) {
          setAuthError('You do not have permission to view reports.');
          return;
        }
        setPrincipal(value);
      })
      .catch((cause) => {
        if (live) setAuthError(userFacingError(cause));
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 275);
    return () => window.clearTimeout(timer);
  }, [search]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', branchId);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (status) params.set('status', status);
    if (debouncedSearch) params.set('search', debouncedSearch);
    return params.toString();
  }, [branchId, dateFrom, dateTo, status, debouncedSearch]);

  const report = useQuery({
    queryKey: ['detailed-report', category, queryString],
    enabled: Boolean(principal),
    queryFn: () =>
      api<DetailedReport>(`/reports/detail/${category}${queryString ? `?${queryString}` : ''}`),
  });

  function chooseCategory(next: Category) {
    setCategory(next);
    setStatus('');
  }

  async function download(format: 'xlsx' | 'csv') {
    setExporting(format);
    try {
      const params = new URLSearchParams(queryString);
      params.set('format', format);
      const response = await fetch(apiUrl(`/reports/export/${category}?${params.toString()}`), {
        credentials: 'include',
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? 'Report export failed.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileNameFrom(response, `${category}-report.${format}`);
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} report exported.`);
    } catch (cause) {
      toast.error(userFacingError(cause, 'The report could not be exported.'));
    } finally {
      setExporting(null);
    }
  }

  if (!ready || (!principal && !authError)) return <PageSkeleton />;
  if (authError || !principal) return <ErrorState message={authError} />;

  return (
    <AppShell
      active="administration"
      activeItem="reports"
      accessMode={principal.accessMode}
      accessBranches={principal.branches}
      permissions={principal.permissions}
      onLogout={() => {
        void api('/auth/logout', { method: 'POST' }).finally(() => {
          clearApiCache();
          router.replace('/login');
        });
      }}
    >
      <PageHeader
        eyebrow="Reporting"
        title="Reports"
        description="Filter detailed operational records and export the exact result to Excel or CSV."
        action={
          <div className="flex gap-2">
            <button type="button" className="button secondary inline-flex items-center gap-2" disabled={Boolean(exporting)} onClick={() => void download('csv')}>
              <Download className="h-4 w-4" aria-hidden="true" />
              {exporting === 'csv' ? 'Exporting...' : 'CSV'}
            </button>
            <button type="button" className="button primary inline-flex items-center gap-2" disabled={Boolean(exporting)} onClick={() => void download('xlsx')}>
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              {exporting === 'xlsx' ? 'Exporting...' : 'Excel'}
            </button>
          </div>
        }
      />

      <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-slate-200" aria-label="Report categories">
        {categories.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold transition ${category === item.key ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            onClick={() => chooseCategory(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <DataTableSurface className="mt-4">
        <DataTableToolbar>
          <div className="grid w-full gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_180px_150px_150px_180px_auto] xl:items-end">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Search</span>
              <span className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input className={`${inputClass} pl-9`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, code, number..." />
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Branch</span>
              <select className={inputClass} value={branchId} onChange={(event) => setBranchId(event.target.value)}>
                <option value="">All authorized branches</option>
                {principal.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Date From</span>
              <input className={inputClass} type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Date To</span>
              <input className={inputClass} type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Status</span>
              <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">All statuses</option>
                {(statusOptions[category] ?? []).map((value) => <option key={value} value={value}>{humanize(value)}</option>)}
              </select>
            </label>
            <button type="button" className="button ghost inline-flex h-10 items-center justify-center gap-2" onClick={() => { setBranchId(''); setDateFrom(''); setDateTo(''); setStatus(''); setSearch(''); }}>
              <Filter className="h-4 w-4" aria-hidden="true" />
              Reset
            </button>
          </div>
        </DataTableToolbar>

        {report.isLoading ? (
          <TableSkeleton columns={7} />
        ) : report.isError ? (
          <div className="p-5"><ErrorState message={userFacingError(report.error)} /></div>
        ) : !report.data?.rows.length ? (
          <DataTableEmpty title="No report rows" description="No records match the selected filters." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    {report.data.columns.map((column) => <th key={column.key} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">{column.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {report.data.rows.map((row, index) => (
                    <tr key={`${category}-${index}`} className="border-b border-slate-100 align-top hover:bg-slate-50/60">
                      {report.data.columns.map((column) => {
                        const value = row[column.key];
                        const isStatus = column.key === 'status' || column.key === 'outcome';
                        return <td key={column.key} className="max-w-[300px] px-4 py-3 text-slate-700">{isStatus && value ? <StatusBadge value={humanize(String(value))} /> : String(value ?? '—') || '—'}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">Showing {report.data.rows.length} filtered {report.data.rows.length === 1 ? 'record' : 'records'}.</footer>
          </>
        )}
      </DataTableSurface>
    </AppShell>
  );
}
