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

@Module({
  imports: [Phase3Module, Phase4Module],
  controllers: [ServiceEngagementController, ServiceCapabilityController, CrmController, WorkflowController],
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
  ],
  exports: [ServiceEngagementService],
})
export class Phase5Module {}
