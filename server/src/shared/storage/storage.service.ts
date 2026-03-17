import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class StorageService implements OnModuleInit {
  private client: Minio.Client;
  private bucket: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>(
      'MINIO_BUCKET',
      'thena-documents',
    );
    this.client = new Minio.Client({
      endPoint: this.config.get<string>('MINIO_ENDPOINT', 'minio'),
      port: parseInt(this.config.get<string>('MINIO_PORT', '9000'), 10),
      accessKey: this.config.get<string>('MINIO_ACCESS_KEY', 'thena'),
      secretKey: this.config.get<string>('MINIO_SECRET_KEY', 'thena-secret'),
      useSSL: this.config.get<string>('MINIO_USE_SSL', 'false') === 'true',
    });
  }

  async onModuleInit() {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
      console.log(`Created MinIO bucket: ${this.bucket}`);
    }
  }

  async upload(
    objectName: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    await this.client.putObject(this.bucket, objectName, buffer, buffer.length, {
      'Content-Type': contentType,
    });
    return `${this.bucket}/${objectName}`;
  }

  async download(objectName: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, objectName);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
