import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ThesisService } from './thesis.service.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { DEFAULT_CHAPTERS } from '../../domain/thesis.types.js';

// ── Mock factories ──────────────────────────────────────────────────────────

const makeTxMock = () => ({
  thesisDocument: {
    create: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  chapter: { createMany: jest.fn() },
});

const makePrismaMock = () => {
  const tx = makeTxMock();
  return {
    _tx: tx,
    client: {
      thesisDocument: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      user: { findUnique: jest.fn() },
      studentAssignment: { findMany: jest.fn() },
      $transaction: jest
        .fn()
        .mockImplementation(
          (fn: (tx: ReturnType<typeof makeTxMock>) => unknown) => fn(tx),
        ),
    },
  };
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const tutorUser = {
  id: 'tutor-1',
  name: 'Tutor',
  email: 't@t.com',
  role: 'TUTOR',
  deletedAt: null,
};
const baseThesis = {
  id: 'thesis-1',
  title: 'My Thesis',
  studentId: 'student-1',
  tutorId: 'tutor-1',
  chapterCount: DEFAULT_CHAPTERS.length,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  student: { id: 'student-1', name: 'Student', email: 's@s.com' },
  tutor: tutorUser,
  chapters: [],
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ThesisService', () => {
  let service: ThesisService;
  let prismaMock: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prismaMock = makePrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThesisService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ThesisService>(ThesisService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = { title: 'My Thesis', tutorId: 'tutor-1' };

    it('should throw BadRequestException when student already has a thesis', async () => {
      prismaMock.client.thesisDocument.findFirst.mockResolvedValue(baseThesis);

      await expect(service.create('student-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when tutor not found', async () => {
      prismaMock.client.thesisDocument.findFirst.mockResolvedValue(null);
      prismaMock.client.user.findUnique.mockResolvedValue(null);

      await expect(service.create('student-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when user is not a TUTOR', async () => {
      prismaMock.client.thesisDocument.findFirst.mockResolvedValue(null);
      prismaMock.client.user.findUnique.mockResolvedValue({
        ...tutorUser,
        role: 'STUDENT',
      });

      await expect(service.create('student-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create thesis with chapters in a transaction', async () => {
      prismaMock.client.thesisDocument.findFirst.mockResolvedValue(null);
      prismaMock.client.user.findUnique.mockResolvedValue(tutorUser);
      prismaMock._tx.thesisDocument.create.mockResolvedValue({
        id: 'thesis-1',
        ...dto,
      });
      prismaMock._tx.chapter.createMany.mockResolvedValue({
        count: DEFAULT_CHAPTERS.length,
      });
      prismaMock._tx.thesisDocument.findUniqueOrThrow.mockResolvedValue(
        baseThesis,
      );

      const result = await service.create('student-1', dto);

      expect(prismaMock.client.$transaction).toHaveBeenCalledTimes(1);
      const [createManyCallA] = prismaMock._tx.chapter.createMany.mock
        .calls[0] as [{ data: { number: number; status: string }[] }];
      expect(createManyCallA.data[0]).toMatchObject({
        number: 1,
        status: 'DRAFT',
      });
      expect(createManyCallA.data[1]).toMatchObject({
        number: 2,
        status: 'LOCKED',
      });
      expect(result).toEqual(baseThesis);
    });

    it('should create default number of chapters when chapterCount is not provided', async () => {
      prismaMock.client.thesisDocument.findFirst.mockResolvedValue(null);
      prismaMock.client.user.findUnique.mockResolvedValue(tutorUser);
      prismaMock._tx.thesisDocument.create.mockResolvedValue({
        id: 'thesis-1',
      });
      prismaMock._tx.chapter.createMany.mockResolvedValue({
        count: DEFAULT_CHAPTERS.length,
      });
      prismaMock._tx.thesisDocument.findUniqueOrThrow.mockResolvedValue(
        baseThesis,
      );

      await service.create('student-1', dto);

      const [createManyCall] = prismaMock._tx.chapter.createMany.mock
        .calls[0] as [
        {
          data: {
            number: number;
            title: string;
            status: string;
            thesisId: string;
          }[];
        },
      ];
      expect(createManyCall.data).toHaveLength(DEFAULT_CHAPTERS.length);
    });
  });

  // ── findMine ──────────────────────────────────────────────────────────────

  describe('findMine', () => {
    it('should return null when student has no thesis', async () => {
      prismaMock.client.thesisDocument.findFirst.mockResolvedValue(null);

      const result = await service.findMine('student-1');

      expect(result).toBeNull();
    });

    it('should return thesis with mapped chapters', async () => {
      const thesis = {
        ...baseThesis,
        chapters: [
          {
            id: 'ch-1',
            number: 1,
            title: 'Chapter 1',
            status: 'DRAFT',
            submissions: [
              { id: 'sub-1', versionNumber: 1, submittedAt: new Date() },
            ],
            _count: { submissions: 1 },
          },
        ],
      };
      prismaMock.client.thesisDocument.findFirst.mockResolvedValue(thesis);

      const result = await service.findMine('student-1');

      expect(result).not.toBeNull();
      expect(result!.chapters[0].submissionCount).toBe(1);
      expect(result!.chapters[0].latestSubmission).not.toBeNull();
    });
  });

  // ── findForTutor ──────────────────────────────────────────────────────────

  describe('findForTutor', () => {
    it('should return empty array when tutor has no theses', async () => {
      prismaMock.client.thesisDocument.findMany.mockResolvedValue([]);

      const result = await service.findForTutor('tutor-1');

      expect(result).toEqual([]);
    });
  });

  // ── findForReviewer ───────────────────────────────────────────────────────

  describe('findForReviewer', () => {
    it('should return empty array when reviewer has no assigned students', async () => {
      prismaMock.client.studentAssignment.findMany.mockResolvedValue([]);

      const result = await service.findForReviewer('reviewer-1');

      expect(result).toEqual([]);
      expect(prismaMock.client.thesisDocument.findMany).not.toHaveBeenCalled();
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should throw NotFoundException when thesis not found', async () => {
      prismaMock.client.thesisDocument.findUnique.mockResolvedValue(null);

      await expect(
        service.findById('nonexistent', 'student-1', 'STUDENT'),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException when student accesses another student's thesis", async () => {
      prismaMock.client.thesisDocument.findUnique.mockResolvedValue({
        ...baseThesis,
        studentId: 'other-student',
        chapters: [],
      });

      await expect(
        service.findById('thesis-1', 'student-1', 'STUDENT'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when tutor accesses unassigned thesis', async () => {
      prismaMock.client.thesisDocument.findUnique.mockResolvedValue({
        ...baseThesis,
        tutorId: 'other-tutor',
        chapters: [],
      });

      await expect(
        service.findById('thesis-1', 'tutor-1', 'TUTOR'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return thesis for the owning student', async () => {
      prismaMock.client.thesisDocument.findUnique.mockResolvedValue({
        ...baseThesis,
        chapters: [],
      });

      const result = await service.findById('thesis-1', 'student-1', 'STUDENT');

      expect(result.id).toBe('thesis-1');
    });

    it('should allow ADMIN to access any thesis', async () => {
      prismaMock.client.thesisDocument.findUnique.mockResolvedValue({
        ...baseThesis,
        chapters: [],
      });

      const result = await service.findById('thesis-1', 'admin-1', 'ADMIN');

      expect(result.id).toBe('thesis-1');
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should throw NotFoundException when thesis not found', async () => {
      prismaMock.client.thesisDocument.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', 'student-1', { title: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when student is not the owner', async () => {
      prismaMock.client.thesisDocument.findUnique.mockResolvedValue({
        ...baseThesis,
        studentId: 'other-student',
      });

      await expect(
        service.update('thesis-1', 'student-1', { title: 'New' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when new tutorId is invalid', async () => {
      prismaMock.client.thesisDocument.findUnique.mockResolvedValue(baseThesis);
      prismaMock.client.user.findUnique.mockResolvedValue(null);

      await expect(
        service.update('thesis-1', 'student-1', { tutorId: 'bad-tutor' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update title and return updated thesis', async () => {
      prismaMock.client.thesisDocument.findUnique.mockResolvedValue(baseThesis);
      prismaMock.client.thesisDocument.update.mockResolvedValue({
        ...baseThesis,
        title: 'New Title',
      });

      const result = await service.update('thesis-1', 'student-1', {
        title: 'New Title',
      });

      expect(result.title).toBe('New Title');
    });
  });
});
