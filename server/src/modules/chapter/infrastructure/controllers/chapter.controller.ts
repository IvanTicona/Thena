import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Req,
  ForbiddenException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ChapterService } from '../../application/services/chapter.service.js';
import {
  ApproveChapterDto,
  RejectChapterDto,
} from '../../application/dtos/chapter-action.dto.js';
import { AuthenticatedRequest } from '../../../../shared/mock-auth/mock-auth.middleware.js';

@Controller('chapters')
export class ChapterController {
  constructor(private readonly chapterService: ChapterService) {}

  @Get()
  async findAll(@Req() req: AuthenticatedRequest) {
    return this.chapterService.findAllForUser(req.user.id, req.user.role);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.chapterService.findById(id);
  }

  @Patch(':id/approve')
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() _dto: ApproveChapterDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (req.user.role !== 'TUTOR') {
      throw new ForbiddenException('Only tutors can approve chapters');
    }
    return this.chapterService.approve(id, req.user.id);
  }

  @Patch(':id/reject')
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() _dto: RejectChapterDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (req.user.role !== 'TUTOR') {
      throw new ForbiddenException('Only tutors can reject chapters');
    }
    return this.chapterService.reject(id);
  }
}
