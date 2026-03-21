import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';

export interface ChapterListItem {
  id: string;
  number: number;
  title: string;
  status: string;
  latestSubmission: {
    id: string;
    versionNumber: number;
    submittedAt: Date;
  } | null;
  submissionCount: number;
}

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
}

@Injectable()
export class ChapterService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForUser(userId: string, role: 'STUDENT' | 'TUTOR'): Promise<ChapterListItem[]> {
    // For MVP: student sees own chapters, tutor sees the only student's chapters
    const whereClause = role === 'STUDENT' ? { studentId: userId } : {}; // Tutor sees all chapters (single student in MVP)

    const chapters = await this.prisma.client.chapter.findMany({
      where: whereClause,
      orderBy: { number: 'asc' },
      include: {
        submissions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          select: {
            id: true,
            versionNumber: true,
            submittedAt: true,
          },
        },
        _count: { select: { submissions: true } },
      },
    });

    return chapters.map((ch) => ({
      id: ch.id,
      number: ch.number,
      title: ch.title,
      status: ch.status,
      latestSubmission: ch.submissions[0] ?? null,
      submissionCount: ch._count.submissions,
    }));
  }

  async findById(id: string): Promise<ChapterDetail> {
    const chapter = await this.prisma.client.chapter.findUnique({
      where: { id },
      include: {
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

  async approve(chapterId: string, tutorId: string): Promise<ChapterApprovalResult> {
    const chapter = await this.prisma.client.chapter.findUnique({
      where: { id: chapterId },
      include: {
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
      },
    });

    // Unlock next chapter if it exists
    let nextChapter = null;
    if (chapter.number < 8) {
      const updated = await this.prisma.client.chapter.updateMany({
        where: {
          studentId: chapter.studentId,
          number: chapter.number + 1,
          status: 'LOCKED',
        },
        data: { status: 'DRAFT' },
      });

      if (updated.count > 0) {
        nextChapter = await this.prisma.client.chapter.findFirst({
          where: {
            studentId: chapter.studentId,
            number: chapter.number + 1,
          },
        });
      }
    }

    return {
      id: approved.id,
      number: approved.number,
      title: approved.title,
      status: approved.status,
      approvedBy: approved.approvedBy,
      approvedAt: approved.approvedAt,
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

  async reject(chapterId: string): Promise<ChapterRejectionResult> {
    const chapter = await this.prisma.client.chapter.findUnique({
      where: { id: chapterId },
    });

    if (!chapter) {
      throw new NotFoundException('Chapter not found');
    }

    if (chapter.status === 'APPROVED') {
      throw new BadRequestException('Cannot reject an approved chapter');
    }

    const updated = await this.prisma.client.chapter.update({
      where: { id: chapterId },
      data: { status: 'DRAFT' },
    });

    return { id: updated.id, status: updated.status };
  }
}
