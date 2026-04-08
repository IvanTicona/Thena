import { Module } from '@nestjs/common';
import { ReviewController } from './infrastructure/controllers/review.controller.js';
import { ReviewService } from './application/services/review.service.js';
import { ObservationController } from './infrastructure/controllers/observation.controller.js';
import { ObservationService } from './application/services/observation.service.js';

@Module({
  controllers: [ReviewController, ObservationController],
  providers: [ReviewService, ObservationService],
})
export class ReviewModule {}
