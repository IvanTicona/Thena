import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';
import type { UserModel } from '../../../../generated/prisma/models/User.js';

interface UserSummary {
  id: string;
  name: string;
  role: string;
}

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<UserModel | null> {
    return this.prisma.client.user.findUnique({ where: { id } });
  }

  async findAll(): Promise<UserSummary[]> {
    return this.prisma.client.user.findMany({
      select: { id: true, name: true, role: true },
    });
  }
}
