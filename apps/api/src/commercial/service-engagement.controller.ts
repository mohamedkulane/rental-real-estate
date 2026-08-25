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
} from '@nestjs/common';
import { ServiceEngagementStatus } from '@prisma/client';
import { PermissionGuard } from '../security/permission.guard';
import { RequirePermissions } from '../security/security.decorators';
import { SessionAuthGuard } from '../security/session-auth.guard';
import type { AuthenticatedRequest } from '../security/security.types';
import {
  CreateServiceEngagementDto,
  ListServiceEngagementActivityQueryDto,
  ListServiceEngagementsQueryDto,
  ResolveCapabilitiesQueryDto,
  ServiceEngagementTransitionDto,
  UpdateServiceEngagementDto,
} from './service-engagement.dto';
import { ServiceEngagementService } from './service-engagement.service';

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'service-engagements', version: '1' })
export class ServiceEngagementController {
  constructor(private readonly engagements: ServiceEngagementService) {}

  @Get()
  @RequirePermissions('service-engagement.read')
  list(@Req() request: AuthenticatedRequest, @Query() query: ListServiceEngagementsQueryDto) {
    return this.engagements.list(request.principal, query);
  }

  @Get(':engagementId')
  @RequirePermissions('service-engagement.read')
  get(
    @Req() request: AuthenticatedRequest,
    @Param('engagementId', ParseUUIDPipe) engagementId: string,
  ) {
    return this.engagements.get(request.principal, engagementId);
  }

  @Get(':engagementId/activity')
  @RequirePermissions('service-engagement.read')
  activity(
    @Req() request: AuthenticatedRequest,
    @Param('engagementId', ParseUUIDPipe) engagementId: string,
    @Query() query: ListServiceEngagementActivityQueryDto,
  ) {
    return this.engagements.activity(request.principal, engagementId, query);
  }

  @Post()
  @RequirePermissions('service-engagement.create')
  create(@Req() request: AuthenticatedRequest, @Body() input: CreateServiceEngagementDto) {
    return this.engagements.create(request.principal, input, request.correlationId);
  }

  @Patch(':engagementId')
  @RequirePermissions('service-engagement.update')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('engagementId', ParseUUIDPipe) engagementId: string,
    @Body() input: UpdateServiceEngagementDto,
  ) {
    return this.engagements.update(request.principal, engagementId, input, request.correlationId);
  }

  @Post(':engagementId/activate')
  @RequirePermissions('service-engagement.activate')
  activate(
    @Req() request: AuthenticatedRequest,
    @Param('engagementId', ParseUUIDPipe) engagementId: string,
    @Body() input: ServiceEngagementTransitionDto,
  ) {
    return this.engagements.transition(
      request.principal,
      engagementId,
      ServiceEngagementStatus.ACTIVE,
      input,
      request.correlationId,
    );
  }

  @Post(':engagementId/deactivate')
  @RequirePermissions('service-engagement.deactivate')
  deactivate(
    @Req() request: AuthenticatedRequest,
    @Param('engagementId', ParseUUIDPipe) engagementId: string,
    @Body() input: ServiceEngagementTransitionDto,
  ) {
    return this.engagements.transition(
      request.principal,
      engagementId,
      ServiceEngagementStatus.INACTIVE,
      input,
      request.correlationId,
    );
  }

  @Post(':engagementId/cancel')
  @RequirePermissions('service-engagement.cancel')
  cancel(
    @Req() request: AuthenticatedRequest,
    @Param('engagementId', ParseUUIDPipe) engagementId: string,
    @Body() input: ServiceEngagementTransitionDto,
  ) {
    return this.engagements.transition(
      request.principal,
      engagementId,
      ServiceEngagementStatus.CANCELLED,
      input,
      request.correlationId,
    );
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'service-capabilities', version: '1' })
export class ServiceCapabilityController {
  constructor(private readonly engagements: ServiceEngagementService) {}

  @Get('resolve')
  @RequirePermissions('service-engagement.capability.read')
  resolve(@Req() request: AuthenticatedRequest, @Query() query: ResolveCapabilitiesQueryDto) {
    return this.engagements.resolveCapabilities(request.principal, query);
  }
}
