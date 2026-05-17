import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from '../notification.service.js';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';

// ── Mock factories ──────────────────────────────────────────────────────────

const makePrismaMock = () => ({
  client: {
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
  },
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('NotificationService', () => {
  let service: NotificationService;
  let prismaMock: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prismaMock = makePrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a notification with the provided data', async () => {
      prismaMock.client.notification.create.mockResolvedValue({
        id: 'notif-1',
        userId: 'user-1',
        type: 'NEW_SUBMISSION',
        title: 'Nueva entrega',
        body: 'Se recibió una entrega',
        metadata: {},
        read: false,
        createdAt: new Date(),
      });

      await service.create(
        'user-1',
        'NEW_SUBMISSION',
        'Nueva entrega',
        'Se recibió una entrega',
      );

      const [createCall] = prismaMock.client.notification.create.mock
        .calls[0] as [
        { data: { userId: string; type: string; title: string; body: string } },
      ];
      expect(createCall.data.userId).toBe('user-1');
      expect(createCall.data.type).toBe('NEW_SUBMISSION');
      expect(createCall.data.title).toBe('Nueva entrega');
      expect(createCall.data.body).toBe('Se recibió una entrega');
    });

    it('should swallow errors and NOT throw when Prisma fails', async () => {
      prismaMock.client.notification.create.mockRejectedValue(
        new Error('DB down'),
      );

      // Should resolve without throwing
      await expect(
        service.create('user-1', 'NEW_SUBMISSION', 'title', 'body'),
      ).resolves.toBeUndefined();
    });

    it('should not pass metadata when none provided — DB default applies', async () => {
      prismaMock.client.notification.create.mockResolvedValue({});

      await service.create('user-1', 'NEW_SUBMISSION', 'title', 'body');

      const [createCall] = prismaMock.client.notification.create.mock
        .calls[0] as [{ data: { metadata?: object } }];
      expect(createCall.data.metadata).toBeUndefined();
    });

    it('should pass custom metadata when provided', async () => {
      prismaMock.client.notification.create.mockResolvedValue({});

      const metadata = { submissionId: 'sub-1', chapterId: 'ch-1' };
      await service.create(
        'user-1',
        'NEW_SUBMISSION',
        'title',
        'body',
        metadata,
      );

      const [createCall] = prismaMock.client.notification.create.mock
        .calls[0] as [{ data: { metadata: object } }];
      expect(createCall.data.metadata).toEqual(metadata);
    });
  });

  // ── findByUser ────────────────────────────────────────────────────────────

  describe('findByUser', () => {
    it('should return paginated notifications with unread count', async () => {
      const mockNotifications = [
        {
          id: 'notif-1',
          type: 'NEW_SUBMISSION',
          title: 'Title',
          body: 'Body',
          read: false,
          metadata: {},
          createdAt: new Date(),
        },
      ];
      prismaMock.client.notification.findMany.mockResolvedValue(
        mockNotifications,
      );
      prismaMock.client.notification.count
        .mockResolvedValueOnce(1) // total
        .mockResolvedValueOnce(1); // unread

      const result = await service.findByUser('user-1', 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.unreadCount).toBe(1);
    });

    it('should use page=1 and limit=20 when passed', async () => {
      prismaMock.client.notification.findMany.mockResolvedValue([]);
      prismaMock.client.notification.count.mockResolvedValue(0);

      await service.findByUser('user-1', 1, 20);

      const [findCall] = prismaMock.client.notification.findMany.mock
        .calls[0] as [{ skip: number; take: number }];
      expect(findCall.skip).toBe(0);
      expect(findCall.take).toBe(20);
    });

    it('should paginate correctly with custom page and limit', async () => {
      prismaMock.client.notification.findMany.mockResolvedValue([]);
      prismaMock.client.notification.count.mockResolvedValue(50);

      const result = await service.findByUser('user-1', 3, 10);

      const [findCall] = prismaMock.client.notification.findMany.mock
        .calls[0] as [{ skip: number; take: number }];
      expect(findCall.skip).toBe(20);
      expect(findCall.take).toBe(10);
      expect(result.page).toBe(3);
      expect(result.totalPages).toBe(5);
    });
  });

  // ── markAsRead ────────────────────────────────────────────────────────────

  describe('markAsRead', () => {
    it('should return {id, read: false} when notification not found or not owned', async () => {
      prismaMock.client.notification.findFirst.mockResolvedValue(null);

      const result = await service.markAsRead('notif-1', 'user-1');

      expect(result).toEqual({ id: 'notif-1', read: false });
      expect(prismaMock.client.notification.update).not.toHaveBeenCalled();
    });

    it('should mark notification as read when owned by user', async () => {
      prismaMock.client.notification.findFirst.mockResolvedValue({
        id: 'notif-1',
        userId: 'user-1',
        read: false,
      });
      prismaMock.client.notification.update.mockResolvedValue({
        id: 'notif-1',
        read: true,
      });

      const result = await service.markAsRead('notif-1', 'user-1');

      expect(prismaMock.client.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'notif-1' },
          data: { read: true },
        }),
      );
      expect(result.read).toBe(true);
    });
  });

  // ── markAllAsRead ─────────────────────────────────────────────────────────

  describe('markAllAsRead', () => {
    it('should update all unread notifications for the user', async () => {
      prismaMock.client.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.markAllAsRead('user-1');

      expect(prismaMock.client.notification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', read: false },
          data: { read: true },
        }),
      );
      expect(result.count).toBe(5);
    });

    it('should return count=0 when no unread notifications', async () => {
      prismaMock.client.notification.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.markAllAsRead('user-1');

      expect(result.count).toBe(0);
    });
  });

  // ── countUnread ───────────────────────────────────────────────────────────

  describe('countUnread', () => {
    it('should return the unread notification count for a user', async () => {
      prismaMock.client.notification.count.mockResolvedValue(3);

      const result = await service.countUnread('user-1');

      expect(result).toBe(3);
      expect(prismaMock.client.notification.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1', read: false } }),
      );
    });
  });
});
