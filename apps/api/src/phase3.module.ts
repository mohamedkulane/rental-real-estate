import { Module } from '@nestjs/common';
import { BusinessDateService } from './common/business-date.service';
import { EffectiveDatingService } from './common/effective-dating.service';
import { ApprovalController, AuditController } from './governance/governance.controller';
import { AuditService } from './governance/audit.service';
import { GovernanceService } from './governance/governance.service';
import { AccessService } from './identity/access.service';
import { PermissionController, RoleController } from './identity/access.controller';
import { AuthController } from './identity/auth.controller';
import { AuthRateLimitService } from './identity/auth-rate-limit.service';
import { AuthService } from './identity/auth.service';
import { PasswordService } from './identity/password.service';
import {
  BranchController,
  CompanyController,
  EmployeeController,
  UserController,
} from './organization/organization.controllers';
import { OrganizationService } from './organization/organization.service';
import { AuthorizationService } from './security/authorization.service';
import { PermissionGuard } from './security/permission.guard';
import { SessionAuthGuard } from './security/session-auth.guard';

@Module({
  controllers: [
    AuthController,
    CompanyController,
    BranchController,
    EmployeeController,
    UserController,
    PermissionController,
    RoleController,
    AuditController,
    ApprovalController,
  ],
  providers: [
    BusinessDateService,
    EffectiveDatingService,
    PasswordService,
    AuditService,
    AuthRateLimitService,
    AuthService,
    AuthorizationService,
    PermissionGuard,
    SessionAuthGuard,
    OrganizationService,
    AccessService,
    GovernanceService,
  ],
  exports: [
    BusinessDateService,
    EffectiveDatingService,
    PasswordService,
    AuditService,
    AuthService,
    AuthorizationService,
  ],
})
export class Phase3Module {}
