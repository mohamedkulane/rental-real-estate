import type { ApiEnvironment } from '@rerms/config';
import { describe, expect, it, vi } from 'vitest';
import type { RedisService } from '../../src/infrastructure/redis.service';
import { AuthRateLimitService } from '../../src/identity/auth-rate-limit.service';
import { PartyCryptoService } from '../../src/portfolio/party-crypto.service';

const encryptionV1 = '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';
const encryptionV2 = '303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f';
const lookupOne = '101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f';
const lookupTwo = '202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f';

function environment(overrides: Partial<ApiEnvironment> = {}): ApiEnvironment {
  return {
    PARTY_DATA_ENCRYPTION_KEY: encryptionV1,
    PARTY_DATA_ENCRYPTION_KEY_VERSION: 'v1',
    PARTY_DATA_DECRYPTION_KEYS: '',
    PARTY_CONTACT_LOOKUP_KEY: lookupOne,
    AUTH_RATE_LIMIT_KEY: lookupTwo,
    AUTH_LOGIN_LIMIT_PER_15_MINUTES: 3,
    AUTH_RESET_LIMIT_PER_HOUR: 2,
    ...overrides,
  } as ApiEnvironment;
}

describe('security hardening controls', () => {
  it('decrypts old Party contact ciphertext after an encryption-key rotation', () => {
    const oldCrypto = new PartyCryptoService(environment());
    const ciphertext = oldCrypto.encrypt('owner@example.test');
    const rotatedCrypto = new PartyCryptoService(
      environment({
        PARTY_DATA_ENCRYPTION_KEY: encryptionV2,
        PARTY_DATA_ENCRYPTION_KEY_VERSION: 'v2',
        PARTY_DATA_DECRYPTION_KEYS: `v1:${encryptionV1}`,
      }),
    );
    expect(rotatedCrypto.decrypt(ciphertext)).toBe('owner@example.test');
    expect(rotatedCrypto.encrypt('new@example.test')).toMatch(/^v2\./);
  });

  it('uses a distinct keyed lookup digest and preserves normalization', () => {
    const first = new PartyCryptoService(environment());
    const second = new PartyCryptoService(environment({ PARTY_CONTACT_LOOKUP_KEY: lookupTwo }));
    expect(first.normalizedHash(' Owner@Example.Test ')).toBe(
      first.normalizedHash('owner@example.test'),
    );
    expect(first.normalizedHash('owner@example.test')).not.toBe(
      second.normalizedHash('owner@example.test'),
    );
  });

  it('throttles login attempts without putting the raw identity into Redis keys', async () => {
    let count = 0;
    const exec = vi.fn().mockImplementation(() =>
      Promise.resolve([
        [null, ++count],
        [null, 1],
      ]),
    );
    const incr = vi.fn().mockReturnThis();
    const multi = vi.fn().mockReturnValue({
      incr,
      expire: vi.fn().mockReturnThis(),
      exec,
    });
    const redis = { client: { multi } } as unknown as RedisService;
    const limiter = new AuthRateLimitService(redis, environment());
    await limiter.consume('login', '192.0.2.5', 'Admin@Example.Test');
    await limiter.consume('login', '192.0.2.5', 'Admin@Example.Test');
    await limiter.consume('login', '192.0.2.5', 'Admin@Example.Test');
    await expect(limiter.consume('login', '192.0.2.5', 'Admin@Example.Test')).rejects.toMatchObject(
      { status: 429 },
    );
    const redisKey = incr.mock.calls[0]?.[0] as string;
    expect(redisKey).toMatch(/^rerms:auth-limit:login:/);
    expect(redisKey).not.toContain('Admin');
    expect(redisKey).not.toContain('192.0.2.5');
  });
});
