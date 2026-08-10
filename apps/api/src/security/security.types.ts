import type { BranchAccessMode } from '@prisma/client';
import type { Request } from 'express';

export interface AuthenticatedPrincipal {
  userId: string;
  sessionId: string;
  employeeId: string;
  companyId: string;
  accessMode: BranchAccessMode;
  permissions: ReadonlySet<string>;
  permissionBranchScopes: ReadonlyMap<string, ReadonlySet<string | null>>;
  branchIds: ReadonlySet<string>;
}

export interface AuthenticatedRequest extends Request {
  principal: AuthenticatedPrincipal;
  sessionToken: string;
  correlationId?: string;
}
