import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';

type KnowledgeLayer = 'TUTOR' | 'INSTITUTIONAL';

/** Roles allowed to delete INSTITUTIONAL knowledge chunks */
const INSTITUTIONAL_ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'] as const;

export interface KnowledgeDocumentSummary {
  sourceDocument: string;
  layer: string;
  chunkCount: number;
  lastUpdated: Date | null;
}

export interface KnowledgeDeletionResult {
  sourceDocument: string;
  deletedChunks: number;
}

export interface KnowledgeChunkDeletionResult {
  id: string;
  deleted: true;
}

export interface EngineIngestionResult {
  status: string;
  source_document: string;
  chunks_created: number;
  layer: string;
}

export interface AdminKnowledgeChunk {
  id: string;
  sourceDocument: string;
  layer: string;
  content: string;
  createdAt: Date;
}

@Injectable()
export class KnowledgeService {
  private engineUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.engineUrl = this.config.get<string>(
      'ENGINE_URL',
      'http://engine:8000',
    );
  }

  async listByOwner(
    ownerId: string | null,
    layer?: string,
    page?: number,
    limit?: number,
  ): Promise<{
    data: KnowledgeDocumentSummary[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const resolvedLayer: KnowledgeLayer =
      (layer as KnowledgeLayer) ?? (ownerId ? undefined : 'INSTITUTIONAL');

    const chunks = await this.prisma.client.knowledgeChunk.groupBy({
      by: ['sourceDocument', 'layer'],
      where: {
        ...(resolvedLayer && { layer: resolvedLayer }),
        ...(ownerId ? { ownerId } : { layer: 'INSTITUTIONAL' }),
      },
      _count: { id: true },
      _max: { createdAt: true },
    });

    const allItems = chunks.map((group) => ({
      sourceDocument: group.sourceDocument,
      layer: group.layer,
      chunkCount: group._count.id,
      lastUpdated: group._max.createdAt,
    }));

    const resolvedPage = Math.max(1, page ?? 1);
    const resolvedLimit = Math.min(100, Math.max(1, limit ?? 20));
    const skip = (resolvedPage - 1) * resolvedLimit;
    const total = allItems.length;
    const data = allItems.slice(skip, skip + resolvedLimit);

    return {
      data,
      meta: {
        page: resolvedPage,
        limit: resolvedLimit,
        total,
        totalPages: Math.ceil(total / resolvedLimit),
      },
    };
  }

  async upload(
    file: Express.Multer.File,
    layer: string,
    ownerId: string | null,
  ): Promise<EngineIngestionResult> {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('Only PDF and DOCX files are supported');
    }

    // Forward to engine for processing
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }),
      file.originalname,
    );
    formData.append('layer', layer);
    formData.append('source_document', file.originalname);
    if (ownerId) {
      formData.append('owner_id', ownerId);
    }

    const response = await fetch(`${this.engineUrl}/knowledge/ingest`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new BadRequestException(`Engine ingestion failed: ${error}`);
    }

    return response.json() as Promise<EngineIngestionResult>;
  }

  async deleteBySource(
    sourceDocument: string,
    ownerId: string | null,
    userRole?: string | null,
  ): Promise<KnowledgeDeletionResult> {
    // Peek at the layer before attempting deletion
    const sample = await this.prisma.client.knowledgeChunk.findFirst({
      where: { sourceDocument },
      select: { layer: true, ownerId: true },
    });

    if (!sample) {
      throw new NotFoundException(
        `No knowledge found for document: ${sourceDocument}`,
      );
    }

    // P0-8: INSTITUTIONAL chunks can only be deleted by ADMIN or SUPER_ADMIN
    if (sample.layer === 'INSTITUTIONAL') {
      if (!userRole || !(INSTITUTIONAL_ADMIN_ROLES as readonly string[]).includes(userRole)) {
        throw new ForbiddenException(
          'Solo los administradores pueden eliminar conocimiento institucional',
        );
      }
      // Admin delete: remove all chunks for this source regardless of ownerId
      const result = await this.prisma.client.knowledgeChunk.deleteMany({
        where: { sourceDocument, layer: 'INSTITUTIONAL' },
      });
      return { sourceDocument, deletedChunks: result.count };
    }

    // TUTOR layer: only the owner can delete
    const where = {
      sourceDocument,
      ...(ownerId && { ownerId }),
    };

    const existing = await this.prisma.client.knowledgeChunk.findFirst({
      where,
    });

    if (!existing) {
      throw new NotFoundException(
        `No knowledge found for document: ${sourceDocument}`,
      );
    }

    const result = await this.prisma.client.knowledgeChunk.deleteMany({
      where,
    });

    return {
      sourceDocument,
      deletedChunks: result.count,
    };
  }

  async deleteById(
    id: string,
    ownerId: string | null,
    userRole?: string | null,
  ): Promise<KnowledgeChunkDeletionResult> {
    const chunk = await this.prisma.client.knowledgeChunk.findUnique({
      where: { id },
    });

    if (!chunk) {
      throw new NotFoundException(`Knowledge chunk not found: ${id}`);
    }

    // P0-8: INSTITUTIONAL chunks can only be deleted by ADMIN or SUPER_ADMIN
    if (chunk.layer === 'INSTITUTIONAL') {
      if (!userRole || !(INSTITUTIONAL_ADMIN_ROLES as readonly string[]).includes(userRole)) {
        throw new ForbiddenException(
          'Solo los administradores pueden eliminar conocimiento institucional',
        );
      }
      await this.prisma.client.knowledgeChunk.delete({ where: { id } });
      return { id, deleted: true };
    }

    // TUTOR layer: only the owner can delete
    if (ownerId && chunk.ownerId !== ownerId) {
      throw new NotFoundException(`Knowledge chunk not found: ${id}`);
    }

    await this.prisma.client.knowledgeChunk.delete({
      where: { id },
    });

    return { id, deleted: true };
  }

  async listAllChunks(): Promise<AdminKnowledgeChunk[]> {
    const chunks = await this.prisma.client.knowledgeChunk.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        sourceDocument: true,
        layer: true,
        content: true,
        createdAt: true,
      },
    });

    return chunks.map((c) => ({
      id: c.id,
      sourceDocument: c.sourceDocument,
      layer: c.layer,
      content: c.content,
      createdAt: c.createdAt,
    }));
  }
}
