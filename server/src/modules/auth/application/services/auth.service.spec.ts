import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../auth.service.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { AuditService } from '../../../audit/application/audit.service.js';

// ── Mock factories ──────────────────────────────────────────────────────────

const makePrismaMock = () => ({
  client: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
});

const makeJwtMock = () => ({
  sign: jest.fn().mockReturnValue('mock-token'),
});

const makeConfigMock = () => ({
  get: jest.fn((key: string, fallback?: unknown) => fallback ?? 'mock-secret'),
  getOrThrow: jest.fn((_key: string) => 'mock-secret'),
});

const makeAuditMock = () => ({
  log: jest.fn().mockResolvedValue(undefined),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const baseUser = {
  id: 'user-1',
  email: 'test@test.com',
  name: 'Test User',
  role: 'STUDENT',
  passwordHash: 'hashed-password',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;
  let prismaMock: ReturnType<typeof makePrismaMock>;
  let jwtMock: ReturnType<typeof makeJwtMock>;
  let configMock: ReturnType<typeof makeConfigMock>;
  let auditMock: ReturnType<typeof makeAuditMock>;

  beforeEach(async () => {
    prismaMock = makePrismaMock();
    jwtMock = makeJwtMock();
    configMock = makeConfigMock();
    auditMock = makeAuditMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
        { provide: ConfigService, useValue: configMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── register ──────────────────────────────────────────────────────────────

  describe('register', () => {
    it('should throw ConflictException when email already exists', async () => {
      prismaMock.client.user.findUnique.mockResolvedValue(baseUser);

      await expect(
        service.register({ email: 'test@test.com', name: 'Test', password: 'password123' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create a new STUDENT user and return without passwordHash', async () => {
      prismaMock.client.user.findUnique.mockResolvedValue(null);
      prismaMock.client.user.create.mockResolvedValue(baseUser);

      const result = await service.register({
        email: 'new@test.com',
        name: 'New User',
        password: 'password123',
      });

      expect(prismaMock.client.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'new@test.com', role: 'STUDENT' }),
        }),
      );
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
    });

    it('should always create as STUDENT regardless of dto fields', async () => {
      prismaMock.client.user.findUnique.mockResolvedValue(null);
      prismaMock.client.user.create.mockResolvedValue(baseUser);

      await service.register({ email: 'admin@test.com', name: 'Admin', password: 'pass1234' });

      const createCall = prismaMock.client.user.create.mock.calls[0][0];
      expect(createCall.data.role).toBe('STUDENT');
    });

    it('should hash the password before saving', async () => {
      prismaMock.client.user.findUnique.mockResolvedValue(null);
      prismaMock.client.user.create.mockResolvedValue(baseUser);

      await service.register({ email: 'new@test.com', name: 'New', password: 'plaintext' });

      const createCall = prismaMock.client.user.create.mock.calls[0][0];
      const isHashed = await bcrypt.compare('plaintext', createCall.data.passwordHash);
      expect(isHashed).toBe(true);
    });
  });

  // ── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('should throw UnauthorizedException when user not found', async () => {
      prismaMock.client.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@test.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      prismaMock.client.user.findUnique.mockResolvedValue({
        ...baseUser,
        passwordHash: await bcrypt.hash('correctpassword', 10),
      });

      await expect(
        service.login({ email: 'test@test.com', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return user without passwordHash on successful login', async () => {
      const hash = await bcrypt.hash('password123', 10);
      prismaMock.client.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash: hash });

      const result = await service.login({ email: 'test@test.com', password: 'password123' });

      expect(result).not.toHaveProperty('passwordHash');
      expect(result.email).toBe('test@test.com');
    });

    it('should fire-and-forget audit log on successful login', async () => {
      const hash = await bcrypt.hash('password123', 10);
      prismaMock.client.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash: hash });

      await service.login({ email: 'test@test.com', password: 'password123' });

      // Give microtask queue a chance to run
      await new Promise((r) => setImmediate(r));

      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LOGIN', actorId: 'user-1' }),
      );
    });
  });

  // ── generateTokens ────────────────────────────────────────────────────────

  describe('generateTokens', () => {
    it('should call jwtService.sign twice and return access + refresh tokens', () => {
      jwtMock.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = service.generateTokens({
        sub: 'user-1',
        email: 'test@test.com',
        role: 'STUDENT',
      });

      expect(jwtMock.sign).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    });
  });

  // ── refresh ───────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('should throw UnauthorizedException when user not found', async () => {
      prismaMock.client.user.findUnique.mockResolvedValue(null);

      await expect(service.refresh('non-existent')).rejects.toThrow(UnauthorizedException);
    });

    it('should return a new accessToken when user is found', async () => {
      prismaMock.client.user.findUnique.mockResolvedValue(baseUser);
      jwtMock.sign.mockReturnValue('new-access-token');

      const result = await service.refresh('user-1');

      expect(result).toHaveProperty('accessToken');
      expect(typeof result.accessToken).toBe('string');
    });
  });

  // ── getCookieOptions ──────────────────────────────────────────────────────

  describe('getCookieOptions', () => {
    it('should return httpOnly cookies', () => {
      const opts = service.getCookieOptions('access');
      expect(opts.httpOnly).toBe(true);
    });

    it('should return shorter maxAge for access than refresh', () => {
      const accessOpts = service.getCookieOptions('access');
      const refreshOpts = service.getCookieOptions('refresh');
      expect(accessOpts.maxAge!).toBeLessThan(refreshOpts.maxAge!);
    });
  });
});
