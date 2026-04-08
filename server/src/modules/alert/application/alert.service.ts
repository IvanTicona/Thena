import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import { NotificationService } from '../../notification/application/notification.service.js';

const INACTIVITY_THRESHOLD_DAYS = 7;

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Runs daily at 8:00 AM.
   * Finds all thesis documents where the last submission was > 7 days ago
   * and no active INACTIVITY alert already exists.
   * Creates an alert and notifies the assigned tutor.
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async checkInactivity(): Promise<void> {
    this.logger.log('Running inactivity check...');

    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - INACTIVITY_THRESHOLD_DAYS);

    // Find thesis documents with at least one submission and no active INACTIVITY alert
    const inactiveTheses = await this.prisma.client.thesisDocument.findMany({
      where: {
        // Must have a tutor assigned to receive the notification
        tutorId: { not: null },
        // Has at least one chapter with submissions
        chapters: {
          some: {
            submissions: {
              some: {},
            },
          },
        },
        // No active (unresolved) INACTIVITY alert
        alerts: {
          none: {
            type: 'INACTIVITY',
            resolvedAt: null,
          },
        },
      },
      select: {
        id: true,
        tutorId: true,
        student: {
          select: {
            id: true,
            name: true,
          },
        },
        chapters: {
          select: {
            submissions: {
              orderBy: { submittedAt: 'desc' },
              take: 1,
              select: { submittedAt: true },
            },
          },
        },
      },
    });

    let alertsCreated = 0;

    for (const thesis of inactiveTheses) {
      // Find the most recent submission across all chapters
      const latestSubmission = thesis.chapters
        .flatMap((c) => c.submissions)
        .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())[0];

      // Skip if no submissions at all, or last submission is recent enough
      if (!latestSubmission || latestSubmission.submittedAt >= thresholdDate) {
        continue;
      }

      // Create the inactivity alert
      await this.prisma.client.alert.create({
        data: {
          thesisId: thesis.id,
          type: 'INACTIVITY',
          metadata: {
            lastSubmissionAt: latestSubmission.submittedAt.toISOString(),
            studentId: thesis.student.id,
            studentName: thesis.student.name,
          },
        },
      });

      // Notify the tutor — fire-and-forget
      void this.notificationService.create(
        thesis.tutorId!,
        'INACTIVITY_ALERT',
        '⚠️ Alerta de inactividad',
        `⚠️ Alerta de inactividad: ${thesis.student.name} no ha enviado entregas en 7 días`,
        {
          thesisId: thesis.id,
          studentId: thesis.student.id,
          studentName: thesis.student.name,
          lastSubmissionAt: latestSubmission.submittedAt.toISOString(),
        },
      );

      alertsCreated++;
    }

    this.logger.log(`Inactivity check complete. Alerts created: ${alertsCreated}`);
  }

  /**
   * Resolves an active alert by setting its resolvedAt timestamp.
   */
  async resolveAlert(alertId: string): Promise<{ id: string; resolvedAt: Date }> {
    const alert = await this.prisma.client.alert.findUnique({
      where: { id: alertId },
    });

    if (!alert) {
      throw new NotFoundException(`Alert ${alertId} not found`);
    }

    const updated = await this.prisma.client.alert.update({
      where: { id: alertId },
      data: { resolvedAt: new Date() },
      select: { id: true, resolvedAt: true },
    });

    return { id: updated.id, resolvedAt: updated.resolvedAt! };
  }

  /**
   * Returns active (unresolved) alerts, optionally filtered by thesisId.
   */
  async getActiveAlerts(thesisId?: string) {
    return this.prisma.client.alert.findMany({
      where: {
        resolvedAt: null,
        ...(thesisId ? { thesisId } : {}),
      },
      orderBy: { triggeredAt: 'desc' },
      select: {
        id: true,
        thesisId: true,
        type: true,
        triggeredAt: true,
        resolvedAt: true,
        metadata: true,
        thesis: {
          select: {
            id: true,
            title: true,
            student: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });
  }

  /**
   * Auto-resolves any active INACTIVITY alert for a thesis when a new submission is created.
   * Fire-and-forget — errors are swallowed so they never break the submission flow.
   */
  async resolveInactivityAlertsForThesis(thesisId: string): Promise<void> {
    try {
      await this.prisma.client.alert.updateMany({
        where: {
          thesisId,
          type: 'INACTIVITY',
          resolvedAt: null,
        },
        data: {
          resolvedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to auto-resolve inactivity alerts for thesis ${thesisId}: ${String(error)}`,
      );
    }
  }
}
