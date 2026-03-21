import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Req,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KnowledgeService } from '../../application/services/knowledge.service.js';
import { AuthenticatedRequest } from '../../../../shared/mock-auth/mock-auth.middleware.js';

@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  async list(@Req() req: AuthenticatedRequest, @Query('layer') layer?: string) {
    const userId = req.user?.id ?? null;
    // Tutors see their own + institutional; if no user, show institutional only
    return this.knowledgeService.listByOwner(
      layer === 'INSTITUTIONAL' ? null : userId,
      layer,
    );
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Req() req: AuthenticatedRequest,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 20 * 1024 * 1024 }), // 20MB
          new FileTypeValidator({
            fileType:
              /(application\/pdf|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Query('layer') layer: string = 'TUTOR',
  ) {
    const userId = req.user?.id ?? null;
    const effectiveLayer = req.user?.role === 'TUTOR' ? layer : 'INSTITUTIONAL';
    const ownerId = effectiveLayer === 'TUTOR' ? userId : null;

    return this.knowledgeService.upload(file, effectiveLayer, ownerId);
  }

  @Delete(':sourceDocument')
  async delete(
    @Req() req: AuthenticatedRequest,
    @Param('sourceDocument') sourceDocument: string,
  ) {
    const userId = req.user?.id ?? null;
    return this.knowledgeService.deleteBySource(sourceDocument, userId);
  }
}
