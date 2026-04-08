/**
 * E2E integration tests for the Auth endpoints.
 * Uses a focused TestingModule with all external deps mocked —
 * no real DB, Redis, or MinIO required.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { ThrottlerModule } from '@nestjs/throttler';

import { AuthModule } from '../src/modules/auth/auth.module.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import { AuditService } from '../src/modules/audit/application/audit.service.js';

// ── Shared mock builder ───────────────────────────────────────────────────────

function buildPrismaUserMock() {
  return {
    client: {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    },
  };
}

// ── App factory ───────────────────────────────────────────────────────────────

async function createTestApp(prisma: ReturnType<typeof buildPrismaUserMock>): Promise<INestApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      ThrottlerModule.forRoot([{ name: 'global', ttl: 60_000, limit: 100 }]),
      JwtModule.register({ secret: 'test-access-secret', signOptions: { expiresIn: '15m' } }),
      AuthModule,
    ],
  })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideProvider(AuditService)
    .useValue({ log: jest.fn().mockResolvedValue(undefined) })
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

describe('Auth E2E (/api/v1/auth)', () => {
  let app: INestApplication;
  let prismaMock: ReturnType<typeof buildPrismaUserMock>;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

    prismaMock = buildPrismaUserMock();
    app = await createTestApp(prismaMock);
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  // ── POST /auth/register ──────────────────────────────────────────────────

  describe('POST /api/v1/auth/register', () => {
    it('should return 201 and user data on valid registration', async () => {
      const newUser = {
        id: 'user-1',
        email: 'new@test.com',
        name: 'New User',
        role: 'STUDENT',
        createdAt: new Date(),
        updatedAt: new Date(),
        passwordHash: 'hash',
      };

      prismaMock.client.user.findUnique.mockResolvedValue(null);
      prismaMock.client.user.create.mockResolvedValue(newUser);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'new@test.com', name: 'New User', password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('email', 'new@test.com');
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('should return 409 when email already exists', async () => {
      prismaMock.client.user.findUnique.mockResolvedValue({
        id: 'existing-1',
        email: 'existing@test.com',
        passwordHash: 'hash',
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'existing@test.com', name: 'User', password: 'password123' });

      expect(res.status).toBe(409);
    });

    it('should return 400 when email is invalid', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'not-an-email', name: 'User', password: 'password123' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when password is too short', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'test@test.com', name: 'User', password: 'short' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when name is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'test@test.com', password: 'password123' });

      expect(res.status).toBe(400);
    });

    it('should set httpOnly cookies on successful registration', async () => {
      const newUser = {
        id: 'user-1',
        email: 'new@test.com',
        name: 'New User',
        role: 'STUDENT',
        createdAt: new Date(),
        updatedAt: new Date(),
        passwordHash: 'hash',
      };

      prismaMock.client.user.findUnique.mockResolvedValue(null);
      prismaMock.client.user.create.mockResolvedValue(newUser);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'new@test.com', name: 'New User', password: 'password123' });

      expect(res.headers['set-cookie']).toBeDefined();
      const cookies = res.headers['set-cookie'] as string[];
      expect(cookies.some((c: string) => c.startsWith('access_token'))).toBe(true);
      expect(cookies.some((c: string) => c.startsWith('refresh_token'))).toBe(true);
    });
  });

  // ── POST /auth/login ──────────────────────────────────────────────────────

  describe('POST /api/v1/auth/login', () => {
    it('should return 200 and user data on valid credentials', async () => {
      const hash = await bcrypt.hash('password123', 10);
      const user = {
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test User',
        role: 'STUDENT',
        passwordHash: hash,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.client.user.findUnique.mockResolvedValue(user);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'test@test.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('test@test.com');
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('should return 401 when user does not exist', async () => {
      prismaMock.client.user.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@test.com', password: 'password123' });

      expect(res.status).toBe(401);
    });

    it('should return 401 when password is wrong', async () => {
      const hash = await bcrypt.hash('correctpassword', 10);
      prismaMock.client.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        passwordHash: hash,
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'test@test.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
    });

    it('should return 400 when email is invalid', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: 'password123' });

      expect(res.status).toBe(400);
    });

    it('should set cookies on successful login', async () => {
      const hash = await bcrypt.hash('password123', 10);
      prismaMock.client.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test',
        role: 'STUDENT',
        passwordHash: hash,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'test@test.com', password: 'password123' });

      const cookies = res.headers['set-cookie'] as string[];
      expect(cookies.some((c: string) => c.startsWith('access_token'))).toBe(true);
    });
  });

  // ── POST /auth/logout ─────────────────────────────────────────────────────

  describe('POST /api/v1/auth/logout', () => {
    it('should return 200 and clear cookies', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'ok' });
    });
  });
});
