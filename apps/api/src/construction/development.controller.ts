import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { PermissionGuard } from '../security/permission.guard';
import { RequirePermissions } from '../security/security.decorators';
import { SessionAuthGuard } from '../security/session-auth.guard';
import type { AuthenticatedRequest } from '../security/security.types';
import {
  AttachDevelopmentConstructionDto,
  ConvertDevelopmentPlotDto,
  CreateDevelopmentBlockDto,
  CreateDevelopmentPlotDto,
  CreateDevelopmentProjectDto,
  DevelopmentPlotTransitionDto,
  DevelopmentProjectQueryDto,
  DevelopmentProjectTransitionDto,
  RecordDevelopmentCostDto,
  UpsertDevelopmentBudgetLineDto,
} from './construction.dto';
import { DevelopmentService } from './development.service';

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'development', version: '1' })
export class DevelopmentController {
  constructor(private readonly development: DevelopmentService) {}

  @Get('overview')
  @RequirePermissions('development.read')
  overview(@Req() req: AuthenticatedRequest) {
    return this.development.overview(req.principal);
  }

  @Get('projects')
  @RequirePermissions('development.read')
  list(@Req() req: AuthenticatedRequest, @Query() query: DevelopmentProjectQueryDto) {
    return this.development.listProjects(req.principal, query);
  }

  @Post('projects')
  @RequirePermissions('development.manage')
  create(@Req() req: AuthenticatedRequest, @Body() input: CreateDevelopmentProjectDto) {
    return this.development.createProject(req.principal, input, req.correlationId);
  }

  @Get('projects/:id')
  @RequirePermissions('development.read')
  get(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.development.getProject(req.principal, id);
  }

  @Post('projects/:id/transition')
  @RequirePermissions('development.manage')
  transition(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: DevelopmentProjectTransitionDto,
  ) {
    return this.development.transitionProject(req.principal, id, input, req.correlationId);
  }

  @Post('blocks')
  @RequirePermissions('development.manage')
  block(@Req() req: AuthenticatedRequest, @Body() input: CreateDevelopmentBlockDto) {
    return this.development.createBlock(req.principal, input);
  }

  @Post('plots')
  @RequirePermissions('development.manage')
  plot(@Req() req: AuthenticatedRequest, @Body() input: CreateDevelopmentPlotDto) {
    return this.development.createPlot(req.principal, input);
  }

  @Post('plots/:id/transition')
  @RequirePermissions('development.manage')
  transitionPlot(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: DevelopmentPlotTransitionDto,
  ) {
    return this.development.transitionPlot(req.principal, id, input);
  }

  @Post('budget-lines')
  @RequirePermissions('development.manage')
  budget(@Req() req: AuthenticatedRequest, @Body() input: UpsertDevelopmentBudgetLineDto) {
    return this.development.upsertBudgetLine(req.principal, input);
  }

  @Post('costs')
  @RequirePermissions('expense.manage')
  cost(@Req() req: AuthenticatedRequest, @Body() input: RecordDevelopmentCostDto) {
    return this.development.recordCost(req.principal, input, req.correlationId);
  }

  @Post('construction')
  @RequirePermissions('construction.manage')
  attach(@Req() req: AuthenticatedRequest, @Body() input: AttachDevelopmentConstructionDto) {
    return this.development.attachConstruction(req.principal, input, req.correlationId);
  }

  @Post('convert-plot')
  @RequirePermissions('development.manage', 'portfolio.property.create', 'service-engagement.create')
  convert(@Req() req: AuthenticatedRequest, @Body() input: ConvertDevelopmentPlotDto) {
    return this.development.convertPlot(req.principal, input, req.correlationId);
  }
}
