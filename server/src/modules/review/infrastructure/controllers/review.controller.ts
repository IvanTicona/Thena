import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ReviewService } from '../../application/services/review.service.js';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../../auth/domain/auth.types.js';

@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get('latest')
  async findLatest(
    @Query('chapterId', ParseUUIDPipe) chapterId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const ownershipUserId = user.role === 'STUDENT' ? user.sub : undefined;
    return this.reviewService.findLatestByChapterId(chapterId, ownershipUserId);
  }

  @Get('diff')
  async getDiff(
    @Query('submissionV1', ParseUUIDPipe) submissionV1: string,
    @Query('submissionV2', ParseUUIDPipe) submissionV2: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const ownershipUserId = user.role === 'STUDENT' ? user.sub : undefined;
    return this.reviewService.getDiff(
      submissionV1,
      submissionV2,
      ownershipUserId,
    );
  }

  @Get(':jobId/export')
  async exportPdf(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.reviewService.generatePdfReport(
      jobId,
      user.sub,
      user.role,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get(':jobId')
  async findByJobId(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const ownershipUserId = user.role === 'STUDENT' ? user.sub : undefined;
    return this.reviewService.findByJobId(jobId, ownershipUserId);
  }
}
