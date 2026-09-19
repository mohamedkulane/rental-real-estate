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

describe.skipIf(!(databaseUrl && adminEmail && adminPassword))('Portal account admin', () => {
  let app: INestApplication;
  let database: PrismaClient;
  let adminToken: string;
  let ownerPartyId: string;
  let createdPortalAccountId: string | undefined;
  const uniqueEmail = `owner-portal-admin-${Date.now()}@example.test`;

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

    const owners = await request(app.getHttpServer())
      .get('/api/v1/owners?limit=20')
      .set('Cookie', `rerms_session=${adminToken}`)
      .expect(200);
    for (const owner of owners.body.items as Array<{ partyId: string }>) {
      const existing = await database.portalAccount.findUnique({ where: { partyId: owner.partyId } });
      if (!existing) {
        ownerPartyId = owner.partyId;
        break;
      }
    }
    if (!ownerPartyId) throw new Error('No owner without portal account found for test.');
  });

  afterAll(async () => {
    if (createdPortalAccountId) {
      await database.portalAccount.deleteMany({ where: { id: createdPortalAccountId } });
      await database.user.deleteMany({ where: { emailNormalized: uniqueEmail.toLowerCase() } });
    }
    await app?.close();
    await database?.$disconnect();
  });

  it('lists portal accounts for staff', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/portal-accounts?limit=10')
      .set('Cookie', `rerms_session=${adminToken}`)
      .expect(200);
    expect(Array.isArray(response.body.items)).toBe(true);
  });

  it('creates a unique owner portal login and rejects duplicate email', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/portal-accounts')
      .set('Cookie', `rerms_session=${adminToken}`)
      .send({
        partyId: ownerPartyId,
        portalType: 'OWNER',
        email: uniqueEmail,
        password: 'Portal-Admin-Password1!',
      })
      .expect(201);
    createdPortalAccountId = created.body.id;
    expect(created.body.user.emailNormalized).toBe(uniqueEmail.toLowerCase());
    expect(created.body.portalType).toBe('OWNER');

    await request(app.getHttpServer())
      .post('/api/v1/portal-accounts')
      .set('Cookie', `rerms_session=${adminToken}`)
      .send({
        partyId: ownerPartyId,
        portalType: 'OWNER',
        email: uniqueEmail,
        password: 'Portal-Admin-Password1!',
      })
      .expect(400);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: uniqueEmail, password: 'Portal-Admin-Password1!' })
      .expect(201);
    const ownerToken = sessionToken(login);
    await request(app.getHttpServer())
      .get('/api/v1/portal/owner/overview')
      .set('Cookie', `rerms_session=${ownerToken}`)
      .expect(200);
  });

  it('deactivates a portal account and ends sessions', async () => {
    if (!createdPortalAccountId) return;
    await request(app.getHttpServer())
      .patch(`/api/v1/portal-accounts/${createdPortalAccountId}/status`)
      .set('Cookie', `rerms_session=${adminToken}`)
      .send({ active: false, reason: 'Test deactivation' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: uniqueEmail, password: 'Portal-Admin-Password1!' })
      .expect(401);
  });
});
