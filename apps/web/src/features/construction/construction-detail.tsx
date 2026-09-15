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
  economicModel: string;
  clientPartyId?: string | null;
  contracts: Array<{ id: string; contractNumber: string; status: string; contractValue: string }>;
  milestones: Array<{ id: string; title: string; status: string; sequence: number }>;
  workPackages: Array<{ id: string; title: string; status: string }>;
  budgetLines: Array<{ id: string; category: string; budgetAmount: string; actualAmount: string }>;
  billingEvents: Array<{ id: string; amount: string; status: string }>;
};

export function ConstructionDetail({ projectId }: { projectId: string }) {
  const router = useRouter();
  const ready = useClientReady();
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [project, setProject] = useState<Detail | null>(null);
  const [error, setError] = useState('');

  async function reload() {
    const data = await api<Detail>(`/construction/projects/${projectId}`);
    setProject(data);
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

  const contract = project.contracts[0];
  const canManage = hasPermission(principal, 'construction.manage');
  const invoicedTotal = project.billingEvents.reduce(
    (sum, event) => sum + Number.parseFloat(event.amount || '0'),
    0,
  );
  const contractValue = Number.parseFloat(contract?.contractValue || '0');
  const remainingBillable = Math.max(contractValue - invoicedTotal, 0);
  const costTotal = project.budgetLines.reduce(
    (sum, line) => sum + Number.parseFloat(line.actualAmount || '0'),
    0,
  );

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
        eyebrow="Client construction"
        title={`${project.projectNumber} — ${project.name}`}
        description="Contract, milestones, work packages, costs, and client billing."
        action={<StatusBadge value={project.status} />}
      />
      {error ? <ErrorState message={error} /> : null}

      {contract ? (
        <section className="mt-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-4">
          <div>
            <p className="text-[12px] font-semibold text-slate-500">Contract value</p>
            <p className="mt-1 text-[18px] font-bold text-slate-900">{contract.contractValue}</p>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-slate-500">Already invoiced</p>
            <p className="mt-1 text-[18px] font-bold text-slate-900">{invoicedTotal.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-slate-500">Remaining billable</p>
            <p className="mt-1 text-[18px] font-bold text-emerald-700">{remainingBillable.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-slate-500">Recorded costs</p>
            <p className="mt-1 text-[18px] font-bold text-slate-900">{costTotal.toFixed(2)}</p>
          </div>
        </section>
      ) : null}

      {canManage && !contract ? (
        <FormSection title="Construction contract">
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void post(
                '/construction/contracts',
                {
                  constructionProjectId: project.id,
                  contractValue: formValue(form, 'contractValue'),
                  paymentTermsSummary: formValue(form, 'paymentTermsSummary'),
                  effectiveDate: formValue(form, 'effectiveDate'),
                  installments: [
                    {
                      label: formValue(form, 'installmentLabel') || 'Installment 1',
                      percent: formValue(form, 'installmentPercent') || '100',
                    },
                  ],
                },
                'Contract created',
              );
            }}
          >
            <label className="grid gap-1 text-sm">
              Contract value
              <input name="contractValue" required className="rounded-lg border border-slate-200 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              Effective date
              <input name="effectiveDate" type="date" required className="rounded-lg border border-slate-200 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              Payment terms
              <input name="paymentTermsSummary" required className="rounded-lg border border-slate-200 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              First installment %
              <input name="installmentPercent" defaultValue="30" className="rounded-lg border border-slate-200 px-3 py-2" />
            </label>
            <input type="hidden" name="installmentLabel" value="Agreed installment" />
            <button className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white" type="submit">
              Save contract
            </button>
          </form>
        </FormSection>
      ) : null}

      {canManage && contract && contract.status === 'DRAFT' ? (
        <button
          className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
          type="button"
          onClick={() =>
            void post(`/construction/contracts/${contract.id}/transition`, { status: 'ACTIVE' }, 'Contract approved')
          }
        >
          Approve contract
        </button>
      ) : null}

      {canManage ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <FormSection title="Milestone">
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void post(
                  '/construction/milestones',
                  { constructionProjectId: project.id, title: formValue(form, 'title') },
                  'Milestone added',
                );
              }}
            >
              <input name="title" required placeholder="Foundation" className="rounded-lg border border-slate-200 px-3 py-2" />
              <button className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white" type="submit">
                Add milestone
              </button>
            </form>
            <ul className="mt-3 space-y-2">
              {project.milestones.map((row) => (
                <li key={row.id} className="flex items-center justify-between text-sm">
                  <span>{row.title}</span>
                  <button
                    type="button"
                    className="font-semibold text-emerald-700"
                    onClick={() =>
                      void post(
                        `/construction/milestones/${row.id}/transition`,
                        { status: 'COMPLETED', percentComplete: '100' },
                        'Milestone completed',
                      )
                    }
                  >
                    Complete
                  </button>
                </li>
              ))}
            </ul>
          </FormSection>
          <FormSection title="Work package">
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void post(
                  '/construction/work-packages',
                  { constructionProjectId: project.id, title: formValue(form, 'title') },
                  'Work package added',
                );
              }}
            >
              <input name="title" required placeholder="Site preparation" className="rounded-lg border border-slate-200 px-3 py-2" />
              <button className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white" type="submit">
                Add work package
              </button>
            </form>
          </FormSection>
          <FormSection title="Project cost">
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void post(
                  '/construction/costs',
                  {
                    constructionProjectId: project.id,
                    category: 'MATERIALS',
                    amount: formValue(form, 'amount'),
                    businessDate: new Date().toISOString().slice(0, 10),
                  },
                  'Cost recorded',
                );
              }}
            >
              <input name="amount" required placeholder="Amount" className="rounded-lg border border-slate-200 px-3 py-2" />
              <button className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white" type="submit">
                Post cost
              </button>
            </form>
          </FormSection>
          {contract ? (
            <FormSection title="Client billing">
              <p className="mb-3 text-[13px] text-slate-600">
                Billing ceiling: {remainingBillable.toFixed(2)} remaining of {contract.contractValue} contract value.
              </p>
              <form
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void post(
                    '/construction/billing',
                    {
                      constructionProjectId: project.id,
                      contractId: contract.id,
                      basis: 'MANUAL',
                      amount: formValue(form, 'amount'),
                      dueDate: formValue(form, 'dueDate'),
                    },
                    'Client invoice issued',
                  );
                }}
              >
                <input name="amount" required placeholder="Invoice amount" className="rounded-lg border border-slate-200 px-3 py-2" />
                <input name="dueDate" type="date" required className="rounded-lg border border-slate-200 px-3 py-2" />
                <button className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white" type="submit">
                  Issue invoice
                </button>
              </form>
            </FormSection>
          ) : null}
        </div>
      ) : null}

      {canManage && project.status === 'ACTIVE' ? (
        <button
          className="mt-6 rounded-lg border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800"
          type="button"
          onClick={() => void post(`/construction/projects/${project.id}/handover`, {}, 'Handover completed')}
        >
          Complete and handover
        </button>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Milestones</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {project.milestones.map((row) => (
              <li key={row.id} className="flex justify-between">
                <span>{row.title}</span>
                <StatusBadge value={row.status} />
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Budget & costs</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {project.budgetLines.map((row) => (
              <li key={row.id} className="flex justify-between">
                <span>{row.category}</span>
                <span>
                  {row.actualAmount} / {row.budgetAmount}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {canManage && project.status === 'PLANNING' ? (
        <button
          className="mt-6 ml-3 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
          type="button"
          onClick={() =>
            void post(`/construction/projects/${project.id}/transition`, { status: 'ACTIVE' }, 'Project activated')
          }
        >
          Activate project
        </button>
      ) : null}
    </AppShell>
  );
}
