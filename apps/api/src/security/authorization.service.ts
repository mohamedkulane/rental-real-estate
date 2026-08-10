import { ForbiddenException, Injectable } from '@nestjs/common';
import { BranchAccessMode } from '@prisma/client';
import type { AuthenticatedPrincipal } from './security.types';

@Injectable()
export class AuthorizationService {
  hasPermission(principal: AuthenticatedPrincipal, permission: string): boolean {
    return principal.permissions.has(permission);
  }

  canAccessBranch(principal: AuthenticatedPrincipal, branchId: string): boolean {
    return (
      principal.accessMode === BranchAccessMode.COMPANY_WIDE || principal.branchIds.has(branchId)
    );
  }

  canPerformInBranch(
    principal: AuthenticatedPrincipal,
    permission: string,
    branchId: string,
  ): boolean {
    if (!this.canAccessBranch(principal, branchId)) return false;
    const scopes = principal.permissionBranchScopes.get(permission);
    return Boolean(scopes?.has(null) || scopes?.has(branchId));
  }

  canPerformCompanyWide(principal: AuthenticatedPrincipal, permission: string): boolean {
    if (principal.accessMode !== BranchAccessMode.COMPANY_WIDE) return false;
    return Boolean(principal.permissionBranchScopes.get(permission)?.has(null));
  }

  authorizedBranchIds(
    principal: AuthenticatedPrincipal,
    permission: string,
  ): ReadonlySet<string> | null {
    const scopes = principal.permissionBranchScopes.get(permission);
    if (!scopes) return new Set();
    if (principal.accessMode === BranchAccessMode.COMPANY_WIDE && scopes.has(null)) return null;

    const branchIds = new Set<string>();
    for (const branchId of principal.branchIds)
      if (scopes.has(null) || scopes.has(branchId)) branchIds.add(branchId);
    if (principal.accessMode === BranchAccessMode.COMPANY_WIDE)
      for (const scope of scopes) if (scope) branchIds.add(scope);
    return branchIds;
  }

  canPerformAcrossBranches(
    principal: AuthenticatedPrincipal,
    permission: string,
    branchIds: Iterable<string>,
  ): boolean {
    const ids = [...new Set(branchIds)];
    return (
      ids.length > 0 &&
      ids.every((branchId) => this.canPerformInBranch(principal, permission, branchId))
    );
  }

  assertBranchAccess(principal: AuthenticatedPrincipal, branchId: string): void {
    if (!this.canAccessBranch(principal, branchId))
      throw new ForbiddenException('Branch access denied.');
  }

  assertBranchPermission(
    principal: AuthenticatedPrincipal,
    permission: string,
    branchId: string,
  ): void {
    if (!this.canPerformInBranch(principal, permission, branchId))
      throw new ForbiddenException('Permission is not granted for this branch.');
  }

  assertCompanyPermission(principal: AuthenticatedPrincipal, permission: string): void {
    if (!this.canPerformCompanyWide(principal, permission))
      throw new ForbiddenException('Company-wide permission is required for this action.');
  }

  assertPermissionAcrossBranches(
    principal: AuthenticatedPrincipal,
    permission: string,
    branchIds: Iterable<string>,
  ): void {
    if (!this.canPerformAcrossBranches(principal, permission, branchIds))
      throw new ForbiddenException(
        'Permission is not granted for every branch related to this record.',
      );
  }
}
