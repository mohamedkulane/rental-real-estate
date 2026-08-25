import { createHash, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { sessionToken } from '../session-cookie';

const databaseUrl = process.env.DATABASE_URL ?? '';
const adminEmail = process.env.SEED_ADMIN_EMAIL;
const adminPassword = process.env.SEED_ADMIN_PASSWORD;

type EngagementSummary = { id: string };
type EngagementListBody = {
  items: EngagementSummary[];
  totalCount: number;
  pageInfo: { hasNextPage: boolean; nextCursor?: string };
};
type EngagementBody = {
  id: string;
  engagementNumber: string;
  version: number;
  status: string;
  period: string;
  history: Array<{ action: string }>;
};
type CapabilityBody = {
  capabilities: {
    canCreateLease: boolean;
    canCollectRent: boolean;
    canCreateRentalListing: boolean;
  };
};

describe.skipIf(!(databaseUrl && adminEmail && adminPassword))(
  'Phase 5.1 Service Engagement API',
  () => {
    let app: INestApplication;
    let database: PrismaClient;
    let adminToken = '';
    let branchToken = '';
    let multiToken = '';
    let companyId = '';
    let companyPartyId = '';
    let userId = '';
    let hodanId = '';
    let wadajirId = '';
    let businessDate = '';
    let hodanPropertyId = '';
    let wadajirPropertyId = '';
    let emptyPropertyId = '';
    let scheduledEngagementId = '';
    let currentEngagementId = '';
    let wadajirEngagementId = '';
    const suffix = randomUUID().slice(0, 8);
    const branchEmail = `p51.branch.${suffix}@example.test`;
    const multiEmail = `p51.multi.${suffix}@example.test`;
    const password = 'Phase-5.1-Service-Engagement!';

    const auth = (token: string) => ({ authorization: `Bearer ${token}` });
    const offsetDate = (days: number) => {
      const value = new Date(`${businessDate}T00:00:00.000Z`);
      value.setUTCDate(value.getUTCDate() + days);
      return value.toISOString().slice(0, 10);
    };

    async function activeProperty(branchId: string, label: string) {
      const id = randomUUID();
      const from = new Date('2026-01-01');
      await database.property.create({
        data: {
          id,
          companyId,
          propertyCode: `P51-${label}-${id.slice(0, 6)}`,
          name: `Phase 5.1 ${label} Property`,
          propertyType: 'HOUSE',
          status: 'ACTIVE',
          city: 'Mogadishu',
          branchAssignments: { create: { id: randomUUID(), branchId, effectiveFrom: from } },
          propertyLifecycleHistories: {
            create: {
              id: randomUUID(),
              status: 'ACTIVE',
              effectiveFrom: from,
              reason: 'Phase 5.1 E2E fixture',
              actorUserId: userId,
            },
          },
          ownerships: {
            create: {
              id: randomUUID(),
              ownerPartyId: companyPartyId,
              ownershipPercent: '100',
              effectiveFrom: from,
              entitlements: {
                create: {
                  id: randomUUID(),
                  payoutPercent: '100',
                  effectiveFrom: from,
                },
              },
            },
          },
        },
      });
      return id;
    }

    async function createEmployee(email: string, accessMode: 'BRANCH' | 'MULTI_BRANCH') {
      const employee = await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set(auth(adminToken))
        .send({
          displayName: `Phase 5.1 ${accessMode} User`,
          accessMode,
          branchId: hodanId,
          email,
          password,
        })
        .expect(201);
      if (accessMode === 'MULTI_BRANCH') {
        await request(app.getHttpServer())
          .post(`/api/v1/employees/${employee.body.id}/branches`)
          .set(auth(adminToken))
          .send({ branchId: wadajirId, effectiveFrom: businessDate })
          .expect(201);
      }
      const roles = await request(app.getHttpServer())
        .get('/api/v1/roles')
        .set(auth(adminToken))
        .expect(200);
      const role = (roles.body as Array<{ id: string; code: string }>).find(
        (item) => item.code === 'PROPERTY_MANAGER',
      )!;
      for (const branchId of accessMode === 'MULTI_BRANCH' ? [hodanId, wadajirId] : [hodanId]) {
        await request(app.getHttpServer())
          .post(`/api/v1/employees/${employee.body.id}/roles`)
          .set(auth(adminToken))
          .send({ roleId: role.id, branchId, effectiveFrom: businessDate })
          .expect(201);
      }
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(201);
      return sessionToken(login);
    }

    beforeAll(async () => {
      process.env.WEB_URL = 'http://localhost:3000';
      process.env.AUTH_RATE_LIMIT_KEY = createHash('sha256')
        .update(`p51-e2e-rate-limit-${suffix}`)
        .digest('hex');
      process.env.REDIS_URL ??= 'redis://localhost:56379';
      process.env.PARTY_DATA_ENCRYPTION_KEY ??=
        '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';
      database = new PrismaClient({ datasourceUrl: databaseUrl });
      const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
      app = module.createNestApplication();
      configureApplication(app);
      await app.init();
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: adminEmail, password: adminPassword })
        .expect(201);
      adminToken = sessionToken(login);
      const me = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set(auth(adminToken))
        .expect(200);
      businessDate = me.body.businessDate as string;
      const company = await database.company.findFirstOrThrow();
      companyId = company.id;
      companyPartyId = company.legalPartyId!;
      userId = (await database.user.findFirstOrThrow({ where: { employee: { companyId } } })).id;
      const branches = await request(app.getHttpServer())
        .get('/api/v1/branches')
        .set(auth(adminToken))
        .expect(200);
      hodanId = (branches.body as Array<{ id: string; code: string }>).find(
        (item) => item.code === 'HODAN',
      )!.id;
      wadajirId = (branches.body as Array<{ id: string; code: string }>).find(
        (item) => item.code === 'WADAJIR',
      )!.id;
      hodanPropertyId = await activeProperty(hodanId, 'Hodan');
      wadajirPropertyId = await activeProperty(wadajirId, 'Wadajir');
      emptyPropertyId = await activeProperty(hodanId, 'No Authority');
      branchToken = await createEmployee(branchEmail, 'BRANCH');
      multiToken = await createEmployee(multiEmail, 'MULTI_BRANCH');
    }, 120_000);

    afterAll(async () => {
      await app?.close();
      await database?.$disconnect();
    }, 30_000);

    it('creates more than one page and preserves complete stable cursor pagination', async () => {
      for (let index = 1; index <= 12; index += 1) {
        await request(app.getHttpServer())
          .post('/api/v1/service-engagements')
          .set(auth(adminToken))
          .send({
            propertyId: hodanPropertyId,
            serviceModel: 'TENANT_PLACEMENT',
            effectiveFrom: offsetDate(180 + index * 2),
            effectiveTo: offsetDate(181 + index * 2),
            notes: `Cursor boundary ${String(index).padStart(2, '0')}`,
          })
          .expect(201);
      }
      const first = await request(app.getHttpServer())
        .get('/api/v1/service-engagements')
        .query({ propertyId: hodanPropertyId, status: 'DRAFT', limit: 5 })
        .set(auth(adminToken))
        .expect(200);
      const firstBody = first.body as unknown as EngagementListBody;
      expect(firstBody.items).toHaveLength(5);
      expect(firstBody.totalCount).toBeGreaterThanOrEqual(12);
      expect(firstBody.pageInfo.hasNextPage).toBe(true);
      const second = await request(app.getHttpServer())
        .get('/api/v1/service-engagements')
        .query({
          propertyId: hodanPropertyId,
          status: 'DRAFT',
          limit: 5,
          cursor: firstBody.pageInfo.nextCursor,
        })
        .set(auth(adminToken))
        .expect(200);
      const secondBody = second.body as unknown as EngagementListBody;
      expect(secondBody.items).toHaveLength(5);
      expect(new Set([...firstBody.items, ...secondBody.items].map((item) => item.id)).size).toBe(
        10,
      );
      const searched = await request(app.getHttpServer())
        .get('/api/v1/service-engagements')
        .query({ search: 'phase 5.1 HODAN property', serviceModel: 'TENANT_PLACEMENT' })
        .set(auth(adminToken))
        .expect(200);
      expect((searched.body as unknown as EngagementListBody).items.length).toBeGreaterThan(0);
    });

    it('schedules, activates, resolves, edits, and cancels effective policy', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/service-engagements')
        .set(auth(adminToken))
        .send({
          propertyId: hodanPropertyId,
          serviceModel: 'FULL_MANAGEMENT',
          effectiveFrom: offsetDate(60),
          notes: 'Scheduled authority',
        })
        .expect(201);
      const createdBody = created.body as unknown as EngagementBody;
      scheduledEngagementId = createdBody.id;
      expect(createdBody.engagementNumber).toMatch(/^ENG-\d{6,}$/);
      const activated = await request(app.getHttpServer())
        .post(`/api/v1/service-engagements/${scheduledEngagementId}/activate`)
        .set(auth(adminToken))
        .send({ version: createdBody.version, reason: 'Approved future management authority' })
        .expect(201);
      const activatedBody = activated.body as unknown as EngagementBody;
      expect(activatedBody.period).toBe('SCHEDULED');
      const resolved = await request(app.getHttpServer())
        .get('/api/v1/service-capabilities/resolve')
        .query({ propertyId: hodanPropertyId, businessDate: offsetDate(61) })
        .set(auth(adminToken))
        .expect(200);
      const resolvedBody = resolved.body as unknown as CapabilityBody;
      expect(resolvedBody.capabilities.canCreateLease).toBe(true);
      expect(resolvedBody.capabilities.canCollectRent).toBe(true);
      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/service-engagements/${scheduledEngagementId}`)
        .set(auth(adminToken))
        .send({ version: activatedBody.version, notes: 'Corrected reference only' })
        .expect(200);
      const updatedBody = updated.body as unknown as EngagementBody;
      await request(app.getHttpServer())
        .patch(`/api/v1/service-engagements/${scheduledEngagementId}`)
        .set(auth(adminToken))
        .send({ version: activatedBody.version, notes: 'Stale update' })
        .expect(409);
      await request(app.getHttpServer())
        .post(`/api/v1/service-engagements/${scheduledEngagementId}/cancel`)
        .set(auth(adminToken))
        .send({ version: updatedBody.version, reason: 'Future authority withdrawn' })
        .expect(201)
        .expect(({ body }) => expect(body.status).toBe('CANCELLED'));
    });

    it('activates current authority, resolves it, and deactivates with append-only history', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/service-engagements')
        .set(auth(adminToken))
        .send({
          propertyId: emptyPropertyId,
          serviceModel: 'RENTAL_BROKERAGE',
          effectiveFrom: offsetDate(-10),
        })
        .expect(201);
      const createdBody = created.body as unknown as EngagementBody;
      currentEngagementId = createdBody.id;
      const activated = await request(app.getHttpServer())
        .post(`/api/v1/service-engagements/${currentEngagementId}/activate`)
        .set(auth(adminToken))
        .send({ version: createdBody.version, reason: 'Current brokerage mandate approved' })
        .expect(201);
      const activatedBody = activated.body as unknown as EngagementBody;
      const resolved = await request(app.getHttpServer())
        .get('/api/v1/service-capabilities/resolve')
        .query({ propertyId: emptyPropertyId })
        .set(auth(adminToken))
        .expect(200);
      const resolvedBody = resolved.body as unknown as CapabilityBody;
      expect(resolvedBody.capabilities.canCreateRentalListing).toBe(true);
      expect(resolvedBody.capabilities.canCollectRent).toBe(false);
      const ended = await request(app.getHttpServer())
        .post(`/api/v1/service-engagements/${currentEngagementId}/deactivate`)
        .set(auth(adminToken))
        .send({ version: activatedBody.version, reason: 'Brokerage mandate ended' })
        .expect(201);
      expect((ended.body as unknown as EngagementBody).status).toBe('INACTIVE');
      const detail = await request(app.getHttpServer())
        .get(`/api/v1/service-engagements/${currentEngagementId}`)
        .set(auth(adminToken))
        .expect(200);
      expect((detail.body as unknown as EngagementBody).history.map((item) => item.action)).toEqual(
        expect.arrayContaining(['CREATED', 'ACTIVE', 'INACTIVE']),
      );
    });

    it('enforces BRANCH, MULTI_BRANCH, COMPANY_WIDE, and company/object isolation', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/service-engagements')
        .set(auth(adminToken))
        .send({
          propertyId: wadajirPropertyId,
          serviceModel: 'SALE_BROKERAGE',
          effectiveFrom: offsetDate(90),
        })
        .expect(201);
      const createdBody = created.body as unknown as EngagementBody;
      wadajirEngagementId = createdBody.id;
      const branchList = await request(app.getHttpServer())
        .get('/api/v1/service-engagements')
        .set(auth(branchToken))
        .expect(200);
      expect(
        (branchList.body as unknown as EngagementListBody).items.some(
          (item) => item.id === wadajirEngagementId,
        ),
      ).toBe(false);
      await request(app.getHttpServer())
        .get(`/api/v1/service-engagements/${wadajirEngagementId}`)
        .set(auth(branchToken))
        .expect(403);
      await request(app.getHttpServer())
        .patch(`/api/v1/service-engagements/${wadajirEngagementId}`)
        .set(auth(branchToken))
        .send({
          version: createdBody.version,
          propertyId: hodanPropertyId,
          notes: 'Attempted unauthorized scope transfer',
        })
        .expect(403);
      const multiList = await request(app.getHttpServer())
        .get('/api/v1/service-engagements')
        .set(auth(multiToken))
        .expect(200);
      expect(
        (multiList.body as unknown as EngagementListBody).items.some(
          (item) => item.id === wadajirEngagementId,
        ),
      ).toBe(true);
      await request(app.getHttpServer())
        .get(`/api/v1/service-engagements/${wadajirEngagementId}`)
        .set(auth(adminToken))
        .expect(200);
      await request(app.getHttpServer())
        .post('/api/v1/service-engagements')
        .set(auth(adminToken))
        .send({
          propertyId: randomUUID(),
          serviceModel: 'FULL_MANAGEMENT',
          effectiveFrom: businessDate,
        })
        .expect(404);
    });

    it('returns a deny-by-default capability set when no active authority exists', async () => {
      const propertyId = await activeProperty(hodanId, 'Deny Default');
      const response = await request(app.getHttpServer())
        .get('/api/v1/service-capabilities/resolve')
        .query({ propertyId })
        .set(auth(adminToken))
        .expect(200);
      expect(Object.values(response.body.capabilities).every((value) => value === false)).toBe(
        true,
      );
      expect(response.body.sources.property).toEqual([]);
    });
  },
);
