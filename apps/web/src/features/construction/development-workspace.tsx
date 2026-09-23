'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import toast from '@/lib/toast';
import { AppShell } from '@/components/shared/app-shell';
import { PageSkeleton } from '@/components/shared/loading-system';
import { EmptyState, ErrorState, PageHeader, StatusBadge } from '@/components/shared/ui';
import { useCreateDrawerState } from '@/components/shared/use-create-drawer-state';
import {
  WorkspaceFormDrawer,
  WorkspaceFormDrawerFooter,
} from '@/components/shared/workspace-form-drawer';
import { useClientReady } from '@/lib/client-ready';
import { api, clearApiCache, hasPermission, type Principal, userFacingError } from '@/lib/phase3-api';

const FORM_ID = 'create-development-project-form';

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

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-[28px] font-bold leading-none text-slate-900">{value}</p>
      <p className="mt-2 text-[13px] font-medium text-slate-500">{label}</p>
    </div>
  );
}

export function DevelopmentWorkspace() {
  const router = useRouter();
  const ready = useClientReady();
  const { createOpen, openCreate, closeCreate } = useCreateDrawerState();
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState<WidgetData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [sourcePropertyId, setSourcePropertyId] = useState('');

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

  useEffect(() => {
    if (!createOpen) return;
    setName('');
    setSourcePropertyId('');
  }, [createOpen]);

  const canManage = Boolean(principal && hasPermission(principal, 'development.manage'));
  const branchId = branches[0]?.id ?? '';
  const readyToSubmit = Boolean(branchId && name.trim() && sourcePropertyId);

  async function createProject() {
    if (!readyToSubmit) {
      toast.error('Complete the required fields before saving.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await api<Project>('/development/projects', {
        method: 'POST',
        body: JSON.stringify({
          branchId,
          sourcePropertyId,
          name: name.trim(),
          developmentType: 'RESIDENTIAL',
        }),
      });
      toast.success('Development project created.');
      closeCreate();
      router.push(`/development/projects/${created.id}`);
    } catch (cause) {
      toast.error(userFacingError(cause));
    } finally {
      setSubmitting(false);
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
        action={
          canManage ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-800"
              onClick={openCreate}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Start development
            </button>
          ) : undefined
        }
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
      {canManage ? (
        <WorkspaceFormDrawer
          open={createOpen}
          eyebrow="Projects"
          title="Start company development"
          description="Create a company development from owned land."
          onClose={() => {
            if (!submitting) closeCreate();
          }}
          size="md"
          footer={
            <WorkspaceFormDrawerFooter
              formId={FORM_ID}
              onCancel={closeCreate}
              submitLabel="Create development"
              isPending={submitting}
              disabled={!readyToSubmit}
            />
          }
        >
          <form
            id={FORM_ID}
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void createProject();
            }}
          >
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-slate-500">Project name</span>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px]"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                autoFocus
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-slate-500">Company-owned land</span>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px]"
                value={sourcePropertyId}
                onChange={(event) => setSourcePropertyId(event.target.value)}
                required
              >
                <option value="">Select property</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </label>
          </form>
        </WorkspaceFormDrawer>
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
          <EmptyState
            title="No developments"
            description="Create a company development from owned land."
            action={
              canManage ? (
                <button type="button" className="button primary" onClick={openCreate}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Start development
                </button>
              ) : undefined
            }
          />
        )}
      </div>
    </AppShell>
  );
}
