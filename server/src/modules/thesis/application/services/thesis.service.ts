import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { CreateThesisDto } from '../dtos/create-thesis.dto.js';
import { UpdateThesisDto } from '../dtos/update-thesis.dto.js';
import { TutorDashboardQueryDto } from '../dtos/tutor-dashboard-query.dto.js';
import { UserRole } from '../../../auth/domain/auth.types.js';
import { DEFAULT_CHAPTERS } from '../../domain/thesis.types.js';

@Injectable()
export class ThesisService {
  constructor(private readonly prisma: PrismaService) {}

  async create(studentId: string, dto: CreateThesisDto) {
    // Check student doesn't already have a thesis (non-deleted)
    const existing = await this.prisma.client.thesisDocument.findFirst({
      where: { studentId, deletedAt: null },
    });

    if (existing) {
      throw new BadRequestException('Student already has a thesis');
    }

    // Validate tutor exists and has TUTOR role
    const tutor = await this.prisma.client.user.findUnique({
      where: { id: dto.tutorId, deletedAt: null },
    });

    if (!tutor || tutor.role !== 'TUTOR') {
      throw new BadRequestException('Invalid tutor ID: user not found or not a tutor');
    }

    // Determine chapter count and titles
    const chapterCount = dto.chapterCount ?? DEFAULT_CHAPTERS.length;
    const chapterTitles = this.resolveChapterTitles(chapterCount);

    // Create thesis + chapters in a transaction
    const thesis = await this.prisma.client.$transaction(async (tx) => {
      const newThesis = await tx.thesisDocument.create({
        data: {
          title: dto.title,
          studentId,
          tutorId: dto.tutorId,
          chapterCount,
        },
      });

      await tx.chapter.createMany({
        data: chapterTitles.map((title, index) => ({
          number: index + 1,
          title,
          status: index === 0 ? 'DRAFT' : 'LOCKED',
          thesisId: newThesis.id,
        })),
      });

      return tx.thesisDocument.findUniqueOrThrow({
        where: { id: newThesis.id },
        include: {
          chapters: { orderBy: { number: 'asc' } },
          student: { select: { id: true, name: true, email: true } },
          tutor: { select: { id: true, name: true, email: true } },
        },
      });
    });

    return thesis;
  }

  /**
   * Resolves chapter titles for a given count.
   * Uses DEFAULT_CHAPTERS when count matches, otherwise generates generic titles.
   */
  private resolveChapterTitles(count: number): string[] {
    if (count === DEFAULT_CHAPTERS.length) {
      return [...DEFAULT_CHAPTERS];
    }
    if (count <= DEFAULT_CHAPTERS.length) {
      return [...DEFAULT_CHAPTERS].slice(0, count);
    }
    // More chapters than defaults: use defaults + generate extra
    const titles = [...DEFAULT_CHAPTERS] as string[];
    for (let i = DEFAULT_CHAPTERS.length + 1; i <= count; i++) {
      titles.push(`Capítulo ${i}`);
    }
    return titles;
  }

  async findMine(studentId: string) {
    const thesis = await this.prisma.client.thesisDocument.findFirst({
      where: { studentId, deletedAt: null },
      include: {
        chapters: {
          orderBy: { number: 'asc' },
          include: {
            submissions: {
              orderBy: { versionNumber: 'desc' },
              take: 1,
              select: { id: true, versionNumber: true, submittedAt: true },
            },
            _count: { select: { submissions: true } },
          },
        },
        tutor: { select: { id: true, name: true, email: true } },
      },
    });

    if (!thesis) return null;

    return {
      ...thesis,
      chapters: thesis.chapters.map((ch) => ({
        id: ch.id,
        number: ch.number,
        title: ch.title,
        status: ch.status,
        latestSubmission: ch.submissions[0] ?? null,
        submissionCount: ch._count.submissions,
      })),
    };
  }

  async findForReviewer(reviewerId: string) {
    // Find all student assignments where this reviewer is assigned
    const assignments = await this.prisma.client.studentAssignment.findMany({
      where: { reviewerId, active: true },
      select: { studentId: true },
    });

    const studentIds = assignments.map((a) => a.studentId);

    if (studentIds.length === 0) return [];

    const theses = await this.prisma.client.thesisDocument.findMany({
      where: { studentId: { in: studentIds }, deletedAt: null },
      include: {
        student: { select: { id: true, name: true, email: true } },
        chapters: {
          orderBy: { number: 'asc' },
          include: {
            submissions: {
              orderBy: { versionNumber: 'desc' },
              take: 1,
              select: { id: true, versionNumber: true, submittedAt: true },
            },
            _count: { select: { submissions: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return theses.map((thesis) => ({
      ...thesis,
      chapters: thesis.chapters.map((ch) => ({
        id: ch.id,
        number: ch.number,
        title: ch.title,
        status: ch.status,
        latestSubmission: ch.submissions[0] ?? null,
        submissionCount: ch._count.submissions,
      })),
    }));
  }

  async findForTutor(tutorId: string) {
    const theses = await this.prisma.client.thesisDocument.findMany({
      where: { tutorId },
      include: {
        student: { select: { id: true, name: true, email: true } },
        chapters: {
          orderBy: { number: 'asc' },
          include: {
            submissions: {
              orderBy: { versionNumber: 'desc' },
              take: 1,
              select: { id: true, versionNumber: true, submittedAt: true },
            },
            _count: { select: { submissions: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return theses.map((thesis) => ({
      ...thesis,
      chapters: thesis.chapters.map((ch) => ({
        id: ch.id,
        number: ch.number,
        title: ch.title,
        status: ch.status,
        latestSubmission: ch.submissions[0] ?? null,
        submissionCount: ch._count.submissions,
      })),
    }));
  }

  async findForTutorWithFilters(tutorId: string, query: TutorDashboardQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tutorId };

    if (query.studentName) {
      where['student'] = {
        name: { contains: query.studentName, mode: 'insensitive' },
      };
    }

    const [theses, total] = await Promise.all([
      this.prisma.client.thesisDocument.findMany({
        where,
        include: {
          student: { select: { id: true, name: true, email: true } },
          chapters: {
            orderBy: { number: 'asc' },
            where: query.chapterStatus ? { status: query.chapterStatus as any } : undefined,
            include: {
              submissions: {
                orderBy: { versionNumber: 'desc' },
                take: 1,
                select: { id: true, versionNumber: true, submittedAt: true },
              },
              _count: { select: { submissions: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.client.thesisDocument.count({ where }),
    ]);

    const data = theses.map((thesis) => ({
      ...thesis,
      chapters: thesis.chapters.map((ch) => ({
        id: ch.id,
        number: ch.number,
        title: ch.title,
        status: ch.status,
        latestSubmission: ch.submissions[0] ?? null,
        submissionCount: ch._count.submissions,
      })),
    }));

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string, userId: string, role: UserRole) {
    const thesis = await this.prisma.client.thesisDocument.findUnique({
      where: { id },
      include: {
        chapters: {
          orderBy: { number: 'asc' },
          include: {
            submissions: {
              orderBy: { versionNumber: 'desc' },
              take: 1,
              select: { id: true, versionNumber: true, submittedAt: true },
            },
            _count: { select: { submissions: true } },
          },
        },
        student: { select: { id: true, name: true, email: true } },
        tutor: { select: { id: true, name: true, email: true } },
      },
    });

    if (!thesis) {
      throw new NotFoundException('Thesis not found');
    }

    // Ownership check
    if (role === 'STUDENT' && thesis.studentId !== userId) {
      throw new ForbiddenException('Thesis does not belong to this student');
    }

    if (role === 'TUTOR' && thesis.tutorId !== userId) {
      throw new ForbiddenException('Thesis is not assigned to this tutor');
    }

    return {
      ...thesis,
      chapters: thesis.chapters.map((ch) => ({
        id: ch.id,
        number: ch.number,
        title: ch.title,
        status: ch.status,
        latestSubmission: ch.submissions[0] ?? null,
        submissionCount: ch._count.submissions,
      })),
    };
  }

  async update(id: string, studentId: string, dto: UpdateThesisDto) {
    const thesis = await this.prisma.client.thesisDocument.findUnique({
      where: { id },
    });

    if (!thesis) {
      throw new NotFoundException('Thesis not found');
    }

    if (thesis.studentId !== studentId) {
      throw new ForbiddenException('Thesis does not belong to this student');
    }

    // Validate new tutorId if changing tutor
    if (dto.tutorId !== undefined) {
      if (dto.tutorId !== null) {
        const tutor = await this.prisma.client.user.findUnique({
          where: { id: dto.tutorId },
        });

        if (!tutor || tutor.role !== 'TUTOR') {
          throw new BadRequestException('Invalid tutor ID: user not found or not a tutor');
        }
      }
    }

    return this.prisma.client.thesisDocument.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.tutorId !== undefined && { tutorId: dto.tutorId }),
      },
      include: {
        chapters: { orderBy: { number: 'asc' } },
        student: { select: { id: true, name: true, email: true } },
        tutor: { select: { id: true, name: true, email: true } },
      },
    });
  }
}
