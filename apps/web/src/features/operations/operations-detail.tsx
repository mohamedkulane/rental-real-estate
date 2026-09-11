'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FormSkeleton } from '@/components/shared/loading-system';
import { ErrorState, FormSection, PageHeader, StatusBadge } from '@/components/shared/ui';
import { EntityDocuments } from '@/features/portfolio/entity-documents';
import { api, hasPermission, userFacingError } from '@/lib/phase3-api';
import { formatDate, humanize } from '@/lib/presentation';
import { OperationsShell, useOperationsPrincipal } from './operations-shell';

type OperationsDetailMode = 'maintenance' | 'work-orders' | 'inspections' | 'vendors';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-[14px] font-medium text-slate-900">{value}</p>
    </div>
  );
}

const endpoints: Record<OperationsDetailMode, (id: string) => string> = {
  maintenance: (id) => `/maintenance-requests/${id}`,
  'work-orders': (id) => `/work-orders/${id}`,
  inspections: (id) => `/inspections/${id}`,
  vendors: (id) => `/vendors/${id}`,
};

const titles: Record<OperationsDetailMode, string> = {
  maintenance: 'Maintenance Detail',
  'work-orders': 'Work Order Detail',
  inspections: 'Inspection Detail',
  vendors: 'Vendor Detail',
};

const back: Record<OperationsDetailMode, string> = {
  maintenance: '/operations/maintenance',
  'work-orders': '/operations/work-orders',
  inspections: '/operations/inspections',
  vendors: '/operations/vendors',
};

const activeItems: Record<OperationsDetailMode, string> = {
  maintenance: 'operations:maintenance',
  'work-orders': 'operations:work-orders',
  inspections: 'operations:inspections',
  vendors: 'operations:vendors',
};

export function OperationsDetail({ mode }: { mode: OperationsDetailMode }) {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { principal } = useOperationsPrincipal();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['operations-detail', mode, id],
    enabled: Boolean(id && principal),
    queryFn: () => api<Record<string, unknown>>(endpoints[mode](id)),
  });
  const history = useQuery({
    queryKey: ['condition-history', query.data?.propertyId],
    enabled: typeof query.data?.propertyId === 'string',
    queryFn: () =>
      api<{ events: Array<{ kind: string; number: string; status: string; title: string; occurredAt: string }> }>(
        `/operations/properties/${String(query.data?.propertyId)}/condition-history`,
      ),
  });

  const nested = (...keys: string[]) =>
    keys.reduce<unknown>(
      (value, key) =>
        value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined,
      query.data ?? {},
    );
  const text = (value: unknown) => (typeof value === 'string' ? value : 'Not set');

  const transition = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api(`${endpoints[mode](id)}/transition`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Status updated.');
      void queryClient.invalidateQueries({ queryKey: ['operations-detail', mode, id] });
    },
    onError: (cause) => toast.error(userFacingError(cause)),
  });

  return (
    <OperationsShell principal={principal} activeItem={activeItems[mode]}>
      <PageHeader
        eyebrow="Operations"
        title={text(query.data?.requestNumber ?? query.data?.workOrderNumber ?? query.data?.inspectionNumber) || titles[mode]}
        description={titles[mode]}
        action={
          <Link className="button secondary" href={back[mode]}>
            Back
          </Link>
        }
      />
      {query.isLoading ? (
        <FormSkeleton />
      ) : query.isError ? (
        <ErrorState message={userFacingError(query.error)} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <FormSection title="Summary">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Status</p>
                <div className="mt-1">
                  <StatusBadge value={text(query.data?.status)} />
                </div>
              </div>
              <Field label="Property" value={text(nested('property', 'name'))} />
              {mode === 'maintenance' ? <Field label="Title" value={text(query.data?.title)} /> : null}
              {mode === 'maintenance' ? <Field label="Priority" value={humanize(text(query.data?.priority))} /> : null}
              {mode === 'work-orders' ? (
                <Field label="Approval" value={humanize(text(query.data?.approvalStatus))} />
              ) : null}
              {mode === 'inspections' ? <Field label="Type" value={humanize(text(query.data?.type))} /> : null}
              {mode === 'vendors' ? <Field label="Name" value={text(nested('party', 'displayName'))} /> : null}
              <Field
                label="Reported / scheduled"
                value={formatDate(query.data?.reportedAt ?? query.data?.scheduledAt ?? query.data?.createdAt)}
              />
            </div>
            {mode === 'maintenance' && principal && hasPermission(principal, 'maintenance.manage') ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {['TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((status) => (
                  <button
                    key={status}
                    className="button secondary"
                    type="button"
                    onClick={() => transition.mutate({ status })}
                  >
                    {humanize(status)}
                  </button>
                ))}
                {hasPermission(principal, 'work-order.manage') ? (
                  <CreateWorkOrderFromRequest requestId={id} propertyId={text(query.data?.propertyId)} branchId={text(query.data?.branchId)} />
                ) : null}
              </div>
            ) : null}
            {mode === 'work-orders' && principal && hasPermission(principal, 'work-order.manage') ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {['SCHEDULED', 'IN_PROGRESS', 'COMPLETED'].map((status) => (
                  <button
                    key={status}
                    className="button secondary"
                    type="button"
                    onClick={() =>
                      transition.mutate({
                        status,
                        actualCost: status === 'COMPLETED' ? '150.00' : undefined,
                        laborNotes: 'Completed on site.',
                      })
                    }
                  >
                    {humanize(status)}
                  </button>
                ))}
                {hasPermission(principal, 'expense.manage') ? (
                  <PostExpenseButton workOrderId={id} />
                ) : null}
              </div>
            ) : null}
            {mode === 'inspections' && principal && hasPermission(principal, 'inspection.manage') ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="button secondary" type="button" onClick={() => transition.mutate({ status: 'IN_PROGRESS' })}>
                  Start
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() =>
                    transition.mutate({
                      status: 'COMPLETED',
                      items: [{ area: 'Kitchen', item: 'Cabinets', condition: 'DAMAGED', severity: 'HIGH' }],
                    })
                  }
                >
                  Complete
                </button>
                {hasPermission(principal, 'defect.manage') ? (
                  <CreateDefectButton
                    inspectionId={id}
                    propertyId={text(query.data?.propertyId)}
                    branchId={text(query.data?.branchId)}
                  />
                ) : null}
              </div>
            ) : null}
          </FormSection>
          {mode !== 'vendors' ? (
            <FormSection title="Property condition history">
              <ul className="space-y-2 text-sm">
                {(history.data?.events ?? []).slice(0, 12).map((event) => (
                  <li key={`${event.kind}-${event.number}`}>
                    {humanize(event.kind)} {event.number}: {event.title} ({humanize(event.status)})
                  </li>
                ))}
              </ul>
            </FormSection>
          ) : null}
          {principal ? (
            <EntityDocuments
              entityType={
                mode === 'maintenance'
                  ? 'MaintenanceRequest'
                  : mode === 'work-orders'
                    ? 'WorkOrder'
                    : mode === 'inspections'
                      ? 'Inspection'
                      : 'Vendor'
              }
              entityId={id}
              canManage={hasPermission(principal, 'portfolio.document.manage')}
            />
          ) : null}
        </div>
      )}
    </OperationsShell>
  );
}

function CreateWorkOrderFromRequest({
  requestId,
  propertyId,
  branchId,
}: {
  requestId: string;
  propertyId: string;
  branchId: string;
}) {
  const mutation = useMutation({
    mutationFn: () =>
      api('/work-orders', {
        method: 'POST',
        body: JSON.stringify({
          branchId,
          maintenanceRequestId: requestId,
          propertyId,
          currency: 'USD',
        }),
      }),
    onSuccess: () => toast.success('Work order created.'),
    onError: (cause) => toast.error(userFacingError(cause)),
  });
  return (
    <button className="button" type="button" onClick={() => mutation.mutate()}>
      Create work order
    </button>
  );
}

function PostExpenseButton({ workOrderId }: { workOrderId: string }) {
  const mutation = useMutation({
    mutationFn: () => api(`/work-orders/${workOrderId}/expense`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => toast.success('Maintenance expense recorded.'),
    onError: (cause) => toast.error(userFacingError(cause)),
  });
  return (
    <button className="button" type="button" onClick={() => mutation.mutate()}>
      Post expense
    </button>
  );
}

function CreateDefectButton({
  inspectionId,
  propertyId,
  branchId,
}: {
  inspectionId: string;
  propertyId: string;
  branchId: string;
}) {
  const mutation = useMutation({
    mutationFn: async () => {
      const defect = await api<{ id: string }>('/defects', {
        method: 'POST',
        body: JSON.stringify({
          branchId,
          propertyId,
          inspectionId,
          title: 'Inspection finding',
          description: 'Created from inspection.',
          severity: 'HIGH',
        }),
      });
      await api(`/defects/${defect.id}/maintenance-request`, {
        method: 'POST',
        body: JSON.stringify({
          title: 'Follow-up from inspection',
          description: 'Defect converted to a maintenance request.',
          categoryCode: 'INSPECTION',
          priority: 'HIGH',
        }),
      });
    },
    onSuccess: () => toast.success('Defect and maintenance request created.'),
    onError: (cause) => toast.error(userFacingError(cause)),
  });
  return (
    <button className="button" type="button" onClick={() => mutation.mutate()}>
      Create defect follow-up
    </button>
  );
}
