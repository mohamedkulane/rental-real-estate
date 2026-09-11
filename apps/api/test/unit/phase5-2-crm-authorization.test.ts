import { BranchAccessMode } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { AuthorizationService } from '../../src/security/authorization.service';
import type { AuthenticatedPrincipal } from '../../src/security/security.types';

const leadRead = 'crm.lead.read';
const leadTransfer = 'crm.lead.branch.transfer';
const sourceManage = 'crm.source.manage';

function principal(overrides: Partial<AuthenticatedPrincipal> = {}): AuthenticatedPrincipal {
  return {
    userId: 'user-a',
    sessionId: 'session-a',
    employeeId: 'employee-a',
    companyId: 'company-a',
    businessDate: '2026-08-25',
    accessMode: BranchAccessMode.MULTI_BRANCH,
    roles: [],
    permissions: new Set([leadRead, leadTransfer]),
    permissionBranchScopes: new Map([
      [leadRead, new Set(['branch-a'])],
      [leadTransfer, new Set(['branch-a', 'branch-b'])],
    ]),
    branchIds: new Set(['branch-a', 'branch-b']),
    ...overrides,
  };
}

describe('Phase 5.2 CRM authorization composition', () => {
  const authorization = new AuthorizationService();

  it('intersects a MULTI_BRANCH employee scope with the exact CRM permission scope', () => {
    const actor = principal();

    expect(authorization.authorizedBranchIds(actor, leadRead)).toEqual(new Set(['branch-a']));
    expect(authorization.canPerformInBranch(actor, leadRead, 'branch-a')).toBe(true);
    expect(authorization.canPerformInBranch(actor, leadRead, 'branch-b')).toBe(false);
    expect(authorization.canPerformInBranch(actor, 'crm.lead.update', 'branch-a')).toBe(false);
  });

  it('requires transfer authority over both source and destination Branches', () => {
    const actor = principal();

    expect(
      authorization.canPerformAcrossBranches(actor, leadTransfer, ['branch-a', 'branch-b']),
    ).toBe(true);
    expect(
      authorization.canPerformAcrossBranches(
        principal({
          permissionBranchScopes: new Map([
            [leadRead, new Set(['branch-a'])],
            [leadTransfer, new Set(['branch-a'])],
          ]),
        }),
        leadTransfer,
        ['branch-a', 'branch-b'],
      ),
    ).toBe(false);
  });

  it('does not turn a company-level role grant into COMPANY_WIDE employee access', () => {
    const actor = principal({
      permissionBranchScopes: new Map([[leadRead, new Set([null])]]),
    });

    expect(authorization.authorizedBranchIds(actor, leadRead)).toEqual(
      new Set(['branch-a', 'branch-b']),
    );
    expect(authorization.canPerformInBranch(actor, leadRead, 'branch-c')).toBe(false);
    expect(authorization.canPerformCompanyWide(actor, leadRead)).toBe(false);
  });

  it('keeps a COMPANY_WIDE employee constrained by a Branch-scoped CRM role grant', () => {
    const actor = principal({
      accessMode: BranchAccessMode.COMPANY_WIDE,
      permissionBranchScopes: new Map([[leadRead, new Set(['branch-a'])]]),
    });

    expect(authorization.authorizedBranchIds(actor, leadRead)).toEqual(new Set(['branch-a']));
    expect(authorization.canPerformInBranch(actor, leadRead, 'branch-a')).toBe(true);
    expect(authorization.canPerformInBranch(actor, leadRead, 'branch-b')).toBe(false);
    expect(authorization.canPerformCompanyWide(actor, leadRead)).toBe(false);
  });

  it('allows Company-wide Source administration only with both explicit dimensions', () => {
    const actor = principal({
      accessMode: BranchAccessMode.COMPANY_WIDE,
      permissions: new Set([sourceManage]),
      permissionBranchScopes: new Map([[sourceManage, new Set([null])]]),
    });

    expect(authorization.canPerformCompanyWide(actor, sourceManage)).toBe(true);
    expect(
      authorization.canPerformCompanyWide(
        principal({
          accessMode: BranchAccessMode.COMPANY_WIDE,
          permissions: new Set([sourceManage]),
          permissionBranchScopes: new Map([[sourceManage, new Set(['branch-a'])]]),
        }),
        sourceManage,
      ),
    ).toBe(false);
  });

  it('returns an empty authorized set when a CRM permission is absent', () => {
    expect(authorization.authorizedBranchIds(principal(), 'crm.lead.contact.read')).toEqual(
      new Set(),
    );
  });
});
