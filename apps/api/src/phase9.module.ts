import { Module } from '@nestjs/common';
import { Phase3Module } from './phase3.module';
import { Phase6Module } from './phase6.module';
import { Phase8Module } from './phase8.module';
import { PortalOwnerController, PortalTenantController } from './portals/portal.controller';
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
import { SavedViewController } from './reporting/saved-view.controller';
import { SavedViewService } from './reporting/saved-view.service';
import { GeneratedDocumentController } from './reporting/generated-document.controller';
import { GeneratedDocumentService } from './reporting/generated-document.service';
import { ActivityTimelineController } from './reporting/activity-timeline.controller';
import { ActivityTimelineService } from './reporting/activity-timeline.service';

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
    SavedViewController,
    GeneratedDocumentController,
    ActivityTimelineController,
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
    SavedViewService,
    GeneratedDocumentService,
    ActivityTimelineService,
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
    SavedViewService,
    GeneratedDocumentService,
    ActivityTimelineService,
  ],
})
export class Phase9Module {}
