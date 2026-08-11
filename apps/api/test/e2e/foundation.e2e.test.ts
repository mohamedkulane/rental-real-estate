import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { DatabaseService } from '../../src/database/database.service';
import { QueueService } from '../../src/infrastructure/queue.service';
import { RedisService } from '../../src/infrastructure/redis.service';

process.env.WEB_URL = 'http://localhost:3000';
process.env.DATABASE_URL = 'postgresql://unused:unused@localhost:5432/unused';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.NODE_ENV = 'test';
process.env.PARTY_DATA_ENCRYPTION_KEY = '0'.repeat(64);

describe('foundation API', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue({ $queryRaw: vi.fn() })
      .overrideProvider(RedisService)
      .useValue({ ensureConnected: vi.fn() })
      .overrideProvider(QueueService)
      .useValue({ checkHealth: vi.fn() })
      .compile();
    app = module.createNestApplication();
    configureApplication(app);
    await app.init();
  });
  afterAll(async () => app?.close());

  it('returns liveness and a correlation ID', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(response.body.status).toBe('ok');
    expect(response.headers['x-correlation-id']).toBeTruthy();
    expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('accepts both local browser aliases outside production while rejecting other origins', async () => {
    const localAlias = await request(app.getHttpServer())
      .options('/api/v1/auth/login')
      .set('origin', 'http://127.0.0.1:3000')
      .set('access-control-request-method', 'POST')
      .set('access-control-request-headers', 'content-type')
      .expect(204);
    expect(localAlias.headers['access-control-allow-origin']).toBe('http://127.0.0.1:3000');

    const denied = await request(app.getHttpServer())
      .options('/api/v1/auth/login')
      .set('origin', 'https://untrusted.example')
      .set('access-control-request-method', 'POST')
      .expect(404);
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('returns the standard validation error envelope', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/foundation/validate')
      .send({ label: '' })
      .expect(400);
    expect(response.body).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
    expect(response.body.correlationId).toBeTruthy();
  });
  it('does not expose Swagger unless the explicit non-production switch is enabled', async () => {
    await request(app.getHttpServer()).get('/api/docs').expect(404);
  });
});
