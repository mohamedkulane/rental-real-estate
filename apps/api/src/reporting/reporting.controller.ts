import { Controller, Get, Header, Param, Post, Query, Req, Res, StreamableFile, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
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
  @Get('detail/:section')
  detail(@Req() request: AuthenticatedRequest, @Param('section') section: string, @Query() query: ReportExportQueryDto) {
    return this.reporting.detailSection(request.principal, section, query);
  }

  @RequirePermissions('report.read')
  @Get('export/:section')
  async export(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Param('section') section: string,
    @Query() query: ReportExportQueryDto,
  ) {
    const file = await this.reporting.exportSection(request.principal, section, query);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return new StreamableFile(file.body);
  }
}

@Controller({ path: 'dashboard', version: '1' })
@UseGuards(SessionAuthGuard, PermissionGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardReadModelService) {}

  @RequirePermissions('dashboard.read')
  @Get('summary')
  summary(@Req() request: AuthenticatedRequest, @Query('branchId') branchId?: string) {
    return this.dashboard.summary(request.principal, branchId);
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
  @Header('Cache-Control', 'no-store')
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
