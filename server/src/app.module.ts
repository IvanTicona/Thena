import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './shared/prisma/prisma.module.js';
import { StorageModule } from './shared/storage/storage.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UserModule } from './modules/user/user.module.js';
import { ChapterModule } from './modules/chapter/chapter.module.js';
import { SubmissionModule } from './modules/submission/submission.module.js';
import { ReviewModule } from './modules/review/review.module.js';
import { KnowledgeModule } from './modules/knowledge/knowledge.module.js';
import { ThesisModule } from './modules/thesis/thesis.module.js';
import { HealthModule } from './shared/health/health.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AssignmentModule } from './modules/assignment/assignment.module.js';
import { NotificationModule } from './modules/notification/notification.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
    }),

    // Rate limiting — default 100 req/min globally; auth endpoints override to 5/60s
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60_000,
        limit: 100,
      },
    ]),

    PrismaModule,
    AuthModule,
    StorageModule,

    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('REDIS_URL', 'redis://redis:6379'),
        },
      }),
    }),

    UserModule,
    ChapterModule,
    SubmissionModule,
    ReviewModule,
    KnowledgeModule,
    ThesisModule,
    HealthModule,
    AuditModule,
    AssignmentModule,
    NotificationModule,
  ],
  controllers: [],
  providers: [
    // Apply ThrottlerGuard globally; auth endpoints override with stricter limits
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
