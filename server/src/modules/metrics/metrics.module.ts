import { Module } from '@nestjs/common';
import { MetricsController } from './infrastructure/controllers/metrics.controller.js';
import { MetricsService } from './application/services/metrics.service.js';

@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class MetricsModule {}
