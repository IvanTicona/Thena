import { Module } from '@nestjs/common';
import { ReviewController } from './infrastructure/controllers/review.controller.js';
import { ReviewService } from './application/services/review.service.js';

@Module({
  controllers: [ReviewController],
  providers: [ReviewService],
})
export class ReviewModule {}
