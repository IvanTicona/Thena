import { Module } from '@nestjs/common';
import { AlertService } from './application/alert.service.js';
import { AlertController } from './infrastructure/controllers/alert.controller.js';
import { NotificationModule } from '../notification/notification.module.js';

@Module({
  imports: [NotificationModule],
  controllers: [AlertController],
  providers: [AlertService],
  exports: [AlertService],
})
export class AlertModule {}
