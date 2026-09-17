'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from '@/lib/toast';
import { FormSkeleton } from '@/components/shared/loading-system';
import { ErrorState, FormSection, PageHeader, StatusBadge } from '@/components/shared/ui';
import { api, hasPermission, userFacingError } from '@/lib/phase3-api';
import { formatDate } from '@/lib/presentation';
import {
  BranchSelect,
  FinanceFormPanel,
  FinanceReferencePicker,
  FinanceTextField,
  financeNested,
  financeScalar,
  financeText,
  type FinanceRow,
} from './finance-forms';
import { FinanceAccessDenied } from './finance-shared';
import { FinanceShell, useFinancePrincipal } from './finance-shell';

type JournalLineDraft = {
  accountId: string;
  accountLabel: string;
  debit: string;
  credit: string;
  memo: string;
};

function signedAmount(debit: string, credit: string) {
  const debitValue = Number(debit || 0);
  const creditValue = Number(credit || 0);
  if (debitValue > 0 && creditValue > 0) return null;
  if (debitValue > 0) return debitValue.toFixed(2);
  if (creditValue > 0) return (-creditValue).toFixed(2);
  return '0';
}

export function JournalCreateWorkspace() {
  const router = useRouter();
  const { principal, error: principalError } = useFinancePrincipal();
  const allowed = Boolean(principal && hasPermission(principal, 'journal.manage'));
  const [branchId, setBranchId] = useState('');
  const [businessDate, setBusinessDate] = useState(new Date().toISOString().slice(0, 10));
  const [currency, setCurrency] = useState('USD');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<JournalLineDraft[]>([
    { accountId: '', accountLabel: '', debit: '', credit: '', memo: '' },
    { accountId: '', accountLabel: '', debit: '', credit: '', memo: '' },
  ]);

  const totals = useMemo(() => {
    const debits = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
    const credits = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
    return { debits, credits, balanced: debits > 0 && debits === credits };
  }, [lines]);

  const create = useMutation({
    mutationFn: () =>
      api<{ id: string }>('/journals', {
        method: 'POST',
        body: JSON.stringify({
          branchId: branchId || undefined,
          businessDate,
          currency,
          description,
          lines: lines
            .map((line) => ({
              accountId: line.accountId,
              signedAmount: signedAmount(line.debit, line.credit),
            }))
            .filter((line) => line.accountId && line.signedAmount && line.signedAmount !== '0'),
        }),
      }),
    onSuccess: (journal: { id: string }) => {
      toast.success('Journal saved as draft.');
      router.push(`/finance/accounting/${journal.id}`);
    },
    onError: (error) => toast.error(userFacingError(error)),
  });

  return (
    <FinanceShell principal={principal} principalError={principalError} activeItem="finance:accounting">
      <PageHeader
        eyebrow="Finance"
        title="Create Journal"
        description="Balanced manual journal entry. Posted journals remain immutable."
        action={
          <Link className="button secondary" href="/finance/accounting">
            Back to accounting
          </Link>
        }
      />
      {principal && !allowed ? (
        <FinanceAccessDenied description="Journal creation requires journal.manage permission." />
      ) : (
        <FinanceFormPanel
          title="Journal entry"
          description="Each line needs one account and either a debit or a credit. Totals must balance before saving."
          submitLabel={totals.balanced ? 'Save draft' : 'Debits must equal credits'}
          busy={create.isPending}
          disabled={!totals.balanced || !description.trim() || lines.filter((line) => line.accountId).length < 2}
          onSubmit={() => {
            if (!totals.balanced) {
              toast.error('Journal is not balanced.');
              return;
            }
            create.mutate();
          }}
        >
          {principal ? (
            <BranchSelect branches={principal.branches} value={branchId} onChange={setBranchId} />
          ) : null}
          <FinanceTextField
            label="Business date"
            type="date"
            value={businessDate}
            onChange={setBusinessDate}
            required
          />
          <FinanceTextField
            label="Currency"
            value={currency}
            onChange={(value) => setCurrency(value.toUpperCase())}
            maxLength={3}
            required
          />
          <FinanceTextField
            label="Description"
            value={description}
            onChange={setDescription}
            required
            wide
          />
          <div className="full space-y-3">
            {lines.map((line, index) => (
              <div key={index} className="grid gap-3 rounded-lg border border-slate-200 p-4 md:grid-cols-4">
                <FinanceReferencePicker
                  label={`Account ${index + 1}`}
                  path="/finance/selectors/accounts"
                  value={line.accountId}
                  onChange={(record) =>
                    setLines((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index
                          ? {
                              ...row,
                              accountId: record?.id ?? '',
                              accountLabel: record?.label ?? '',
                            }
                          : row,
                      ),
                    )
                  }
                />
                <FinanceTextField
                  label="Debit"
                  type="number"
                  min={0}
                  step="0.01"
                  value={line.debit}
                  onChange={(value) =>
                    setLines((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, debit: value, credit: '' } : row,
                      ),
                    )
                  }
                />
                <FinanceTextField
                  label="Credit"
                  type="number"
                  min={0}
                  step="0.01"
                  value={line.credit}
                  onChange={(value) =>
                    setLines((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, credit: value, debit: '' } : row,
                      ),
                    )
                  }
                />
                <FinanceTextField
                  label="Memo"
                  value={line.memo}
                  onChange={(value) =>
                    setLines((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, memo: value } : row,
                      ),
                    )
                  }
                />
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-4 text-[14px]">
              <span>Total debits: {totals.debits.toFixed(2)}</span>
              <span>Total credits: {totals.credits.toFixed(2)}</span>
              <span className={totals.balanced ? 'text-emerald-700' : 'text-red-700'}>
                {totals.balanced ? 'Balanced' : 'Not balanced'}
              </span>
              <button
                type="button"
                className="button secondary"
                onClick={() =>
                  setLines((current) => [
                    ...current,
                    { accountId: '', accountLabel: '', debit: '', credit: '', memo: '' },
                  ])
                }
              >
                Add line
              </button>
            </div>
          </div>
        </FinanceFormPanel>
      )}
    </FinanceShell>
  );
}

export function JournalDetailWorkspace() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { principal, error: principalError } = useFinancePrincipal();
  const canRead = Boolean(principal && hasPermission(principal, 'journal.read'));
  const canManage = Boolean(principal && hasPermission(principal, 'journal.manage'));
  const [reason, setReason] = useState('');

  const query = useQuery({
    queryKey: ['journal', params.id],
    enabled: canRead && Boolean(params.id),
    queryFn: () => api<FinanceRow>(`/journals/${params.id}`),
  });

  const post = useMutation({
    mutationFn: () => api(`/journals/${params.id}/post`, { method: 'POST', body: '{}' }),
    onSuccess: () => {
      toast.success('Journal posted.');
      void queryClient.invalidateQueries({ queryKey: ['journal', params.id] });
    },
    onError: (error) => toast.error(userFacingError(error)),
  });

  const reverse = useMutation({
    mutationFn: () =>
      api(`/journals/${params.id}/reverse`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      toast.success('Reversal journal created.');
      void queryClient.invalidateQueries({ queryKey: ['journal', params.id] });
    },
    onError: (error) => toast.error(userFacingError(error)),
  });

  const lines = (query.data?.lines as Array<Record<string, unknown>> | undefined) ?? [];
  const debits = lines.reduce((sum, line) => {
    const amount = Number(financeScalar(line.signedAmount) || 0);
    return amount > 0 ? sum + amount : sum;
  }, 0);
  const credits = lines.reduce((sum, line) => {
    const amount = Number(financeScalar(line.signedAmount) || 0);
    return amount < 0 ? sum + Math.abs(amount) : sum;
  }, 0);
  const status = financeText(query.data?.status);

  return (
    <FinanceShell principal={principal} principalError={principalError} activeItem="finance:accounting">
      <PageHeader
        eyebrow="Finance"
        title={financeText(query.data?.journalNumber) || 'Journal'}
        description="Draft, post, and reverse operational journal entries."
        action={
          <Link className="button secondary" href="/finance/accounting">
            Back to accounting
          </Link>
        }
      />
      {principal && !canRead ? (
        <FinanceAccessDenied />
      ) : query.isLoading ? (
        <FormSkeleton />
      ) : query.isError ? (
        <ErrorState message={userFacingError(query.error)} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <FormSection title="Journal entry">
            <div className="mb-4 flex items-center justify-between gap-3">
              <StatusBadge value={status} />
              <span className="text-[13px] text-slate-500">{formatDate(query.data?.businessDate)}</span>
            </div>
            <p className="mb-4 text-[14px] text-slate-800">{financeText(query.data?.description)}</p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-left text-[14px]">
                <thead className="bg-slate-50 text-[12px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Account</th>
                    <th className="px-4 py-2">Debit</th>
                    <th className="px-4 py-2">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    const amount = Number(financeScalar(line.signedAmount) || 0);
                    return (
                      <tr key={financeText(line.id)} className="border-t border-slate-100">
                        <td className="px-4 py-2">
                          {financeText(financeNested(line, 'account', 'code'))}{' '}
                          {financeText(financeNested(line, 'account', 'name'))}
                        </td>
                        <td className="px-4 py-2">{amount > 0 ? amount.toFixed(2) : '—'}</td>
                        <td className="px-4 py-2">{amount < 0 ? Math.abs(amount).toFixed(2) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[13px] text-slate-600">
              Total debits {debits.toFixed(2)} · Total credits {credits.toFixed(2)}
            </p>
          </FormSection>
          {canManage ? (
            <aside className="space-y-4">
              {status === 'DRAFT' ? (
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-[14px] font-semibold text-slate-900">Post journal</h2>
                  <button
                    className="button primary mt-4 w-full"
                    type="button"
                    disabled={post.isPending || debits !== credits}
                    onClick={() => post.mutate()}
                  >
                    {post.isPending ? 'Posting…' : 'Post journal'}
                  </button>
                </section>
              ) : null}
              {status === 'POSTED' ? (
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-[14px] font-semibold text-slate-900">Reverse journal</h2>
                  <textarea
                    className="mt-3 min-h-[80px] w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px]"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Reversal reason"
                  />
                  <button
                    className="button secondary mt-4 w-full"
                    type="button"
                    disabled={reverse.isPending || reason.trim().length < 3}
                    onClick={() => reverse.mutate()}
                  >
                    {reverse.isPending ? 'Reversing…' : 'Create reversal entry'}
                  </button>
                </section>
              ) : null}
            </aside>
          ) : null}
        </div>
      )}
    </FinanceShell>
  );
}
