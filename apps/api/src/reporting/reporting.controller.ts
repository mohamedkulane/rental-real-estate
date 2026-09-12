import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ReportExportQueryDto } from '../portals/portal.dto';
import { RequirePermissions } from '../security/security.decorators';
import { PermissionGuard } from '../security/permission.guard';
import { SessionAuthGuard } from '../security/session-auth.guard';
import type { AuthenticatedRequest } from '../security/security.types';
import { DashboardReadModelService } from './dashboard-read-model.service';
import { NotificationService } from './notification.service';
import { ReportingService } from './reporting.service';
import { GlobalSearchQueryDto } from '../portals/portal.dto';
import { SearchService } from './search.service';

@Controller({ path: 'reports', version: '1' })
@UseGuards(SessionAuthGuard, PermissionGuard)
export class ReportingController {
  constructor(private readonly reporting: ReportingService) {}

  @RequirePermissions('report.read')
  @Get('workspace')
  workspace(@Req() request: AuthenticatedRequest, @Query() query: ReportExportQueryDto) {
    return this.reporting.workspace(request.principal, query.branchId);
  }

  @RequirePermissions('report.read')
  @Get('export/:section')
  export(@Req() request: AuthenticatedRequest, @Param('section') section: string, @Query() query: ReportExportQueryDto) {
    return this.reporting.exportSection(request.principal, section, query.branchId);
  }
}

@Controller({ path: 'dashboard', version: '1' })
@UseGuards(SessionAuthGuard, PermissionGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardReadModelService) {}

  @RequirePermissions('dashboard.read')
  @Get('summary')
  summary(@Req() request: AuthenticatedRequest) {
    return this.dashboard.summary(request.principal);
  }
}

@Controller({ path: 'search', version: '1' })
@UseGuards(SessionAuthGuard, PermissionGuard)
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @RequirePermissions('search.read')
  @Get()
  globalSearch(@Req() request: AuthenticatedRequest, @Query() query: GlobalSearchQueryDto) {
    return this.search.search(
      request.principal,
      query.q,
      query.branchId,
      query.limit ? Number(query.limit) : 12,
    );
  }
}

@Controller({ path: 'notifications', version: '1' })
@UseGuards(SessionAuthGuard)
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  inbox(@Req() request: AuthenticatedRequest) {
    return this.notifications.inbox(request.principal);
  }

  @Post('read')
  markRead(@Req() request: AuthenticatedRequest, @Query('id') id?: string) {
    return this.notifications.markRead(request.principal, id);
  }

  @Post('seed')
  seed(@Req() request: AuthenticatedRequest) {
    return this.notifications.seedOperationalNotifications(request.principal);
  }
}
