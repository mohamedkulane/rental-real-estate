'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { AppShell } from '@/components/shared/app-shell';
import { PageSkeleton } from '@/components/shared/loading-system';
import { EmptyState, ErrorState, FormSection, PageHeader, StatusBadge } from '@/components/shared/ui';
import { useClientReady } from '@/lib/client-ready';
import { api, clearApiCache, hasPermission, type Principal, userFacingError } from '@/lib/phase3-api';

const formValue = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
};

type WidgetData = {
  widgets: {
    activeDevelopments: number;
    totalPlannedArea: string;
    plots: number;
    completedAssets: number;
    constructionProgress: number;
    totalDevelopmentCost: string;
    saleReadyAssets: number;
  };
};

type Project = {
  id: string;
  projectNumber: string;
  name: string;
  status: string;
  sourceProperty?: { name?: string };
};

export function DevelopmentWorkspace() {
  const router = useRouter();
  const ready = useClientReady();
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState<WidgetData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    void api<Principal>('/auth/me')
      .then((value) => {
        if (!hasPermission(value, 'development.read')) {
          router.replace('/admin');
          return;
        }
        setPrincipal(value);
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  useEffect(() => {
    if (!principal) return;
    void Promise.all([
      api<WidgetData>('/development/overview'),
      api<{ items: Project[] }>('/development/projects?limit=25'),
      api<{ items: Array<{ id: string; name: string }> }>('/properties?limit=50').catch(() => ({ items: [] })),
      api<Array<{ id: string; name: string }>>('/branches').catch(() => []),
    ])
      .then(([widgets, list, propertyList, branchList]) => {
        setOverview(widgets);
        setProjects(list.items);
        setProperties(propertyList.items);
        setBranches(principal.branches?.length ? principal.branches : branchList);
      })
      .catch((cause) => setError(userFacingError(cause)));
  }, [principal]);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const created = await api<Project>('/development/projects', {
        method: 'POST',
        body: JSON.stringify({
          branchId: branches[0]?.id,
          sourcePropertyId: formValue(form, 'sourcePropertyId'),
          name: formValue(form, 'name'),
          developmentType: 'RESIDENTIAL',
        }),
      });
      toast.success('Development project created.');
      router.push(`/development/projects/${created.id}`);
    } catch (cause) {
      toast.error(userFacingError(cause));
    }
  }

  if (!ready || !principal) return <PageSkeleton />;

  return (
    <AppShell
      active="commercial"
      activeItem="projects:development"
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
        eyebrow="Projects"
        title="Development Overview"
        description="Company-owned land, blocks, plots, construction, and sale-ready assets."
      />
      {error ? <ErrorState message={error} /> : null}
      {overview ? (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-4">
            <Metric label="Active Developments" value={overview.widgets.activeDevelopments} />
            <Metric label="Total Planned Area" value={overview.widgets.totalPlannedArea} />
            <Metric label="Plots" value={overview.widgets.plots} />
            <Metric label="Completed Assets" value={overview.widgets.completedAssets} />
            <Metric label="Construction Progress" value={`${overview.widgets.constructionProgress}%`} />
            <Metric label="Total Development Cost" value={overview.widgets.totalDevelopmentCost} />
            <Metric label="Sale-Ready Assets" value={overview.widgets.saleReadyAssets} />
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Development progress</h3>
              <p className="mt-3 text-sm text-slate-600">
                Construction {overview.widgets.constructionProgress}% complete across company-owned projects.
              </p>
              <div className="mt-3 h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-emerald-600"
                  style={{ width: `${Math.min(100, overview.widgets.constructionProgress)}%` }}
                />
              </div>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Asset status mix</h3>
              <p className="mt-3 text-sm text-slate-600">
                {overview.widgets.saleReadyAssets} sale-ready of {overview.widgets.completedAssets} converted assets.
              </p>
            </section>
          </div>
        </>
      ) : null}
      {hasPermission(principal, 'development.manage') ? (
        <FormSection title="Start company development">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => void createProject(event)}>
            <label className="grid gap-1 text-sm">
              Project name
              <input name="name" required className="rounded-lg border border-slate-200 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              Company-owned land
              <select name="sourcePropertyId" required className="rounded-lg border border-slate-200 px-3 py-2">
                <option value="">Select property</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white" type="submit">
              Create development
            </button>
          </form>
        </FormSection>
      ) : null}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Development projects</h2>
        {projects.length ? (
          <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {projects.map((project) => (
              <li key={project.id} className="flex items-center justify-between px-4 py-3">
                <Link className="font-semibold text-emerald-800" href={`/development/projects/${project.id}`}>
                  {project.projectNumber} — {project.name}
                </Link>
                <StatusBadge value={project.status} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No developments" description="Create a company development from owned land." />
        )}
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-[28px] font-bold leading-none text-slate-900">{value}</p>
      <p className="mt-2 text-[13px] font-medium text-slate-500">{label}</p>
    </div>
  );
}
