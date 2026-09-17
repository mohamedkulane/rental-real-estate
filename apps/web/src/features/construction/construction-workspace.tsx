'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from '@/lib/toast';
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
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState<WidgetData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [parties, setParties] = useState<Array<{ id: string; displayName: string }>>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void api<Principal>('/auth/me')
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

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      const created = await api<Project>('/construction/projects', {
        method: 'POST',
        body: JSON.stringify({
          branchId: branches[0]?.id,
          name: formValue(form, 'name'),
          economicModel: 'CONSTRUCTION_FOR_CLIENT',
          clientPartyId: formValue(form, 'clientPartyId'),
          scope: formValue(form, 'scope'),
        }),
      });
      toast.success('Construction project created.');
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
      {hasPermission(principal, 'construction.manage') ? (
        <FormSection title="Start client construction">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => void createProject(event)}>
            <label className="grid gap-1 text-sm">
              Project name
              <input name="name" required className="rounded-lg border border-slate-200 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              Client
              <select name="clientPartyId" required className="rounded-lg border border-slate-200 px-3 py-2">
                <option value="">Select client</option>
                {parties.map((party) => (
                  <option key={party.id} value={party.id}>
                    {party.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm md:col-span-2">
              Scope
              <textarea name="scope" className="rounded-lg border border-slate-200 px-3 py-2" rows={3} />
            </label>
            <button
              type="submit"
              disabled={submitting || !branches[0]?.id}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
            >
              {submitting ? 'Creating...' : 'Create project'}
            </button>
          </form>
        </FormSection>
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
          <EmptyState title="No construction projects" description="Create a client construction project to begin." />
        )}
      </div>
    </AppShell>
  );
}
