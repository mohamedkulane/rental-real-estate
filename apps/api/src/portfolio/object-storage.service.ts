import { Readable } from 'node:stream';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { ApiEnvironment } from '@rerms/config';
import { API_ENVIRONMENT } from '../config/foundation-config.module';

@Injectable()
export class ObjectStorageService implements OnModuleInit {
  private readonly client: S3Client;

  constructor(@Inject(API_ENVIRONMENT) private readonly environment: ApiEnvironment) {
    this.client = new S3Client({
      endpoint: environment.S3_ENDPOINT,
      region: environment.S3_REGION,
      forcePathStyle: environment.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: environment.S3_ACCESS_KEY_ID,
        secretAccessKey: environment.S3_SECRET_ACCESS_KEY,
      },
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.environment.S3_BUCKET }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.environment.S3_BUCKET }));
    }
  }

  maximumUploadBytes(): number {
    return this.environment.DOCUMENT_MAX_UPLOAD_BYTES;
  }

  async put(input: {
    storageKey: string;
    body: Buffer;
    mimeType: string;
    checksum: string;
  }): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.environment.S3_BUCKET,
        Key: input.storageKey,
        Body: input.body,
        ContentType: input.mimeType,
        Metadata: { checksum: input.checksum },
      }),
    );
  }

  async get(storageKey: string): Promise<{
    body: Readable;
    contentLength?: number;
    contentType?: string;
  }> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.environment.S3_BUCKET, Key: storageKey }),
    );
    if (!response.Body) throw new Error('Stored document content is unavailable.');
    return {
      body: response.Body as Readable,
      ...(response.ContentLength === undefined ? {} : { contentLength: response.ContentLength }),
      ...(response.ContentType ? { contentType: response.ContentType } : {}),
    };
  }

  async remove(storageKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.environment.S3_BUCKET, Key: storageKey }),
    );
  }
}
