'use client';

import { useEffect, useState, type ReactNode } from 'react';
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
import { api, apiCached, clearApiCache, hasPermission, type Principal, userFacingError } from '@/lib/phase3-api';

const FORM_ID = 'create-construction-project-form';

type WidgetData = {
  widgets: {
    activeProjects: number;
    delayedProjects: number;
    budgetUtilization: number;
    upcomingMilestones: number;
    openWorkPackages: number;
    outstandingClientInvoices: string;
  };
};

type Project = {
  id: string;
  projectNumber: string;
  name: string;
  status: string;
  economicModel: string;
  client?: { displayName?: string };
};

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-[28px] font-bold leading-none text-slate-900">{value}</p>
      <p className="mt-2 text-[13px] font-medium text-slate-500">{label}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function Bar({ label, value, max, suffix = '' }: { label: string; value: number; max: number; suffix?: string }) {
  const width = Math.min(100, Math.round((Number(value) / Math.max(max, 1)) * 100));
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-600">
        <span>{label}</span>
        <span>
          {value}
          {suffix}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function ConstructionWorkspace() {
  const router = useRouter();
  const ready = useClientReady();
  const { createOpen, openCreate, closeCreate } = useCreateDrawerState();
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState<WidgetData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [parties, setParties] = useState<Array<{ id: string; displayName: string }>>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [clientPartyId, setClientPartyId] = useState('');
  const [scope, setScope] = useState('');

  useEffect(() => {
    void apiCached<Principal>('/auth/me')
      .then((value) => {
        if (!hasPermission(value, 'construction.read')) {
          router.replace('/admin');
          return;
        }
        setPrincipal(value);
      })
      .catch((cause) => {
        setError(userFacingError(cause));
        router.replace('/login');
      });
  }, [router]);

  useEffect(() => {
    if (!principal) return;
    void Promise.all([
      api<WidgetData>('/construction/overview'),
      api<{ items: Project[] }>('/construction/projects?limit=25&economicModel=CONSTRUCTION_FOR_CLIENT'),
      api<{ items: Array<{ id: string; displayName: string }> }>('/parties?limit=50').catch(() => ({
        items: [],
      })),
      api<Array<{ id: string; name: string }>>('/branches').catch(() => []),
    ])
      .then(([widgets, list, partyList, branchList]) => {
        setOverview(widgets);
        setProjects(list.items);
        setParties(partyList.items);
        setBranches(principal.branches?.length ? principal.branches : branchList);
      })
      .catch((cause) => setError(userFacingError(cause)));
  }, [principal]);

  useEffect(() => {
    if (!createOpen) return;
    setName('');
    setClientPartyId('');
    setScope('');
  }, [createOpen]);

  const canManage = Boolean(principal && hasPermission(principal, 'construction.manage'));
  const branchId = branches[0]?.id ?? '';
  const readyToSubmit = Boolean(branchId && name.trim() && clientPartyId);

  async function createProject() {
    if (!readyToSubmit) {
      toast.error('Complete the required fields before saving.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await api<Project>('/construction/projects', {
        method: 'POST',
        body: JSON.stringify({
          branchId,
          name: name.trim(),
          economicModel: 'CONSTRUCTION_FOR_CLIENT',
          clientPartyId,
          scope: scope.trim() || undefined,
        }),
      });
      toast.success('Construction project created.');
      closeCreate();
      router.push(`/construction/projects/${created.id}`);
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
      activeItem="projects:construction"
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
        title="Construction Overview"
        description="Client construction projects, progress, budget, and billing."
        action={
          canManage ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-800"
              onClick={openCreate}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Start project
            </button>
          ) : undefined
        }
      />
      {error ? <ErrorState message={error} /> : null}
      {overview ? (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <Metric label="Active Projects" value={overview.widgets.activeProjects} />
            <Metric label="Delayed Projects" value={overview.widgets.delayedProjects} />
            <Metric label="Budget Utilization" value={`${overview.widgets.budgetUtilization}%`} />
            <Metric label="Upcoming Milestones" value={overview.widgets.upcomingMilestones} />
            <Metric label="Open Work Packages" value={overview.widgets.openWorkPackages} />
            <Metric label="Outstanding Invoices" value={overview.widgets.outstandingClientInvoices} />
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <ChartCard title="Project progress">
              <Bar label="Active" value={overview.widgets.activeProjects} max={Math.max(overview.widgets.activeProjects, 1)} />
              <Bar label="Delayed" value={overview.widgets.delayedProjects} max={Math.max(overview.widgets.activeProjects, 1)} />
            </ChartCard>
            <ChartCard title="Budget vs actual">
              <Bar label="Utilization" value={overview.widgets.budgetUtilization} max={100} suffix="%" />
            </ChartCard>
          </div>
        </>
      ) : null}
      {canManage ? (
        <WorkspaceFormDrawer
          open={createOpen}
          eyebrow="Projects"
          title="Start client construction"
          description="Create a client construction project for the selected branch."
          onClose={() => {
            if (!submitting) closeCreate();
          }}
          size="md"
          footer={
            <WorkspaceFormDrawerFooter
              formId={FORM_ID}
              onCancel={closeCreate}
              submitLabel="Create project"
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
              <span className="mb-1 block text-[12px] font-semibold text-slate-500">Client</span>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px]"
                value={clientPartyId}
                onChange={(event) => setClientPartyId(event.target.value)}
                required
              >
                <option value="">Select client</option>
                {parties.map((party) => (
                  <option key={party.id} value={party.id}>
                    {party.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-slate-500">Scope</span>
              <textarea
                className="min-h-[96px] w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px]"
                value={scope}
                onChange={(event) => setScope(event.target.value)}
                rows={3}
              />
            </label>
          </form>
        </WorkspaceFormDrawer>
      ) : null}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Projects</h2>
        {projects.length ? (
          <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {projects.map((project) => (
              <li key={project.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <Link className="font-semibold text-emerald-800" href={`/construction/projects/${project.id}`}>
                    {project.projectNumber} — {project.name}
                  </Link>
                  <p className="text-sm text-slate-500">{project.client?.displayName ?? 'No client'}</p>
                </div>
                <StatusBadge value={project.status} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No construction projects"
            description="Create a client construction project to begin."
            action={
              canManage ? (
                <button type="button" className="button primary" onClick={openCreate}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Start project
                </button>
              ) : undefined
            }
          />
        )}
      </div>
    </AppShell>
  );
}
