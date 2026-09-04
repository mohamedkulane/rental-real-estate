import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseFilters,
} from '@nestjs/common';
import { LeadFollowUpState, LeadSourceStatus, LeadStage } from '@prisma/client';
import { PermissionGuard } from '../security/permission.guard';
import { RequirePermissions } from '../security/security.decorators';
import { SessionAuthGuard } from '../security/session-auth.guard';
import type { AuthenticatedRequest } from '../security/security.types';
import {
  ActivityListQueryDto,
  AssignmentDto,
  BranchTransferDto,
  ContactedTransitionDto,
  ConvertedTransitionDto,
  CorrectActivityDto,
  CorrectLeadIntentDto,
  CreateActivityDto,
  CreateFollowUpDto,
  CreateLeadDto,
  CreateSourceDto,
  CrmPageQueryDto,
  FollowUpListQueryDto,
  PipelineQueryDto,
  BranchSelectorQueryDto,
  EmployeeSelectorQueryDto,
  ReferenceSelectorQueryDto,
  LeadListQueryDto,
  LinkPartyDto,
  LostTransitionDto,
  MatchingTransitionDto,
  NurturingTransitionDto,
  ReasonDto,
  SourceListQueryDto,
  StageTransitionDto,
  UpdateFollowUpDto,
  UpdateLeadDto,
  UpdateSourceDto,
  VersionedReasonDto,
} from './crm.dto';
import { CrmReadService } from './crm-read.service';
import { CrmSelectorsService } from './crm-selectors.service';
import { CrmExceptionFilter, CrmSearchGuard } from './crm-http';
import { CrmLeadService } from './crm-lead.service';
import { CrmOperationsService } from './crm-operations.service';

@UseFilters(CrmExceptionFilter)
@UseGuards(SessionAuthGuard, PermissionGuard, CrmSearchGuard)
@Controller({ path: 'crm', version: '1' })
export class CrmController {
  constructor(
    private readonly leads: CrmLeadService,
    private readonly operations: CrmOperationsService,
    private readonly read: CrmReadService,
    private readonly selectors: CrmSelectorsService,
  ) {}

  @Get('leads')
  @RequirePermissions('crm.lead.read')
  list(@Req() req: AuthenticatedRequest, @Query() query: LeadListQueryDto) {
    return this.read.list(req.principal, query);
  }
  @Get('pipeline')
  @RequirePermissions('crm.lead.read')
  pipeline(@Req() req: AuthenticatedRequest, @Query() query: PipelineQueryDto) {
    return this.read.pipeline(req.principal, query);
  }
  @Post('leads')
  @RequirePermissions('crm.lead.create')
  create(@Req() req: AuthenticatedRequest, @Body() input: CreateLeadDto) {
    return this.leads.create(req.principal, input, req.correlationId);
  }
  @Get('leads/:leadId')
  @RequirePermissions('crm.lead.read')
  get(@Req() req: AuthenticatedRequest, @Param('leadId', ParseUUIDPipe) leadId: string) {
    return this.read.get(req.principal, leadId, req.correlationId);
  }
  @Patch('leads/:leadId')
  @RequirePermissions('crm.lead.update')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Body() input: UpdateLeadDto,
  ) {
    return this.leads.update(req.principal, leadId, input, req.correlationId);
  }
  @Post('leads/:leadId/intent-correction')
  @RequirePermissions('crm.lead.update')
  intent(
    @Req() req: AuthenticatedRequest,
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Body() input: CorrectLeadIntentDto,
  ) {
    return this.leads.correctIntent(req.principal, leadId, input, req.correlationId);
  }
  @Post('leads/:leadId/party-link')
  @RequirePermissions('crm.lead.update')
  linkParty(
    @Req() req: AuthenticatedRequest,
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Body() input: LinkPartyDto,
  ) {
    return this.leads.linkParty(req.principal, leadId, input, req.correlationId);
  }
  @Post('leads/:leadId/party-unlink')
  @RequirePermissions('crm.lead.update')
  unlinkParty(
    @Req() req: AuthenticatedRequest,
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Body() input: VersionedReasonDto,
  ) {
    return this.leads.unlinkParty(req.principal, leadId, input, req.correlationId);
  }

  @Post('leads/:leadId/contacted')
  @RequirePermissions('crm.lead.stage')
  contacted(
    @Req() req: AuthenticatedRequest,
    @Param('leadId', ParseUUIDPipe) id: string,
    @Body() input: ContactedTransitionDto,
  ) {
    return this.leads.transition(req.principal, id, LeadStage.CONTACTED, input, req.correlationId);
  }
  @Post('leads/:leadId/qualified')
  @RequirePermissions('crm.lead.stage')
  qualified(
    @Req() req: AuthenticatedRequest,
    @Param('leadId', ParseUUIDPipe) id: string,
    @Body() input: StageTransitionDto,
  ) {
    return this.leads.transition(req.principal, id, LeadStage.QUALIFIED, input, req.correlationId);
  }
  @Post('leads/:leadId/matching')
  @RequirePermissions('crm.lead.stage')
  matching(
    @Req() req: AuthenticatedRequest,
    @Param('leadId', ParseUUIDPipe) id: string,
    @Body() input: MatchingTransitionDto,
  ) {
    return this.leads.transition(req.principal, id, LeadStage.MATCHING, input, req.correlationId);
  }
  @Post('leads/:leadId/nurturing')
  @RequirePermissions('crm.lead.stage')
  nurturing(
    @Req() req: AuthenticatedRequest,
    @Param('leadId', ParseUUIDPipe) id: string,
    @Body() input: NurturingTransitionDto,
  ) {
    return this.leads.transition(req.principal, id, LeadStage.NURTURING, input, req.correlationId);
  }
  @Post('leads/:leadId/converted')
  @RequirePermissions('crm.lead.stage')
  converted(
    @Req() req: AuthenticatedRequest,
    @Param('leadId', ParseUUIDPipe) id: string,
    @Body() input: ConvertedTransitionDto,
  ) {
    return this.leads.transition(req.principal, id, LeadStage.CONVERTED, input, req.correlationId);
  }
  @Post('leads/:leadId/lost')
  @RequirePermissions('crm.lead.stage')
  lost(
    @Req() req: AuthenticatedRequest,
    @Param('leadId', ParseUUIDPipe) id: string,
    @Body() input: LostTransitionDto,
  ) {
    return this.leads.transition(req.principal, id, LeadStage.LOST, input, req.correlationId);
  }

  @Get('leads/:leadId/history')
  @RequirePermissions('crm.lead.read')
  history(
    @Req() req: AuthenticatedRequest,
    @Param('leadId', ParseUUIDPipe) id: string,
    @Query() query: CrmPageQueryDto,
  ) {
    return this.read.history(req.principal, id, query);
  }
  @Get('leads/:leadId/activities')
  @RequirePermissions('crm.lead.read', 'crm.activity.read')
  activities(
    @Req() req: AuthenticatedRequest,
    @Param('leadId', ParseUUIDPipe) id: string,
    @Query() query: ActivityListQueryDto,
  ) {
    return this.read.activities(req.principal, id, query);
  }
  @Post('leads/:leadId/activities')
  @RequirePermissions('crm.activity.create')
  createActivity(
    @Req() req: AuthenticatedRequest,
    @Param('leadId', ParseUUIDPipe) id: string,
    @Body() input: CreateActivityDto,
  ) {
    return this.operations.createActivity(req.principal, id, input, req.correlationId);
  }
  @Post('leads/:leadId/activities/:activityId/correction')
  @RequirePermissions('crm.activity.correct')
  correctActivity(
    @Req() req: AuthenticatedRequest,
    @Param('leadId', ParseUUIDPipe) id: string,
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @Body() input: CorrectActivityDto,
  ) {
    return this.operations.correctActivity(
      req.principal,
      id,
      activityId,
      'correction',
      input,
      req.correlationId,
    );
  }
  @Post('leads/:leadId/activities/:activityId/void')
  @RequirePermissions('crm.activity.correct')
  voidActivity(
    @Req() req: AuthenticatedRequest,
    @Param('leadId', ParseUUIDPipe) id: string,
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @Body() input: ReasonDto,
  ) {
    return this.operations.correctActivity(
      req.principal,
      id,
      activityId,
      'void',
      input,
      req.correlationId,
    );
  }

  @Get('follow-ups')
  @RequirePermissions('crm.lead.read', 'crm.followup.read')
  followUps(@Req() req: AuthenticatedRequest, @Query() query: FollowUpListQueryDto) {
    return this.read.followUps(req.principal, query);
  }
  @Get('leads/:leadId/follow-ups')
  @RequirePermissions('crm.lead.read', 'crm.followup.read')
  leadFollowUps(
    @Req() req: AuthenticatedRequest,
    @Param('leadId', ParseUUIDPipe) id: string,
    @Query() query: FollowUpListQueryDto,
  ) {
    return this.read.followUps(req.principal, query, id);
  }
  @Post('leads/:leadId/follow-ups')
  @RequirePermissions('crm.followup.create')
  createFollowUp(
    @Req() req: AuthenticatedRequest,
    @Param('leadId', ParseUUIDPipe) id: string,
    @Body() input: CreateFollowUpDto,
  ) {
    return this.operations.createFollowUp(req.principal, id, input, req.correlationId);
  }
  @Patch('leads/:leadId/follow-ups/:followUpId')
  @RequirePermissions('crm.followup.update')
  updateFollowUp(
    @Req() req: AuthenticatedRequest,
    @Param('leadId', ParseUUIDPipe) id: string,
    @Param('followUpId', ParseUUIDPipe) followUpId: string,
    @Body() input: UpdateFollowUpDto,
  ) {
    return this.operations.updateFollowUp(req.principal, id, followUpId, input, req.correlationId);
  }
  @Post('leads/:leadId/follow-ups/:followUpId/complete')
  @RequirePermissions('crm.followup.complete')
  completeFollowUp(
    @Req() req: AuthenticatedRequest,
    @Param('leadId', ParseUUIDPipe) id: string,
    @Param('followUpId', ParseUUIDPipe) followUpId: string,
    @Body() input: VersionedReasonDto,
  ) {
    return this.operations.outcome(
      req.principal,
      id,
      followUpId,
      LeadFollowUpState.COMPLETED,
      input,
      req.correlationId,
    );
  }
  @Post('leads/:leadId/follow-ups/:followUpId/cancel')
  @RequirePermissions('crm.followup.cancel')
  cancelFollowUp(
    @Req() req: AuthenticatedRequest,
    @Param('leadId', ParseUUIDPipe) id: string,
    @Param('followUpId', ParseUUIDPipe) followUpId: string,
    @Body() input: VersionedReasonDto,
  ) {
    return this.operations.outcome(
      req.principal,
      id,
      followUpId,
      LeadFollowUpState.CANCELLED,
      input,
      req.correlationId,
    );
  }

  @Get('leads/:leadId/assignments')
  @RequirePermissions('crm.lead.read', 'crm.assignment.read')
  assignments(
    @Req() req: AuthenticatedRequest,
    @Param('leadId', ParseUUIDPipe) id: string,
    @Query() query: CrmPageQueryDto,
  ) {
    return this.read.assignments(req.principal, id, query);
  }
  @Post('leads/:leadId/assign')
  @RequirePermissions('crm.assignment.manage')
  assign(
    @Req() req: AuthenticatedRequest,
    @Param('leadId', ParseUUIDPipe) id: string,
    @Body() input: AssignmentDto,
  ) {
    return this.leads.assignment(req.principal, id, 'assign', input, req.correlationId);
  }
  @Post('leads/:leadId/reassign')
  @RequirePermissions('crm.assignment.manage')
  reassign(
    @Req() req: AuthenticatedRequest,
    @Param('leadId', ParseUUIDPipe) id: string,
    @Body() input: AssignmentDto,
  ) {
    return this.leads.assignment(req.principal, id, 'reassign', input, req.correlationId);
  }
  @Post('leads/:leadId/unassign')
  @RequirePermissions('crm.assignment.manage')
  unassign(
    @Req() req: AuthenticatedRequest,
    @Param('leadId', ParseUUIDPipe) id: string,
    @Body() input: VersionedReasonDto,
  ) {
    return this.leads.assignment(req.principal, id, 'unassign', input, req.correlationId);
  }
  @Post('leads/:leadId/branch-transfer')
  @RequirePermissions('crm.lead.branch.transfer')
  transfer(
    @Req() req: AuthenticatedRequest,
    @Param('leadId', ParseUUIDPipe) id: string,
    @Body() input: BranchTransferDto,
  ) {
    return this.leads.transfer(req.principal, id, input, req.correlationId);
  }

  @Get('lead-sources/options')
  @RequirePermissions('crm.source.read')
  sourceOptions(@Req() req: AuthenticatedRequest, @Query() query: SourceListQueryDto) {
    return this.read.sources(req.principal, query, true);
  }
  @Get('lead-sources')
  @RequirePermissions('crm.source.manage')
  sources(@Req() req: AuthenticatedRequest, @Query() query: SourceListQueryDto) {
    return this.read.sources(req.principal, query);
  }
  @Post('lead-sources')
  @RequirePermissions('crm.source.manage')
  createSource(@Req() req: AuthenticatedRequest, @Body() input: CreateSourceDto) {
    return this.operations.createSource(req.principal, input, req.correlationId);
  }
  @Patch('lead-sources/:sourceId')
  @RequirePermissions('crm.source.manage')
  updateSource(
    @Req() req: AuthenticatedRequest,
    @Param('sourceId', ParseUUIDPipe) id: string,
    @Body() input: UpdateSourceDto,
  ) {
    return this.operations.updateSource(req.principal, id, input, req.correlationId);
  }
  @Post('lead-sources/:sourceId/deactivate')
  @RequirePermissions('crm.source.manage')
  deactivateSource(
    @Req() req: AuthenticatedRequest,
    @Param('sourceId', ParseUUIDPipe) id: string,
    @Body() input: VersionedReasonDto,
  ) {
    return this.operations.sourceLifecycle(
      req.principal,
      id,
      LeadSourceStatus.INACTIVE,
      input,
      req.correlationId,
    );
  }
  @Post('lead-sources/:sourceId/reactivate')
  @RequirePermissions('crm.source.manage')
  reactivateSource(
    @Req() req: AuthenticatedRequest,
    @Param('sourceId', ParseUUIDPipe) id: string,
    @Body() input: VersionedReasonDto,
  ) {
    return this.operations.sourceLifecycle(
      req.principal,
      id,
      LeadSourceStatus.ACTIVE,
      input,
      req.correlationId,
    );
  }
  @Get('selectors/branches')
  branches(@Req() req: AuthenticatedRequest, @Query() query: BranchSelectorQueryDto) {
    return this.selectors.branches(req.principal, query);
  }
  @Get('selectors/employees')
  employees(@Req() req: AuthenticatedRequest, @Query() query: EmployeeSelectorQueryDto) {
    return this.selectors.employees(req.principal, query);
  }
  @Get('selectors/parties')
  parties(@Req() req: AuthenticatedRequest, @Query() query: ReferenceSelectorQueryDto) {
    return this.selectors.parties(req.principal, query);
  }
  @Get('selectors/properties')
  properties(@Req() req: AuthenticatedRequest, @Query() query: ReferenceSelectorQueryDto) {
    return this.selectors.assets(req.principal, query, false);
  }
  @Get('selectors/spaces')
  spaces(@Req() req: AuthenticatedRequest, @Query() query: ReferenceSelectorQueryDto) {
    return this.selectors.assets(req.principal, query, true);
  }
}
