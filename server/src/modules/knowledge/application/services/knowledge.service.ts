import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { AuditService } from '../../../audit/application/audit.service.js';
import { AuditAction } from '../../../audit/domain/audit.constants.js';

type KnowledgeLayer = 'TUTOR' | 'INSTITUTIONAL';

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
    private readonly auditService: AuditService,
  ) {
    this.engineUrl = this.config.getOrThrow<string>('ENGINE_URL');
  }

  async listByOwner(
    ownerId: string | null,
    layer: string | undefined,
    page: number,
    limit: number,
  ): Promise<{
    data: KnowledgeDocumentSummary[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const resolvedLayer: KnowledgeLayer | undefined =
      layer !== undefined
        ? (layer as KnowledgeLayer)
        : ownerId !== null
          ? undefined
          : 'INSTITUTIONAL';

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

    const skip = (page - 1) * limit;
    const total = allItems.length;
    const data = allItems.slice(skip, skip + limit);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async upload(
    file: Express.Multer.File,
    layer: string,
    ownerId: string | null,
    actorId: string,
  ): Promise<EngineIngestionResult> {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('Only PDF and DOCX files are supported');
    }

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

    const ingestionResult = (await response.json()) as EngineIngestionResult;

    void this.auditService.log({
      action: AuditAction.UPLOAD_KNOWLEDGE,
      actorId,
      entityType: 'knowledge',
      entityId: file.originalname,
      metadata: {
        layer,
        chunksCreated: ingestionResult.chunks_created,
        sourceDocument: ingestionResult.source_document,
      },
    });

    return ingestionResult;
  }

  async deleteBySource(
    sourceDocument: string,
    ownerId: string | null,
    userRole?: string | null,
  ): Promise<KnowledgeDeletionResult> {
    const sample = await this.prisma.client.knowledgeChunk.findFirst({
      where: { sourceDocument },
      select: { layer: true, ownerId: true },
    });

    if (!sample) {
      throw new NotFoundException(
        `No knowledge found for document: ${sourceDocument}`,
      );
    }

    if (sample.layer === 'INSTITUTIONAL') {
      if (
        !userRole ||
        !(INSTITUTIONAL_ADMIN_ROLES as readonly string[]).includes(userRole)
      ) {
        throw new ForbiddenException(
          'Solo los administradores pueden eliminar conocimiento institucional',
        );
      }
      const result = await this.prisma.client.knowledgeChunk.deleteMany({
        where: { sourceDocument, layer: 'INSTITUTIONAL' },
      });

      if (ownerId) {
        void this.auditService.log({
          action: AuditAction.DELETE_KNOWLEDGE,
          actorId: ownerId,
          entityType: 'knowledge',
          entityId: sourceDocument,
          metadata: { layer: 'INSTITUTIONAL', deletedChunks: result.count },
        });
      }

      return { sourceDocument, deletedChunks: result.count };
    }

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

    if (ownerId) {
      void this.auditService.log({
        action: AuditAction.DELETE_KNOWLEDGE,
        actorId: ownerId,
        entityType: 'knowledge',
        entityId: sourceDocument,
        metadata: { layer: 'TUTOR', deletedChunks: result.count },
      });
    }

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

    if (chunk.layer === 'INSTITUTIONAL') {
      if (
        !userRole ||
        !(INSTITUTIONAL_ADMIN_ROLES as readonly string[]).includes(userRole)
      ) {
        throw new ForbiddenException(
          'Solo los administradores pueden eliminar conocimiento institucional',
        );
      }
      await this.prisma.client.knowledgeChunk.delete({ where: { id } });

      if (ownerId) {
        void this.auditService.log({
          action: AuditAction.DELETE_KNOWLEDGE,
          actorId: ownerId,
          entityType: 'knowledge',
          entityId: id,
          metadata: {
            layer: 'INSTITUTIONAL',
            sourceDocument: chunk.sourceDocument,
          },
        });
      }

      return { id, deleted: true };
    }

    if (ownerId !== null && chunk.ownerId !== ownerId) {
      throw new NotFoundException(`Knowledge chunk not found: ${id}`);
    }

    await this.prisma.client.knowledgeChunk.delete({
      where: { id },
    });

    if (ownerId) {
      void this.auditService.log({
        action: AuditAction.DELETE_KNOWLEDGE,
        actorId: ownerId,
        entityType: 'knowledge',
        entityId: id,
        metadata: { layer: 'TUTOR', sourceDocument: chunk.sourceDocument },
      });
    }

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
