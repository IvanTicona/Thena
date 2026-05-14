import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { AuditService } from '../../../audit/application/audit.service.js';
import { AuditAction } from '../../../audit/domain/audit.constants.js';
import { UserRole } from '../../../auth/domain/auth.types.js';
import { NotificationService } from '../../../notification/application/notification.service.js';

export interface ChapterDetail {
  id: string;
  number: number;
  title: string;
  status: string;
  submissions: {
    id: string;
    versionNumber: number;
    fileName: string;
    submittedAt: Date;
    reviewJob: { id: string; status: string } | null;
  }[];
  approvedBy: string | null;
  approvedAt: Date | null;
}

export interface ChapterApprovalResult {
  id: string;
  number: number;
  title: string;
  status: string;
  approvedBy: string | null;
  approvedAt: Date | null;
  comment: string | null;
  nextChapter: {
    id: string;
    number: number;
    title: string;
    status: string;
  } | null;
}

export interface ChapterRejectionResult {
  id: string;
  status: string;
  comment: string | null;
}

export interface RequestTutorReviewResult {
  id: string;
  status: string;
}

@Injectable()
export class ChapterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
  ) {}

  async findById(id: string, userId: string, role: UserRole): Promise<ChapterDetail> {
    const chapter = await this.prisma.client.chapter.findUnique({
      where: { id },
      include: {
        thesis: { select: { studentId: true, tutorId: true } },
        submissions: {
          orderBy: { versionNumber: 'desc' },
          select: {
            id: true,
            versionNumber: true,
            fileName: true,
            submittedAt: true,
            reviewJob: {
              select: { id: true, status: true },
            },
          },
        },
      },
    });

    if (!chapter) {
      throw new NotFoundException('Chapter not found');
    }

    // Ownership check
    if (role === 'STUDENT' && chapter.thesis.studentId !== userId) {
      throw new ForbiddenException('Chapter does not belong to this student');
    }

    if (role === 'TUTOR' && chapter.thesis.tutorId !== userId) {
      throw new ForbiddenException('Chapter is not assigned to this tutor');
    }

    return {
      id: chapter.id,
      number: chapter.number,
      title: chapter.title,
      status: chapter.status,
      submissions: chapter.submissions,
      approvedBy: chapter.approvedBy,
      approvedAt: chapter.approvedAt,
    };
  }

  async approve(chapterId: string, tutorId: string, comment?: string): Promise<ChapterApprovalResult> {
    const chapter = await this.prisma.client.chapter.findUnique({
      where: { id: chapterId },
      include: {
        thesis: { select: { id: true, tutorId: true, studentId: true } },
        submissions: {
          include: {
            reviewJob: true,
          },
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!chapter) {
      throw new NotFoundException('Chapter not found');
    }

    // Ownership check: only the assigned tutor can approve
    if (chapter.thesis.tutorId !== tutorId) {
      throw new ForbiddenException('Chapter is not assigned to this tutor');
    }

    if (chapter.status === 'APPROVED') {
      throw new BadRequestException('Chapter is already approved');
    }

    // Check that there's a completed review
    const latestSubmission = chapter.submissions[0];
    if (
      !latestSubmission?.reviewJob ||
      latestSubmission.reviewJob.status !== 'COMPLETED'
    ) {
      throw new BadRequestException('Chapter has no completed review');
    }

    // Approve the chapter
    const approved = await this.prisma.client.chapter.update({
      where: { id: chapterId },
      data: {
        status: 'APPROVED',
        approvedBy: tutorId,
        approvedAt: new Date(),
        ...(comment !== undefined && { comment }),
      },
    });

    // Unlock next chapter if it exists (scope by thesisId)
    let nextChapter = null;
    if (chapter.number < 8) {
      const updated = await this.prisma.client.chapter.updateMany({
        where: {
          thesisId: chapter.thesis.id,
          number: chapter.number + 1,
          status: 'LOCKED',
        },
        data: { status: 'DRAFT' },
      });

      if (updated.count > 0) {
        nextChapter = await this.prisma.client.chapter.findFirst({
          where: {
            thesisId: chapter.thesis.id,
            number: chapter.number + 1,
          },
        });
      }
    }

    // Audit log — fire-and-forget
    void this.auditService.log({
      action: AuditAction.APPROVE_CHAPTER,
      actorId: tutorId,
      entityType: 'chapter',
      entityId: chapterId,
      metadata: { chapterNumber: chapter.number, thesisId: chapter.thesis.id },
    });

    // Notification for student — fire-and-forget (errors swallowed in NotificationService)
    void this.notificationService.create(
      chapter.thesis.studentId,
      'CHAPTER_APPROVED',
      'Capítulo aprobado',
      `Tu capítulo "${chapter.title}" fue aprobado por el tutor.`,
      { chapterId, chapterNumber: chapter.number },
    );

    return {
      id: approved.id,
      number: approved.number,
      title: approved.title,
      status: approved.status,
      approvedBy: approved.approvedBy,
      approvedAt: approved.approvedAt,
      comment: approved.comment,
      nextChapter: nextChapter
        ? {
            id: nextChapter.id,
            number: nextChapter.number,
            title: nextChapter.title,
            status: nextChapter.status,
          }
        : null,
    };
  }

  async requestTutorReview(
    chapterId: string,
    studentId: string,
  ): Promise<RequestTutorReviewResult> {
    const chapter = await this.prisma.client.chapter.findUnique({
      where: { id: chapterId },
      include: {
        thesis: { select: { studentId: true } },
        submissions: {
          include: { reviewJob: true },
          orderBy: { versionNumber: 'desc' },
        },
      },
    });

    if (!chapter) {
      throw new NotFoundException('Chapter not found');
    }

    if (chapter.thesis.studentId !== studentId) {
      throw new ForbiddenException('Chapter does not belong to this student');
    }

    if (chapter.status !== 'DRAFT') {
      throw new BadRequestException(
        'Only chapters in DRAFT status can be sent for tutor review',
      );
    }

    // Must have at least one completed AI review
    const hasCompletedReview = chapter.submissions.some(
      (s) => s.reviewJob?.status === 'COMPLETED',
    );

    if (!hasCompletedReview) {
      throw new BadRequestException(
        'You must have at least one completed AI review before requesting tutor review',
      );
    }

    // Must not have an active AI review in progress
    const hasActiveReview = chapter.submissions.some(
      (s) =>
        s.reviewJob?.status === 'QUEUED' ||
        s.reviewJob?.status === 'PROCESSING',
    );

    if (hasActiveReview) {
      throw new BadRequestException(
        'Wait for the current AI review to finish before requesting tutor review',
      );
    }

    const updated = await this.prisma.client.chapter.update({
      where: { id: chapterId },
      data: { status: 'IN_REVIEW' },
    });

    return { id: updated.id, status: updated.status };
  }

  async reject(chapterId: string, tutorId: string, comment?: string): Promise<ChapterRejectionResult> {
    const chapter = await this.prisma.client.chapter.findUnique({
      where: { id: chapterId },
      include: { thesis: { select: { tutorId: true, studentId: true } } },
    });

    if (!chapter) {
      throw new NotFoundException('Chapter not found');
    }

    // Ownership check: only the assigned tutor can reject
    if (chapter.thesis.tutorId !== tutorId) {
      throw new ForbiddenException('Chapter is not assigned to this tutor');
    }

    if (chapter.status === 'APPROVED') {
      throw new BadRequestException('Cannot reject an approved chapter');
    }

    const updated = await this.prisma.client.chapter.update({
      where: { id: chapterId },
      data: {
        status: 'DRAFT',
        ...(comment !== undefined && { comment }),
      },
    });

    // Audit log — fire-and-forget
    void this.auditService.log({
      action: AuditAction.REJECT_CHAPTER,
      actorId: tutorId,
      entityType: 'chapter',
      entityId: chapterId,
      metadata: { chapterNumber: chapter.number },
    });

    // Notification for student — fire-and-forget (errors swallowed in NotificationService)
    void this.notificationService.create(
      chapter.thesis.studentId,
      'CHAPTER_REJECTED',
      'Capítulo rechazado',
      `Tu capítulo "${chapter.title}" fue rechazado por el tutor. Revisá el comentario y volvé a enviar.`,
      { chapterId, chapterNumber: chapter.number },
    );

    return { id: updated.id, status: updated.status, comment: updated.comment };
  }
}
