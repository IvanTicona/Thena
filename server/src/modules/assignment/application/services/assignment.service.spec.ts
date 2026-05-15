import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AssignmentService } from './assignment.service.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { AuditService } from '../../../audit/application/audit.service.js';

// ── Mock factories ──────────────────────────────────────────────────────────

const makePrismaMock = () => ({
  client: {
    user: { findUnique: jest.fn() },
    studentAssignment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  },
});

const makeAuditMock = () => ({
  log: jest.fn().mockResolvedValue(undefined),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const student = { id: 'student-1', name: 'Student', email: 's@s.com', role: 'STUDENT' };
const tutor = { id: 'tutor-1', name: 'Tutor', email: 't@t.com', role: 'TUTOR' };
const reviewer = { id: 'reviewer-1', name: 'Reviewer', email: 'r@r.com', role: 'REVIEWER' };

const baseAssignment = {
  id: 'assign-1',
  assignedAt: new Date(),
  active: true,
  student: { id: 'student-1', name: 'Student', email: 's@s.com' },
  tutor: { id: 'tutor-1', name: 'Tutor', email: 't@t.com' },
  reviewer: null,
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AssignmentService', () => {
  let service: AssignmentService;
  let prismaMock: ReturnType<typeof makePrismaMock>;
  let auditMock: ReturnType<typeof makeAuditMock>;

  beforeEach(async () => {
    prismaMock = makePrismaMock();
    auditMock = makeAuditMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignmentService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();

    service = module.get<AssignmentService>(AssignmentService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = { studentId: 'student-1', tutorId: 'tutor-1' };

    it('should throw BadRequestException when student not found', async () => {
      prismaMock.client.user.findUnique.mockResolvedValueOnce(null);

      await expect(service.create(dto, 'admin-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when user is not STUDENT role', async () => {
      prismaMock.client.user.findUnique.mockResolvedValueOnce({ ...student, role: 'TUTOR' });

      await expect(service.create(dto, 'admin-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when tutor not found', async () => {
      prismaMock.client.user.findUnique
        .mockResolvedValueOnce(student)
        .mockResolvedValueOnce(null);

      await expect(service.create(dto, 'admin-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when tutor does not have TUTOR role', async () => {
      prismaMock.client.user.findUnique
        .mockResolvedValueOnce(student)
        .mockResolvedValueOnce({ ...tutor, role: 'STUDENT' });

      await expect(service.create(dto, 'admin-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when reviewer not found', async () => {
      prismaMock.client.user.findUnique
        .mockResolvedValueOnce(student)
        .mockResolvedValueOnce(tutor)
        .mockResolvedValueOnce(null);
      prismaMock.client.studentAssignment.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ ...dto, reviewerId: 'reviewer-1' }, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when student already has an assignment', async () => {
      prismaMock.client.user.findUnique
        .mockResolvedValueOnce(student)
        .mockResolvedValueOnce(tutor);
      prismaMock.client.studentAssignment.findUnique.mockResolvedValue(baseAssignment);

      await expect(service.create(dto, 'admin-1')).rejects.toThrow(ConflictException);
    });

    it('should create and return the assignment', async () => {
      prismaMock.client.user.findUnique
        .mockResolvedValueOnce(student)
        .mockResolvedValueOnce(tutor);
      prismaMock.client.studentAssignment.findUnique.mockResolvedValue(null);
      prismaMock.client.studentAssignment.create.mockResolvedValue(baseAssignment);

      const result = await service.create(dto, 'admin-1');

      expect(result.id).toBe('assign-1');
      expect(result.student.id).toBe('student-1');
      expect(result.tutor.id).toBe('tutor-1');
    });

    it('should validate reviewer role when reviewerId is provided', async () => {
      prismaMock.client.user.findUnique
        .mockResolvedValueOnce(student)
        .mockResolvedValueOnce(tutor)
        .mockResolvedValueOnce(reviewer);
      prismaMock.client.studentAssignment.findUnique.mockResolvedValue(null);
      prismaMock.client.studentAssignment.create.mockResolvedValue({
        ...baseAssignment,
        reviewer: { id: 'reviewer-1', name: 'Reviewer', email: 'r@r.com' },
      });

      const result = await service.create({ ...dto, reviewerId: 'reviewer-1' }, 'admin-1');

      expect(result.reviewer).not.toBeNull();
    });
  });

  // ── findPaginated ─────────────────────────────────────────────────────────

  describe('findPaginated', () => {
    it('should return paginated assignments', async () => {
      prismaMock.client.studentAssignment.findMany.mockResolvedValue([baseAssignment]);
      prismaMock.client.studentAssignment.count.mockResolvedValue(1);

      const result = await service.findPaginated({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should calculate totalPages correctly', async () => {
      prismaMock.client.studentAssignment.findMany.mockResolvedValue([]);
      prismaMock.client.studentAssignment.count.mockResolvedValue(25);

      const result = await service.findPaginated({ page: 1, limit: 10 });

      expect(result.meta.totalPages).toBe(3);
    });
  });

  // ── delete ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should throw NotFoundException when assignment not found', async () => {
      prismaMock.client.studentAssignment.findUnique.mockResolvedValue(null);

      await expect(service.delete('nonexistent', 'admin-1')).rejects.toThrow(NotFoundException);
    });

    it('should delete and return confirmation', async () => {
      prismaMock.client.studentAssignment.findUnique.mockResolvedValue(baseAssignment);
      prismaMock.client.studentAssignment.delete.mockResolvedValue(baseAssignment);

      const result = await service.delete('assign-1', 'admin-1');

      expect(result).toEqual({ id: 'assign-1', deleted: true });
      expect(prismaMock.client.studentAssignment.delete).toHaveBeenCalledWith({
        where: { id: 'assign-1' },
      });
    });
  });
});
