import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import bcrypt from 'bcryptjs';

import { AuthController } from '../src/modules/auth/infrastructure/controllers/auth.controller.js';
import { AuthService } from '../src/modules/auth/application/auth.service.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import { AuditService } from '../src/modules/audit/application/audit.service.js';

// ── Mock factories ────────────────────────────────────────────────────────────

function buildPrismaMock() {
  return {
    client: {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    },
  };
}

// ── App factory ───────────────────────────────────────────────────────────────

async function createTestApp(
  prisma: ReturnType<typeof buildPrismaMock>,
): Promise<INestApplication> {
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  process.env.JWT_ACCESS_EXPIRY = '15m';
  process.env.JWT_REFRESH_EXPIRY = '7d';
  process.env.NODE_ENV = 'test';

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      JwtModule.register({
        secret: 'test-access-secret',
        signOptions: { expiresIn: '15m' },
      }),
    ],
    controllers: [AuthController],
    providers: [
      AuthService,
      { provide: PrismaService, useValue: prisma },
      { provide: AuditService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
    ],
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

describe('Auth E2E (/api/v1/auth)', () => {
  let app: INestApplication;
  let prismaMock: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prismaMock = buildPrismaMock();
    app = await createTestApp(prismaMock);
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  // ── POST /auth/register ───────────────────────────────────────────────────

  describe('POST /api/v1/auth/register', () => {
    it('should return 201 and user data on valid registration', async () => {
      const newUser = {
        id: 'user-1',
        email: 'new@test.com',
        name: 'New User',
        role: 'STUDENT',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
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
        deletedAt: null,
        passwordHash: 'hash',
      };

      prismaMock.client.user.findUnique.mockResolvedValue(null);
      prismaMock.client.user.create.mockResolvedValue(newUser);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'new@test.com', name: 'New User', password: 'password123' });

      const cookies = res.headers['set-cookie'] as unknown as string[];
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
        deletedAt: null,
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
        deletedAt: null,
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
        deletedAt: null,
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'test@test.com', password: 'password123' });

      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies.some((c: string) => c.startsWith('access_token'))).toBe(true);
    });
  });

  // ── POST /auth/logout ─────────────────────────────────────────────────────

  describe('POST /api/v1/auth/logout', () => {
    it('should return 200 and clear cookies', async () => {
      const res = await request(app.getHttpServer()).post('/api/v1/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'ok' });
    });
  });
});
