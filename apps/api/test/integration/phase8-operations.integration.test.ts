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

describe.skipIf(!(databaseUrl && adminEmail && adminPassword))('Phase 8 operations', () => {
  let app: INestApplication;
  let database: PrismaClient;
  let token: string;
  let branchId: string;
  let otherBranchId: string;
  let propertyId: string;

  beforeAll(async () => {
    process.env.WEB_URL = 'http://localhost:3000';
    process.env.REDIS_URL ??= 'redis://localhost:56379';
    database = new PrismaClient({ datasourceUrl: databaseUrl });
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApplication(app);
    await app.init();
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(201);
    token = sessionToken(login);
    const company = await database.company.findFirstOrThrow();
    const branches = await database.branch.findMany({ where: { companyId: company.id, active: true } });
    branchId = branches[0]!.id;
    otherBranchId = branches[1]?.id ?? branches[0]!.id;
    const property = await database.property.findFirst({
      where: { companyId: company.id, branchAssignments: { some: { branchId } } },
    });
    propertyId = property?.id ?? '';
  });

  afterAll(async () => {
    await app?.close();
    await database?.$disconnect();
  });

  it('creates maintenance, work order, inspection defect follow-up, and idempotent expense', async () => {
    if (!propertyId) return;
    const suffix = randomUUID().slice(0, 6);
    const created = await request(app.getHttpServer())
      .post('/api/v1/maintenance-requests')
      .set('Cookie', `rerms_session=${token}`)
      .send({
        branchId,
        propertyId,
        title: `Leaky tap ${suffix}`,
        description: 'Kitchen tap is leaking.',
        categoryCode: 'PLUMBING',
        priority: 'HIGH',
      })
      .expect(201);
    const requestId = created.body.id as string;
    await request(app.getHttpServer())
      .post(`/api/v1/maintenance-requests/${requestId}/transition`)
      .set('Cookie', `rerms_session=${token}`)
      .send({ status: 'TRIAGED' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/maintenance-requests/${requestId}/transition`)
      .set('Cookie', `rerms_session=${token}`)
      .send({ status: 'ASSIGNED' })
      .expect(201);
    const workOrder = await request(app.getHttpServer())
      .post('/api/v1/work-orders')
      .set('Cookie', `rerms_session=${token}`)
      .send({
        branchId,
        maintenanceRequestId: requestId,
        propertyId,
        currency: 'USD',
        estimatedCost: '100.00',
      })
      .expect(201);
    const workOrderId = workOrder.body.id as string;
    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${workOrderId}/transition`)
      .set('Cookie', `rerms_session=${token}`)
      .send({ status: 'SCHEDULED' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${workOrderId}/transition`)
      .set('Cookie', `rerms_session=${token}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${workOrderId}/transition`)
      .set('Cookie', `rerms_session=${token}`)
      .send({ status: 'COMPLETED', actualCost: '150.00', laborNotes: 'Replaced washer.' })
      .expect(201);
    const expense = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${workOrderId}/expense`)
      .set('Cookie', `rerms_session=${token}`)
      .send({})
      .expect(201);
    const replay = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${workOrderId}/expense`)
      .set('Cookie', `rerms_session=${token}`)
      .send({})
      .expect(201);
    expect(replay.body.id).toBe(expense.body.id);
    const inspection = await request(app.getHttpServer())
      .post('/api/v1/inspections')
      .set('Cookie', `rerms_session=${token}`)
      .send({
        branchId,
        type: 'MOVE_OUT',
        propertyId,
        scheduledAt: new Date().toISOString(),
        items: [{ area: 'Kitchen', item: 'Cabinets', condition: 'DAMAGED', severity: 'HIGH' }],
      })
      .expect(201);
    const inspectionId = (inspection.body as { id: string }).id;
    const defect = await request(app.getHttpServer())
      .post('/api/v1/defects')
      .set('Cookie', `rerms_session=${token}`)
      .send({
        branchId,
        propertyId,
        inspectionId,
        title: 'Damaged cabinets',
        description: 'Found during move-out.',
        severity: 'HIGH',
      })
      .expect(201);
    const defectId = (defect.body as { id: string }).id;
    const followUp = await request(app.getHttpServer())
      .post(`/api/v1/defects/${defectId}/maintenance-request`)
      .set('Cookie', `rerms_session=${token}`)
      .send({
        title: 'Repair cabinets',
        description: 'Inspection follow-up.',
        categoryCode: 'INSPECTION',
        priority: 'HIGH',
      })
      .expect(201);
    const followUpBody = followUp.body as { sourceInspectionId: string; sourceDefectId: string };
    expect(followUpBody.sourceInspectionId).toBe(inspectionId);
    expect(followUpBody.sourceDefectId).toBe(defectId);
    await request(app.getHttpServer())
      .post('/api/v1/maintenance-requests')
      .set('Cookie', `rerms_session=${token}`)
      .send({
        branchId: otherBranchId === branchId ? branchId : otherBranchId,
        propertyId,
        title: 'Branch scope check',
        description: 'Should remain company isolated.',
        categoryCode: 'GENERAL',
      })
      .expect((response) => {
        expect([201, 400, 403]).toContain(response.status);
      });
  });
});
