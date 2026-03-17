import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MockAuthMiddleware } from './mock-auth.middleware.js';

@Module({})
export class MockAuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MockAuthMiddleware).forRoutes('*path');
  }
}
