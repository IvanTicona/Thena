import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ReviewService } from '../../application/services/review.service.js';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator.js';
import { JwtPayload } from '../../../auth/domain/auth.types.js';

@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get('latest')
  async findLatest(
    @Query('chapterId', ParseUUIDPipe) chapterId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    // P0-7: Enforce ownership only for STUDENT role — tutors can view any review
    const ownershipUserId = user?.role === 'STUDENT' ? user.sub : undefined;
    return this.reviewService.findLatestByChapterId(chapterId, ownershipUserId);
  }

  @Get(':jobId')
  async findByJobId(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    // P0-7: Enforce ownership only for STUDENT role — tutors can view any review
    const ownershipUserId = user?.role === 'STUDENT' ? user.sub : undefined;
    return this.reviewService.findByJobId(jobId, ownershipUserId);
  }
}
