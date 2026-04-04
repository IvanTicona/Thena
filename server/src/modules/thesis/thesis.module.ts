import { Module } from '@nestjs/common';
import { ThesisController } from './infrastructure/controllers/thesis.controller.js';
import { ThesisService } from './application/services/thesis.service.js';

@Module({
  controllers: [ThesisController],
  providers: [ThesisService],
  exports: [ThesisService],
})
export class ThesisModule {}
