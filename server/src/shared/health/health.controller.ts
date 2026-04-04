import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
  HealthIndicator,
  HealthIndicatorStatus,
} from '@nestjs/terminus';
import { Public } from '../../modules/auth/infrastructure/decorators/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

class PrismaHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.client.$queryRaw`SELECT 1`;
      return this.getStatus(key, true);
    } catch {
      return this.getStatus(key, false);
    }
  }
}

@Controller('health')
export class HealthController {
  private readonly prismaIndicator: PrismaHealthIndicator;

  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
  ) {
    this.prismaIndicator = new PrismaHealthIndicator(prisma);
  }

  @Get()
  @Public()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prismaIndicator.isHealthy('database'),
      async (): Promise<HealthIndicatorResult> => {
        try {
          const { default: Redis } = await import('ioredis');
          const redis = new Redis(
            process.env.REDIS_URL ?? 'redis://redis:6379',
            { lazyConnect: true, connectTimeout: 3000 },
          );
          await redis.connect();
          await redis.ping();
          await redis.quit();
          return {
            redis: { status: 'up' as HealthIndicatorStatus },
          };
        } catch {
          return {
            redis: { status: 'down' as HealthIndicatorStatus },
          };
        }
      },
    ]);
  }
}
