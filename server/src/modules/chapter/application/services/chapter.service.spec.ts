import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChapterService } from '../services/chapter.service.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { AuditService } from '../../../audit/application/audit.service.js';
import { NotificationService } from '../../../notification/application/notification.service.js';

// ── Mock factories ──────────────────────────────────────────────────────────

const makePrismaMock = () => ({
  client: {
    thesisDocument: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    chapter: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
});

const makeAuditMock = () => ({
  log: jest.fn().mockResolvedValue(undefined),
});

const makeNotificationMock = () => ({
  create: jest.fn().mockResolvedValue(undefined),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeChapter = (overrides = {}) => ({
  id: 'chapter-1',
  number: 1,
  title: 'Introduction',
  status: 'DRAFT',
  thesisId: 'thesis-1',
  approvedBy: null,
  approvedAt: null,
  comment: null,
  thesis: { id: 'thesis-1', studentId: 'student-1', tutorId: 'tutor-1' },
  submissions: [],
  ...overrides,
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ChapterService', () => {
  let service: ChapterService;
  let prismaMock: ReturnType<typeof makePrismaMock>;
  let auditMock: ReturnType<typeof makeAuditMock>;
  let notificationMock: ReturnType<typeof makeNotificationMock>;

  beforeEach(async () => {
    prismaMock = makePrismaMock();
    auditMock = makeAuditMock();
    notificationMock = makeNotificationMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChapterService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
        { provide: NotificationService, useValue: notificationMock },
      ],
    }).compile();

    service = module.get<ChapterService>(ChapterService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── approve ────────────────────────────────────────────────────────────────

  describe('approve', () => {
    it('should throw NotFoundException when chapter does not exist', async () => {
      prismaMock.client.chapter.findUnique.mockResolvedValue(null);

      await expect(service.approve('chapter-1', 'tutor-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when tutor is not assigned to chapter', async () => {
      prismaMock.client.chapter.findUnique.mockResolvedValue(
        makeChapter({ thesis: { id: 'thesis-1', studentId: 'student-1', tutorId: 'other-tutor' } }),
      );

      await expect(service.approve('chapter-1', 'tutor-1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when chapter is already APPROVED', async () => {
      prismaMock.client.chapter.findUnique.mockResolvedValue(
        makeChapter({ status: 'APPROVED' }),
      );

      await expect(service.approve('chapter-1', 'tutor-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when no completed review exists', async () => {
      prismaMock.client.chapter.findUnique.mockResolvedValue(
        makeChapter({
          submissions: [{ id: 'sub-1', reviewJob: { status: 'QUEUED' } }],
        }),
      );

      await expect(service.approve('chapter-1', 'tutor-1')).rejects.toThrow(BadRequestException);
    });

    it('should approve chapter with completed review and return result', async () => {
      const approvedChapter = {
        id: 'chapter-1',
        number: 1,
        title: 'Introduction',
        status: 'APPROVED',
        approvedBy: 'tutor-1',
        approvedAt: new Date(),
        comment: null,
      };

      prismaMock.client.chapter.findUnique.mockResolvedValue(
        makeChapter({
          submissions: [{ id: 'sub-1', reviewJob: { id: 'job-1', status: 'COMPLETED' } }],
        }),
      );
      prismaMock.client.chapter.update.mockResolvedValue(approvedChapter);
      prismaMock.client.chapter.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.approve('chapter-1', 'tutor-1');

      expect(result.status).toBe('APPROVED');
      expect(result.approvedBy).toBe('tutor-1');
    });

    it('should unlock next chapter when current chapter number < 8', async () => {
      const approvedChapter = {
        id: 'chapter-1',
        number: 1,
        title: 'Introduction',
        status: 'APPROVED',
        approvedBy: 'tutor-1',
        approvedAt: new Date(),
        comment: null,
      };
      const nextChapter = {
        id: 'chapter-2',
        number: 2,
        title: 'Chapter 2',
        status: 'DRAFT',
      };

      prismaMock.client.chapter.findUnique.mockResolvedValue(
        makeChapter({
          submissions: [{ id: 'sub-1', reviewJob: { id: 'job-1', status: 'COMPLETED' } }],
        }),
      );
      prismaMock.client.chapter.update.mockResolvedValue(approvedChapter);
      prismaMock.client.chapter.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.client.chapter.findFirst.mockResolvedValue(nextChapter);

      const result = await service.approve('chapter-1', 'tutor-1');

      expect(prismaMock.client.chapter.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ number: 2, status: 'LOCKED' }),
        }),
      );
      expect(result.nextChapter).not.toBeNull();
      expect(result.nextChapter!.number).toBe(2);
    });

    it('should NOT unlock next chapter when chapter number is 8', async () => {
      const approvedChapter = {
        id: 'chapter-8',
        number: 8,
        title: 'Conclusion',
        status: 'APPROVED',
        approvedBy: 'tutor-1',
        approvedAt: new Date(),
        comment: null,
      };

      prismaMock.client.chapter.findUnique.mockResolvedValue(
        makeChapter({
          number: 8,
          submissions: [{ id: 'sub-1', reviewJob: { id: 'job-1', status: 'COMPLETED' } }],
        }),
      );
      prismaMock.client.chapter.update.mockResolvedValue(approvedChapter);

      await service.approve('chapter-8', 'tutor-1');

      expect(prismaMock.client.chapter.updateMany).not.toHaveBeenCalled();
    });

    it('should notify the student after approval', async () => {
      const approvedChapter = {
        id: 'chapter-1',
        number: 1,
        title: 'Introduction',
        status: 'APPROVED',
        approvedBy: 'tutor-1',
        approvedAt: new Date(),
        comment: null,
      };

      prismaMock.client.chapter.findUnique.mockResolvedValue(
        makeChapter({
          submissions: [{ id: 'sub-1', reviewJob: { id: 'job-1', status: 'COMPLETED' } }],
        }),
      );
      prismaMock.client.chapter.update.mockResolvedValue(approvedChapter);
      prismaMock.client.chapter.updateMany.mockResolvedValue({ count: 0 });

      await service.approve('chapter-1', 'tutor-1');

      // fire-and-forget — drain microtask queue
      await new Promise((r) => setImmediate(r));

      expect(notificationMock.create).toHaveBeenCalledWith(
        'student-1',
        'CHAPTER_APPROVED',
        expect.any(String),
        expect.any(String),
        expect.any(Object),
      );
    });
  });

  // ── reject ─────────────────────────────────────────────────────────────────

  describe('reject', () => {
    it('should throw NotFoundException when chapter does not exist', async () => {
      prismaMock.client.chapter.findUnique.mockResolvedValue(null);

      await expect(service.reject('chapter-1', 'tutor-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when tutor is not assigned to chapter', async () => {
      prismaMock.client.chapter.findUnique.mockResolvedValue(
        makeChapter({ thesis: { id: 'thesis-1', studentId: 'student-1', tutorId: 'other-tutor' } }),
      );

      await expect(service.reject('chapter-1', 'tutor-1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when chapter is already APPROVED', async () => {
      prismaMock.client.chapter.findUnique.mockResolvedValue(
        makeChapter({ status: 'APPROVED' }),
      );

      await expect(service.reject('chapter-1', 'tutor-1')).rejects.toThrow(BadRequestException);
    });

    it('should set chapter status back to DRAFT with optional comment', async () => {
      prismaMock.client.chapter.findUnique.mockResolvedValue(
        makeChapter({ status: 'IN_REVIEW' }),
      );
      prismaMock.client.chapter.update.mockResolvedValue({
        id: 'chapter-1',
        status: 'DRAFT',
        comment: 'Needs more work',
      });

      const result = await service.reject('chapter-1', 'tutor-1', 'Needs more work');

      expect(prismaMock.client.chapter.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'DRAFT', comment: 'Needs more work' }),
        }),
      );
      expect(result.status).toBe('DRAFT');
      expect(result.comment).toBe('Needs more work');
    });

    it('should fire audit log on rejection', async () => {
      prismaMock.client.chapter.findUnique.mockResolvedValue(makeChapter({ status: 'IN_REVIEW' }));
      prismaMock.client.chapter.update.mockResolvedValue({
        id: 'chapter-1',
        status: 'DRAFT',
        comment: null,
      });

      await service.reject('chapter-1', 'tutor-1');

      await new Promise((r) => setImmediate(r));

      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'REJECT_CHAPTER', actorId: 'tutor-1' }),
      );
    });
  });

  // ── requestTutorReview ────────────────────────────────────────────────────

  describe('requestTutorReview', () => {
    it('should throw NotFoundException when chapter does not exist', async () => {
      prismaMock.client.chapter.findUnique.mockResolvedValue(null);

      await expect(service.requestTutorReview('chapter-1', 'student-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when student does not own chapter', async () => {
      prismaMock.client.chapter.findUnique.mockResolvedValue(
        makeChapter({ thesis: { studentId: 'other-student' } }),
      );

      await expect(service.requestTutorReview('chapter-1', 'student-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException when chapter is not in DRAFT status', async () => {
      prismaMock.client.chapter.findUnique.mockResolvedValue(
        makeChapter({ status: 'IN_REVIEW' }),
      );

      await expect(service.requestTutorReview('chapter-1', 'student-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when no completed AI review exists', async () => {
      prismaMock.client.chapter.findUnique.mockResolvedValue(
        makeChapter({
          submissions: [{ id: 'sub-1', reviewJob: { status: 'QUEUED' } }],
        }),
      );

      await expect(service.requestTutorReview('chapter-1', 'student-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when an active review is in progress', async () => {
      prismaMock.client.chapter.findUnique.mockResolvedValue(
        makeChapter({
          submissions: [
            { id: 'sub-1', reviewJob: { status: 'COMPLETED' } },
            { id: 'sub-2', reviewJob: { status: 'PROCESSING' } },
          ],
        }),
      );

      await expect(service.requestTutorReview('chapter-1', 'student-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should set chapter status to IN_REVIEW on success', async () => {
      prismaMock.client.chapter.findUnique.mockResolvedValue(
        makeChapter({
          submissions: [{ id: 'sub-1', reviewJob: { status: 'COMPLETED' } }],
        }),
      );
      prismaMock.client.chapter.update.mockResolvedValue({
        id: 'chapter-1',
        status: 'IN_REVIEW',
      });

      const result = await service.requestTutorReview('chapter-1', 'student-1');

      expect(result.status).toBe('IN_REVIEW');
      expect(prismaMock.client.chapter.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'IN_REVIEW' },
        }),
      );
    });
  });

  // ── findAllForUser ────────────────────────────────────────────────────────

  describe('findAllForUser', () => {
    it('should return empty array when STUDENT has no thesis', async () => {
      prismaMock.client.thesisDocument.findUnique.mockResolvedValue(null);

      const result = await service.findAllForUser('student-1', 'STUDENT');

      expect(result).toEqual([]);
    });

    it('should return chapters mapped correctly for STUDENT', async () => {
      prismaMock.client.thesisDocument.findUnique.mockResolvedValue({ id: 'thesis-1' });
      prismaMock.client.chapter.findMany.mockResolvedValue([
        {
          id: 'chapter-1',
          number: 1,
          title: 'Intro',
          status: 'DRAFT',
          submissions: [{ id: 'sub-1', versionNumber: 1, submittedAt: new Date() }],
          _count: { submissions: 1 },
        },
      ]);

      const result = await service.findAllForUser('student-1', 'STUDENT');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'chapter-1',
        number: 1,
        status: 'DRAFT',
        submissionCount: 1,
      });
    });
  });
});
