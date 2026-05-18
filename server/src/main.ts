import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { LoggingInterceptor } from './shared/interceptors/logging.interceptor.js';
import { requireEnv } from './shared/utils/require-env.js';

function validateJwtSecrets(logger: Logger): void {
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  const insecure = ['changeme-access', 'changeme-refresh', '', undefined];

  if (insecure.includes(accessSecret)) {
    logger.error(
      'JWT_ACCESS_SECRET is missing or using an insecure default value. ' +
        'Set a strong secret in your .env before starting Thena.',
    );
    process.exit(1);
  }

  if (insecure.includes(refreshSecret)) {
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

  app.useGlobalInterceptors(new LoggingInterceptor());

  app.enableCors({
    origin: requireEnv('CORS_ORIGIN'),
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  });

  // Graceful shutdown — drains BullMQ and closes DB connections on SIGTERM
  app.enableShutdownHooks();

  const port = parseInt(requireEnv('PORT_SERVER'), 10);
  await app.listen(port);
  logger.log(`Thena API running on port ${port}`);
}
void bootstrap();
