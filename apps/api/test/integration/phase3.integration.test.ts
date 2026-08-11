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

describe.skipIf(!(databaseUrl && adminEmail && adminPassword))(
  'Phase 3 persistence integration',
  () => {
    let app: INestApplication;
    let database: PrismaClient;

    beforeAll(async () => {
      process.env.WEB_URL = 'http://localhost:3000';
      process.env.REDIS_URL ??= 'redis://localhost:56379';
      database = new PrismaClient({ datasourceUrl: databaseUrl });
      const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
      app = module.createNestApplication();
      configureApplication(app);
      await app.init();
    });

    afterAll(async () => {
      await app?.close();
      await database?.$disconnect();
    });

    it('persists user, branch and role assignments, enforces suspension, and writes audit evidence', async () => {
      const suffix = randomUUID().slice(0, 8);
      const email = `phase3.integration.${suffix}@example.test`;
      const password = 'Phase3-Integration-Password!';
      const adminLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: adminEmail, password: adminPassword })
        .expect(201);
      const adminToken = sessionToken(adminLogin);
      const branches = await database.branch.findMany({
        where: { code: { in: ['HODAN', 'WADAJIR'] } },
      });
      const hodan = branches.find((branch) => branch.code === 'HODAN')!;
      const wadajir = branches.find((branch) => branch.code === 'WADAJIR')!;
      const receptionist = await database.role.findFirstOrThrow({
        where: { code: 'RECEPTIONIST' },
      });

      const created = await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set('authorization', `Bearer ${adminToken}`)
        .send({
          employeeNumber: `I-${suffix}`,
          displayName: 'Hodan Ahmed Osman',
          accessMode: 'MULTI_BRANCH',
          branchId: hodan.id,
          email,
          password,
        })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/employees/${created.body.id}/branches`)
        .set('authorization', `Bearer ${adminToken}`)
        .send({
          branchId: wadajir.id,
          effectiveFrom: new Date().toISOString().slice(0, 10),
        })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/employees/${created.body.id}/roles`)
        .set('authorization', `Bearer ${adminToken}`)
        .send({
          roleId: receptionist.id,
          branchId: hodan.id,
          effectiveFrom: new Date().toISOString().slice(0, 10),
        })
        .expect(201);

      const staffLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(201);
      const staffToken = sessionToken(staffLogin);
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('authorization', `Bearer ${staffToken}`)
        .expect(200);
      await request(app.getHttpServer())
        .get(`/api/v1/branches/${hodan.id}`)
        .set('authorization', `Bearer ${staffToken}`)
        .expect(200);
      await request(app.getHttpServer())
        .get(`/api/v1/branches/${wadajir.id}`)
        .set('authorization', `Bearer ${staffToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/api/v1/users/${created.body.user.id}/status`)
        .set('authorization', `Bearer ${adminToken}`)
        .send({ status: 'SUSPENDED', reason: 'Integration suspension proof' })
        .expect(200);
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('authorization', `Bearer ${staffToken}`)
        .expect(401);

      const persisted = await database.employee.findUniqueOrThrow({
        where: { id: created.body.id as string },
        include: { branchAssignments: true, roles: true, user: true },
      });
      expect(persisted.branchAssignments).toHaveLength(2);
      expect(persisted.roles).toHaveLength(1);
      expect(persisted.user?.status).toBe('SUSPENDED');
      expect(
        await database.auditLog.count({
          where: { entityId: created.body.user.id as string, action: 'identity.user.suspended' },
        }),
      ).toBe(1);
    });
  },
);
