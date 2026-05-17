import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type { AuditActionType } from '../domain/audit.constants.js';

export interface LogAuditOptions {
  action: AuditActionType;
  actorId: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogFilters {
  action?: string;
  actorId?: string;
  entityType?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page: number;
  limit: number;
}

export interface PaginatedAuditLogs {
  data: {
    id: string;
    action: string;
    actorId: string;
    entityType: string;
    entityId: string;
    metadata: unknown;
    createdAt: Date;
    actor: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
  }[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Append-only audit log entry. Errors are swallowed intentionally —
   * audit logging must NEVER break the main business flow.
   */
  async log(options: LogAuditOptions): Promise<void> {
    try {
      await this.prisma.client.auditLog.create({
        data: {
          action: options.action,
          actorId: options.actorId,
          entityType: options.entityType,
          entityId: options.entityId,
          ...(options.metadata !== undefined
            ? { metadata: options.metadata as object }
            : {}),
        },
      });
    } catch (error) {
      // Log to console but do NOT propagate — audit must not break business logic
      console.error('[AuditService] Failed to write audit log:', error);
    }
  }

  async exportCsv(
    filters: Omit<AuditLogFilters, 'page' | 'limit'>,
  ): Promise<string> {
    const where: Record<string, unknown> = {};

    if (filters.action) {
      where['action'] = filters.action;
    }

    if (filters.actorId) {
      where['actorId'] = filters.actorId;
    }

    if (filters.entityType) {
      where['entityType'] = filters.entityType;
    }

    if (filters.dateFrom || filters.dateTo) {
      where['createdAt'] = {
        ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
        ...(filters.dateTo ? { lte: filters.dateTo } : {}),
      };
    }

    const rows = await this.prisma.client.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000, // safety cap
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    const header = [
      'id',
      'action',
      'actorId',
      'actorName',
      'actorEmail',
      'actorRole',
      'entityType',
      'entityId',
      'createdAt',
    ];

    const escape = (value: string) => {
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines = rows.map((row) =>
      [
        row.id,
        row.action,
        row.actorId,
        row.actor.name,
        row.actor.email,
        row.actor.role,
        row.entityType,
        row.entityId,
        row.createdAt.toISOString(),
      ]
        .map(escape)
        .join(','),
    );

    return [header.join(','), ...lines].join('\n');
  }

  async findAll(filters: AuditLogFilters): Promise<PaginatedAuditLogs> {
    const skip = (filters.page - 1) * filters.limit;

    const where: Record<string, unknown> = {};

    if (filters.action) {
      where['action'] = filters.action;
    }

    if (filters.actorId) {
      where['actorId'] = filters.actorId;
    }

    if (filters.entityType) {
      where['entityType'] = filters.entityType;
    }

    if (filters.dateFrom || filters.dateTo) {
      where['createdAt'] = {
        ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
        ...(filters.dateTo ? { lte: filters.dateTo } : {}),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.client.auditLog.findMany({
        where,
        skip,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      this.prisma.client.auditLog.count({ where }),
    ]);

    return {
      data,
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit),
    };
  }
}
