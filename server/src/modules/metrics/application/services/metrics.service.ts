import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';

export interface MetricsSummary {
  totalTheses: number;
  totalReviews: number;
  avgReviewTimeSeconds: number;
  activeStudentsThisMonth: number;
}

export interface ObservationsBySeverity {
  severity: string;
  count: number;
}

export interface ObservationsByAgent {
  agent: string;
  count: number;
}

export interface ReviewsOverTime {
  date: string;
  count: number;
}

@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(): Promise<MetricsSummary> {
    const [totalTheses, totalReviews, avgDuration, activeStudents] = await Promise.all([
      this.prisma.client.thesisDocument.count(),

      this.prisma.client.reviewJob.count({
        where: { status: 'COMPLETED' },
      }),

      this.prisma.client.reviewJob.aggregate({
        _avg: { durationMs: true },
        where: { status: 'COMPLETED', durationMs: { not: null } },
      }),

      this.prisma.client.submission.findMany({
        where: {
          submittedAt: {
            gte: new Date(new Date().setDate(1)), // First day of current month
          },
        },
        select: { studentId: true },
        distinct: ['studentId'],
      }),
    ]);

    const avgMs = avgDuration._avg.durationMs ?? 0;

    return {
      totalTheses,
      totalReviews,
      avgReviewTimeSeconds: Math.round(avgMs / 1000),
      activeStudentsThisMonth: activeStudents.length,
    };
  }

  async getObservationsBySeverity(): Promise<ObservationsBySeverity[]> {
    const grouped = await this.prisma.client.observation.groupBy({
      by: ['severity'],
      _count: { id: true },
      orderBy: { severity: 'asc' },
    });

    return grouped.map((row) => ({
      severity: row.severity as string,
      count: row._count.id,
    }));
  }

  async getObservationsByAgent(): Promise<ObservationsByAgent[]> {
    const grouped = await this.prisma.client.observation.groupBy({
      by: ['type'],
      _count: { id: true },
      orderBy: { type: 'asc' },
    });

    return grouped.map((row) => ({
      agent: row.type as string,
      count: row._count.id,
    }));
  }

  async getReviewsOverTime(): Promise<ReviewsOverTime[]> {
    // Last 30 days, group by date
    const since = new Date();
    since.setDate(since.getDate() - 29);
    since.setHours(0, 0, 0, 0);

    const jobs = await this.prisma.client.reviewJob.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: { gte: since },
      },
      select: { completedAt: true },
    });

    // Build a map: date string → count
    const countByDate = new Map<string, number>();

    // Pre-fill all 30 days with 0
    for (let i = 0; i < 30; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      countByDate.set(key, 0);
    }

    for (const job of jobs) {
      if (!job.completedAt) continue;
      const key = job.completedAt.toISOString().slice(0, 10);
      countByDate.set(key, (countByDate.get(key) ?? 0) + 1);
    }

    return Array.from(countByDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
  }
}
