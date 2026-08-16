import { BranchAccessMode } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { AuthorizationService } from '../../src/security/authorization.service';
import type { AuthenticatedPrincipal } from '../../src/security/security.types';

function principal(overrides: Partial<AuthenticatedPrincipal> = {}): AuthenticatedPrincipal {
  return {
    userId: 'user',
    sessionId: 'session',
    employeeId: 'employee',
    companyId: 'company',
    businessDate: '2026-08-16',
    accessMode: BranchAccessMode.MULTI_BRANCH,
    roles: [],
    permissions: new Set(['organization.branch.read']),
    permissionBranchScopes: new Map([['organization.branch.read', new Set(['branch-a'])]]),
    branchIds: new Set(['branch-a', 'branch-b']),
    ...overrides,
  };
}

describe('AuthorizationService', () => {
  const authorization = new AuthorizationService();

  it('requires both employee scope and permission scope for branch actions', () => {
    const actor = principal();
    expect(authorization.canPerformInBranch(actor, 'organization.branch.read', 'branch-a')).toBe(
      true,
    );
    expect(authorization.canPerformInBranch(actor, 'organization.branch.read', 'branch-b')).toBe(
      false,
    );
    expect(authorization.canPerformInBranch(actor, 'identity.user.read', 'branch-a')).toBe(false);
  });

  it('allows a company-level role grant across explicitly authorized company scope', () => {
    const actor = principal({
      accessMode: BranchAccessMode.COMPANY_WIDE,
      permissionBranchScopes: new Map([['organization.branch.read', new Set([null])]]),
    });
    expect(authorization.canPerformInBranch(actor, 'organization.branch.read', 'any-branch')).toBe(
      true,
    );
  });

  it('does not treat a branch grant as a company-wide grant', () => {
    const actor = principal({
      accessMode: BranchAccessMode.COMPANY_WIDE,
      permissionBranchScopes: new Map([['organization.branch.read', new Set(['branch-a'])]]),
    });
    expect(authorization.canPerformCompanyWide(actor, 'organization.branch.read')).toBe(false);
    expect(authorization.authorizedBranchIds(actor, 'organization.branch.read')).toEqual(
      new Set(['branch-a']),
    );
  });

  it('returns all branches only for an explicit company-wide permission scope', () => {
    const actor = principal({
      accessMode: BranchAccessMode.COMPANY_WIDE,
      permissionBranchScopes: new Map([['organization.branch.read', new Set([null])]]),
    });
    expect(authorization.authorizedBranchIds(actor, 'organization.branch.read')).toBeNull();
  });

  it('requires permission in every related branch before changing a shared record', () => {
    const actor = principal();
    expect(
      authorization.canPerformAcrossBranches(actor, 'organization.branch.read', ['branch-a']),
    ).toBe(true);
    expect(
      authorization.canPerformAcrossBranches(actor, 'organization.branch.read', [
        'branch-a',
        'branch-b',
      ]),
    ).toBe(false);
  });

  it('returns no authorized branches when the capability is absent', () => {
    const actor = principal();
    expect(authorization.authorizedBranchIds(actor, 'identity.user.read')).toEqual(new Set());
  });
});
