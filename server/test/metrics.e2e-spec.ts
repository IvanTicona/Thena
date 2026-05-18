import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';

import { MetricsController } from '../src/modules/metrics/infrastructure/controllers/metrics.controller.js';
import { MetricsService } from '../src/modules/metrics/application/services/metrics.service.js';

// ── Mock factories ────────────────────────────────────────────────────────────

function buildMetricsServiceMock() {
  return {
    getSummary: jest.fn(),
    getObservationsBySeverity: jest.fn(),
    getObservationsByAgent: jest.fn(),
    getReviewsOverTime: jest.fn(),
  };
}

// ── App factory ───────────────────────────────────────────────────────────────

async function createTestApp(
  svc: ReturnType<typeof buildMetricsServiceMock>,
): Promise<INestApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    controllers: [MetricsController],
    providers: [{ provide: MetricsService, useValue: svc }],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  await app.init();
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Metrics E2E (/api/v1/metrics)', () => {
  let app: INestApplication;
  let svcMock: ReturnType<typeof buildMetricsServiceMock>;

  beforeEach(async () => {
    svcMock = buildMetricsServiceMock();
    app = await createTestApp(svcMock);
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  // ── GET /metrics/summary ──────────────────────────────────────────────────

  describe('GET /api/v1/metrics/summary', () => {
    it('should return 200 with summary data', async () => {
      const summary = {
        totalTheses: 10,
        totalReviews: 20,
        avgReviewTimeSeconds: 30,
        activeStudentsThisMonth: 5,
      };
      svcMock.getSummary.mockResolvedValue(summary);

      const res = await request(app.getHttpServer()).get('/api/v1/metrics/summary');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        totalTheses: 10,
        totalReviews: 20,
        avgReviewTimeSeconds: 30,
      });
      expect(svcMock.getSummary).toHaveBeenCalledTimes(1);
    });
  });

  // ── GET /metrics/observations/severity ───────────────────────────────────

  describe('GET /api/v1/metrics/observations/severity', () => {
    it('should return 200 with severity counts', async () => {
      svcMock.getObservationsBySeverity.mockResolvedValue([
        { severity: 'HIGH', count: 5 },
        { severity: 'LOW', count: 12 },
      ]);

      const res = await request(app.getHttpServer()).get(
        '/api/v1/metrics/observations/severity',
      );

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toEqual({ severity: 'HIGH', count: 5 });
    });

    it('should return 200 with empty array when no observations', async () => {
      svcMock.getObservationsBySeverity.mockResolvedValue([]);

      const res = await request(app.getHttpServer()).get(
        '/api/v1/metrics/observations/severity',
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // ── GET /metrics/observations/agent ──────────────────────────────────────

  describe('GET /api/v1/metrics/observations/agent', () => {
    it('should return 200 with agent counts', async () => {
      svcMock.getObservationsByAgent.mockResolvedValue([
        { agent: 'GRAMMAR', count: 8 },
      ]);

      const res = await request(app.getHttpServer()).get(
        '/api/v1/metrics/observations/agent',
      );

      expect(res.status).toBe(200);
      expect(res.body[0]).toEqual({ agent: 'GRAMMAR', count: 8 });
    });
  });

  // ── GET /metrics/reviews ──────────────────────────────────────────────────

  describe('GET /api/v1/metrics/reviews', () => {
    it('should return 200 with 30 days of data', async () => {
      const thirtyDays = Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - i * 86400000).toISOString().slice(0, 10),
        count: 0,
      }));
      svcMock.getReviewsOverTime.mockResolvedValue(thirtyDays);

      const res = await request(app.getHttpServer()).get('/api/v1/metrics/reviews');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(30);
      expect(svcMock.getReviewsOverTime).toHaveBeenCalledTimes(1);
    });
  });
});
