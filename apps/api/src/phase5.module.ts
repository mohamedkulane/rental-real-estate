import { Module } from '@nestjs/common';
import { Phase4Module } from './phase4.module';
import { Phase3Module } from './phase3.module';
import {
  ServiceCapabilityController,
  ServiceEngagementController,
} from './commercial/service-engagement.controller';
import { ServiceEngagementService } from './commercial/service-engagement.service';
import { CrmContactService } from './crm/crm-contact.service';
import { CrmController } from './crm/crm.controller';
import { CrmCursorService } from './crm/crm-cursor.service';
import { CrmLeadService } from './crm/crm-lead.service';
import { CrmOperationsService } from './crm/crm-operations.service';
import { CrmSupportService } from './crm/crm-support.service';
import { CrmReadService } from './crm/crm-read.service';
import { CrmSelectorsService } from './crm/crm-selectors.service';
import { CrmSearchGuard } from './crm/crm-http';
import { WorkflowController } from './workflow/workflow.controller';
import { WorkflowPayloadCipher } from './workflow/workflow-payload-cipher';
import { WorkflowService } from './workflow/workflow.service';
import { WorkflowCommandService } from './workflow/workflow-command.service';
import { LeasingService } from './leasing/leasing.service';
import { ListingService } from './leasing/listing.service';
import { RentalCommandController } from './rental/rental.controller';
import { RentalReadController } from './rental/rental-read.controller';
import { AgreementService } from './rental/agreement.service';
import { RentalOrchestrationService } from './rental/rental-orchestration.service';
import { RentalPresentationService } from './rental/rental-presentation.service';
import {
  ApplicationController,
  LeaseController,
  ListingMatchController,
  MoveInController,
  RentalListingController,
  RenewalController,
  ReservationController,
  SaleListingController,
  TenantController,
  ViewingController,
} from './leasing/phase5-operations.controller';

@Module({
  imports: [Phase3Module, Phase4Module],
  controllers: [
    ServiceEngagementController,
    ServiceCapabilityController,
    CrmController,
    WorkflowController,
    RentalListingController,
    SaleListingController,
    ListingMatchController,
    ViewingController,
    ApplicationController,
    ReservationController,
    TenantController,
    LeaseController,
    RenewalController,
    MoveInController,
    RentalCommandController,
    RentalReadController,
  ],
  providers: [
    ServiceEngagementService,
    CrmContactService,
    CrmCursorService,
    CrmLeadService,
    CrmOperationsService,
    CrmSupportService,
    CrmReadService,
    CrmSelectorsService,
    CrmSearchGuard,
    WorkflowPayloadCipher,
    WorkflowService,
    WorkflowCommandService,
    ListingService,
    LeasingService,
    RentalPresentationService,
    RentalOrchestrationService,
    AgreementService,
  ],
  exports: [ServiceEngagementService, RentalOrchestrationService, RentalPresentationService],
})
export class Phase5Module {}
