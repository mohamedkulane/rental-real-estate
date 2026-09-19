import { Module } from '@nestjs/common';
import { Phase3Module } from './phase3.module';
import { Phase6Module } from './phase6.module';
import { Phase8Module } from './phase8.module';
import {
  PortalOwnerController,
  PortalTenantController,
} from './portals/portal.controller';
import { PortalAdminController } from './portals/portal-admin.controller';
import { PortalAdminService } from './portals/portal-admin.service';
import { PortalAuthorizationService } from './portals/portal-authorization.service';
import { PortalOwnerService } from './portals/portal-owner.service';
import { PortalTenantService } from './portals/portal-tenant.service';
import {
  DashboardController,
  NotificationController,
  ReportingController,
  SearchController,
} from './reporting/reporting.controller';
import { DashboardReadModelService } from './reporting/dashboard-read-model.service';
import { NotificationService } from './reporting/notification.service';
import { ReportingService } from './reporting/reporting.service';
import { SearchService } from './reporting/search.service';

@Module({
  imports: [Phase3Module, Phase6Module, Phase8Module],
  controllers: [
    PortalOwnerController,
    PortalTenantController,
    PortalAdminController,
    ReportingController,
    DashboardController,
    SearchController,
    NotificationController,
  ],
  providers: [
    PortalAuthorizationService,
    PortalOwnerService,
    PortalTenantService,
    PortalAdminService,
    ReportingService,
    DashboardReadModelService,
    SearchService,
    NotificationService,
  ],
  exports: [
    PortalAuthorizationService,
    PortalOwnerService,
    PortalTenantService,
    PortalAdminService,
    ReportingService,
    DashboardReadModelService,
    SearchService,
    NotificationService,
  ],
})
export class Phase9Module {}
