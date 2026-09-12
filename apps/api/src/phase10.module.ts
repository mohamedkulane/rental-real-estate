import { Module } from '@nestjs/common';
import { ConstructionController } from './construction/construction.controller';
import { ConstructionService } from './construction/construction.service';
import { DevelopmentController } from './construction/development.controller';
import { DevelopmentService } from './construction/development.service';
import { Phase3Module } from './phase3.module';
import { Phase9Module } from './phase9.module';

@Module({
  imports: [Phase3Module, Phase9Module],
  controllers: [ConstructionController, DevelopmentController],
  providers: [ConstructionService, DevelopmentService],
  exports: [ConstructionService, DevelopmentService],
})
export class Phase10Module {}
