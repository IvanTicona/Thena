import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import type { Request, Response, NextFunction } from 'express';

import { NotificationController } from '../src/modules/notification/infrastructure/controllers/notification.controller.js';
import { NotificationService } from '../src/modules/notification/application/notification.service.js';
import type { JwtPayload } from '../src/modules/auth/domain/auth.types.js';

// ── Mock factories ────────────────────────────────────────────────────────────

const testUser: JwtPayload = { sub: 'user-1', email: 'student@test.com', role: 'STUDENT' };

function buildNotificationServiceMock() {
  return {
    findByUser: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
  };
}

// ── App factory ───────────────────────────────────────────────────────────────

async function createTestApp(
  svc: ReturnType<typeof buildNotificationServiceMock>,
): Promise<INestApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    controllers: [NotificationController],
    providers: [{ provide: NotificationService, useValue: svc }],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { user: JwtPayload }).user = testUser;
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  await app.init();
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Notification E2E (/api/v1/notifications)', () => {
  let app: INestApplication;
  let svcMock: ReturnType<typeof buildNotificationServiceMock>;

  beforeEach(async () => {
    svcMock = buildNotificationServiceMock();
    app = await createTestApp(svcMock);
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  // ── GET /notifications ────────────────────────────────────────────────────

  describe('GET /api/v1/notifications', () => {
    it('should return 200 with paginated notifications', async () => {
      const paginated = {
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        unreadCount: 0,
      };
      svcMock.findByUser.mockResolvedValue(paginated);

      const res = await request(app.getHttpServer()).get(
        '/api/v1/notifications',
      );

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ page: 1, limit: 20, total: 0 });
      expect(svcMock.findByUser).toHaveBeenCalledWith('user-1', 1, 20);
    });

    it('should pass custom page and limit to the service', async () => {
      svcMock.findByUser.mockResolvedValue({
        data: [],
        total: 50,
        page: 2,
        limit: 10,
        totalPages: 5,
        unreadCount: 3,
      });

      const res = await request(app.getHttpServer()).get(
        '/api/v1/notifications?page=2&limit=10',
      );

      expect(res.status).toBe(200);
      expect(svcMock.findByUser).toHaveBeenCalledWith('user-1', 2, 10);
    });

    it('should return 400 when page is not a number', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/v1/notifications?page=abc',
      );

      expect(res.status).toBe(400);
    });

    it('should return 400 when limit exceeds 100', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/v1/notifications?limit=101',
      );

      expect(res.status).toBe(400);
    });
  });

  // ── PATCH /notifications/read-all ─────────────────────────────────────────

  describe('PATCH /api/v1/notifications/read-all', () => {
    it('should return 200 with updated count', async () => {
      svcMock.markAllAsRead.mockResolvedValue({ count: 5 });

      const res = await request(app.getHttpServer()).patch(
        '/api/v1/notifications/read-all',
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ count: 5 });
      expect(svcMock.markAllAsRead).toHaveBeenCalledWith('user-1');
    });
  });

  // ── PATCH /notifications/:id/read ─────────────────────────────────────────

  describe('PATCH /api/v1/notifications/:id/read', () => {
    it('should return 200 when notification is marked as read', async () => {
      svcMock.markAsRead.mockResolvedValue({ id: 'notif-uuid-1234', read: true });

      const res = await request(app.getHttpServer()).patch(
        '/api/v1/notifications/00000000-0000-0000-0000-000000000001/read',
      );

      expect(res.status).toBe(200);
      expect(res.body.read).toBe(true);
    });

    it('should return 400 when id is not a valid UUID', async () => {
      const res = await request(app.getHttpServer()).patch(
        '/api/v1/notifications/not-a-uuid/read',
      );

      expect(res.status).toBe(400);
    });
  });
});
