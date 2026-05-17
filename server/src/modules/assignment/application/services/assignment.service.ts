import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { AuditService } from '../../../audit/application/audit.service.js';
import { AuditAction } from '../../../audit/domain/audit.constants.js';
import {
  CreateAssignmentDto,
  AssignmentListQueryDto,
} from '../dtos/assignment.dto.js';

interface UserRef {
  id: string;
  name: string;
  email: string;
}

export interface AssignmentItem {
  id: string;
  assignedAt: Date;
  active: boolean;
  student: UserRef;
  tutor: UserRef;
  reviewer: UserRef | null;
}

export interface PaginatedAssignments {
  data: AssignmentItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class AssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    dto: CreateAssignmentDto,
    actorId: string,
  ): Promise<AssignmentItem> {
    const student = await this.prisma.client.user.findUnique({
      where: { id: dto.studentId },
    });
    if (!student || student.role !== 'STUDENT') {
      throw new BadRequestException(
        'Invalid studentId: user not found or not a student',
      );
    }

    const tutor = await this.prisma.client.user.findUnique({
      where: { id: dto.tutorId },
    });
    if (!tutor || tutor.role !== 'TUTOR') {
      throw new BadRequestException(
        'Invalid tutorId: user not found or not a tutor',
      );
    }

    if (dto.reviewerId !== undefined) {
      const reviewer = await this.prisma.client.user.findUnique({
        where: { id: dto.reviewerId },
      });
      if (!reviewer || reviewer.role !== 'REVIEWER') {
        throw new BadRequestException(
          'Invalid reviewerId: user not found or not a reviewer',
        );
      }
    }

    const existing = await this.prisma.client.studentAssignment.findUnique({
      where: { studentId: dto.studentId },
    });
    if (existing) {
      throw new ConflictException('Student already has an assignment');
    }

    const assignment = await this.prisma.client.studentAssignment.create({
      data: {
        studentId: dto.studentId,
        tutorId: dto.tutorId,
        ...(dto.reviewerId !== undefined ? { reviewerId: dto.reviewerId } : {}),
      },
      include: {
        student: { select: { id: true, name: true, email: true } },
        tutor: { select: { id: true, name: true, email: true } },
        reviewer: { select: { id: true, name: true, email: true } },
      },
    });

    void this.auditService.log({
      action: AuditAction.ASSIGN_TUTOR,
      actorId,
      entityType: 'student_assignment',
      entityId: assignment.id,
      metadata: {
        studentId: dto.studentId,
        tutorId: dto.tutorId,
        ...(dto.reviewerId !== undefined ? { reviewerId: dto.reviewerId } : {}),
      },
    });

    return {
      id: assignment.id,
      assignedAt: assignment.assignedAt,
      active: assignment.active,
      student: assignment.student,
      tutor: assignment.tutor,
      reviewer: assignment.reviewer,
    };
  }

  async findPaginated(
    query: AssignmentListQueryDto,
  ): Promise<PaginatedAssignments> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [assignments, total] = await Promise.all([
      this.prisma.client.studentAssignment.findMany({
        skip,
        take: limit,
        orderBy: { assignedAt: 'desc' },
        include: {
          student: { select: { id: true, name: true, email: true } },
          tutor: { select: { id: true, name: true, email: true } },
          reviewer: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.client.studentAssignment.count(),
    ]);

    return {
      data: assignments.map((a) => ({
        id: a.id,
        assignedAt: a.assignedAt,
        active: a.active,
        student: a.student,
        tutor: a.tutor,
        reviewer: a.reviewer,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async delete(
    id: string,
    actorId: string,
  ): Promise<{ id: string; deleted: true }> {
    const assignment = await this.prisma.client.studentAssignment.findUnique({
      where: { id },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    await this.prisma.client.studentAssignment.delete({ where: { id } });

    void this.auditService.log({
      action: AuditAction.ASSIGN_TUTOR,
      actorId,
      entityType: 'student_assignment',
      entityId: id,
      metadata: { action: 'DELETE_ASSIGNMENT' },
    });

    return { id, deleted: true };
  }
}
