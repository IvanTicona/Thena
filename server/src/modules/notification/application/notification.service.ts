import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type { NotificationType } from '../../../generated/prisma/enums.js';

export interface PaginatedNotifications {
  data: {
    id: string;
    type: NotificationType;
    title: string;
    body: string;
    read: boolean;
    metadata: unknown;
    createdAt: Date;
  }[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  unreadCount: number;
}

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a notification in the DB.
   * Errors are swallowed intentionally — notifications must NEVER break the main business flow.
   */
  async create(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.client.notification.create({
        data: {
          userId,
          type,
          title,
          body,
          ...(metadata !== undefined ? { metadata: metadata as object } : {}),
        },
      });
    } catch (error) {
      // Log to console but do NOT propagate — notifications must not break business logic
      console.error(
        '[NotificationService] Failed to create notification:',
        error,
      );
    }
  }

  async findByUser(
    userId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedNotifications> {
    const skip = (page - 1) * limit;

    const [data, total, unreadCount] = await Promise.all([
      this.prisma.client.notification.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          read: true,
          metadata: true,
          createdAt: true,
        },
      }),
      this.prisma.client.notification.count({ where: { userId } }),
      this.countUnread(userId),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      unreadCount,
    };
  }

  async countUnread(userId: string): Promise<number> {
    return this.prisma.client.notification.count({
      where: { userId, read: false },
    });
  }

  async markAsRead(
    id: string,
    userId: string,
  ): Promise<{ id: string; read: boolean }> {
    // Verify ownership — findFirst returns null if not found or not owned
    const notification = await this.prisma.client.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      return { id, read: false };
    }

    const updated = await this.prisma.client.notification.update({
      where: { id },
      data: { read: true },
      select: { id: true, read: true },
    });

    return updated;
  }

  async markAllAsRead(userId: string): Promise<{ count: number }> {
    const result = await this.prisma.client.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    return { count: result.count };
  }
}
