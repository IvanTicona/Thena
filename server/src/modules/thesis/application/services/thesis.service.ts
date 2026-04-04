import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { CreateThesisDto } from '../dtos/create-thesis.dto.js';
import { UpdateThesisDto } from '../dtos/update-thesis.dto.js';
import { DEFAULT_CHAPTERS } from '../../domain/thesis.types.js';

@Injectable()
export class ThesisService {
  constructor(private readonly prisma: PrismaService) {}

  async create(studentId: string, dto: CreateThesisDto) {
    // Check student doesn't already have a thesis
    const existing = await this.prisma.client.thesisDocument.findUnique({
      where: { studentId },
    });

    if (existing) {
      throw new BadRequestException('Student already has a thesis');
    }

    // Validate tutorId if provided
    if (dto.tutorId) {
      const tutor = await this.prisma.client.user.findUnique({
        where: { id: dto.tutorId },
      });

      if (!tutor || tutor.role !== 'TUTOR') {
        throw new BadRequestException('Invalid tutor ID: user not found or not a tutor');
      }
    }

    // Create thesis + 8 chapters in a transaction
    const thesis = await this.prisma.client.$transaction(async (tx) => {
      const newThesis = await tx.thesisDocument.create({
        data: {
          title: dto.title,
          studentId,
          tutorId: dto.tutorId ?? null,
        },
      });

      await tx.chapter.createMany({
        data: DEFAULT_CHAPTERS.map((title, index) => ({
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

  async findMine(studentId: string) {
    const thesis = await this.prisma.client.thesisDocument.findUnique({
      where: { studentId },
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

    return thesis ?? null;
  }

  async findForTutor(tutorId: string) {
    return this.prisma.client.thesisDocument.findMany({
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
  }

  async findById(id: string, userId: string, role: 'STUDENT' | 'TUTOR') {
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

    return thesis;
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
