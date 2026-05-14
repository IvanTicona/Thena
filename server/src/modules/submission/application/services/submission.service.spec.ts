import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { SubmissionService } from './submission.service.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { StorageService } from '../../../../shared/storage/storage.service.js';
import { AuditService } from '../../../audit/application/audit.service.js';
import { NotificationService } from '../../../notification/application/notification.service.js';
import { AlertService } from '../../../alert/application/alert.service.js';

// ── Mock factories ──────────────────────────────────────────────────────────

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const makePrismaMock = () => ({
  client: {
    submission: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    chapter: {
      findUnique: jest.fn(),
    },
    reviewJob: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
});

const makeStorageMock = () => ({
  upload: jest.fn().mockResolvedValue('thena-documents/student-1/chapter-1/1.docx'),
  download: jest.fn().mockResolvedValue(Buffer.from('file-content')),
});

const makeQueueMock = () => ({
  add: jest.fn().mockResolvedValue(undefined),
});

const makeAuditMock = () => ({
  log: jest.fn().mockResolvedValue(undefined),
});

const makeNotificationMock = () => ({
  create: jest.fn().mockResolvedValue(undefined),
});

const makeAlertMock = () => ({
  resolveInactivityAlertsForThesis: jest.fn().mockResolvedValue(undefined),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File => ({
  fieldname: 'file',
  originalname: 'chapter.docx',
  encoding: '7bit',
  mimetype: DOCX_MIME,
  size: 1024,
  buffer: Buffer.from('docx-content'),
  destination: '',
  filename: '',
  path: '',
  stream: null as any,
  ...overrides,
});

const makeChapter = (overrides = {}) => ({
  id: 'chapter-1',
  number: 1,
  title: 'Introduction',
  status: 'DRAFT',
  thesisId: 'thesis-1',
  thesis: { studentId: 'student-1', tutorId: 'tutor-1' },
  ...overrides,
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SubmissionService', () => {
  let service: SubmissionService;
  let prismaMock: ReturnType<typeof makePrismaMock>;
  let storageMock: ReturnType<typeof makeStorageMock>;
  let queueMock: ReturnType<typeof makeQueueMock>;
  let auditMock: ReturnType<typeof makeAuditMock>;
  let notificationMock: ReturnType<typeof makeNotificationMock>;
  let alertMock: ReturnType<typeof makeAlertMock>;

  beforeEach(async () => {
    prismaMock = makePrismaMock();
    storageMock = makeStorageMock();
    queueMock = makeQueueMock();
    auditMock = makeAuditMock();
    notificationMock = makeNotificationMock();
    alertMock = makeAlertMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubmissionService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: StorageService, useValue: storageMock },
        { provide: getQueueToken('review'), useValue: queueMock },
        { provide: AuditService, useValue: auditMock },
        { provide: NotificationService, useValue: notificationMock },
        { provide: AlertService, useValue: alertMock },
      ],
    }).compile();

    service = module.get<SubmissionService>(SubmissionService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── findAllForStudent ─────────────────────────────────────────────────────

  describe('findAllForStudent', () => {
    it('should return submissions for a student', async () => {
      const mockSubmissions = [
        { id: 'sub-1', chapterId: 'chapter-1', versionNumber: 1, fileName: 'ch1.docx', submittedAt: new Date() },
      ];
      prismaMock.client.submission.findMany.mockResolvedValue(mockSubmissions);

      const result = await service.findAllForStudent('student-1');

      expect(result).toEqual(mockSubmissions);
      expect(prismaMock.client.submission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { studentId: 'student-1' } }),
      );
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should throw BadRequestException when file is not DOCX', async () => {
      const file = makeFile({ mimetype: 'application/pdf' });

      await expect(service.create('student-1', 'chapter-1', file)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when chapter does not exist', async () => {
      prismaMock.client.chapter.findUnique.mockResolvedValue(null);

      await expect(
        service.create('student-1', 'chapter-1', makeFile()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when chapter does not belong to student', async () => {
      prismaMock.client.chapter.findUnique.mockResolvedValue(
        makeChapter({ thesis: { studentId: 'other-student', tutorId: 'tutor-1' } }),
      );

      await expect(
        service.create('student-1', 'chapter-1', makeFile()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when chapter is LOCKED', async () => {
      prismaMock.client.chapter.findUnique.mockResolvedValue(makeChapter({ status: 'LOCKED' }));

      await expect(
        service.create('student-1', 'chapter-1', makeFile()),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when chapter is APPROVED', async () => {
      prismaMock.client.chapter.findUnique.mockResolvedValue(makeChapter({ status: 'APPROVED' }));

      await expect(
        service.create('student-1', 'chapter-1', makeFile()),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when chapter is IN_REVIEW', async () => {
      prismaMock.client.chapter.findUnique.mockResolvedValue(makeChapter({ status: 'IN_REVIEW' }));

      await expect(
        service.create('student-1', 'chapter-1', makeFile()),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when an active AI review job exists', async () => {
      prismaMock.client.chapter.findUnique.mockResolvedValue(makeChapter());
      prismaMock.client.reviewJob.findFirst.mockResolvedValue({ id: 'job-1', status: 'PROCESSING' });

      await expect(
        service.create('student-1', 'chapter-1', makeFile()),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create a submission with version 1 when no prior submissions exist', async () => {
      const submission = { id: 'sub-1', chapterId: 'chapter-1', versionNumber: 1, fileName: 'chapter.docx', submittedAt: new Date() };
      const reviewJob = { id: 'job-1', status: 'QUEUED', submissionId: 'sub-1' };

      prismaMock.client.chapter.findUnique.mockResolvedValue(makeChapter());
      prismaMock.client.reviewJob.findFirst.mockResolvedValue(null);
      prismaMock.client.submission.findFirst.mockResolvedValue(null);
      prismaMock.client.submission.create.mockResolvedValue(submission);
      prismaMock.client.reviewJob.create.mockResolvedValue(reviewJob);

      const result = await service.create('student-1', 'chapter-1', makeFile());

      expect(prismaMock.client.submission.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ versionNumber: 1, studentId: 'student-1' }),
        }),
      );
      expect(result.versionNumber).toBe(1);
      expect(result.reviewJob.status).toBe('QUEUED');
    });

    it('should increment version number based on previous submissions', async () => {
      const submission = { id: 'sub-2', chapterId: 'chapter-1', versionNumber: 3, fileName: 'chapter.docx', submittedAt: new Date() };
      const reviewJob = { id: 'job-2', status: 'QUEUED', submissionId: 'sub-2' };

      prismaMock.client.chapter.findUnique.mockResolvedValue(makeChapter());
      prismaMock.client.reviewJob.findFirst.mockResolvedValue(null);
      prismaMock.client.submission.findFirst.mockResolvedValue({ versionNumber: 2 });
      prismaMock.client.submission.create.mockResolvedValue(submission);
      prismaMock.client.reviewJob.create.mockResolvedValue(reviewJob);

      const result = await service.create('student-1', 'chapter-1', makeFile());

      const createCall = prismaMock.client.submission.create.mock.calls[0][0];
      expect(createCall.data.versionNumber).toBe(3);
      expect(result.versionNumber).toBe(3);
    });

    it('should enqueue a review job on BullMQ', async () => {
      const submission = { id: 'sub-1', chapterId: 'chapter-1', versionNumber: 1, fileName: 'chapter.docx', submittedAt: new Date() };
      const reviewJob = { id: 'job-1', status: 'QUEUED', submissionId: 'sub-1' };

      prismaMock.client.chapter.findUnique.mockResolvedValue(makeChapter());
      prismaMock.client.reviewJob.findFirst.mockResolvedValue(null);
      prismaMock.client.submission.findFirst.mockResolvedValue(null);
      prismaMock.client.submission.create.mockResolvedValue(submission);
      prismaMock.client.reviewJob.create.mockResolvedValue(reviewJob);

      await service.create('student-1', 'chapter-1', makeFile());

      expect(queueMock.add).toHaveBeenCalledWith(
        'process-review',
        expect.objectContaining({ jobId: 'job-1', chapterId: 'chapter-1' }),
      );
    });

    it('should upload file to storage', async () => {
      const submission = { id: 'sub-1', chapterId: 'chapter-1', versionNumber: 1, fileName: 'chapter.docx', submittedAt: new Date() };
      const reviewJob = { id: 'job-1', status: 'QUEUED', submissionId: 'sub-1' };

      prismaMock.client.chapter.findUnique.mockResolvedValue(makeChapter());
      prismaMock.client.reviewJob.findFirst.mockResolvedValue(null);
      prismaMock.client.submission.findFirst.mockResolvedValue(null);
      prismaMock.client.submission.create.mockResolvedValue(submission);
      prismaMock.client.reviewJob.create.mockResolvedValue(reviewJob);

      await service.create('student-1', 'chapter-1', makeFile());

      expect(storageMock.upload).toHaveBeenCalledWith(
        'student-1/chapter-1/1.docx',
        expect.any(Buffer),
        DOCX_MIME,
      );
    });
  });

  // ── downloadFile ──────────────────────────────────────────────────────────

  describe('downloadFile', () => {
    it('should throw NotFoundException when submission not found', async () => {
      prismaMock.client.submission.findUnique.mockResolvedValue(null);

      await expect(
        service.downloadFile('sub-1', 'student-1', 'STUDENT'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when STUDENT tries to download someone else\'s file', async () => {
      prismaMock.client.submission.findUnique.mockResolvedValue({
        id: 'sub-1',
        fileUrl: 'thena-documents/other-student/ch1/1.docx',
        fileName: 'ch1.docx',
        studentId: 'other-student',
      });

      await expect(
        service.downloadFile('sub-1', 'student-1', 'STUDENT'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return buffer and fileName for the submission owner', async () => {
      prismaMock.client.submission.findUnique.mockResolvedValue({
        id: 'sub-1',
        fileUrl: 'thena-documents/student-1/chapter-1/1.docx',
        fileName: 'chapter.docx',
        studentId: 'student-1',
      });
      storageMock.download.mockResolvedValue(Buffer.from('file-content'));

      const result = await service.downloadFile('sub-1', 'student-1', 'STUDENT');

      expect(result.fileName).toBe('chapter.docx');
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
    });

    it('should allow TUTOR to download any submission', async () => {
      prismaMock.client.submission.findUnique.mockResolvedValue({
        id: 'sub-1',
        fileUrl: 'thena-documents/student-1/chapter-1/1.docx',
        fileName: 'chapter.docx',
        studentId: 'student-1',
      });
      storageMock.download.mockResolvedValue(Buffer.from('file-content'));

      const result = await service.downloadFile('sub-1', 'tutor-1', 'TUTOR');

      expect(result.fileName).toBe('chapter.docx');
    });

    it('should strip bucket prefix before calling storage.download', async () => {
      prismaMock.client.submission.findUnique.mockResolvedValue({
        id: 'sub-1',
        fileUrl: 'thena-documents/student-1/chapter-1/1.docx',
        fileName: 'chapter.docx',
        studentId: 'student-1',
      });
      storageMock.download.mockResolvedValue(Buffer.from('file'));

      await service.downloadFile('sub-1', 'student-1', 'STUDENT');

      expect(storageMock.download).toHaveBeenCalledWith('student-1/chapter-1/1.docx');
    });
  });
});
