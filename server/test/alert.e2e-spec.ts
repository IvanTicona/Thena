import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { Reflector } from '@nestjs/core';

import { AlertController } from '../src/modules/alert/infrastructure/controllers/alert.controller.js';
import { AlertService } from '../src/modules/alert/application/alert.service.js';
import { JwtAuthGuard } from '../src/modules/auth/infrastructure/guards/jwt-auth.guard.js';
import { RolesGuard } from '../src/modules/auth/infrastructure/guards/roles.guard.js';
import type { JwtPayload } from '../src/modules/auth/domain/auth.types.js';

// ── Mock factories ────────────────────────────────────────────────────────────

let currentUser: JwtPayload = { sub: 'admin-1', email: 'admin@test.com', role: 'ADMIN' };

const mockJwtAuthGuard = {
  canActivate: (ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<{ user: JwtPayload }>();
    req.user = currentUser;
    return true;
  },
};

function buildAlertServiceMock() {
  return {
    getActiveAlerts: jest.fn(),
    resolveAlert: jest.fn(),
  };
}

// ── App factory ───────────────────────────────────────────────────────────────

async function createTestApp(
  svc: ReturnType<typeof buildAlertServiceMock>,
): Promise<INestApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    controllers: [AlertController],
    providers: [
      { provide: AlertService, useValue: svc },
      RolesGuard,
      Reflector,
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue(mockJwtAuthGuard)
    .compile();

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

describe('Alert E2E (/api/v1/alerts)', () => {
  let app: INestApplication;
  let svcMock: ReturnType<typeof buildAlertServiceMock>;

  beforeEach(async () => {
    currentUser = { sub: 'admin-1', email: 'admin@test.com', role: 'ADMIN' };
    svcMock = buildAlertServiceMock();
    app = await createTestApp(svcMock);
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  // ── GET /alerts ───────────────────────────────────────────────────────────

  describe('GET /api/v1/alerts', () => {
    it('should return 200 with all active alerts for ADMIN', async () => {
      svcMock.getActiveAlerts.mockResolvedValue([{ id: 'alert-1' }]);

      const res = await request(app.getHttpServer()).get('/api/v1/alerts');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(svcMock.getActiveAlerts).toHaveBeenCalledWith(undefined);
    });

    it('should pass thesisId to service when provided — regression for !== undefined change', async () => {
      svcMock.getActiveAlerts.mockResolvedValue([]);

      const res = await request(app.getHttpServer()).get(
        '/api/v1/alerts?thesisId=00000000-0000-0000-0000-000000000001',
      );

      expect(res.status).toBe(200);
      expect(svcMock.getActiveAlerts).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000001',
      );
    });

    it('should call service with undefined when no thesisId param — regression for !== undefined change', async () => {
      svcMock.getActiveAlerts.mockResolvedValue([]);

      await request(app.getHttpServer()).get('/api/v1/alerts');

      expect(svcMock.getActiveAlerts).toHaveBeenCalledWith(undefined);
    });

    it('should return 403 when user is STUDENT', async () => {
      currentUser = { sub: 'student-1', email: 'student@test.com', role: 'STUDENT' };

      const res = await request(app.getHttpServer()).get('/api/v1/alerts');

      expect(res.status).toBe(403);
      expect(svcMock.getActiveAlerts).not.toHaveBeenCalled();
    });

    it('should return 200 for SUPER_ADMIN', async () => {
      currentUser = { sub: 'super-1', email: 'super@test.com', role: 'SUPER_ADMIN' };
      svcMock.getActiveAlerts.mockResolvedValue([]);

      const res = await request(app.getHttpServer()).get('/api/v1/alerts');

      expect(res.status).toBe(200);
    });
  });

  // ── PATCH /alerts/:id/resolve ─────────────────────────────────────────────

  describe('PATCH /api/v1/alerts/:id/resolve', () => {
    it('should return 200 when alert is resolved', async () => {
      svcMock.resolveAlert.mockResolvedValue({
        id: 'alert-1',
        resolvedAt: new Date().toISOString(),
      });

      const res = await request(app.getHttpServer()).patch(
        '/api/v1/alerts/00000000-0000-0000-0000-000000000001/resolve',
      );

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('resolvedAt');
      expect(svcMock.resolveAlert).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000001',
      );
    });

    it('should return 400 when id is not a valid UUID', async () => {
      const res = await request(app.getHttpServer()).patch(
        '/api/v1/alerts/not-a-uuid/resolve',
      );

      expect(res.status).toBe(400);
      expect(svcMock.resolveAlert).not.toHaveBeenCalled();
    });

    it('should return 403 when user is STUDENT', async () => {
      currentUser = { sub: 'student-1', email: 'student@test.com', role: 'STUDENT' };

      const res = await request(app.getHttpServer()).patch(
        '/api/v1/alerts/00000000-0000-0000-0000-000000000001/resolve',
      );

      expect(res.status).toBe(403);
    });
  });
});
