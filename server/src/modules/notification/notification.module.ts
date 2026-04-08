import { Module } from '@nestjs/common';
import { NotificationController } from './infrastructure/controllers/notification.controller.js';
import { NotificationService } from './application/notification.service.js';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
