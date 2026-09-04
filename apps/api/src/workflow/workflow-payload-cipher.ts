import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { ApiEnvironment } from '@rerms/config';
import { API_ENVIRONMENT } from '../config/foundation-config.module';

@Injectable()
export class WorkflowPayloadCipher {
  private readonly version: string;
  private readonly key: Buffer;

  constructor(@Inject(API_ENVIRONMENT) environment: ApiEnvironment) {
    this.version = environment.PARTY_DATA_ENCRYPTION_KEY_VERSION;
    this.key = Buffer.from(environment.PARTY_DATA_ENCRYPTION_KEY, 'hex');
  }

  encrypt(payload: Record<string, unknown>): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
    return `${this.version}.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
  }

  decrypt(value: string): Record<string, unknown> {
    const [version, iv, tag, encrypted] = value.split('.');
    if (version !== this.version || !iv || !tag || !encrypted) throw new Error('Workflow draft cannot be decrypted.');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8')) as Record<string, unknown>;
  }
}
