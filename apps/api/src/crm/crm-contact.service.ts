import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { ApiEnvironment } from '@rerms/config';
import { API_ENVIRONMENT } from '../config/foundation-config.module';

@Injectable()
export class CrmContactService {
  private readonly version: string;
  private readonly keys = new Map<string, Buffer>();
  private readonly lookupKey: Buffer;
  constructor(@Inject(API_ENVIRONMENT) environment: ApiEnvironment) {
    this.version = environment.PARTY_DATA_ENCRYPTION_KEY_VERSION;
    this.keys.set(this.version, Buffer.from(environment.PARTY_DATA_ENCRYPTION_KEY, 'hex'));
    for (const entry of environment.PARTY_DATA_DECRYPTION_KEYS.split(',')
      .map((value) => value.trim())
      .filter(Boolean)) {
      const separator = entry.indexOf(':');
      this.keys.set(entry.slice(0, separator), Buffer.from(entry.slice(separator + 1), 'hex'));
    }
    this.lookupKey = Buffer.from(environment.PARTY_CONTACT_LOOKUP_KEY, 'hex');
  }
  normalize(value: string): string {
    return value.trim().toLowerCase();
  }
  encrypt(value: string): string {
    const iv = randomBytes(12);
    const key = this.keys.get(this.version);
    if (!key) throw new Error('CRM contact encryption key unavailable.');
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(value.trim(), 'utf8'), cipher.final()]);
    return `${this.version}.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
  }
  decrypt(value: string): string {
    const [version, iv, tag, encrypted] = value.split('.');
    const key = this.keys.get(version ?? '');
    if (!key || !iv || !tag || !encrypted) throw new Error('CRM contact cannot be decrypted.');
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
  token(value: string): string {
    return createHmac('sha256', this.lookupKey)
      .update('crm-lead-contact-search:v1\0')
      .update(this.normalize(value))
      .digest('hex');
  }
  masked(encrypted: string | null, kind: 'phone' | 'email'): string | null {
    if (!encrypted) return null;
    const value = this.decrypt(encrypted);
    if (kind === 'email') {
      const [name, domain] = value.split('@');
      return domain ? `${name?.slice(0, 1) || '*'}***@${domain}` : '***';
    }
    const tail = value.replace(/\s/g, '').slice(-4);
    return tail ? `***${tail}` : '***';
  }
}
