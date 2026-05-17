import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ObservationService } from './observation.service.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { AuditService } from '../../../audit/application/audit.service.js';
import {
  ObservationTypeEnum,
  ObservationSeverityEnum,
} from '../dtos/observation.dto.js';

// ── Mock factories ──────────────────────────────────────────────────────────

const makePrismaMock = () => ({
  client: {
    reviewReport: { findUnique: jest.fn() },
    observation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
});

const makeAuditMock = () => ({
  log: jest.fn().mockResolvedValue(undefined),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const baseObs = {
  id: 'obs-1',
  reviewReportId: 'report-1',
  type: 'GRAMMAR',
  severity: 'MEDIUM',
  message: 'Fix this',
  suggestion: null,
  textFragment: null,
  offsetStart: null,
  offsetEnd: null,
  source: 'TUTOR',
  authorId: 'tutor-1',
  isMutable: true,
  escalationLevel: 0,
  createdAt: new Date(),
  author: { id: 'tutor-1', name: 'Tutor' },
};

const makeDeepReport = (tutorId: string) => ({
  id: 'report-1',
  reviewJob: {
    submission: {
      chapter: {
        thesis: { tutorId },
      },
    },
  },
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ObservationService', () => {
  let service: ObservationService;
  let prismaMock: ReturnType<typeof makePrismaMock>;
  let auditMock: ReturnType<typeof makeAuditMock>;

  beforeEach(async () => {
    prismaMock = makePrismaMock();
    auditMock = makeAuditMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ObservationService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();

    service = module.get<ObservationService>(ObservationService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = {
      reviewId: 'report-1',
      type: ObservationTypeEnum.STRUCTURE,
      severity: ObservationSeverityEnum.WARNING,
      message: 'Fix this',
    };

    it('should throw NotFoundException when review report not found', async () => {
      prismaMock.client.reviewReport.findUnique.mockResolvedValue(null);

      await expect(service.create('tutor-1', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when tutor is not assigned to the thesis', async () => {
      prismaMock.client.reviewReport.findUnique.mockResolvedValue(
        makeDeepReport('other-tutor'),
      );

      await expect(service.create('tutor-1', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should create and return the observation', async () => {
      prismaMock.client.reviewReport.findUnique.mockResolvedValue(
        makeDeepReport('tutor-1'),
      );
      prismaMock.client.observation.create.mockResolvedValue(baseObs);

      const result = await service.create('tutor-1', dto);

      expect(result.id).toBe('obs-1');
      expect(result.source).toBe('TUTOR');
      const [createCall] = prismaMock.client.observation.create.mock
        .calls[0] as [
        { data: { source: string; authorId: string; isMutable: boolean } },
      ];
      expect(createCall.data.source).toBe('TUTOR');
      expect(createCall.data.authorId).toBe('tutor-1');
      expect(createCall.data.isMutable).toBe(true);
    });

    it('should fire-and-forget audit log after creation', async () => {
      prismaMock.client.reviewReport.findUnique.mockResolvedValue(
        makeDeepReport('tutor-1'),
      );
      prismaMock.client.observation.create.mockResolvedValue(baseObs);

      await service.create('tutor-1', dto);
      await new Promise((r) => setImmediate(r));

      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ADD_OBSERVATION',
          actorId: 'tutor-1',
        }),
      );
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should throw NotFoundException when observation not found', async () => {
      prismaMock.client.observation.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', 'tutor-1', { message: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for immutable (AI-generated) observations', async () => {
      prismaMock.client.observation.findUnique.mockResolvedValue({
        ...baseObs,
        isMutable: false,
        source: 'AI',
      });

      await expect(
        service.update('obs-1', 'tutor-1', { message: 'New' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when tutor is not the author', async () => {
      prismaMock.client.observation.findUnique.mockResolvedValue({
        ...baseObs,
        authorId: 'other-tutor',
      });

      await expect(
        service.update('obs-1', 'tutor-1', { message: 'New' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update and return the observation', async () => {
      prismaMock.client.observation.findUnique.mockResolvedValue(baseObs);
      prismaMock.client.observation.update.mockResolvedValue({
        ...baseObs,
        message: 'Updated',
      });

      const result = await service.update('obs-1', 'tutor-1', {
        message: 'Updated',
      });

      expect(result.message).toBe('Updated');
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should throw NotFoundException when observation not found', async () => {
      prismaMock.client.observation.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent', 'tutor-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException for system observations', async () => {
      prismaMock.client.observation.findUnique.mockResolvedValue({
        ...baseObs,
        isMutable: false,
        source: 'AI',
      });

      await expect(service.remove('obs-1', 'tutor-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException when not the author', async () => {
      prismaMock.client.observation.findUnique.mockResolvedValue({
        ...baseObs,
        authorId: 'other-tutor',
      });

      await expect(service.remove('obs-1', 'tutor-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should delete the observation', async () => {
      prismaMock.client.observation.findUnique.mockResolvedValue(baseObs);
      prismaMock.client.observation.delete.mockResolvedValue(baseObs);

      await service.remove('obs-1', 'tutor-1');

      expect(prismaMock.client.observation.delete).toHaveBeenCalledWith({
        where: { id: 'obs-1' },
      });
    });

    it('should fire-and-forget audit log after deletion', async () => {
      prismaMock.client.observation.findUnique.mockResolvedValue(baseObs);
      prismaMock.client.observation.delete.mockResolvedValue(baseObs);

      await service.remove('obs-1', 'tutor-1');
      await new Promise((r) => setImmediate(r));

      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DELETE_OBSERVATION',
          actorId: 'tutor-1',
        }),
      );
    });
  });
});
