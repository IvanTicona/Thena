import {
  Controller,
  Get,
  Post,
  Param,
  ParseUUIDPipe,
  Body,
  ForbiddenException,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { SubmissionService } from '../../application/services/submission.service.js';
import { CreateSubmissionDto } from '../../application/dtos/create-submission.dto.js';
import { AnalyzeSubmissionDto, ConfirmSubmissionDto } from '../../application/dtos/analyze-submission.dto.js';
import { CurrentUser } from '../../../../modules/auth/infrastructure/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../../../modules/auth/domain/auth.types.js';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

@Controller('submissions')
export class SubmissionController {
  constructor(private readonly submissionService: SubmissionService) {}

  @Get('mine')
  async listMine(@CurrentUser() user: JwtPayload) {
    if (user.role !== 'STUDENT') {
      throw new ForbiddenException(
        'Only students can access their submissions',
      );
    }
    return this.submissionService.findAllForStudent(user.sub);
  }

  @Get(':id/file')
  async downloadFile(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    const { buffer, fileName } = await this.submissionService.downloadFile(
      id,
      user.sub,
      user.role,
    );

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
      'Content-Length': buffer.length,
      'Cache-Control': 'private, max-age=3600',
    });

    res.end(buffer);
  }

  @Post('analyze')
  @UseInterceptors(FileInterceptor('file'))
  async analyze(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE })],
      }),
    )
    file: Express.Multer.File,
    @Body() dto: AnalyzeSubmissionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (user.role !== 'STUDENT') {
      throw new ForbiddenException('Only students can analyze documents');
    }
    return this.submissionService.analyzeDocument(user.sub, dto.chapterId, file);
  }

  @Post('confirm')
  async confirm(
    @Body() dto: ConfirmSubmissionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (user.role !== 'STUDENT') {
      throw new ForbiddenException('Only students can confirm submissions');
    }
    return this.submissionService.confirmFromFullDocument(
      user.sub,
      dto.chapterId,
      dto.tempFileKey,
    );
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE })],
      }),
    )
    file: Express.Multer.File,
    @Body() dto: CreateSubmissionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (user.role !== 'STUDENT') {
      throw new ForbiddenException('Only students can submit chapters');
    }
    return this.submissionService.create(user.sub, dto.chapterId, file);
  }
}
