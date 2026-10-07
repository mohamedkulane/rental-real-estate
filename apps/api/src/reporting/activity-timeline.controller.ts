import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { PermissionGuard } from '../security/permission.guard';
import { SessionAuthGuard } from '../security/session-auth.guard';
import type { AuthenticatedRequest } from '../security/security.types';
import { ActivityTimelineService } from './activity-timeline.service';

@Controller({ path: 'activity-timeline', version: '1' })
@UseGuards(SessionAuthGuard, PermissionGuard)
export class ActivityTimelineController {
  constructor(private readonly timeline: ActivityTimelineService) {}

  @Get()
  get(
    @Req() request: AuthenticatedRequest,
    @Query('entityType') entityType = '',
    @Query('entityId') entityId = '',
  ) {
    return this.timeline.get(request.principal, entityType, entityId);
  }
}
