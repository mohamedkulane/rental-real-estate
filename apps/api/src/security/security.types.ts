import type { BranchAccessMode, PortalType } from '@prisma/client';
import type { Request } from 'express';

export type PrincipalKind = 'STAFF' | 'OWNER' | 'TENANT';

export interface AuthenticatedPrincipal {
  kind?: PrincipalKind;
  userId: string;
  sessionId: string;
  companyId: string;
  businessDate: string;
  employeeId: string;
  accessMode: BranchAccessMode;
  roles: ReadonlyArray<{ code: string; name: string; branchId: string | null }>;
  permissions: ReadonlySet<string>;
  permissionBranchScopes: ReadonlyMap<string, ReadonlySet<string | null>>;
  branchIds: ReadonlySet<string>;
  branches?: ReadonlyArray<{ id: string; code: string; name: string }>;
  partyId?: string;
  displayName?: string;
  portalType?: PortalType;
}

export interface AuthenticatedRequest extends Request {
  principal: AuthenticatedPrincipal;
  sessionToken: string;
  correlationId?: string;
}

export function isStaffPrincipal(principal: AuthenticatedPrincipal): boolean {
  return !principal.kind || principal.kind === 'STAFF';
}

export function isPortalPrincipal(principal: AuthenticatedPrincipal): boolean {
  return principal.kind === 'OWNER' || principal.kind === 'TENANT';
}
