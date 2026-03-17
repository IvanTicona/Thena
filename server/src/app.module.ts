import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './shared/prisma/prisma.module.js';
import { MockAuthModule } from './shared/mock-auth/mock-auth.module.js';
import { StorageModule } from './shared/storage/storage.module.js';
import { UserModule } from './modules/user/user.module.js';
import { ChapterModule } from './modules/chapter/chapter.module.js';
import { SubmissionModule } from './modules/submission/submission.module.js';
import { ReviewModule } from './modules/review/review.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
    }),

    PrismaModule,
    MockAuthModule,
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
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
