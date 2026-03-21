import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  engineUrl: process.env.ENGINE_URL ?? 'http://engine:8000',
}));

export const minioConfig = registerAs('minio', () => ({
  endpoint: process.env.MINIO_ENDPOINT ?? 'minio',
  port: parseInt(process.env.MINIO_PORT ?? '9000', 10),
  accessKey: process.env.MINIO_ACCESS_KEY ?? 'thena',
  secretKey: process.env.MINIO_SECRET_KEY ?? 'thena-secret',
  bucket: process.env.MINIO_BUCKET ?? 'thena-documents',
  useSSL: process.env.MINIO_USE_SSL === 'true',
}));
