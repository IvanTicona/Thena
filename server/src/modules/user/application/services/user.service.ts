import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service.js';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.client.user.findUnique({ where: { id } });
  }

  async findAll() {
    return this.prisma.client.user.findMany({
      select: { id: true, name: true, role: true },
    });
  }
}
