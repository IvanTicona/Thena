import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AlertService } from './alert.service.js';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import { NotificationService } from '../../notification/application/notification.service.js';

// ── Mock factories ──────────────────────────────────────────────────────────

const makePrismaMock = () => ({
  client: {
    thesisDocument: { findMany: jest.fn() },
    alert: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
});

const makeNotificationMock = () => ({
  create: jest.fn().mockResolvedValue(undefined),
});

// ── Date helpers ─────────────────────────────────────────────────────────────

const daysAgo = (n: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

const makeThesis = (id: string, submittedAts: Date[]) => ({
  id,
  tutorId: `tutor-${id}`,
  student: { id: `student-${id}`, name: `Student ${id}` },
  chapters: submittedAts.map((submittedAt) => ({
    submissions: [{ submittedAt }],
  })),
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AlertService', () => {
  let service: AlertService;
  let prismaMock: ReturnType<typeof makePrismaMock>;
  let notificationMock: ReturnType<typeof makeNotificationMock>;

  beforeEach(async () => {
    prismaMock = makePrismaMock();
    notificationMock = makeNotificationMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: NotificationService, useValue: notificationMock },
      ],
    }).compile();

    service = module.get<AlertService>(AlertService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── checkInactivity ───────────────────────────────────────────────────────

  describe('checkInactivity', () => {
    it('creates an alert when the last submission is older than 7 days', async () => {
      prismaMock.client.thesisDocument.findMany.mockResolvedValue([
        makeThesis('t1', [daysAgo(8)]),
      ]);
      prismaMock.client.alert.create.mockResolvedValue({ id: 'alert-1' });

      await service.checkInactivity();

      const [createCall] = prismaMock.client.alert.create.mock.calls[0] as [
        { data: { thesisId: string; type: string } },
      ];
      expect(createCall.data.thesisId).toBe('t1');
      expect(createCall.data.type).toBe('INACTIVITY');
    });

    it('notifies the assigned tutor when an inactivity alert is created', async () => {
      prismaMock.client.thesisDocument.findMany.mockResolvedValue([
        makeThesis('t1', [daysAgo(10)]),
      ]);
      prismaMock.client.alert.create.mockResolvedValue({ id: 'alert-1' });

      await service.checkInactivity();

      expect(notificationMock.create).toHaveBeenCalledWith(
        'tutor-t1',
        'INACTIVITY_ALERT',
        expect.any(String),
        expect.stringContaining('Student t1'),
        expect.objectContaining({ thesisId: 't1' }),
      );
    });

    it('skips a thesis when the last submission is within 7 days', async () => {
      prismaMock.client.thesisDocument.findMany.mockResolvedValue([
        makeThesis('t2', [daysAgo(3)]),
      ]);

      await service.checkInactivity();

      expect(prismaMock.client.alert.create).not.toHaveBeenCalled();
      expect(notificationMock.create).not.toHaveBeenCalled();
    });

    it('skips a thesis that has no submissions at all', async () => {
      prismaMock.client.thesisDocument.findMany.mockResolvedValue([
        {
          id: 't3',
          tutorId: 'tutor-t3',
          student: { id: 's3', name: 'S3' },
          chapters: [{ submissions: [] }],
        },
      ]);

      await service.checkInactivity();

      expect(prismaMock.client.alert.create).not.toHaveBeenCalled();
    });

    it('uses the most recent submission across all chapters to determine inactivity', async () => {
      // Chapter 1: submission 10 days ago (old), Chapter 2: submission 2 days ago (recent)
      // Most recent = 2 days → should NOT trigger an alert
      prismaMock.client.thesisDocument.findMany.mockResolvedValue([
        makeThesis('t4', [daysAgo(10), daysAgo(2)]),
      ]);

      await service.checkInactivity();

      expect(prismaMock.client.alert.create).not.toHaveBeenCalled();
    });

    it('creates alerts only for theses with old submissions when multiple theses are returned', async () => {
      prismaMock.client.thesisDocument.findMany.mockResolvedValue([
        makeThesis('old', [daysAgo(15)]),
        makeThesis('recent', [daysAgo(1)]),
      ]);
      prismaMock.client.alert.create.mockResolvedValue({ id: 'alert-old' });

      await service.checkInactivity();

      expect(prismaMock.client.alert.create).toHaveBeenCalledTimes(1);
      const [createCall] = prismaMock.client.alert.create.mock.calls[0] as [
        { data: { thesisId: string } },
      ];
      expect(createCall.data.thesisId).toBe('old');
    });

    it('stores the last submission date in alert metadata', async () => {
      const lastSubmission = daysAgo(9);
      prismaMock.client.thesisDocument.findMany.mockResolvedValue([
        makeThesis('t5', [lastSubmission]),
      ]);
      prismaMock.client.alert.create.mockResolvedValue({ id: 'alert-t5' });

      await service.checkInactivity();

      const [createCall] = prismaMock.client.alert.create.mock.calls[0] as [
        { data: { metadata: { lastSubmissionAt: string } } },
      ];
      expect(createCall.data.metadata.lastSubmissionAt).toBe(
        lastSubmission.toISOString(),
      );
    });
  });

  // ── resolveAlert ──────────────────────────────────────────────────────────

  describe('resolveAlert', () => {
    it('throws NotFoundException when the alert does not exist', async () => {
      prismaMock.client.alert.findUnique.mockResolvedValue(null);

      await expect(service.resolveAlert('alert-999')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('sets resolvedAt on the alert and returns it', async () => {
      const resolvedAt = new Date();
      prismaMock.client.alert.findUnique.mockResolvedValue({
        id: 'alert-1',
        type: 'INACTIVITY',
      });
      prismaMock.client.alert.update.mockResolvedValue({
        id: 'alert-1',
        resolvedAt,
      });

      const result = await service.resolveAlert('alert-1');

      const [updateCall] = prismaMock.client.alert.update.mock.calls[0] as [
        { where: { id: string }; data: { resolvedAt: Date } },
      ];
      expect(updateCall.where.id).toBe('alert-1');
      expect(updateCall.data.resolvedAt).toBeInstanceOf(Date);
      expect(result.id).toBe('alert-1');
      expect(result.resolvedAt).toBeInstanceOf(Date);
    });
  });

  // ── resolveInactivityAlertsForThesis ──────────────────────────────────────

  describe('resolveInactivityAlertsForThesis', () => {
    it('updates all unresolved INACTIVITY alerts for the thesis', async () => {
      prismaMock.client.alert.updateMany.mockResolvedValue({ count: 2 });

      await service.resolveInactivityAlertsForThesis('thesis-1');

      const [updateManyCall] = prismaMock.client.alert.updateMany.mock
        .calls[0] as [
        {
          where: { thesisId: string; type: string; resolvedAt: null };
          data: { resolvedAt: Date };
        },
      ];
      expect(updateManyCall.where.thesisId).toBe('thesis-1');
      expect(updateManyCall.where.type).toBe('INACTIVITY');
      expect(updateManyCall.where.resolvedAt).toBeNull();
      expect(updateManyCall.data.resolvedAt).toBeInstanceOf(Date);
    });

    it('does not throw when updateMany rejects — errors are swallowed', async () => {
      prismaMock.client.alert.updateMany.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(
        service.resolveInactivityAlertsForThesis('thesis-1'),
      ).resolves.toBeUndefined();
    });
  });
});
