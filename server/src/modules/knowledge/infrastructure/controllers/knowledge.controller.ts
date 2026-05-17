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
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KnowledgeService } from '../../application/services/knowledge.service.js';
import { CurrentUser } from '../../../../modules/auth/infrastructure/decorators/current-user.decorator.js';
import { Roles } from '../../../../modules/auth/infrastructure/decorators/roles.decorator.js';
import { RolesGuard } from '../../../../modules/auth/infrastructure/guards/roles.guard.js';
import type { JwtPayload } from '../../../../modules/auth/domain/auth.types.js';

@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  async listAllChunks() {
    return this.knowledgeService.listAllChunks();
  }

  @Get()
  async list(
    @CurrentUser() user: JwtPayload,
    @Query('layer') layer?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page !== undefined ? parseInt(page, 10) : 1;
    const limitNum = limit !== undefined ? parseInt(limit, 10) : 20;
    return this.knowledgeService.listByOwner(
      layer === 'INSTITUTIONAL' ? null : user.sub,
      layer,
      pageNum,
      limitNum,
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
    const effectiveLayer = user.role === 'TUTOR' ? layer : 'INSTITUTIONAL';
    const ownerId = effectiveLayer === 'TUTOR' ? user.sub : null;

    return this.knowledgeService.upload(
      file,
      effectiveLayer,
      ownerId,
      user.sub,
    );
  }

  @Delete('chunk/:id')
  async deleteChunk(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.knowledgeService.deleteById(id, user.sub, user.role);
  }

  @Delete(':sourceDocument')
  async delete(
    @CurrentUser() user: JwtPayload,
    @Param('sourceDocument') sourceDocument: string,
  ) {
    return this.knowledgeService.deleteBySource(
      sourceDocument,
      user.sub,
      user.role,
    );
  }
}
