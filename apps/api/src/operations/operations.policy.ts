import { ConflictException } from '@nestjs/common';
import {
  DefectStatus,
  InspectionStatus,
  MaintenanceRequestStatus,
  WorkOrderApprovalStatus,
  WorkOrderStatus,
} from '@prisma/client';

export const maintenanceRequestTransitions: Record<
  MaintenanceRequestStatus,
  readonly MaintenanceRequestStatus[]
> = {
  NEW: [MaintenanceRequestStatus.TRIAGED, MaintenanceRequestStatus.ASSIGNED, MaintenanceRequestStatus.CANCELLED],
  TRIAGED: [MaintenanceRequestStatus.ASSIGNED, MaintenanceRequestStatus.ON_HOLD, MaintenanceRequestStatus.CANCELLED],
  ASSIGNED: [MaintenanceRequestStatus.IN_PROGRESS, MaintenanceRequestStatus.ON_HOLD, MaintenanceRequestStatus.CANCELLED],
  IN_PROGRESS: [MaintenanceRequestStatus.ON_HOLD, MaintenanceRequestStatus.COMPLETED, MaintenanceRequestStatus.CANCELLED],
  ON_HOLD: [MaintenanceRequestStatus.ASSIGNED, MaintenanceRequestStatus.IN_PROGRESS, MaintenanceRequestStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

export const workOrderTransitions: Record<WorkOrderStatus, readonly WorkOrderStatus[]> = {
  DRAFT: [WorkOrderStatus.SCHEDULED, WorkOrderStatus.CANCELLED],
  SCHEDULED: [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.ON_HOLD, WorkOrderStatus.CANCELLED],
  IN_PROGRESS: [WorkOrderStatus.ON_HOLD, WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELLED],
  ON_HOLD: [WorkOrderStatus.SCHEDULED, WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

export const inspectionTransitions: Record<InspectionStatus, readonly InspectionStatus[]> = {
  SCHEDULED: [InspectionStatus.IN_PROGRESS, InspectionStatus.CANCELLED],
  IN_PROGRESS: [InspectionStatus.COMPLETED, InspectionStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

export const defectTransitions: Record<DefectStatus, readonly DefectStatus[]> = {
  OPEN: [DefectStatus.IN_PROGRESS, DefectStatus.RESOLVED, DefectStatus.CLOSED],
  IN_PROGRESS: [DefectStatus.RESOLVED, DefectStatus.CLOSED],
  RESOLVED: [DefectStatus.CLOSED],
  CLOSED: [],
};

export function assertLifecycleTransition<T extends string>(
  allowed: Record<T, readonly T[]>,
  from: T,
  to: T,
  label: string,
): void {
  if (!allowed[from].includes(to)) {
    throw new ConflictException(`${label} cannot transition from ${from} to ${to}.`);
  }
}

export function workOrderExpenseIdempotencyKey(workOrderId: string): string {
  return `work-order-expense:${workOrderId}`;
}

export function canPostWorkOrderExpense(input: {
  status: WorkOrderStatus;
  approvalStatus: WorkOrderApprovalStatus;
}): boolean {
  return (
    input.status === WorkOrderStatus.COMPLETED &&
    (input.approvalStatus === WorkOrderApprovalStatus.APPROVED ||
      input.approvalStatus === WorkOrderApprovalStatus.NOT_REQUIRED)
  );
}
