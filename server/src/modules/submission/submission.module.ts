import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SubmissionController } from './infrastructure/controllers/submission.controller.js';
import { SubmissionService } from './application/services/submission.service.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [BullModule.registerQueue({ name: 'review' }), AuditModule],
  controllers: [SubmissionController],
  providers: [SubmissionService],
})
export class SubmissionModule {}
