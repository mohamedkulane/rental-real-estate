import { BranchAccessMode, ExpenseStatus, WorkOrderApprovalStatus, WorkOrderStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import { OperationsService } from './operations.service';

function principal(overrides: Partial<AuthenticatedPrincipal> = {}): AuthenticatedPrincipal {
  return {
    userId: 'user',
    sessionId: 'session',
    employeeId: 'employee',
    companyId: 'company-a',
    businessDate: '2026-09-11',
    accessMode: BranchAccessMode.COMPANY_WIDE,
    roles: [],
    permissions: new Set(['expense.manage', 'work-order.read']),
    permissionBranchScopes: new Map([
      ['expense.manage', new Set([null])],
      ['work-order.read', new Set([null])],
    ]),
    branchIds: new Set(['branch-a']),
    ...overrides,
  };
}

describe('operations expense idempotency', () => {
  const db = {
    workOrder: { findFirst: vi.fn() },
    expense: { findFirst: vi.fn(), create: vi.fn() },
    maintenanceRequest: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  };
  const audit = { write: vi.fn() };
  const service = new OperationsService(db as never, new AuthorizationService(), audit as never);

  beforeEach(() => {
    vi.clearAllMocks();
    db.workOrder.findFirst.mockResolvedValue({
      id: 'wo-1',
      companyId: 'company-a',
      branchId: 'branch-a',
      workOrderNumber: 'WO-000001',
      status: WorkOrderStatus.COMPLETED,
      approvalStatus: WorkOrderApprovalStatus.APPROVED,
      actualCost: new Prisma.Decimal('150'),
      currency: 'USD',
      vendorPartyId: null,
      propertyId: 'prop-1',
      rentableSpaceId: null,
      maintenanceRequestId: null,
      completedAt: new Date('2026-09-11'),
    });
  });

  it('returns the existing expense instead of creating a duplicate', async () => {
    const existing = { id: 'exp-1', companyId: 'company-a', expenseNumber: 'EXP-1', status: ExpenseStatus.APPROVED };
    db.expense.findFirst.mockResolvedValue(existing);
    const result = await service.createWorkOrderExpense(principal(), 'wo-1');
    expect(result).toEqual(existing);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a foreign-company idempotency collision', async () => {
    db.expense.findFirst.mockResolvedValue({ id: 'exp-1', companyId: 'other' });
    await expect(service.createWorkOrderExpense(principal(), 'wo-1')).rejects.toThrow(
      /already in use/u,
    );
  });
});
