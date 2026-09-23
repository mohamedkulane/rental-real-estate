'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import toast from '@/lib/toast';
import { AppShell } from '@/components/shared/app-shell';
import { PageSkeleton } from '@/components/shared/loading-system';
import { ErrorState, PageHeader, StatusBadge } from '@/components/shared/ui';
import {
  WorkspaceFormDrawer,
  WorkspaceFormDrawerFooter,
} from '@/components/shared/workspace-form-drawer';
import { useClientReady } from '@/lib/client-ready';
import { api, clearApiCache, hasPermission, type Principal, userFacingError } from '@/lib/phase3-api';

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

type DrawerKind = 'block' | 'plot' | 'convert' | null;

const drawerCopy: Record<
  Exclude<DrawerKind, null>,
  { title: string; description: string; submitLabel: string; formId: string }
> = {
  block: {
    title: 'Add block',
    description: 'Create a block within this company development.',
    submitLabel: 'Add block',
    formId: 'development-block-form',
  },
  plot: {
    title: 'Add plot',
    description: 'Add a plot under the first development block.',
    submitLabel: 'Add plot',
    formId: 'development-plot-form',
  },
  convert: {
    title: 'Convert saleable plot',
    description: 'Create a canonical Property record from a development plot.',
    submitLabel: 'Convert to Property',
    formId: 'development-convert-form',
  },
};

export function DevelopmentDetail({ projectId }: { projectId: string }) {
  const router = useRouter();
  const ready = useClientReady();
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [project, setProject] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [drawer, setDrawer] = useState<DrawerKind>(null);
  const [submitting, setSubmitting] = useState(false);
  const [blockCode, setBlockCode] = useState('');
  const [blockName, setBlockName] = useState('');
  const [plotNumber, setPlotNumber] = useState('');
  const [plotId, setPlotId] = useState('');
  const [propertyName, setPropertyName] = useState('');

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

  useEffect(() => {
    if (!drawer) return;
    setBlockCode('');
    setBlockName('');
    setPlotNumber('');
    setPlotId('');
    setPropertyName('');
  }, [drawer]);

  async function post(path: string, body: Record<string, unknown>, success: string) {
    try {
      await api(path, { method: 'POST', body: JSON.stringify(body) });
      toast.success(success);
      await reload();
      return true;
    } catch (cause) {
      toast.error(userFacingError(cause));
      return false;
    }
  }

  async function submitDrawer() {
    if (!project || !drawer) return;
    setSubmitting(true);
    try {
      let ok = false;
      if (drawer === 'block') {
        ok = await post(
          '/development/blocks',
          {
            developmentProjectId: project.id,
            code: blockCode.trim(),
            name: blockName.trim(),
          },
          'Block created',
        );
      } else if (drawer === 'plot') {
        ok = await post(
          '/development/plots',
          {
            developmentProjectId: project.id,
            blockId: project.blocks[0]?.id,
            plotNumber: plotNumber.trim(),
          },
          'Plot created',
        );
      } else if (drawer === 'convert') {
        ok = await post(
          '/development/convert-plot',
          {
            plotId,
            propertyName: propertyName.trim(),
            createSaleListing: true,
          },
          'Canonical Property created',
        );
      }
      if (ok) setDrawer(null);
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready || !principal || !project) return <PageSkeleton />;
  const canManage = hasPermission(principal, 'development.manage');
  const copy = drawer ? drawerCopy[drawer] : null;
  const drawerReady =
    drawer === 'block'
      ? Boolean(blockCode.trim() && blockName.trim())
      : drawer === 'plot'
        ? Boolean(plotNumber.trim() && project.blocks[0]?.id)
        : drawer === 'convert'
          ? Boolean(plotId && propertyName.trim())
          : false;

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
        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" className="button secondary" onClick={() => setDrawer('block')}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add block
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              if (!project.blocks[0]?.id) {
                toast.error('Add a block before creating plots.');
                return;
              }
              setDrawer('plot');
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add plot
          </button>
          <button type="button" className="button secondary" onClick={() => setDrawer('convert')}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Convert plot
          </button>
          {!project.constructionProject ? (
            <button
              type="button"
              className="button primary"
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
          ) : null}
        </div>
      ) : null}

      {project.constructionProject ? (
        <p className="mt-4 text-sm text-slate-600">
          Linked construction {project.constructionProject.projectNumber}
        </p>
      ) : null}

      {canManage && copy ? (
        <WorkspaceFormDrawer
          open={Boolean(drawer)}
          eyebrow="Company development"
          title={copy.title}
          description={copy.description}
          onClose={() => {
            if (!submitting) setDrawer(null);
          }}
          size="md"
          footer={
            <WorkspaceFormDrawerFooter
              formId={copy.formId}
              onCancel={() => setDrawer(null)}
              submitLabel={copy.submitLabel}
              isPending={submitting}
              disabled={!drawerReady}
            />
          }
        >
          <form
            id={copy.formId}
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!drawerReady) {
                toast.error('Complete the required fields before saving.');
                return;
              }
              void submitDrawer();
            }}
          >
            {drawer === 'block' ? (
              <>
                <label className="block">
                  <span className="mb-1 block text-[12px] font-semibold text-slate-500">Code</span>
                  <input
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px]"
                    value={blockCode}
                    onChange={(event) => setBlockCode(event.target.value)}
                    placeholder="A"
                    required
                    autoFocus
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[12px] font-semibold text-slate-500">Name</span>
                  <input
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px]"
                    value={blockName}
                    onChange={(event) => setBlockName(event.target.value)}
                    placeholder="Block A"
                    required
                  />
                </label>
              </>
            ) : null}
            {drawer === 'plot' ? (
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-slate-500">Plot number</span>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px]"
                  value={plotNumber}
                  onChange={(event) => setPlotNumber(event.target.value)}
                  placeholder="P-01"
                  required
                  autoFocus
                />
              </label>
            ) : null}
            {drawer === 'convert' ? (
              <>
                <label className="block">
                  <span className="mb-1 block text-[12px] font-semibold text-slate-500">Plot</span>
                  <select
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px]"
                    value={plotId}
                    onChange={(event) => setPlotId(event.target.value)}
                    required
                    autoFocus
                  >
                    <option value="">Select plot</option>
                    {project.plots.map((plot) => (
                      <option key={plot.id} value={plot.id}>
                        {plot.plotNumber}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[12px] font-semibold text-slate-500">Property name</span>
                  <input
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px]"
                    value={propertyName}
                    onChange={(event) => setPropertyName(event.target.value)}
                    placeholder="Villa 01"
                    required
                  />
                </label>
              </>
            ) : null}
          </form>
        </WorkspaceFormDrawer>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Blocks</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {project.blocks.map((block) => (
              <li key={block.id} className="flex justify-between">
                <span>
                  {block.code} — {block.name}
                </span>
              </li>
            ))}
            {!project.blocks.length ? <li className="text-slate-500">No blocks yet.</li> : null}
          </ul>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Plots</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {project.plots.map((plot) => (
              <li key={plot.id} className="flex justify-between">
                <span>{plot.plotNumber}</span>
                <StatusBadge value={plot.status} />
              </li>
            ))}
            {!project.plots.length ? <li className="text-slate-500">No plots yet.</li> : null}
          </ul>
        </section>
      </div>

      {project.outputAssets.length ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Output properties</h2>
          <ul className="mt-3 space-y-2 text-sm">
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
