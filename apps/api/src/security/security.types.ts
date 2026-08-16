import type { BranchAccessMode } from '@prisma/client';
import type { Request } from 'express';

export interface AuthenticatedPrincipal {
  userId: string;
  sessionId: string;
  employeeId: string;
  companyId: string;
  businessDate: string;
  accessMode: BranchAccessMode;
  roles: ReadonlyArray<{ code: string; name: string; branchId: string | null }>;
  permissions: ReadonlySet<string>;
  permissionBranchScopes: ReadonlyMap<string, ReadonlySet<string | null>>;
  branchIds: ReadonlySet<string>;
  branches?: ReadonlyArray<{ id: string; code: string; name: string }>;
}

export interface AuthenticatedRequest extends Request {
  principal: AuthenticatedPrincipal;
  sessionToken: string;
  correlationId?: string;
}
