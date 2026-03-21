import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { MockAuthMiddleware } from './mock-auth.middleware.js';

@Module({})
export class MockAuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(MockAuthMiddleware)
      .exclude({ path: 'users', method: RequestMethod.GET })
      .forRoutes('*path');
  }
}
