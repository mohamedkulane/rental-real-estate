import { sessionToken } from '../session-cookie';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';

const databaseUrl = process.env.DATABASE_URL ?? '';
const adminEmail = process.env.SEED_ADMIN_EMAIL;
const adminPassword = process.env.SEED_ADMIN_PASSWORD;

describe.skipIf(!(databaseUrl && adminEmail && adminPassword))('Phase 9 portals and reporting', () => {
  let app: INestApplication;
  let database: PrismaClient;
  let adminToken: string;
  let ownerToken: string;

  beforeAll(async () => {
    process.env.WEB_URL = 'http://localhost:3000';
    process.env.REDIS_URL ??= 'redis://localhost:56379';
    database = new PrismaClient({ datasourceUrl: databaseUrl });
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApplication(app);
    await app.init();
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(201);
    adminToken = sessionToken(adminLogin);
    const ownerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'owner.portal@example.test', password: 'Portal-Demo-Password1!' })
      .expect(201);
    ownerToken = sessionToken(ownerLogin);
  });

  afterAll(async () => {
    await app?.close();
    await database?.$disconnect();
  });

  it('serves owner portal overview and blocks staff endpoints for portal users', async () => {
    const overview = await request(app.getHttpServer())
      .get('/api/v1/portal/owner/overview')
      .set('Cookie', `rerms_session=${ownerToken}`)
      .expect(200);
    expect(overview.body.summary).toBeDefined();
    await request(app.getHttpServer())
      .get('/api/v1/reports/workspace')
      .set('Cookie', `rerms_session=${ownerToken}`)
      .expect(403);
  });

  it('serves staff dashboard, search, and notifications', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/notifications/seed')
      .set('Cookie', `rerms_session=${adminToken}`)
      .expect(201);
    const dashboard = await request(app.getHttpServer())
      .get('/api/v1/dashboard/summary')
      .set('Cookie', `rerms_session=${adminToken}`)
      .expect(200);
    expect(dashboard.body.widgets).toBeDefined();
    const search = await request(app.getHttpServer())
      .get('/api/v1/search?q=PROP')
      .set('Cookie', `rerms_session=${adminToken}`)
      .expect(200);
    expect(Array.isArray(search.body.items)).toBe(true);
    const notifications = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Cookie', `rerms_session=${adminToken}`)
      .expect(200);
    expect(notifications.body.unreadCount).toBeGreaterThanOrEqual(0);
  });
});
