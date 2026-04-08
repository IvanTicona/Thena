import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReviewService } from '../services/review.service.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';

// ── Mock factories ──────────────────────────────────────────────────────────

const makePrismaMock = () => ({
  client: {
    reviewJob: {
      findUnique: jest.fn(),
    },
    submission: {
      findFirst: jest.fn(),
    },
    observation: {
      findMany: jest.fn(),
    },
  },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeBaseJob = (overrides = {}) => ({
  id: 'job-1',
  submissionId: 'sub-1',
  status: 'QUEUED',
  startedAt: null,
  completedAt: null,
  durationMs: null,
  agentResults: [],
  reviewReport: null,
  submission: {
    markdownContent: null,
    chapter: {
      thesis: { studentId: 'student-1' },
    },
  },
  ...overrides,
});

const makeCompletedJob = (overrides = {}) => ({
  ...makeBaseJob({ status: 'COMPLETED' }),
  reviewReport: {
    id: 'report-1',
    summaryText: 'Good chapter',
    totalObservations: 2,
    bySeverity: { INFO: 1, SUGGESTION: 1, WARNING: 0, ERROR: 0 },
  },
  ...overrides,
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ReviewService', () => {
  let service: ReviewService;
  let prismaMock: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prismaMock = makePrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ReviewService>(ReviewService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── findByJobId ───────────────────────────────────────────────────────────

  describe('findByJobId', () => {
    it('should throw NotFoundException when job does not exist', async () => {
      prismaMock.client.reviewJob.findUnique.mockResolvedValue(null);

      await expect(service.findByJobId('job-999')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when student is not the owner', async () => {
      prismaMock.client.reviewJob.findUnique.mockResolvedValue(
        makeBaseJob({ submission: { markdownContent: null, chapter: { thesis: { studentId: 'other-student' } } } }),
      );

      await expect(service.findByJobId('job-1', 'student-1')).rejects.toThrow(ForbiddenException);
    });

    it('should return base job data for non-completed job', async () => {
      prismaMock.client.reviewJob.findUnique.mockResolvedValue(makeBaseJob());

      const result = await service.findByJobId('job-1', 'student-1');

      expect(result).toMatchObject({
        id: 'job-1',
        status: 'QUEUED',
        submissionId: 'sub-1',
      });
      expect(result).not.toHaveProperty('report');
      expect(result).not.toHaveProperty('observations');
    });

    it('should skip ownership check when no requestingUserId provided', async () => {
      prismaMock.client.reviewJob.findUnique.mockResolvedValue(makeBaseJob());

      await expect(service.findByJobId('job-1')).resolves.toBeDefined();
    });

    it('should return full report and observations for COMPLETED job', async () => {
      prismaMock.client.reviewJob.findUnique.mockResolvedValue(makeCompletedJob());
      prismaMock.client.observation.findMany.mockResolvedValue([
        {
          id: 'obs-1',
          type: 'STRUCTURE',
          severity: 'INFO',
          message: 'Good intro',
          suggestion: null,
          textFragment: null,
          offsetStart: null,
          offsetEnd: null,
          sourceReference: null,
          source: 'AI',
          authorId: null,
          isMutable: false,
          escalationLevel: 0,
        },
      ]);

      const result = await service.findByJobId('job-1', 'student-1') as any;

      expect(result.status).toBe('COMPLETED');
      expect(result.report).toBeDefined();
      expect(result.report.summaryText).toBe('Good chapter');
      expect(result.observations).toHaveLength(1);
    });

    it('should correctly parse bySeverity from job report', async () => {
      prismaMock.client.reviewJob.findUnique.mockResolvedValue(makeCompletedJob());
      prismaMock.client.observation.findMany.mockResolvedValue([]);

      const result = await service.findByJobId('job-1', 'student-1') as any;

      expect(result.report.bySeverity).toMatchObject({
        INFO: 1,
        SUGGESTION: 1,
        WARNING: 0,
        ERROR: 0,
      });
    });
  });

  // ── findLatestByChapterId ─────────────────────────────────────────────────

  describe('findLatestByChapterId', () => {
    it('should throw NotFoundException when no submission with review exists for chapter', async () => {
      prismaMock.client.submission.findFirst.mockResolvedValue(null);

      await expect(service.findLatestByChapterId('chapter-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when latest submission has no review job', async () => {
      prismaMock.client.submission.findFirst.mockResolvedValue({ reviewJob: null });

      await expect(service.findLatestByChapterId('chapter-1')).rejects.toThrow(NotFoundException);
    });

    it('should delegate to findByJobId with the latest submission\'s job id', async () => {
      prismaMock.client.submission.findFirst.mockResolvedValue({
        reviewJob: { id: 'job-1' },
      });
      prismaMock.client.reviewJob.findUnique.mockResolvedValue(makeBaseJob());

      const result = await service.findLatestByChapterId('chapter-1', 'student-1');

      expect(prismaMock.client.reviewJob.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'job-1' } }),
      );
      expect(result).toBeDefined();
    });
  });

  // ── generatePdfReport ─────────────────────────────────────────────────────

  describe('generatePdfReport', () => {
    it('should throw NotFoundException when job does not exist', async () => {
      prismaMock.client.reviewJob.findUnique.mockResolvedValue(null);

      await expect(service.generatePdfReport('job-1', 'student-1', 'STUDENT')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when STUDENT tries to export someone else\'s report', async () => {
      prismaMock.client.reviewJob.findUnique.mockResolvedValue({
        id: 'job-1',
        status: 'COMPLETED',
        reviewReport: { id: 'report-1', summaryText: 'ok', totalObservations: 0, bySeverity: {} },
        submission: {
          versionNumber: 1,
          chapter: {
            number: 1,
            title: 'Intro',
            thesis: { title: 'My Thesis', studentId: 'other-student' },
          },
        },
      });

      await expect(
        service.generatePdfReport('job-1', 'student-1', 'STUDENT'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when job is not COMPLETED', async () => {
      prismaMock.client.reviewJob.findUnique.mockResolvedValue({
        id: 'job-1',
        status: 'QUEUED',
        reviewReport: null,
        submission: {
          versionNumber: 1,
          chapter: {
            number: 1,
            title: 'Intro',
            thesis: { title: 'My Thesis', studentId: 'student-1' },
          },
        },
      });

      await expect(
        service.generatePdfReport('job-1', 'student-1', 'STUDENT'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return a buffer and filename for a completed job', async () => {
      prismaMock.client.reviewJob.findUnique.mockResolvedValue({
        id: 'job-1',
        status: 'COMPLETED',
        completedAt: new Date(),
        reviewReport: {
          id: 'report-1',
          summaryText: 'Good chapter',
          totalObservations: 1,
          bySeverity: { INFO: 1, SUGGESTION: 0, WARNING: 0, ERROR: 0 },
        },
        submission: {
          versionNumber: 1,
          chapter: {
            number: 1,
            title: 'Introduction',
            thesis: { title: 'My Thesis', studentId: 'student-1' },
          },
        },
      });
      prismaMock.client.observation.findMany.mockResolvedValue([]);

      const result = await service.generatePdfReport('job-1', 'student-1', 'STUDENT');

      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(result.filename).toMatch(/thena-reporte-cap1-v1\.pdf/);
    }, 10000);
  });
});
