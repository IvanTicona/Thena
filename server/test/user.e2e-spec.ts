import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { Reflector } from '@nestjs/core';

import { UserController } from '../src/modules/user/infrastructure/controllers/user.controller.js';
import { UserService } from '../src/modules/user/application/services/user.service.js';
import { RolesGuard } from '../src/modules/auth/infrastructure/guards/roles.guard.js';
import type { JwtPayload } from '../src/modules/auth/domain/auth.types.js';

// ── Mock factories ────────────────────────────────────────────────────────────

let currentUser: JwtPayload = { sub: 'admin-1', email: 'admin@test.com', role: 'ADMIN' };

function buildUserServiceMock() {
  return {
    getById: jest.fn(),
    changePassword: jest.fn(),
    create: jest.fn(),
    findPaginated: jest.fn(),
    findTutors: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    restore: jest.fn(),
  };
}

// ── App factory ───────────────────────────────────────────────────────────────

async function createTestApp(
  svc: ReturnType<typeof buildUserServiceMock>,
): Promise<INestApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    controllers: [UserController],
    providers: [
      { provide: UserService, useValue: svc },
      RolesGuard,
      Reflector,
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { user: JwtPayload }).user = currentUser;
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  await app.init();
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('User E2E (/api/v1/users)', () => {
  let app: INestApplication;
  let svcMock: ReturnType<typeof buildUserServiceMock>;

  beforeEach(async () => {
    currentUser = { sub: 'admin-1', email: 'admin@test.com', role: 'ADMIN' };
    svcMock = buildUserServiceMock();
    app = await createTestApp(svcMock);
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  // ── GET /users/me ─────────────────────────────────────────────────────────

  describe('GET /api/v1/users/me', () => {
    it('should return 200 with current user data', async () => {
      svcMock.getById.mockResolvedValue({ id: 'admin-1', email: 'admin@test.com' });

      const res = await request(app.getHttpServer()).get('/api/v1/users/me');

      expect(res.status).toBe(200);
      expect(svcMock.getById).toHaveBeenCalledWith('admin-1');
    });
  });

  // ── PATCH /users/me/password ──────────────────────────────────────────────

  describe('PATCH /api/v1/users/me/password', () => {
    it('should return 200 on valid password change', async () => {
      svcMock.changePassword.mockResolvedValue({ message: 'ok' });

      const res = await request(app.getHttpServer())
        .patch('/api/v1/users/me/password')
        .send({ currentPassword: 'oldpassword', newPassword: 'newpassword123' });

      expect(res.status).toBe(200);
      expect(svcMock.changePassword).toHaveBeenCalledWith(
        'admin-1',
        'oldpassword',
        'newpassword123',
      );
    });

    it('should return 400 when newPassword is too short', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/users/me/password')
        .send({ currentPassword: 'oldpassword', newPassword: 'short' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when currentPassword is missing', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/users/me/password')
        .send({ newPassword: 'newpassword123' });

      expect(res.status).toBe(400);
    });
  });

  // ── GET /users ────────────────────────────────────────────────────────────

  describe('GET /api/v1/users', () => {
    it('should return 200 with paginated users for ADMIN', async () => {
      svcMock.findPaginated.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

      const res = await request(app.getHttpServer()).get('/api/v1/users');

      expect(res.status).toBe(200);
      expect(svcMock.findPaginated).toHaveBeenCalledTimes(1);
    });

    it('should return 403 when user is STUDENT', async () => {
      currentUser = { sub: 'student-1', email: 'student@test.com', role: 'STUDENT' };

      const res = await request(app.getHttpServer()).get('/api/v1/users');

      expect(res.status).toBe(403);
      expect(svcMock.findPaginated).not.toHaveBeenCalled();
    });

    it('should return 400 when page is not a number', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/users?page=abc');

      expect(res.status).toBe(400);
    });

    it('should return 400 when limit exceeds 100', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/users?limit=101');

      expect(res.status).toBe(400);
    });
  });

  // ── POST /users ───────────────────────────────────────────────────────────

  describe('POST /api/v1/users', () => {
    it('should return 201 when admin creates a user', async () => {
      svcMock.create.mockResolvedValue({ id: 'new-user', email: 'tutor@test.com' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/users')
        .send({
          email: 'tutor@test.com',
          name: 'New Tutor',
          password: 'password123',
          role: 'TUTOR',
        });

      expect(res.status).toBe(201);
      expect(svcMock.create).toHaveBeenCalledTimes(1);
    });

    it('should return 403 when STUDENT tries to create a user', async () => {
      currentUser = { sub: 'student-1', email: 'student@test.com', role: 'STUDENT' };

      const res = await request(app.getHttpServer())
        .post('/api/v1/users')
        .send({
          email: 'tutor@test.com',
          name: 'New Tutor',
          password: 'password123',
          role: 'TUTOR',
        });

      expect(res.status).toBe(403);
    });

    it('should return 400 when role is not a valid admin-creatable role', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/users')
        .send({
          email: 'student@test.com',
          name: 'New Student',
          password: 'password123',
          role: 'STUDENT',
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when email is invalid', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/users')
        .send({
          email: 'not-an-email',
          name: 'New Tutor',
          password: 'password123',
          role: 'TUTOR',
        });

      expect(res.status).toBe(400);
    });
  });

  // ── GET /users/:id ────────────────────────────────────────────────────────

  describe('GET /api/v1/users/:id', () => {
    it('should return 200 with user data for ADMIN', async () => {
      svcMock.getById.mockResolvedValue({ id: 'user-uuid', email: 'user@test.com' });

      const res = await request(app.getHttpServer()).get(
        '/api/v1/users/00000000-0000-0000-0000-000000000001',
      );

      expect(res.status).toBe(200);
      expect(svcMock.getById).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000001');
    });

    it('should return 400 when id is not a valid UUID', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/users/not-a-uuid');

      expect(res.status).toBe(400);
    });

    it('should return 403 when user is STUDENT', async () => {
      currentUser = { sub: 'student-1', email: 'student@test.com', role: 'STUDENT' };

      const res = await request(app.getHttpServer()).get(
        '/api/v1/users/00000000-0000-0000-0000-000000000001',
      );

      expect(res.status).toBe(403);
    });
  });

  // ── PATCH /users/:id ──────────────────────────────────────────────────────

  describe('PATCH /api/v1/users/:id', () => {
    it('should return 200 when admin updates a user', async () => {
      svcMock.update.mockResolvedValue({ id: 'user-uuid', name: 'Updated Name' });

      const res = await request(app.getHttpServer())
        .patch('/api/v1/users/00000000-0000-0000-0000-000000000001')
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
    });

    it('should return 400 when id is not a valid UUID', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/users/not-a-uuid')
        .send({ name: 'Test' });

      expect(res.status).toBe(400);
    });
  });

  // ── DELETE /users/:id ─────────────────────────────────────────────────────

  describe('DELETE /api/v1/users/:id', () => {
    it('should return 200 when admin deletes a user', async () => {
      svcMock.delete.mockResolvedValue({ id: 'user-uuid' });

      const res = await request(app.getHttpServer()).delete(
        '/api/v1/users/00000000-0000-0000-0000-000000000001',
      );

      expect(res.status).toBe(200);
    });

    it('should return 400 when id is not a valid UUID', async () => {
      const res = await request(app.getHttpServer()).delete('/api/v1/users/not-a-uuid');

      expect(res.status).toBe(400);
    });
  });

  // ── PATCH /users/:id/restore ──────────────────────────────────────────────

  describe('PATCH /api/v1/users/:id/restore', () => {
    it('should return 200 when admin restores a user', async () => {
      svcMock.restore.mockResolvedValue({ id: 'user-uuid', deletedAt: null });

      const res = await request(app.getHttpServer()).patch(
        '/api/v1/users/00000000-0000-0000-0000-000000000001/restore',
      );

      expect(res.status).toBe(200);
    });

    it('should return 400 when id is not a valid UUID', async () => {
      const res = await request(app.getHttpServer()).patch(
        '/api/v1/users/not-a-uuid/restore',
      );

      expect(res.status).toBe(400);
    });

    it('should return 403 when user is TUTOR', async () => {
      currentUser = { sub: 'tutor-1', email: 'tutor@test.com', role: 'TUTOR' };

      const res = await request(app.getHttpServer()).patch(
        '/api/v1/users/00000000-0000-0000-0000-000000000001/restore',
      );

      expect(res.status).toBe(403);
    });
  });
});
