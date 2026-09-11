import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { ApiEnvironment } from '@rerms/config';
import { API_ENVIRONMENT } from '../config/foundation-config.module';

export interface CrmCursor {
  key: string[];
  asOf?: string;
}
@Injectable()
export class CrmCursorService {
  private readonly key: Buffer;
  constructor(@Inject(API_ENVIRONMENT) environment: ApiEnvironment) {
    this.key = createHmac('sha256', Buffer.from(environment.PARTY_CONTACT_LOOKUP_KEY, 'hex'))
      .update('crm-cursor-encryption:v1')
      .digest();
  }
  scope(input: unknown): string {
    const canonical = (value: unknown): unknown =>
      Array.isArray(value)
        ? value.map(canonical).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
        : value !== null && typeof value === 'object'
          ? Object.fromEntries(
              Object.entries(value)
                .filter(([, v]) => v !== undefined)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([k, v]) => [k, canonical(v)]),
            )
          : typeof value === 'string'
            ? value.trim().toLowerCase()
            : value;
    return createHmac('sha256', this.key)
      .update('crm-scope:v1')
      .update(JSON.stringify(canonical(input)))
      .digest('base64url');
  }
  encode(kind: string, scope: string, key: string[], asOf?: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from('crm-cursor:v1'));
    const body = Buffer.concat([
      cipher.update(JSON.stringify({ v: 1, kind, scope, key, asOf }), 'utf8'),
      cipher.final(),
    ]);
    return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${body.toString('base64url')}`;
  }
  decode(cursor: string | undefined, kind: string, scope: string): CrmCursor | undefined {
    if (!cursor) return undefined;
    try {
      const parts = cursor.split('.');
      if (parts.length !== 4 || parts[0] !== 'v1') throw new Error();
      // Buffer.from(..., 'base64url') is intentionally permissive about the
      // unused trailing bits in a base64url quantum.  Enforce canonical
      // encodings so a one-character cursor mutation can never be accepted as
      // the same authenticated ciphertext.
      const decodeCanonical = (value: string) => {
        if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
        const decoded = Buffer.from(value, 'base64url');
        if (decoded.toString('base64url') !== value) throw new Error();
        return decoded;
      };
      const iv = decodeCanonical(parts[1]!);
      const tag = decodeCanonical(parts[2]!);
      const ciphertext = decodeCanonical(parts[3]!);
      if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) throw new Error();
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.key,
        iv,
      );
      decipher.setAAD(Buffer.from('crm-cursor:v1'));
      decipher.setAuthTag(tag);
      const payload = JSON.parse(
        Buffer.concat([
          decipher.update(ciphertext),
          decipher.final(),
        ]).toString('utf8'),
      ) as Record<string, unknown>;
      if (
        payload.v !== 1 ||
        payload.kind !== kind ||
        payload.scope !== scope ||
        !Array.isArray(payload.key) ||
        !payload.key.every((v) => typeof v === 'string') ||
        payload.key.length < 2 ||
        payload.key.length > 4
      )
        throw new Error();
      if (
        payload.asOf !== undefined &&
        (typeof payload.asOf !== 'string' || Number.isNaN(Date.parse(payload.asOf)))
      )
        throw new Error();
      return {
        key: payload.key,
        ...(typeof payload.asOf === 'string' ? { asOf: payload.asOf } : {}),
      };
    } catch {
      throw new BadRequestException('CRM_VALIDATION_FAILED');
    }
  }
}
