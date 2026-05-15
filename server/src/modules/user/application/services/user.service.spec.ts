import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UserService } from './user.service.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { AuditService } from '../../../audit/application/audit.service.js';

// ── Mock factories ──────────────────────────────────────────────────────────

const makePrismaMock = () => ({
  client: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  },
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
  deletedAt: null,
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('UserService', () => {
  let service: UserService;
  let prismaMock: ReturnType<typeof makePrismaMock>;
  let auditMock: ReturnType<typeof makeAuditMock>;

  beforeEach(async () => {
    prismaMock = makePrismaMock();
    auditMock = makeAuditMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should return the user when found', async () => {
      prismaMock.client.user.findUnique.mockResolvedValue(baseUser);
      const result = await service.findById('user-1');
      expect(result).toEqual(baseUser);
    });

    it('should return null when not found', async () => {
      prismaMock.client.user.findUnique.mockResolvedValue(null);
      const result = await service.findById('nonexistent');
      expect(result).toBeNull();
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return user summaries', async () => {
      const summaries = [{ id: 'user-1', name: 'Test', role: 'STUDENT' }];
      prismaMock.client.user.findMany.mockResolvedValue(summaries);
      const result = await service.findAll();
      expect(result).toEqual(summaries);
    });
  });

  // ── findTutors ────────────────────────────────────────────────────────────

  describe('findTutors', () => {
    it('should query only TUTOR role users', async () => {
      prismaMock.client.user.findMany.mockResolvedValue([]);
      await service.findTutors();
      expect(prismaMock.client.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: 'TUTOR' }),
        }),
      );
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should throw ConflictException when email is already in use', async () => {
      prismaMock.client.user.findFirst.mockResolvedValue(baseUser);

      await expect(
        service.create({ email: 'test@test.com', name: 'Test', password: 'pass', role: 'TUTOR' }, 'admin-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should create a user and return without passwordHash', async () => {
      prismaMock.client.user.findFirst.mockResolvedValue(null);
      prismaMock.client.user.create.mockResolvedValue(baseUser);

      const result = await service.create(
        { email: 'new@test.com', name: 'New', password: 'pass123', role: 'TUTOR' },
        'admin-1',
      );

      expect(result).not.toHaveProperty('passwordHash');
      expect(prismaMock.client.user.create).toHaveBeenCalledTimes(1);
    });

    it('should hash the password before saving', async () => {
      prismaMock.client.user.findFirst.mockResolvedValue(null);
      prismaMock.client.user.create.mockResolvedValue(baseUser);

      await service.create(
        { email: 'new@test.com', name: 'New', password: 'plaintext', role: 'TUTOR' },
        'admin-1',
      );

      const createCall = prismaMock.client.user.create.mock.calls[0][0];
      const isHashed = await bcrypt.compare('plaintext', createCall.data.passwordHash);
      expect(isHashed).toBe(true);
    });
  });

  // ── findPaginated ─────────────────────────────────────────────────────────

  describe('findPaginated', () => {
    it('should return paginated data with correct meta', async () => {
      prismaMock.client.user.findMany.mockResolvedValue([baseUser]);
      prismaMock.client.user.count.mockResolvedValue(1);

      const result = await service.findPaginated({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should default to page 1 and limit 20 when not specified', async () => {
      prismaMock.client.user.findMany.mockResolvedValue([]);
      prismaMock.client.user.count.mockResolvedValue(0);

      await service.findPaginated({});

      const findCall = prismaMock.client.user.findMany.mock.calls[0][0];
      expect(findCall.skip).toBe(0);
      expect(findCall.take).toBe(20);
    });

    it('should cap limit at 100', async () => {
      prismaMock.client.user.findMany.mockResolvedValue([]);
      prismaMock.client.user.count.mockResolvedValue(0);

      await service.findPaginated({ limit: 999 });

      const findCall = prismaMock.client.user.findMany.mock.calls[0][0];
      expect(findCall.take).toBe(100);
    });
  });

  // ── getById ───────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('should throw NotFoundException when user not found', async () => {
      prismaMock.client.user.findUnique.mockResolvedValue(null);
      await expect(service.getById('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should return user without passwordHash', async () => {
      prismaMock.client.user.findUnique.mockResolvedValue(baseUser);
      const result = await service.getById('user-1');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.id).toBe('user-1');
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should throw NotFoundException when user not found', async () => {
      prismaMock.client.user.findUnique.mockResolvedValue(null);
      await expect(service.update('nonexistent', { name: 'New Name' }, 'admin-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when new email is already taken', async () => {
      prismaMock.client.user.findUnique.mockResolvedValue(baseUser);
      prismaMock.client.user.findFirst.mockResolvedValue({ ...baseUser, id: 'other-user' });

      await expect(
        service.update('user-1', { email: 'taken@test.com' }, 'admin-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should update and return without passwordHash', async () => {
      prismaMock.client.user.findUnique.mockResolvedValue(baseUser);
      prismaMock.client.user.findFirst.mockResolvedValue(null);
      prismaMock.client.user.update.mockResolvedValue({ ...baseUser, name: 'Updated Name' });

      const result = await service.update('user-1', { name: 'Updated Name' }, 'admin-1');

      expect(result).not.toHaveProperty('passwordHash');
      expect(prismaMock.client.user.update).toHaveBeenCalledTimes(1);
    });
  });

  // ── delete ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should throw NotFoundException when user not found', async () => {
      prismaMock.client.user.findUnique.mockResolvedValue(null);
      await expect(service.delete('nonexistent', 'admin-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when deleting own account', async () => {
      prismaMock.client.user.findUnique.mockResolvedValue({ ...baseUser, id: 'admin-1' });
      await expect(service.delete('admin-1', 'admin-1')).rejects.toThrow(BadRequestException);
    });

    it('should soft-delete the user and return confirmation', async () => {
      prismaMock.client.user.findUnique.mockResolvedValue(baseUser);
      prismaMock.client.user.update.mockResolvedValue({ ...baseUser, deletedAt: new Date() });

      const result = await service.delete('user-1', 'admin-1');

      expect(result).toEqual({ id: 'user-1', deleted: true });
      const updateCall = prismaMock.client.user.update.mock.calls[0][0];
      expect(updateCall.data.deletedAt).toBeInstanceOf(Date);
    });
  });

  // ── changePassword ────────────────────────────────────────────────────────

  describe('changePassword', () => {
    it('should throw NotFoundException when user not found', async () => {
      prismaMock.client.user.findUnique.mockResolvedValue(null);
      await expect(service.changePassword('nonexistent', 'old', 'new')).rejects.toThrow(NotFoundException);
    });

    it('should throw UnauthorizedException when current password is wrong', async () => {
      const hash = await bcrypt.hash('correctpassword', 10);
      prismaMock.client.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash: hash });

      await expect(service.changePassword('user-1', 'wrongpassword', 'newpass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should update password and return success', async () => {
      const hash = await bcrypt.hash('currentpass', 10);
      prismaMock.client.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash: hash });
      prismaMock.client.user.update.mockResolvedValue(baseUser);

      const result = await service.changePassword('user-1', 'currentpass', 'newpass123');

      expect(result).toEqual({ success: true });
      expect(prismaMock.client.user.update).toHaveBeenCalledTimes(1);
    });
  });

  // ── restore ───────────────────────────────────────────────────────────────

  describe('restore', () => {
    it('should throw NotFoundException when user not found', async () => {
      prismaMock.client.user.findUnique.mockResolvedValue(null);
      await expect(service.restore('nonexistent', 'admin-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when user is not deleted', async () => {
      prismaMock.client.user.findUnique.mockResolvedValue({ ...baseUser, deletedAt: null });
      await expect(service.restore('user-1', 'admin-1')).rejects.toThrow(BadRequestException);
    });

    it('should restore user and return without passwordHash', async () => {
      const deletedUser = { ...baseUser, deletedAt: new Date() };
      prismaMock.client.user.findUnique.mockResolvedValue(deletedUser);
      prismaMock.client.user.update.mockResolvedValue({ ...baseUser, deletedAt: null });

      const result = await service.restore('user-1', 'admin-1');

      expect(result).not.toHaveProperty('passwordHash');
      const updateCall = prismaMock.client.user.update.mock.calls[0][0];
      expect(updateCall.data.deletedAt).toBeNull();
    });
  });
});
