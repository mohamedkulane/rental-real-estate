import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../../src/database/database.service';
import type { AuditService } from '../../src/governance/audit.service';
import { GovernanceService } from '../../src/governance/governance.service';
import type { AuthorizationService } from '../../src/security/authorization.service';
import type { AuthenticatedPrincipal } from '../../src/security/security.types';
import { BranchAccessMode } from '@prisma/client';

describe('GovernanceService', () => {
  it('rejects maker self-approval before a decision is written', async () => {
    const transaction = {
      approvalStep: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'step',
          requestId: 'request',
          sequence: 1,
          request: {
            branchId: null,
            makerEmployeeId: 'employee',
            actionType: 'TEST',
            policy: { rules: [{ actionType: 'TEST', sequence: 1, makerChecker: true }] },
          },
        }),
      },
      approvalDecision: { create: vi.fn() },
    };
    const database = {
      $transaction: vi.fn((work: (tx: typeof transaction) => unknown) =>
        Promise.resolve(work(transaction)),
      ),
    } as unknown as DatabaseService;
    const authorization = { assertCompanyPermission: vi.fn() } as unknown as AuthorizationService;
    const service = new GovernanceService(database, {} as AuditService, authorization);
    const principal = {
      userId: 'user',
      sessionId: 'session',
      employeeId: 'employee',
      companyId: 'company',
      accessMode: BranchAccessMode.COMPANY_WIDE,
      permissions: new Set(),
      permissionBranchScopes: new Map(),
      branchIds: new Set(),
    } satisfies AuthenticatedPrincipal;
    await expect(service.decide(principal, 'step', { outcome: 'APPROVED' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(transaction.approvalDecision.create).not.toHaveBeenCalled();
  });
});
