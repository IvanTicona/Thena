import { Controller, Get } from '@nestjs/common';
import { MetricsService } from '../../application/services/metrics.service.js';
import { Roles } from '../../../auth/infrastructure/decorators/roles.decorator.js';

@Controller('metrics')
@Roles('ADMIN', 'SUPER_ADMIN')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('summary')
  async getSummary() {
    return this.metricsService.getSummary();
  }

  @Get('observations/severity')
  async getObservationsBySeverity() {
    return this.metricsService.getObservationsBySeverity();
  }

  @Get('observations/agent')
  async getObservationsByAgent() {
    return this.metricsService.getObservationsByAgent();
  }

  @Get('reviews')
  async getReviewsOverTime() {
    return this.metricsService.getReviewsOverTime();
  }
}
