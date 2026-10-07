import { Module } from '@nestjs/common';
import { DevelopmentController } from './development/development.controller';
import { DevelopmentService } from './development/development.service';
import { Phase3Module } from './phase3.module';
import { Phase9Module } from './phase9.module';

@Module({
  imports: [Phase3Module, Phase9Module],
  controllers: [DevelopmentController],
  providers: [DevelopmentService],
  exports: [DevelopmentService],
})
export class Phase10Module {}
