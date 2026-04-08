import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { LoggingInterceptor } from './shared/interceptors/logging.interceptor.js';

/** Guard: reject insecure JWT secrets before accepting any connections. */
function validateJwtSecrets(logger: Logger): void {
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  const insecure = ['changeme-access', 'changeme-refresh', '', undefined];

  if (!accessSecret || insecure.includes(accessSecret)) {
    logger.error(
      'JWT_ACCESS_SECRET is missing or using an insecure default value. ' +
        'Set a strong secret in your .env before starting Thena.',
    );
    process.exit(1);
  }

  if (!refreshSecret || insecure.includes(refreshSecret)) {
    logger.error(
      'JWT_REFRESH_SECRET is missing or using an insecure default value. ' +
        'Set a strong secret in your .env before starting Thena.',
    );
    process.exit(1);
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Abort immediately if JWT secrets are not properly configured
  validateJwtSecrets(logger);

  // Security hardening — helmet adds essential HTTP security headers
  app.use(helmet());

  app.use(cookieParser());

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global request logging — logs method, path, userId, duration, status
  app.useGlobalInterceptors(new LoggingInterceptor());

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });

  // Graceful shutdown — drains BullMQ and closes DB connections on SIGTERM
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Thena API running on port ${port}`);
}
bootstrap();
