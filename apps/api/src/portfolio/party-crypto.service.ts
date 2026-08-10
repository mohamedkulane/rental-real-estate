import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { ApiEnvironment } from '@rerms/config';
import { API_ENVIRONMENT } from '../config/foundation-config.module';

@Injectable()
export class PartyCryptoService {
  private readonly key: Buffer;
  constructor(@Inject(API_ENVIRONMENT) environment: ApiEnvironment) {
    this.key = Buffer.from(environment.PARTY_DATA_ENCRYPTION_KEY, 'hex');
  }

  encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
  }

  decrypt(value: string): string {
    const [iv, tag, encrypted] = value.split('.');
    if (!iv || !tag || !encrypted) throw new Error('Invalid encrypted contact value.');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  normalizedHash(value: string): string {
    return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
  }
}
