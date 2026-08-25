import { Module } from '@nestjs/common';
import { Phase4Module } from './phase4.module';
import { Phase3Module } from './phase3.module';
import {
  ServiceCapabilityController,
  ServiceEngagementController,
} from './commercial/service-engagement.controller';
import { ServiceEngagementService } from './commercial/service-engagement.service';

@Module({
  imports: [Phase3Module, Phase4Module],
  controllers: [ServiceEngagementController, ServiceCapabilityController],
  providers: [ServiceEngagementService],
  exports: [ServiceEngagementService],
})
export class Phase5Module {}
