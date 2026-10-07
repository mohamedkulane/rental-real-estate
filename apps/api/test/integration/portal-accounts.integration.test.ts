import { sessionToken } from '../session-cookie';
import { randomUUID } from 'node:crypto';
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

    const principal = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', `rerms_session=${adminToken}`)
      .expect(200);
    const companyId = principal.body.companyId as string;
    const businessDate = new Date(`${String(principal.body.businessDate)}T00:00:00.000Z`);
    const branch = await database.branch.findFirstOrThrow({ where: { companyId, active: true } });
    const fixtureSuffix = Date.now().toString();
    ownerPartyId = randomUUID();
    await database.party.create({
      data: {
        id: ownerPartyId,
        companyId,
        partyNumber: `PTY-PORTAL-${fixtureSuffix}`,
        kind: 'PERSON',
        displayName: 'Portal Account Integration Owner',
        owner: {
          create: {
            ownerNumber: `OWN-PORTAL-${fixtureSuffix}`,
          },
        },
        branchAssignments: {
          create: {
            id: randomUUID(),
            branchId: branch.id,
            effectiveFrom: businessDate,
          },
        },
      },
    });
  });

  afterAll(async () => {
    if (ownerPartyId) {
      await database.partyBranchAssignment.deleteMany({ where: { partyId: ownerPartyId } });
      await database.ownerProfile.deleteMany({ where: { partyId: ownerPartyId } });
      await database.party.deleteMany({ where: { id: ownerPartyId } });
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

  it('requires an active Full Management engagement for owner portal access', async () => {
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
  });
});
