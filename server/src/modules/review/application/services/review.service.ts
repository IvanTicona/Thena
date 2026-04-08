import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';

export interface ReviewAgent {
  type: string;
  status: string;
}

export interface SourceReference {
  layer: 'TUTOR' | 'INSTITUTIONAL';
  chunkId: string;
  documentTitle: string;
  section: string;
}

export interface BySeverity {
  INFO: number;
  SUGGESTION: number;
  WARNING: number;
  ERROR: number;
}

export interface ReviewObservation {
  id: string;
  type: string;
  severity: string;
  message: string;
  suggestion: string | null;
  textFragment: string | null;
  offsetStart: number | null;
  offsetEnd: number | null;
  sourceReference: SourceReference | null;
  source: string;
  authorId: string | null;
  isMutable: boolean;
  escalationLevel: number;
}

export interface ReviewJobBase {
  id: string;
  submissionId: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
  agents: ReviewAgent[];
}

export interface ReviewJobCompleted extends ReviewJobBase {
  report: {
    id: string;
    summaryText: string;
    totalObservations: number;
    bySeverity: BySeverity;
  };
  observations: ReviewObservation[];
  markdownContent: string | null;
}

export type ReviewJobResult = ReviewJobBase | ReviewJobCompleted;

function parseSourceReference(value: unknown): SourceReference | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const obj = value as Record<string, string>;
  return {
    layer: obj.layer as SourceReference['layer'],
    chunkId: obj.chunkId,
    documentTitle: obj.documentTitle,
    section: obj.section,
  };
}

function parseBySeverity(value: unknown): BySeverity {
  if (!value || typeof value !== 'object') {
    return { INFO: 0, SUGGESTION: 0, WARNING: 0, ERROR: 0 };
  }
  const obj = value as Record<string, number>;
  return {
    INFO: obj.INFO ?? 0,
    SUGGESTION: obj.SUGGESTION ?? 0,
    WARNING: obj.WARNING ?? 0,
    ERROR: obj.ERROR ?? 0,
  };
}

@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async findByJobId(jobId: string, requestingUserId?: string): Promise<ReviewJobResult> {
    const job = await this.prisma.client.reviewJob.findUnique({
      where: { id: jobId },
      include: {
        agentResults: {
          select: { agentType: true, status: true },
          orderBy: { createdAt: 'asc' },
        },
        reviewReport: true,
        submission: {
          select: {
            markdownContent: true,
            chapter: {
              select: {
                thesis: { select: { studentId: true } },
              },
            },
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Review job not found');
    }

    // P0-7: Ownership check — only the student who owns the chapter can view its review.
    // Tutors bypass this check (they access reviews via their own dashboard endpoints).
    if (requestingUserId) {
      const studentId = job.submission.chapter.thesis.studentId;
      if (studentId !== requestingUserId) {
        throw new ForbiddenException('No tenés permiso para ver esta revisión');
      }
    }

    const base = {
      id: job.id,
      submissionId: job.submissionId,
      status: job.status,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      durationMs: job.durationMs,
      agents: job.agentResults.map((a) => ({
        type: a.agentType,
        status: a.status,
      })),
    };

    if (job.status !== 'COMPLETED' || !job.reviewReport) {
      return base;
    }

    // Fetch observations for the completed report
    const observations = await this.prisma.client.observation.findMany({
      where: { reviewReportId: job.reviewReport.id },
      orderBy: { createdAt: 'asc' },
    });

    return {
      ...base,
      report: {
        id: job.reviewReport.id,
        summaryText: job.reviewReport.summaryText,
        totalObservations: job.reviewReport.totalObservations,
        bySeverity: parseBySeverity(job.reviewReport.bySeverity),
      },
      observations: observations.map((o) => ({
        id: o.id,
        type: o.type,
        severity: o.severity,
        message: o.message,
        suggestion: o.suggestion,
        textFragment: o.textFragment,
        offsetStart: o.offsetStart,
        offsetEnd: o.offsetEnd,
        sourceReference: parseSourceReference(o.sourceReference),
        source: o.source,
        authorId: o.authorId,
        isMutable: o.isMutable,
        escalationLevel: o.escalationLevel,
      })),
      markdownContent: job.submission.markdownContent,
    };
  }

  async findLatestByChapterId(chapterId: string, requestingUserId?: string): Promise<ReviewJobResult> {
    const submission = await this.prisma.client.submission.findFirst({
      where: { chapterId },
      orderBy: { versionNumber: 'desc' },
      select: { reviewJob: { select: { id: true } } },
    });

    if (!submission?.reviewJob) {
      throw new NotFoundException('No review found for this chapter');
    }

    return this.findByJobId(submission.reviewJob.id, requestingUserId);
  }
}
