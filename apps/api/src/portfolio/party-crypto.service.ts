import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { ApiEnvironment } from '@rerms/config';
import { API_ENVIRONMENT } from '../config/foundation-config.module';

@Injectable()
export class PartyCryptoService {
  private readonly currentVersion: string;
  private readonly encryptionKeys = new Map<string, Buffer>();
  private readonly lookupKey: Buffer;

  constructor(@Inject(API_ENVIRONMENT) environment: ApiEnvironment) {
    this.currentVersion = environment.PARTY_DATA_ENCRYPTION_KEY_VERSION;
    this.encryptionKeys.set(
      this.currentVersion,
      Buffer.from(environment.PARTY_DATA_ENCRYPTION_KEY, 'hex'),
    );
    for (const entry of environment.PARTY_DATA_DECRYPTION_KEYS.split(',')
      .map((item) => item.trim())
      .filter(Boolean)) {
      const separator = entry.indexOf(':');
      const version = entry.slice(0, separator);
      const key = entry.slice(separator + 1);
      if (!/^v[1-9][0-9]*$/.test(version) || !/^[0-9a-fA-F]{64}$/.test(key)) {
        throw new Error(
          'PARTY_DATA_DECRYPTION_KEYS must contain comma-separated version:hex-key entries.',
        );
      }
      this.encryptionKeys.set(version, Buffer.from(key, 'hex'));
    }
    this.lookupKey = Buffer.from(environment.PARTY_CONTACT_LOOKUP_KEY, 'hex');
  }

  encrypt(value: string): string {
    const iv = randomBytes(12);
    const key = this.encryptionKeys.get(this.currentVersion);
    if (!key) throw new Error('The current Party encryption key is unavailable.');
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return `${this.currentVersion}.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
  }

  decrypt(value: string): string {
    const parts = value.split('.');
    const versioned = /^v[1-9][0-9]*$/.test(parts[0] ?? '');
    const version = versioned ? parts[0] : this.currentVersion;
    const [iv, tag, encrypted] = versioned ? parts.slice(1) : parts;
    const key = this.encryptionKeys.get(version ?? '');
    if (!key || !iv || !tag || !encrypted)
      throw new Error('Invalid or unsupported encrypted contact value.');
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  normalizedHash(value: string): string {
    return createHmac('sha256', this.lookupKey)
      .update('party-contact-search:v1\0')
      .update(value.trim().toLowerCase())
      .digest('hex');
  }
}
