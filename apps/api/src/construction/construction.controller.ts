import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { PermissionGuard } from '../security/permission.guard';
import { RequirePermissions } from '../security/security.decorators';
import { SessionAuthGuard } from '../security/session-auth.guard';
import type { AuthenticatedRequest } from '../security/security.types';
import {
  ConstructionContractTransitionDto,
  ConstructionMilestoneTransitionDto,
  ConstructionProjectQueryDto,
  ConstructionProjectTransitionDto,
  ConstructionWorkPackageTransitionDto,
  CreateConstructionBillingDto,
  CreateConstructionContractDto,
  CreateConstructionMilestoneDto,
  CreateConstructionProjectDto,
  CreateConstructionWorkPackageDto,
  LinkConstructionDocumentDto,
  RecordConstructionCostDto,
  RecordConstructionProgressDto,
  UpsertConstructionBudgetLineDto,
} from './construction.dto';
import { ConstructionService } from './construction.service';

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'construction', version: '1' })
export class ConstructionController {
  constructor(private readonly construction: ConstructionService) {}

  @Get('overview')
  @RequirePermissions('construction.read')
  overview(@Req() req: AuthenticatedRequest) {
    return this.construction.overview(req.principal);
  }

  @Get('projects')
  @RequirePermissions('construction.read')
  list(@Req() req: AuthenticatedRequest, @Query() query: ConstructionProjectQueryDto) {
    return this.construction.listProjects(req.principal, query);
  }

  @Post('projects')
  @RequirePermissions('construction.manage')
  create(@Req() req: AuthenticatedRequest, @Body() input: CreateConstructionProjectDto) {
    return this.construction.createProject(req.principal, input, req.correlationId);
  }

  @Get('projects/:id')
  @RequirePermissions('construction.read')
  get(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.construction.getProject(req.principal, id);
  }

  @Post('projects/:id/transition')
  @RequirePermissions('construction.manage')
  transition(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ConstructionProjectTransitionDto,
  ) {
    return this.construction.transitionProject(req.principal, id, input, req.correlationId);
  }

  @Post('projects/:id/handover')
  @RequirePermissions('construction.manage')
  handover(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.construction.handover(req.principal, id, req.correlationId);
  }

  @Get('projects/:id/statement')
  @RequirePermissions('construction.read')
  statement(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.construction.clientStatement(req.principal, id);
  }

  @Get('projects/:id/documents')
  @RequirePermissions('construction.read')
  documents(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.construction.listDocuments(req.principal, id);
  }

  @Post('projects/:id/documents')
  @RequirePermissions('construction.manage')
  linkDocument(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: LinkConstructionDocumentDto,
  ) {
    return this.construction.linkDocument(req.principal, id, input);
  }

  @Post('contracts')
  @RequirePermissions('construction.manage')
  createContract(@Req() req: AuthenticatedRequest, @Body() input: CreateConstructionContractDto) {
    return this.construction.createContract(req.principal, input, req.correlationId);
  }

  @Post('contracts/:id/transition')
  @RequirePermissions('construction.manage')
  transitionContract(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ConstructionContractTransitionDto,
  ) {
    return this.construction.transitionContract(req.principal, id, input, req.correlationId);
  }

  @Post('budget-lines')
  @RequirePermissions('construction.manage')
  budget(@Req() req: AuthenticatedRequest, @Body() input: UpsertConstructionBudgetLineDto) {
    return this.construction.upsertBudgetLine(req.principal, input);
  }

  @Post('milestones')
  @RequirePermissions('construction.manage')
  milestone(@Req() req: AuthenticatedRequest, @Body() input: CreateConstructionMilestoneDto) {
    return this.construction.createMilestone(req.principal, input);
  }

  @Post('milestones/:id/transition')
  @RequirePermissions('construction.manage')
  transitionMilestone(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ConstructionMilestoneTransitionDto,
  ) {
    return this.construction.transitionMilestone(req.principal, id, input, req.correlationId);
  }

  @Post('work-packages')
  @RequirePermissions('construction.manage')
  workPackage(@Req() req: AuthenticatedRequest, @Body() input: CreateConstructionWorkPackageDto) {
    return this.construction.createWorkPackage(req.principal, input);
  }

  @Post('work-packages/:id/transition')
  @RequirePermissions('construction.manage')
  transitionWorkPackage(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ConstructionWorkPackageTransitionDto,
  ) {
    return this.construction.transitionWorkPackage(req.principal, id, input, req.correlationId);
  }

  @Post('costs')
  @RequirePermissions('expense.manage')
  cost(@Req() req: AuthenticatedRequest, @Body() input: RecordConstructionCostDto) {
    return this.construction.recordCost(req.principal, input, req.correlationId);
  }

  @Post('billing')
  @RequirePermissions('billing.manage')
  billing(@Req() req: AuthenticatedRequest, @Body() input: CreateConstructionBillingDto) {
    return this.construction.createBilling(req.principal, input, req.correlationId);
  }

  @Post('progress')
  @RequirePermissions('construction.manage')
  progress(@Req() req: AuthenticatedRequest, @Body() input: RecordConstructionProgressDto) {
    return this.construction.recordProgress(req.principal, input);
  }
}
