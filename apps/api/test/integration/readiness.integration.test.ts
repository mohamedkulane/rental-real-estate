import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';

describe('infrastructure readiness', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApplication(app);
    await app.init();
  });
  afterAll(async () => app?.close());

  it('connects to PostgreSQL, Redis, and BullMQ', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/readiness').expect(200);
    expect(response.body).toEqual({ status: 'ready', database: 'up', redis: 'up', queue: 'up' });
  });
});
