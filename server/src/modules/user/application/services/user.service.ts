import {
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import { AuditService } from '../../../audit/application/audit.service.js';
import { AuditAction } from '../../../audit/domain/audit.constants.js';
import { UserRole } from '../../../auth/domain/auth.types.js';
import type { UserModel } from '../../../../generated/prisma/models/User.js';
import {
  CreateUserDto,
  UpdateUserDto,
  UserListQueryDto,
} from '../dtos/user.dto.js';
import { PaginatedUsersResponse } from '../dtos/user-response.dto.js';

interface UserSummary {
  id: string;
  name: string;
  role: string;
}

export interface TutorSummary {
  id: string;
  name: string;
  email: string;
}

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findById(id: string): Promise<UserModel | null> {
    return this.prisma.client.user.findUnique({ where: { id } });
  }

  async findAll(): Promise<UserSummary[]> {
    return this.prisma.client.user.findMany({
      select: { id: true, name: true, role: true },
    });
  }

  async findTutors(): Promise<TutorSummary[]> {
    return this.prisma.client.user.findMany({
      where: { role: 'TUTOR' },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
  }

  // ─── Admin User Management ────────────────────────────────────────────

  async create(dto: CreateUserDto, actorId: string): Promise<Omit<UserModel, 'passwordHash'>> {
    const existing = await this.prisma.client.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.client.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        role: dto.role as UserRole,
        passwordHash,
      },
    });

    void this.auditService.log({
      action: AuditAction.CREATE_USER,
      actorId,
      entityType: 'user',
      entityId: user.id,
      metadata: { email: user.email, role: user.role },
    });

    return this.omitPassword(user);
  }

  async findPaginated(query: UserListQueryDto): Promise<PaginatedUsersResponse> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where = query.role ? { role: query.role as UserRole } : {};

    const [users, total] = await Promise.all([
      this.prisma.client.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string): Promise<Omit<UserModel, 'passwordHash'>> {
    const user = await this.prisma.client.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.omitPassword(user);
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actorId: string,
  ): Promise<Omit<UserModel, 'passwordHash'>> {
    const user = await this.prisma.client.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check email uniqueness if changing
    if (dto.email && dto.email !== user.email) {
      const emailTaken = await this.prisma.client.user.findUnique({
        where: { email: dto.email },
      });
      if (emailTaken) {
        throw new ConflictException('Email already in use');
      }
    }

    const updated = await this.prisma.client.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.role !== undefined && { role: dto.role as UserRole }),
      },
    });

    void this.auditService.log({
      action: AuditAction.CREATE_USER,
      actorId,
      entityType: 'user',
      entityId: id,
      metadata: { updatedFields: Object.keys(dto) },
    });

    return this.omitPassword(updated);
  }

  async delete(id: string, actorId: string): Promise<{ id: string; deleted: true }> {
    const user = await this.prisma.client.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent deleting yourself
    if (id === actorId) {
      throw new BadRequestException('Cannot delete your own account');
    }

    await this.prisma.client.user.delete({ where: { id } });

    void this.auditService.log({
      action: AuditAction.CREATE_USER,
      actorId,
      entityType: 'user',
      entityId: id,
      metadata: { action: 'DELETE_USER', email: user.email },
    });

    return { id, deleted: true };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: true }> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.client.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { success: true };
  }

  private omitPassword(user: UserModel): Omit<UserModel, 'passwordHash'> {
    const { passwordHash: _hash, ...rest } = user;
    return rest;
  }
}
