'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from '@/lib/toast';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableScroll,
  DataTableSurface,
} from '@/components/shared/data-table';
import { TableSkeleton } from '@/components/shared/loading-system';
import { EmptyState, PageHeader, StatusBadge } from '@/components/shared/ui';
import { api, hasPermission, type CursorPage, userFacingError } from '@/lib/phase3-api';
import { formatDate } from '@/lib/presentation';
import type { PickRecord } from '@/features/workflow/record-picker';
import {
  FinanceFormPanel,
  FinanceRecordSelect,
  FinanceReferencePicker,
  FinanceTextField,
  financeMoney,
  financePickerMap,
  financeText,
} from './finance-forms';
import { FinanceAccessDenied } from './finance-shared';
import { FinanceShell, useFinancePrincipal } from './finance-shell';

type ScheduleRow = Record<string, unknown> & { id: string; status?: string };

export function FinanceBillingSchedules() {
  const { principal, error: principalError } = useFinancePrincipal();
  const queryClient = useQueryClient();
  const allowed = Boolean(principal && hasPermission(principal, 'billing.read'));
  const canManage = Boolean(principal && hasPermission(principal, 'billing.manage'));

  const [engagement, setEngagement] = useState<PickRecord | null>(null);
  const [lease, setLease] = useState<PickRecord | null>(null);
  const [chargeTypeId, setChargeTypeId] = useState('');
  const [billingDayOfMonth, setBillingDayOfMonth] = useState('1');
  const [currency, setCurrency] = useState('USD');
  const [amount, setAmount] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));

  const schedules = useQuery({
    queryKey: ['billing-schedules'],
    enabled: allowed,
    queryFn: () => api<CursorPage<ScheduleRow>>('/billing-schedules?limit=50'),
  });

  const createSchedule = useMutation({
    mutationFn: () =>
      api<{ id: string }>('/billing-schedules', {
        method: 'POST',
        body: JSON.stringify({
          serviceEngagementId: engagement?.id,
          leaseId: lease?.id,
          chargeTypeId,
          billingDayOfMonth: Number(billingDayOfMonth),
          currency,
          amount,
          effectiveFrom,
        }),
      }),
    onSuccess: () => {
      toast.success('Billing schedule created.');
      void queryClient.invalidateQueries({ queryKey: ['billing-schedules'] });
    },
    onError: (error) => toast.error(userFacingError(error)),
  });

  const runBilling = useMutation({
    mutationFn: () =>
      api<{ runDate: string; results?: Array<{ chargeId: string | null; skipped: boolean }> }>(
        '/billing-schedules/run',
        { method: 'POST', body: JSON.stringify({}) },
      ),
    onSuccess: (result) => {
      const created = result.results?.filter((row) => row.chargeId).length ?? 0;
      toast.success(`Billing run complete. ${created} charge(s) generated.`);
      void queryClient.invalidateQueries({ queryKey: ['billing-schedules'] });
    },
    onError: (error) => toast.error(userFacingError(error)),
  });

  useEffect(() => {
    if (lease?.currency) setCurrency(String(lease.currency));
    if (lease?.rentAmount) setAmount(String(lease.rentAmount));
  }, [lease]);

  const engagementPath = useMemo(
    () => '/service-engagements?status=ACTIVE&serviceModel=FULL_MANAGEMENT',
    [],
  );

  return (
    <FinanceShell principal={principal} principalError={principalError} activeItem="finance:billing">
      <PageHeader
        eyebrow="Finance"
        title="Billing Schedules"
        description="Recurring rent billing for Full Management engagements only. Rental Brokerage cannot receive recurring billing."
        action={
          canManage ? (
            <button
              className="button primary"
              type="button"
              disabled={runBilling.isPending}
              onClick={() => runBilling.mutate()}
            >
              {runBilling.isPending ? 'Running…' : 'Run billing now'}
            </button>
          ) : null
        }
      />

      {principal && !allowed ? (
        <FinanceAccessDenied />
      ) : (
        <div className="space-y-6">
          {canManage ? (
            <FinanceFormPanel
              title="Create billing schedule"
              description="Full Management leases only. Rental brokerage cannot receive recurring billing."
              submitLabel="Create schedule"
              busy={createSchedule.isPending}
              disabled={!engagement?.id || !lease?.id || !chargeTypeId || Number(amount) <= 0}
              onSubmit={() => {
                if (!engagement?.id || !lease?.id || !chargeTypeId || Number(amount) <= 0) {
                  toast.error('Choose an engagement, lease, charge type, and amount.');
                  return;
                }
                createSchedule.mutate();
              }}
            >
              <FinanceRecordSelect
                label="Full Management engagement"
                path={engagementPath}
                value={engagement?.id ?? ''}
                map={financePickerMap.engagement}
                onChange={setEngagement}
                required
                emptyHint="No active Full Management engagement. Complete that service workflow before recurring billing."
              />
              <FinanceRecordSelect
                label="Lease"
                path="/leases"
                value={lease?.id ?? ''}
                map={financePickerMap.lease}
                filter={(row) => ['SIGNED', 'ACTIVE'].includes(financeText(row.status))}
                onChange={setLease}
                required
                emptyHint="No signed or active Full Management lease is available. Complete signing and activation in Leasing first."
              />
              <FinanceReferencePicker
                label="Charge type"
                path="/finance/selectors/charge-types"
                value={chargeTypeId}
                onChange={(record) => setChargeTypeId(record?.id ?? '')}
                required
              />
              <FinanceTextField
                label="Billing day of month"
                type="number"
                min={1}
                max={28}
                value={billingDayOfMonth}
                onChange={setBillingDayOfMonth}
                required
              />
              <FinanceTextField
                label="Amount"
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={setAmount}
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
                label="Effective from"
                type="date"
                value={effectiveFrom}
                onChange={setEffectiveFrom}
                required
              />
            </FinanceFormPanel>
          ) : null}

          <DataTableSurface>
            {schedules.isLoading ? (
              <TableSkeleton columns={6} />
            ) : !(schedules.data?.items ?? []).length ? (
              <EmptyState
                title="No billing schedules yet"
                description="Recurring rent schedules appear here after a signed or active Full Management lease is linked."
              />
            ) : (
              <DataTableScroll>
                <DataTable minWidth={920}>
                  <DataTableHead>
                    <tr>
                      <DataTableHeaderCell>Lease</DataTableHeaderCell>
                      <DataTableHeaderCell>Engagement</DataTableHeaderCell>
                      <DataTableHeaderCell>Amount</DataTableHeaderCell>
                      <DataTableHeaderCell>Recurrence</DataTableHeaderCell>
                      <DataTableHeaderCell>Next run</DataTableHeaderCell>
                      <DataTableHeaderCell>Status</DataTableHeaderCell>
                    </tr>
                  </DataTableHead>
                  <DataTableBody>
                    {(schedules.data?.items ?? []).map((row) => (
                      <DataTableRow key={row.id}>
                        <DataTableCell>{financeText((row.lease as { leaseNumber?: string })?.leaseNumber)}</DataTableCell>
                        <DataTableCell>
                          {financeText((row.engagement as { engagementNumber?: string })?.engagementNumber)}
                        </DataTableCell>
                        <DataTableCell>{financeMoney(row.currency, row.amount)}</DataTableCell>
                        <DataTableCell>Monthly (day {financeText(row.billingDayOfMonth)})</DataTableCell>
                        <DataTableCell>{formatDate(row.nextRunOn)}</DataTableCell>
                        <DataTableCell>
                          <StatusBadge value={financeText(row.status) || 'ACTIVE'} />
                        </DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              </DataTableScroll>
            )}
          </DataTableSurface>

          <p className="text-[13px] text-slate-600">
            Generated charges appear in the{' '}
            <Link className="text-emerald-700" href="/finance/charges">
              Charges register
            </Link>
            . Issue them from{' '}
            <Link className="text-emerald-700" href="/finance/invoices/new">
              Create Invoice
            </Link>
            .
          </p>
        </div>
      )}
    </FinanceShell>
  );
}
