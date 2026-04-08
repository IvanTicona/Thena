import { Module } from '@nestjs/common';
import { ChapterController } from './infrastructure/controllers/chapter.controller.js';
import { ChapterService } from './application/services/chapter.service.js';
import { AuditModule } from '../audit/audit.module.js';
import { NotificationModule } from '../notification/notification.module.js';

@Module({
  imports: [AuditModule, NotificationModule],
  controllers: [ChapterController],
  providers: [ChapterService],
  exports: [ChapterService],
})
export class ChapterModule {}
