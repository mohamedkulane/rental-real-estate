import { describe, expect, it, vi } from 'vitest';
import { BranchAccessMode } from '@prisma/client';
import { LeasingService } from '../../src/leasing/leasing.service';
import { AuthorizationService } from '../../src/security/authorization.service';
import type { AuthenticatedPrincipal } from '../../src/security/security.types';

describe('leasing search scope', () => {
  it.each([BranchAccessMode.BRANCH, BranchAccessMode.MULTI_BRANCH, BranchAccessMode.COMPANY_WIDE])('retains company and %s authorization when searching', async (accessMode) => {
    const findMany = vi.fn<(input: { where: Record<string, { companyId: string; branchId?: { in: string[] }; leaseNumber?: { contains: string; mode: string } }> }) => Promise<[]>>().mockResolvedValue([]);
    const service = new LeasingService({ leaseRenewal: { findMany }, moveIn: { findMany } } as never, new AuthorizationService(), {} as never, {} as never);
    const branchIds = accessMode === BranchAccessMode.BRANCH ? ['branch-a'] : ['branch-a', 'branch-b'];
    const principal: AuthenticatedPrincipal = {
      companyId: 'company-a', userId: 'user', employeeId: 'employee', sessionId: 'session', businessDate: '2026-09-09', accessMode,
      branchIds: new Set(branchIds), roles: [], permissions: new Set(['renewal.read', 'move-in.read']),
      permissionBranchScopes: new Map(['renewal.read', 'move-in.read'].map((permission) => [permission, new Set<string | null>([null])])),
    };
    for (const search of [undefined, 'Lease-001']) {
      await service.listRenewals(principal, { limit: 20, ...(search ? { search } : {}) });
      await service.listMoveIns(principal, { limit: 20, ...(search ? { search } : {}) });
      const calls = findMany.mock.calls.slice(-2);
      for (const [index, args] of calls.entries()) {
        const where = args[0].where[index === 0 ? 'originalLease' : 'lease']!;
        expect(where.companyId).toBe('company-a');
        if (accessMode === BranchAccessMode.COMPANY_WIDE) expect(where.branchId).toBeUndefined();
        else expect(where.branchId).toEqual({ in: branchIds });
        if (search) expect(where.leaseNumber).toEqual({ contains: search, mode: 'insensitive' });
      }
    }
  });
});
