import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';

type KnowledgeLayer = 'TUTOR' | 'INSTITUTIONAL';

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
  ): Promise<KnowledgeDocumentSummary[]> {
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

    return chunks.map((group) => ({
      sourceDocument: group.sourceDocument,
      layer: group.layer,
      chunkCount: group._count.id,
      lastUpdated: group._max.createdAt,
    }));
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
  ): Promise<KnowledgeDeletionResult> {
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
  ): Promise<KnowledgeChunkDeletionResult> {
    const chunk = await this.prisma.client.knowledgeChunk.findUnique({
      where: { id },
    });

    if (!chunk) {
      throw new NotFoundException(`Knowledge chunk not found: ${id}`);
    }

    if (ownerId && chunk.ownerId !== ownerId) {
      throw new NotFoundException(`Knowledge chunk not found: ${id}`);
    }

    await this.prisma.client.knowledgeChunk.delete({
      where: { id },
    });

    return { id, deleted: true };
  }
}
