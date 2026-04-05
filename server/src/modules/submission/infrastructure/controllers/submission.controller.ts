import {
  Controller,
  Get,
  Post,
  Body,
  ForbiddenException,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SubmissionService } from '../../application/services/submission.service.js';
import { CreateSubmissionDto } from '../../application/dtos/create-submission.dto.js';
import { CurrentUser } from '../../../../modules/auth/infrastructure/decorators/current-user.decorator.js';
import { JwtPayload } from '../../../../modules/auth/domain/auth.types.js';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

@Controller('submissions')
export class SubmissionController {
  constructor(private readonly submissionService: SubmissionService) {}

  @Get('mine')
  async listMine(@CurrentUser() user: JwtPayload) {
    if (user.role !== 'STUDENT') {
      throw new ForbiddenException('Only students can access their submissions');
    }
    return this.submissionService.findAllForStudent(user.sub);
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
