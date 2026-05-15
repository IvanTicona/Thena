import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';

// ── Mock factories ──────────────────────────────────────────────────────────

const makePrismaMock = () => ({
  client: {
    thesisDocument: { count: jest.fn() },
    reviewJob: {
      count: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    observation: { groupBy: jest.fn() },
    submission: { findMany: jest.fn() },
  },
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('MetricsService', () => {
  let service: MetricsService;
  let prismaMock: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prismaMock = makePrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── getSummary ────────────────────────────────────────────────────────────

  describe('getSummary', () => {
    it('should return all summary fields', async () => {
      prismaMock.client.thesisDocument.count.mockResolvedValue(10);
      prismaMock.client.reviewJob.count.mockResolvedValue(20);
      prismaMock.client.reviewJob.aggregate.mockResolvedValue({ _avg: { durationMs: 30000 } });
      prismaMock.client.submission.findMany.mockResolvedValue([
        { studentId: 's1' },
        { studentId: 's2' },
      ]);

      const result = await service.getSummary();

      expect(result.totalTheses).toBe(10);
      expect(result.totalReviews).toBe(20);
      expect(result.avgReviewTimeSeconds).toBe(30);
      expect(result.activeStudentsThisMonth).toBe(2);
    });

    it('should handle zero avg duration', async () => {
      prismaMock.client.thesisDocument.count.mockResolvedValue(0);
      prismaMock.client.reviewJob.count.mockResolvedValue(0);
      prismaMock.client.reviewJob.aggregate.mockResolvedValue({ _avg: { durationMs: null } });
      prismaMock.client.submission.findMany.mockResolvedValue([]);

      const result = await service.getSummary();

      expect(result.avgReviewTimeSeconds).toBe(0);
      expect(result.activeStudentsThisMonth).toBe(0);
    });
  });

  // ── getObservationsBySeverity ─────────────────────────────────────────────

  describe('getObservationsBySeverity', () => {
    it('should map grouped observations by severity', async () => {
      prismaMock.client.observation.groupBy.mockResolvedValue([
        { severity: 'HIGH', _count: { id: 5 } },
        { severity: 'LOW', _count: { id: 12 } },
      ]);

      const result = await service.getObservationsBySeverity();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ severity: 'HIGH', count: 5 });
      expect(result[1]).toEqual({ severity: 'LOW', count: 12 });
    });

    it('should return empty array when no observations', async () => {
      prismaMock.client.observation.groupBy.mockResolvedValue([]);

      const result = await service.getObservationsBySeverity();

      expect(result).toEqual([]);
    });
  });

  // ── getObservationsByAgent ────────────────────────────────────────────────

  describe('getObservationsByAgent', () => {
    it('should map grouped observations by agent type', async () => {
      prismaMock.client.observation.groupBy.mockResolvedValue([
        { type: 'GRAMMAR', _count: { id: 8 } },
        { type: 'STRUCTURE', _count: { id: 3 } },
      ]);

      const result = await service.getObservationsByAgent();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ agent: 'GRAMMAR', count: 8 });
      expect(result[1]).toEqual({ agent: 'STRUCTURE', count: 3 });
    });
  });

  // ── getReviewsOverTime ────────────────────────────────────────────────────

  describe('getReviewsOverTime', () => {
    it('should return exactly 30 days of data', async () => {
      prismaMock.client.reviewJob.findMany.mockResolvedValue([]);

      const result = await service.getReviewsOverTime();

      expect(result).toHaveLength(30);
    });

    it('should fill dates with 0 when no reviews', async () => {
      prismaMock.client.reviewJob.findMany.mockResolvedValue([]);

      const result = await service.getReviewsOverTime();

      expect(result.every((r) => r.count === 0)).toBe(true);
    });

    it('should count jobs for their completion date', async () => {
      const today = new Date();
      today.setHours(12, 0, 0, 0);

      prismaMock.client.reviewJob.findMany.mockResolvedValue([
        { completedAt: today },
        { completedAt: today },
      ]);

      const result = await service.getReviewsOverTime();
      const todayKey = today.toISOString().slice(0, 10);
      const todayEntry = result.find((r) => r.date === todayKey);

      expect(todayEntry?.count).toBe(2);
    });

    it('should return dates sorted in ascending order', async () => {
      prismaMock.client.reviewJob.findMany.mockResolvedValue([]);

      const result = await service.getReviewsOverTime();

      for (let i = 1; i < result.length; i++) {
        expect(result[i].date > result[i - 1].date).toBe(true);
      }
    });
  });
});
