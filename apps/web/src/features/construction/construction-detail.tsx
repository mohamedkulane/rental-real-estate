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
  economicModel: string;
  clientPartyId?: string | null;
  contracts: Array<{ id: string; contractNumber: string; status: string; contractValue: string }>;
  milestones: Array<{ id: string; title: string; status: string; sequence: number }>;
  workPackages: Array<{ id: string; title: string; status: string }>;
  budgetLines: Array<{ id: string; category: string; budgetAmount: string; actualAmount: string }>;
  billingEvents: Array<{ id: string; amount: string; status: string }>;
};

type DrawerKind = 'contract' | 'milestone' | 'workPackage' | 'cost' | 'billing' | null;

const drawerCopy: Record<
  Exclude<DrawerKind, null>,
  { title: string; description: string; submitLabel: string; formId: string }
> = {
  contract: {
    title: 'Add construction contract',
    description: 'Capture contract value, payment terms, and the first installment.',
    submitLabel: 'Save contract',
    formId: 'construction-contract-form',
  },
  milestone: {
    title: 'Add milestone',
    description: 'Track a delivery milestone for this construction project.',
    submitLabel: 'Add milestone',
    formId: 'construction-milestone-form',
  },
  workPackage: {
    title: 'Add work package',
    description: 'Define a work package for site or trade execution.',
    submitLabel: 'Add work package',
    formId: 'construction-work-package-form',
  },
  cost: {
    title: 'Record project cost',
    description: 'Post a materials cost against this construction project.',
    submitLabel: 'Post cost',
    formId: 'construction-cost-form',
  },
  billing: {
    title: 'Issue client invoice',
    description: 'Bill the client within the remaining contract value.',
    submitLabel: 'Issue invoice',
    formId: 'construction-billing-form',
  },
};

export function ConstructionDetail({ projectId }: { projectId: string }) {
  const router = useRouter();
  const ready = useClientReady();
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [project, setProject] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [drawer, setDrawer] = useState<DrawerKind>(null);
  const [submitting, setSubmitting] = useState(false);

  const [contractValue, setContractValue] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [installmentPercent, setInstallmentPercent] = useState('30');
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [workPackageTitle, setWorkPackageTitle] = useState('');
  const [costAmount, setCostAmount] = useState('');
  const [billingAmount, setBillingAmount] = useState('');
  const [billingDueDate, setBillingDueDate] = useState('');

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

  useEffect(() => {
    if (!drawer) return;
    setContractValue('');
    setEffectiveDate('');
    setPaymentTerms('');
    setInstallmentPercent('30');
    setMilestoneTitle('');
    setWorkPackageTitle('');
    setCostAmount('');
    setBillingAmount('');
    setBillingDueDate('');
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
    const contract = project.contracts[0];
    setSubmitting(true);
    try {
      let ok = false;
      if (drawer === 'contract') {
        ok = await post(
          '/construction/contracts',
          {
            constructionProjectId: project.id,
            contractValue: contractValue.trim(),
            paymentTermsSummary: paymentTerms.trim(),
            effectiveDate,
            installments: [{ label: 'Agreed installment', percent: installmentPercent || '100' }],
          },
          'Contract created',
        );
      } else if (drawer === 'milestone') {
        ok = await post(
          '/construction/milestones',
          { constructionProjectId: project.id, title: milestoneTitle.trim() },
          'Milestone added',
        );
      } else if (drawer === 'workPackage') {
        ok = await post(
          '/construction/work-packages',
          { constructionProjectId: project.id, title: workPackageTitle.trim() },
          'Work package added',
        );
      } else if (drawer === 'cost') {
        ok = await post(
          '/construction/costs',
          {
            constructionProjectId: project.id,
            category: 'MATERIALS',
            amount: costAmount.trim(),
            businessDate: new Date().toISOString().slice(0, 10),
          },
          'Cost recorded',
        );
      } else if (drawer === 'billing' && contract) {
        ok = await post(
          '/construction/billing',
          {
            constructionProjectId: project.id,
            contractId: contract.id,
            basis: 'MANUAL',
            amount: billingAmount.trim(),
            dueDate: billingDueDate,
          },
          'Client invoice issued',
        );
      }
      if (ok) setDrawer(null);
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready || !principal || !project) return <PageSkeleton />;

  const contract = project.contracts[0];
  const canManage = hasPermission(principal, 'construction.manage');
  const invoicedTotal = project.billingEvents.reduce(
    (sum, event) => sum + Number.parseFloat(event.amount || '0'),
    0,
  );
  const contractValueNum = Number.parseFloat(contract?.contractValue || '0');
  const remainingBillable = Math.max(contractValueNum - invoicedTotal, 0);
  const costTotal = project.budgetLines.reduce(
    (sum, line) => sum + Number.parseFloat(line.actualAmount || '0'),
    0,
  );

  const copy = drawer ? drawerCopy[drawer] : null;
  const drawerReady =
    drawer === 'contract'
      ? Boolean(contractValue.trim() && effectiveDate && paymentTerms.trim())
      : drawer === 'milestone'
        ? Boolean(milestoneTitle.trim())
        : drawer === 'workPackage'
          ? Boolean(workPackageTitle.trim())
          : drawer === 'cost'
            ? Boolean(costAmount.trim())
            : drawer === 'billing'
              ? Boolean(billingAmount.trim() && billingDueDate)
              : false;

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
      ) : canManage ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5">
          <p className="text-sm font-semibold text-slate-900">No construction contract yet</p>
          <p className="mt-1 text-sm text-slate-600">Add a contract before billing the client.</p>
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
            onClick={() => setDrawer('contract')}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add contract
          </button>
        </div>
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
        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" className="button secondary" onClick={() => setDrawer('milestone')}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add milestone
          </button>
          <button type="button" className="button secondary" onClick={() => setDrawer('workPackage')}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add work package
          </button>
          <button type="button" className="button secondary" onClick={() => setDrawer('cost')}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Record cost
          </button>
          {contract ? (
            <button type="button" className="button secondary" onClick={() => setDrawer('billing')}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Issue invoice
            </button>
          ) : null}
        </div>
      ) : null}

      {canManage && copy ? (
        <WorkspaceFormDrawer
          open={Boolean(drawer)}
          eyebrow="Client construction"
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
            {drawer === 'contract' ? (
              <>
                <label className="block">
                  <span className="mb-1 block text-[12px] font-semibold text-slate-500">Contract value</span>
                  <input
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px]"
                    value={contractValue}
                    onChange={(event) => setContractValue(event.target.value)}
                    required
                    autoFocus
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[12px] font-semibold text-slate-500">Effective date</span>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px]"
                    value={effectiveDate}
                    onChange={(event) => setEffectiveDate(event.target.value)}
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[12px] font-semibold text-slate-500">Payment terms</span>
                  <input
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px]"
                    value={paymentTerms}
                    onChange={(event) => setPaymentTerms(event.target.value)}
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[12px] font-semibold text-slate-500">First installment %</span>
                  <input
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px]"
                    value={installmentPercent}
                    onChange={(event) => setInstallmentPercent(event.target.value)}
                  />
                </label>
              </>
            ) : null}
            {drawer === 'milestone' ? (
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-slate-500">Title</span>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px]"
                  value={milestoneTitle}
                  onChange={(event) => setMilestoneTitle(event.target.value)}
                  placeholder="Foundation"
                  required
                  autoFocus
                />
              </label>
            ) : null}
            {drawer === 'workPackage' ? (
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-slate-500">Title</span>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px]"
                  value={workPackageTitle}
                  onChange={(event) => setWorkPackageTitle(event.target.value)}
                  placeholder="Site preparation"
                  required
                  autoFocus
                />
              </label>
            ) : null}
            {drawer === 'cost' ? (
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-slate-500">Amount</span>
                <input
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px]"
                  value={costAmount}
                  onChange={(event) => setCostAmount(event.target.value)}
                  required
                  autoFocus
                />
              </label>
            ) : null}
            {drawer === 'billing' ? (
              <>
                <p className="text-[13px] text-slate-600">
                  Billing ceiling: {remainingBillable.toFixed(2)} remaining of {contract?.contractValue} contract
                  value.
                </p>
                <label className="block">
                  <span className="mb-1 block text-[12px] font-semibold text-slate-500">Invoice amount</span>
                  <input
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px]"
                    value={billingAmount}
                    onChange={(event) => setBillingAmount(event.target.value)}
                    required
                    autoFocus
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[12px] font-semibold text-slate-500">Due date</span>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px]"
                    value={billingDueDate}
                    onChange={(event) => setBillingDueDate(event.target.value)}
                    required
                  />
                </label>
              </>
            ) : null}
          </form>
        </WorkspaceFormDrawer>
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
              <li key={row.id} className="flex items-center justify-between gap-3">
                <span>{row.title}</span>
                <div className="flex items-center gap-2">
                  <StatusBadge value={row.status} />
                  {canManage && row.status !== 'COMPLETED' ? (
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
                  ) : null}
                </div>
              </li>
            ))}
            {!project.milestones.length ? (
              <li className="text-slate-500">No milestones yet.</li>
            ) : null}
          </ul>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Work packages</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {project.workPackages.map((row) => (
              <li key={row.id} className="flex justify-between">
                <span>{row.title}</span>
                <StatusBadge value={row.status} />
              </li>
            ))}
            {!project.workPackages.length ? (
              <li className="text-slate-500">No work packages yet.</li>
            ) : null}
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
            {!project.budgetLines.length ? (
              <li className="text-slate-500">No budget lines yet.</li>
            ) : null}
          </ul>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Client billing</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {project.billingEvents.map((row) => (
              <li key={row.id} className="flex justify-between">
                <span>{row.amount}</span>
                <StatusBadge value={row.status} />
              </li>
            ))}
            {!project.billingEvents.length ? (
              <li className="text-slate-500">No invoices yet.</li>
            ) : null}
          </ul>
        </section>
      </div>

      {canManage && project.status === 'PLANNING' ? (
        <button
          className="mt-6 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
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
