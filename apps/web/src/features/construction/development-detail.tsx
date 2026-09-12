'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { AppShell } from '@/components/shared/app-shell';
import { PageSkeleton } from '@/components/shared/loading-system';
import { ErrorState, FormSection, PageHeader, StatusBadge } from '@/components/shared/ui';
import { useClientReady } from '@/lib/client-ready';
import { api, clearApiCache, hasPermission, type Principal, userFacingError } from '@/lib/phase3-api';

const formValue = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
};

type Detail = {
  id: string;
  projectNumber: string;
  name: string;
  status: string;
  branchId: string;
  constructionProject?: { id: string; projectNumber: string } | null;
  blocks: Array<{ id: string; code: string; name: string }>;
  plots: Array<{ id: string; plotNumber: string; status: string }>;
  outputAssets: Array<{ id: string; property?: { propertyCode?: string; name?: string } }>;
};

export function DevelopmentDetail({ projectId }: { projectId: string }) {
  const router = useRouter();
  const ready = useClientReady();
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [project, setProject] = useState<Detail | null>(null);
  const [error, setError] = useState('');

  async function reload() {
    setProject(await api<Detail>(`/development/projects/${projectId}`));
  }

  useEffect(() => {
    void api<Principal>('/auth/me')
      .then(setPrincipal)
      .catch(() => router.replace('/login'));
  }, [router]);

  useEffect(() => {
    if (!principal) return;
    void reload().catch((cause) => setError(userFacingError(cause)));
  }, [principal, projectId]);

  async function post(path: string, body: Record<string, unknown>, success: string) {
    try {
      await api(path, { method: 'POST', body: JSON.stringify(body) });
      toast.success(success);
      await reload();
    } catch (cause) {
      toast.error(userFacingError(cause));
    }
  }

  if (!ready || !principal || !project) return <PageSkeleton />;
  const canManage = hasPermission(principal, 'development.manage');

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
        eyebrow="Company development"
        title={`${project.projectNumber} — ${project.name}`}
        description="Blocks, plots, construction, and conversion to saleable Property records."
        action={<StatusBadge value={project.status} />}
      />
      {error ? <ErrorState message={error} /> : null}
      {canManage ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <FormSection title="Block">
            <form
              className="grid gap-3"
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void post(
                  '/development/blocks',
                  {
                    developmentProjectId: project.id,
                    code: formValue(form, 'code'),
                    name: formValue(form, 'name'),
                  },
                  'Block created',
                );
              }}
            >
              <input name="code" required placeholder="A" className="rounded-lg border border-slate-200 px-3 py-2" />
              <input name="name" required placeholder="Block A" className="rounded-lg border border-slate-200 px-3 py-2" />
              <button className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white" type="submit">
                Add block
              </button>
            </form>
          </FormSection>
          <FormSection title="Plot">
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void post(
                  '/development/plots',
                  {
                    developmentProjectId: project.id,
                    blockId: project.blocks[0]?.id,
                    plotNumber: formValue(form, 'plotNumber'),
                  },
                  'Plot created',
                );
              }}
            >
              <input name="plotNumber" required placeholder="P-01" className="rounded-lg border border-slate-200 px-3 py-2" />
              <button className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white" type="submit">
                Add plot
              </button>
            </form>
          </FormSection>
          {!project.constructionProject ? (
            <FormSection title="Development construction">
              <button
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
                type="button"
                onClick={() =>
                  void post(
                    '/development/construction',
                    { developmentProjectId: project.id, name: `${project.name} construction` },
                    'Construction attached',
                  )
                }
              >
                Start construction
              </button>
            </FormSection>
          ) : (
            <p className="text-sm text-slate-600">Linked construction {project.constructionProject.projectNumber}</p>
          )}
          <FormSection title="Convert saleable plot">
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void post(
                  '/development/convert-plot',
                  {
                    plotId: formValue(form, 'plotId'),
                    propertyName: formValue(form, 'propertyName'),
                    createSaleListing: true,
                  },
                  'Canonical Property created',
                );
              }}
            >
              <select name="plotId" required className="rounded-lg border border-slate-200 px-3 py-2">
                <option value="">Select plot</option>
                {project.plots.map((plot) => (
                  <option key={plot.id} value={plot.id}>
                    {plot.plotNumber}
                  </option>
                ))}
              </select>
              <input name="propertyName" required placeholder="Villa 01" className="rounded-lg border border-slate-200 px-3 py-2" />
              <button className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white" type="submit">
                Convert to Property
              </button>
            </form>
          </FormSection>
        </div>
      ) : null}
      {project.outputAssets.length ? (
        <div className="mt-6">
          <h2 className="font-semibold">Output properties</h2>
          <ul className="mt-2 text-sm">
            {project.outputAssets.map((asset) => (
              <li key={asset.id}>
                {asset.property?.propertyCode} — {asset.property?.name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </AppShell>
  );
}
