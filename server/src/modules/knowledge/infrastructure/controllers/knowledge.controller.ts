import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KnowledgeService } from '../../application/services/knowledge.service.js';
import { CurrentUser } from '../../../../modules/auth/infrastructure/decorators/current-user.decorator.js';
import { JwtPayload } from '../../../../modules/auth/domain/auth.types.js';

@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  async list(@CurrentUser() user: JwtPayload, @Query('layer') layer?: string) {
    const userId = user?.sub ?? null;
    // Tutors see their own + institutional; if no user, show institutional only
    return this.knowledgeService.listByOwner(
      layer === 'INSTITUTIONAL' ? null : userId,
      layer,
    );
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @CurrentUser() user: JwtPayload,
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
    const userId = user?.sub ?? null;
    const effectiveLayer = user?.role === 'TUTOR' ? layer : 'INSTITUTIONAL';
    const ownerId = effectiveLayer === 'TUTOR' ? userId : null;

    return this.knowledgeService.upload(file, effectiveLayer, ownerId);
  }

  @Delete('chunk/:id')
  async deleteChunk(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const userId = user?.sub ?? null;
    const userRole = user?.role ?? null;
    // P0-8: Pass role so service can enforce ADMIN-only for INSTITUTIONAL chunks
    return this.knowledgeService.deleteById(id, userId, userRole);
  }

  @Delete(':sourceDocument')
  async delete(
    @CurrentUser() user: JwtPayload,
    @Param('sourceDocument') sourceDocument: string,
  ) {
    const userId = user?.sub ?? null;
    const userRole = user?.role ?? null;
    // P0-8: Pass role so service can enforce ADMIN-only for INSTITUTIONAL chunks
    return this.knowledgeService.deleteBySource(sourceDocument, userId, userRole);
  }
}
