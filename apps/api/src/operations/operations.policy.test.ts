import {
  InspectionStatus,
  MaintenanceRequestStatus,
  WorkOrderApprovalStatus,
  WorkOrderStatus,
} from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  assertLifecycleTransition,
  canPostWorkOrderExpense,
  maintenanceRequestTransitions,
  workOrderExpenseIdempotencyKey,
  workOrderTransitions,
} from './operations.policy';

describe('operations lifecycle', () => {
  it('allows the specified maintenance statuses and blocks completed reopening', () => {
    expect(maintenanceRequestTransitions[MaintenanceRequestStatus.NEW]).toContain(
      MaintenanceRequestStatus.TRIAGED,
    );
    expect(maintenanceRequestTransitions[MaintenanceRequestStatus.COMPLETED]).toEqual([]);
    expect(() =>
      assertLifecycleTransition(
        maintenanceRequestTransitions,
        MaintenanceRequestStatus.COMPLETED,
        MaintenanceRequestStatus.NEW,
        'Maintenance request',
      ),
    ).toThrow(/cannot transition/u);
  });

  it('keeps completed work orders immutable', () => {
    expect(workOrderTransitions[WorkOrderStatus.COMPLETED]).toEqual([]);
    expect(
      canPostWorkOrderExpense({
        status: WorkOrderStatus.COMPLETED,
        approvalStatus: WorkOrderApprovalStatus.APPROVED,
      }),
    ).toBe(true);
    expect(
      canPostWorkOrderExpense({
        status: WorkOrderStatus.IN_PROGRESS,
        approvalStatus: WorkOrderApprovalStatus.APPROVED,
      }),
    ).toBe(false);
  });

  it('uses a stable work-order expense idempotency key', () => {
    expect(workOrderExpenseIdempotencyKey('wo-1')).toBe('work-order-expense:wo-1');
  });

  it('completes inspections only from in progress', () => {
    expect(() =>
      assertLifecycleTransition(
        {
          SCHEDULED: [InspectionStatus.IN_PROGRESS, InspectionStatus.CANCELLED],
          IN_PROGRESS: [InspectionStatus.COMPLETED, InspectionStatus.CANCELLED],
          COMPLETED: [],
          CANCELLED: [],
        },
        InspectionStatus.SCHEDULED,
        InspectionStatus.COMPLETED,
        'Inspection',
      ),
    ).toThrow(/cannot transition/u);
  });
});
