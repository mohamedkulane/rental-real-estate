import type { ApiEnvironment } from '@rerms/config';
import { describe, expect, it } from 'vitest';
import { ObjectStorageService } from './object-storage.service';

const testEnvironment = {
  NODE_ENV: 'test',
  S3_ENDPOINT: 'http://127.0.0.1:59000',
  S3_REGION: 'us-east-1',
  S3_FORCE_PATH_STYLE: true,
  S3_ACCESS_KEY_ID: 'test-access',
  S3_SECRET_ACCESS_KEY: 'test-secret',
  S3_BUCKET: 'test-bucket',
} as ApiEnvironment;

describe('ObjectStorageService test adapter', () => {
  it('round-trips document bytes without requiring an external object store', async () => {
    const storage = new ObjectStorageService(testEnvironment);
    const body = Buffer.from('test document');

    await storage.onModuleInit();
    await storage.put({
      storageKey: 'documents/test.pdf',
      body,
      mimeType: 'application/pdf',
      checksum: 'checksum',
    });

    const stored = await storage.get('documents/test.pdf');
    const chunks: Buffer[] = [];
    for await (const chunk of stored.body) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks)).toEqual(body);
    expect(stored.contentLength).toBe(body.length);
    expect(stored.contentType).toBe('application/pdf');

    await storage.remove('documents/test.pdf');
    await expect(storage.get('documents/test.pdf')).rejects.toThrow(
      'Stored document content is unavailable.',
    );
  });
});
