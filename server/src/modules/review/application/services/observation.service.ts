import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { CreateObservationDto, UpdateObservationDto } from '../dtos/observation.dto.js';

export interface ObservationResult {
  id: string;
  reviewReportId: string;
  type: string;
  severity: string;
  message: string;
  suggestion: string | null;
  textFragment: string | null;
  offsetStart: number | null;
  offsetEnd: number | null;
  source: string;
  authorId: string | null;
  isMutable: boolean;
  escalationLevel: number;
  createdAt: Date;
  author: { id: string; name: string } | null;
}

@Injectable()
export class ObservationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tutorId: string, dto: CreateObservationDto): Promise<ObservationResult> {
    // Verify the review report exists and belongs to a thesis assigned to this tutor
    const report = await this.prisma.client.reviewReport.findUnique({
      where: { id: dto.reviewId },
      include: {
        reviewJob: {
          include: {
            submission: {
              include: {
                chapter: {
                  include: {
                    thesis: {
                      select: { tutorId: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('Review report not found');
    }

    const thesis = report.reviewJob.submission.chapter.thesis;
    if (thesis.tutorId !== tutorId) {
      throw new ForbiddenException('You are not the tutor for this thesis');
    }

    const observation = await this.prisma.client.observation.create({
      data: {
        reviewReportId: dto.reviewId,
        type: dto.type as any,
        severity: dto.severity as any,
        message: dto.message,
        suggestion: dto.suggestion ?? null,
        textFragment: dto.textFragment ?? null,
        offsetStart: dto.offsetStart ?? null,
        offsetEnd: dto.offsetEnd ?? null,
        source: 'TUTOR',
        authorId: tutorId,
        isMutable: true,
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    return this.mapObservation(observation);
  }

  async update(
    observationId: string,
    tutorId: string,
    dto: UpdateObservationDto,
  ): Promise<ObservationResult> {
    const observation = await this.prisma.client.observation.findUnique({
      where: { id: observationId },
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    if (!observation) {
      throw new NotFoundException('Observation not found');
    }

    // Only mutable (tutor) observations can be edited
    if (!observation.isMutable || observation.source !== 'TUTOR') {
      throw new ForbiddenException('System observations cannot be modified');
    }

    // Only the author can edit their observation
    if (observation.authorId !== tutorId) {
      throw new ForbiddenException('You can only edit your own observations');
    }

    const updated = await this.prisma.client.observation.update({
      where: { id: observationId },
      data: {
        ...(dto.severity !== undefined && { severity: dto.severity as any }),
        ...(dto.message !== undefined && { message: dto.message }),
        ...(dto.suggestion !== undefined && { suggestion: dto.suggestion }),
        ...(dto.textFragment !== undefined && { textFragment: dto.textFragment }),
        ...(dto.offsetStart !== undefined && { offsetStart: dto.offsetStart }),
        ...(dto.offsetEnd !== undefined && { offsetEnd: dto.offsetEnd }),
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    return this.mapObservation(updated);
  }

  async remove(observationId: string, tutorId: string): Promise<void> {
    const observation = await this.prisma.client.observation.findUnique({
      where: { id: observationId },
    });

    if (!observation) {
      throw new NotFoundException('Observation not found');
    }

    // Only mutable (tutor) observations can be deleted
    if (!observation.isMutable || observation.source !== 'TUTOR') {
      throw new ForbiddenException('System observations cannot be deleted');
    }

    // Only the author can delete their observation
    if (observation.authorId !== tutorId) {
      throw new ForbiddenException('You can only delete your own observations');
    }

    await this.prisma.client.observation.delete({
      where: { id: observationId },
    });
  }

  private mapObservation(obs: {
    id: string;
    reviewReportId: string;
    type: string;
    severity: string;
    message: string;
    suggestion: string | null;
    textFragment: string | null;
    offsetStart: number | null;
    offsetEnd: number | null;
    source: string;
    authorId: string | null;
    isMutable: boolean;
    escalationLevel: number;
    createdAt: Date;
    author: { id: string; name: string } | null;
  }): ObservationResult {
    return {
      id: obs.id,
      reviewReportId: obs.reviewReportId,
      type: obs.type,
      severity: obs.severity,
      message: obs.message,
      suggestion: obs.suggestion,
      textFragment: obs.textFragment,
      offsetStart: obs.offsetStart,
      offsetEnd: obs.offsetEnd,
      source: obs.source,
      authorId: obs.authorId,
      isMutable: obs.isMutable,
      escalationLevel: obs.escalationLevel,
      createdAt: obs.createdAt,
      author: obs.author,
    };
  }
}
