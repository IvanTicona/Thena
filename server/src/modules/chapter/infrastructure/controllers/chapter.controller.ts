import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  ForbiddenException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ChapterService } from '../../application/services/chapter.service.js';
import {
  ApproveChapterDto,
  RejectChapterDto,
} from '../../application/dtos/chapter-action.dto.js';
import { PaginationQueryDto } from '../../application/dtos/pagination-query.dto.js';
import { CurrentUser } from '../../../../modules/auth/infrastructure/decorators/current-user.decorator.js';
import { JwtPayload } from '../../../../modules/auth/domain/auth.types.js';

@Controller('chapters')
export class ChapterController {
  constructor(private readonly chapterService: ChapterService) {}

  @Get()
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: PaginationQueryDto,
  ) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    return this.chapterService.findAllForUserPaginated(user.sub, user.role, page, limit);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.chapterService.findById(id, user.sub, user.role);
  }

  @Patch(':id/request-review')
  async requestTutorReview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    if (user.role !== 'STUDENT') {
      throw new ForbiddenException('Only students can request tutor review');
    }
    return this.chapterService.requestTutorReview(id, user.sub);
  }

  @Patch(':id/approve')
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveChapterDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (user.role !== 'TUTOR') {
      throw new ForbiddenException('Only tutors can approve chapters');
    }
    return this.chapterService.approve(id, user.sub, dto.comment);
  }

  @Patch(':id/reject')
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectChapterDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (user.role !== 'TUTOR') {
      throw new ForbiddenException('Only tutors can reject chapters');
    }
    return this.chapterService.reject(id, user.sub, dto.comment);
  }
}
