import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SubmissionController } from './infrastructure/controllers/submission.controller.js';
import { SubmissionService } from './application/services/submission.service.js';

@Module({
  imports: [BullModule.registerQueue({ name: 'review' })],
  controllers: [SubmissionController],
  providers: [SubmissionService],
})
export class SubmissionModule {}
