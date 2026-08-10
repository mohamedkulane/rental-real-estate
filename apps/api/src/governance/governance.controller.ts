import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { PermissionGuard } from '../security/permission.guard';
import { RequirePermissions } from '../security/security.decorators';
import { SessionAuthGuard } from '../security/session-auth.guard';
import type { AuthenticatedRequest } from '../security/security.types';
import { CreateApprovalRequestDto, DecideApprovalDto } from './governance.dto';
import { GovernanceService } from './governance.service';

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'audit', version: '1' })
export class AuditController {
  constructor(private readonly governance: GovernanceService) {}
  @Get() @RequirePermissions('governance.audit.read') list(@Req() request: AuthenticatedRequest) {
    return this.governance.listAudit(request.principal);
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'approvals', version: '1' })
export class ApprovalController {
  constructor(private readonly governance: GovernanceService) {}
  @Get() @RequirePermissions('governance.approval.read') list(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.governance.listApprovals(request.principal);
  }
  @Post() @RequirePermissions('governance.approval.request') create(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateApprovalRequestDto,
  ) {
    return this.governance.createApproval(request.principal, input, request.correlationId);
  }
  @Post('steps/:stepId/decisions') @RequirePermissions('governance.approval.decide') decide(
    @Req() request: AuthenticatedRequest,
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @Body() input: DecideApprovalDto,
  ) {
    return this.governance.decide(request.principal, stepId, input, request.correlationId);
  }
}
