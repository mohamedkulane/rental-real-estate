import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { PermissionGuard } from '../security/permission.guard';
import { RequirePermissions } from '../security/security.decorators';
import { SessionAuthGuard } from '../security/session-auth.guard';
import type { AuthenticatedRequest } from '../security/security.types';
import { CancelWorkflowDraftDto, CompleteWorkflowDraftDto, CreateWorkflowDraftDto, ListWorkflowDraftsDto, UpdateWorkflowDraftDto } from './workflow.dto';
import { WorkflowService } from './workflow.service';

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'workflows', version: '1' })
export class WorkflowController {
  constructor(private readonly workflows: WorkflowService) {}

  @Get() @RequirePermissions('workflow.draft.read')
  list(@Req() request: AuthenticatedRequest, @Query() query: ListWorkflowDraftsDto) { return this.workflows.list(request.principal, query); }

  @Get(':workflowId') @RequirePermissions('workflow.draft.read')
  get(@Req() request: AuthenticatedRequest, @Param('workflowId', ParseUUIDPipe) id: string) { return this.workflows.get(request.principal, id); }

  @Post() @RequirePermissions('workflow.draft.update')
  create(@Req() request: AuthenticatedRequest, @Body() input: CreateWorkflowDraftDto) { return this.workflows.create(request.principal, input, request.correlationId); }

  @Patch(':workflowId') @RequirePermissions('workflow.draft.update')
  update(@Req() request: AuthenticatedRequest, @Param('workflowId', ParseUUIDPipe) id: string, @Body() input: UpdateWorkflowDraftDto) { return this.workflows.update(request.principal, id, input, request.correlationId); }

  @Post(':workflowId/cancel') @RequirePermissions('workflow.draft.cancel')
  cancel(@Req() request: AuthenticatedRequest, @Param('workflowId', ParseUUIDPipe) id: string, @Body() input: CancelWorkflowDraftDto) { return this.workflows.cancel(request.principal, id, input, request.correlationId); }

  @Post(':workflowId/complete') @RequirePermissions('workflow.draft.complete')
  complete(@Req() request: AuthenticatedRequest, @Param('workflowId', ParseUUIDPipe) id: string, @Body() input: CompleteWorkflowDraftDto) { return this.workflows.complete(request.principal, id, input, request.correlationId); }
}
