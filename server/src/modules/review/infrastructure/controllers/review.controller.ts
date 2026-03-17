import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ReviewService } from '../../application/services/review.service.js';

@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get('latest')
  async findLatest(@Query('chapterId', ParseUUIDPipe) chapterId: string) {
    return this.reviewService.findLatestByChapterId(chapterId);
  }

  @Get(':jobId')
  async findByJobId(@Param('jobId', ParseUUIDPipe) jobId: string) {
    return this.reviewService.findByJobId(jobId);
  }
}
