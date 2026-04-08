import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../audit.service.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';

// ── Mock factories ──────────────────────────────────────────────────────────

const makePrismaMock = () => ({
  client: {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeAuditLog = (overrides = {}) => ({
  id: 'log-1',
  action: 'LOGIN',
  actorId: 'user-1',
  entityType: 'user',
  entityId: 'user-1',
  metadata: {},
  createdAt: new Date('2026-01-01'),
  actor: { id: 'user-1', name: 'Test User', email: 'test@test.com', role: 'STUDENT' },
  ...overrides,
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AuditService', () => {
  let service: AuditService;
  let prismaMock: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prismaMock = makePrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── log ───────────────────────────────────────────────────────────────────

  describe('log', () => {
    it('should create an audit log entry with correct data', async () => {
      prismaMock.client.auditLog.create.mockResolvedValue({ id: 'log-1' });

      await service.log({
        action: 'LOGIN',
        actorId: 'user-1',
        entityType: 'user',
        entityId: 'user-1',
        metadata: { email: 'test@test.com' },
      });

      expect(prismaMock.client.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'LOGIN',
            actorId: 'user-1',
            entityType: 'user',
            entityId: 'user-1',
            metadata: { email: 'test@test.com' },
          }),
        }),
      );
    });

    it('should use empty object as metadata when none provided', async () => {
      prismaMock.client.auditLog.create.mockResolvedValue({ id: 'log-1' });

      await service.log({
        action: 'SUBMIT_CHAPTER',
        actorId: 'student-1',
        entityType: 'submission',
        entityId: 'sub-1',
      });

      const createCall = prismaMock.client.auditLog.create.mock.calls[0][0];
      expect(createCall.data.metadata).toEqual({});
    });

    it('should swallow errors and NOT throw when Prisma fails', async () => {
      prismaMock.client.auditLog.create.mockRejectedValue(new Error('DB down'));

      await expect(
        service.log({ action: 'LOGIN', actorId: 'user-1', entityType: 'user', entityId: 'user-1' }),
      ).resolves.toBeUndefined();
    });

    it('should log the error to console when Prisma fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      prismaMock.client.auditLog.create.mockRejectedValue(new Error('DB down'));

      await service.log({ action: 'LOGIN', actorId: 'user-1', entityType: 'user', entityId: 'user-1' });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AuditService]'),
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated audit logs with defaults', async () => {
      const logs = [makeAuditLog()];
      prismaMock.client.auditLog.findMany.mockResolvedValue(logs);
      prismaMock.client.auditLog.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should apply pagination correctly', async () => {
      prismaMock.client.auditLog.findMany.mockResolvedValue([]);
      prismaMock.client.auditLog.count.mockResolvedValue(100);

      const result = await service.findAll({ page: 3, limit: 10 });

      expect(prismaMock.client.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
      expect(result.page).toBe(3);
      expect(result.totalPages).toBe(10);
    });

    it('should filter by action when provided', async () => {
      prismaMock.client.auditLog.findMany.mockResolvedValue([]);
      prismaMock.client.auditLog.count.mockResolvedValue(0);

      await service.findAll({ action: 'LOGIN' });

      expect(prismaMock.client.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ action: 'LOGIN' }),
        }),
      );
    });

    it('should filter by actorId when provided', async () => {
      prismaMock.client.auditLog.findMany.mockResolvedValue([]);
      prismaMock.client.auditLog.count.mockResolvedValue(0);

      await service.findAll({ actorId: 'user-1' });

      expect(prismaMock.client.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ actorId: 'user-1' }),
        }),
      );
    });

    it('should filter by entityType when provided', async () => {
      prismaMock.client.auditLog.findMany.mockResolvedValue([]);
      prismaMock.client.auditLog.count.mockResolvedValue(0);

      await service.findAll({ entityType: 'submission' });

      expect(prismaMock.client.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ entityType: 'submission' }),
        }),
      );
    });

    it('should filter by date range when provided', async () => {
      prismaMock.client.auditLog.findMany.mockResolvedValue([]);
      prismaMock.client.auditLog.count.mockResolvedValue(0);

      const dateFrom = new Date('2026-01-01');
      const dateTo = new Date('2026-12-31');

      await service.findAll({ dateFrom, dateTo });

      expect(prismaMock.client.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: dateFrom, lte: dateTo },
          }),
        }),
      );
    });

    it('should cap limit at 100', async () => {
      prismaMock.client.auditLog.findMany.mockResolvedValue([]);
      prismaMock.client.auditLog.count.mockResolvedValue(0);

      await service.findAll({ limit: 999 });

      expect(prismaMock.client.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('should ensure page is at least 1 when invalid value provided', async () => {
      prismaMock.client.auditLog.findMany.mockResolvedValue([]);
      prismaMock.client.auditLog.count.mockResolvedValue(0);

      const result = await service.findAll({ page: 0 });

      expect(result.page).toBe(1);
    });

    it('should not filter by action when action is not provided', async () => {
      prismaMock.client.auditLog.findMany.mockResolvedValue([]);
      prismaMock.client.auditLog.count.mockResolvedValue(0);

      await service.findAll({});

      const findManyCall = prismaMock.client.auditLog.findMany.mock.calls[0][0];
      expect(findManyCall.where).not.toHaveProperty('action');
    });
  });
});
