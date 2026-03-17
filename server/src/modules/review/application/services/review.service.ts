import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';

@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async findByJobId(jobId: string) {
    const job = await this.prisma.client.reviewJob.findUnique({
      where: { id: jobId },
      include: {
        agentResults: {
          select: { agentType: true, status: true },
          orderBy: { createdAt: 'asc' },
        },
        reviewReport: true,
        submission: {
          select: { markdownContent: true },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Review job not found');
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
        bySeverity: job.reviewReport.bySeverity,
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
        sourceReference: o.sourceReference,
      })),
      markdownContent: job.submission.markdownContent,
    };
  }

  async findLatestByChapterId(chapterId: string) {
    const submission = await this.prisma.client.submission.findFirst({
      where: { chapterId },
      orderBy: { versionNumber: 'desc' },
      select: { reviewJob: { select: { id: true } } },
    });

    if (!submission?.reviewJob) {
      throw new NotFoundException('No review found for this chapter');
    }

    return this.findByJobId(submission.reviewJob.id);
  }
}
