import { Module } from '@nestjs/common';
import {
  DefectController,
  InspectionController,
  MaintenanceRequestController,
  OperationsOverviewController,
  VendorController,
  WorkOrderController,
} from './operations/operations.controller';
import { OperationsService } from './operations/operations.service';
import { Phase3Module } from './phase3.module';
import { Phase6Module } from './phase6.module';

@Module({
  imports: [Phase3Module, Phase6Module],
  controllers: [
    OperationsOverviewController,
    VendorController,
    MaintenanceRequestController,
    WorkOrderController,
    InspectionController,
    DefectController,
  ],
  providers: [OperationsService],
  exports: [OperationsService],
})
export class Phase8Module {}
