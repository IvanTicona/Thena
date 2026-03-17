import {
  Controller,
  Post,
  Body,
  Req,
  ForbiddenException,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SubmissionService } from '../../application/services/submission.service.js';
import { CreateSubmissionDto } from '../../application/dtos/create-submission.dto.js';
import { AuthenticatedRequest } from '../../../../shared/mock-auth/mock-auth.middleware.js';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

@Controller('submissions')
export class SubmissionController {
  constructor(private readonly submissionService: SubmissionService) {}

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
    @Req() req: AuthenticatedRequest,
  ) {
    if (req.user.role !== 'STUDENT') {
      throw new ForbiddenException('Only students can submit chapters');
    }
    return this.submissionService.create(req.user.id, dto.chapterId, file);
  }
}
