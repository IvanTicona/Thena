import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SubmissionController } from './infrastructure/controllers/submission.controller.js';
import { SubmissionService } from './application/services/submission.service.js';
import { AuditModule } from '../audit/audit.module.js';
import { NotificationModule } from '../notification/notification.module.js';
import { AlertModule } from '../alert/alert.module.js';

@Module({
  imports: [BullModule.registerQueue({ name: 'review' }), AuditModule, NotificationModule, AlertModule],
  controllers: [SubmissionController],
  providers: [SubmissionService],
})
export class SubmissionModule {}
