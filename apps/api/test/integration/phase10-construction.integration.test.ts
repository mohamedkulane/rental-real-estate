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

function recordId(body: unknown): string {
  if (!body || typeof body !== 'object' || !('id' in body) || typeof body.id !== 'string') {
    throw new Error('Expected a record id in the response body.');
  }
  return body.id;
}

function nestedId(body: unknown, key: string): string {
  if (!body || typeof body !== 'object' || !(key in body)) {
    throw new Error(`Expected ${key} in the response body.`);
  }
  const value = (body as Record<string, unknown>)[key];
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') return value.id;
  throw new Error(`Expected ${key} to contain an id.`);
}

function stringField(body: unknown, key: string): string {
  if (!body || typeof body !== 'object' || !(key in body)) {
    throw new Error(`Expected ${key} in the response body.`);
  }
  const value = (body as Record<string, unknown>)[key];
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  throw new Error(`Expected ${key} to be a string.`);
}

describe.skipIf(!(databaseUrl && adminEmail && adminPassword))('Phase 10 construction and development', () => {
  let app: INestApplication;
  let database: PrismaClient;
  let token: string;
  let branchId: string;
  let otherBranchId: string;
  let clientPartyId: string;
  let sourcePropertyId: string;

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
    const party = await database.party.findFirst({ where: { companyId: company.id, id: { not: company.legalPartyId ?? '' } } });
    clientPartyId = party?.id ?? '';
    const property = await database.property.findFirst({
      where: { companyId: company.id, branchAssignments: { some: { branchId } } },
    });
    sourcePropertyId = property?.id ?? '';
  });

  afterAll(async () => {
    await app?.close();
    await database?.$disconnect();
  });

  it('runs client construction through contract, cost, billing, payment, and handover', async () => {
    if (!clientPartyId) return;
    const suffix = randomUUID().slice(0, 6);
    const created = await request(app.getHttpServer())
      .post('/api/v1/construction/projects')
      .set('Cookie', `rerms_session=${token}`)
      .send({
        branchId,
        name: `Client villa ${suffix}`,
        economicModel: 'CONSTRUCTION_FOR_CLIENT',
        clientPartyId,
        scope: 'Build a residential villa',
      })
      .expect(201);
    const projectId = recordId(created.body);
    const merged = await request(app.getHttpServer())
      .post('/api/v1/construction/projects')
      .set('Cookie', `rerms_session=${token}`)
      .send({
        branchId,
        name: `Invalid mix ${suffix}`,
        economicModel: 'CONSTRUCTION_FOR_CLIENT',
        clientPartyId,
        developmentProjectId: randomUUID(),
      })
      .expect(400);
    const mergedMessage =
      typeof merged.body === 'object' && merged.body
        ? String((merged.body as { message?: unknown; error?: unknown }).message ?? (merged.body as { error?: unknown }).error)
        : '';
    expect(mergedMessage).toMatch(/cannot be linked/i);

    const contract = await request(app.getHttpServer())
      .post('/api/v1/construction/contracts')
      .set('Cookie', `rerms_session=${token}`)
      .send({
        constructionProjectId: projectId,
        contractValue: '10000.00',
        paymentTermsSummary: '25% start, 75% completion',
        effectiveDate: '2026-09-12',
        installments: [
          { label: 'Start', percent: '25' },
          { label: 'Completion', percent: '75' },
        ],
      })
      .expect(201);
    const contractId = recordId(contract.body);
    expect(Array.isArray((contract.body as { installments?: unknown }).installments)).toBe(true);
    await request(app.getHttpServer())
      .post(`/api/v1/construction/contracts/${contractId}/transition`)
      .set('Cookie', `rerms_session=${token}`)
      .send({ status: 'ACTIVE' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/construction/budget-lines')
      .set('Cookie', `rerms_session=${token}`)
      .send({
        constructionProjectId: projectId,
        category: 'MATERIALS',
        label: 'Materials',
        budgetAmount: '4000.00',
      })
      .expect(201);
    const milestone = await request(app.getHttpServer())
      .post('/api/v1/construction/milestones')
      .set('Cookie', `rerms_session=${token}`)
      .send({ constructionProjectId: projectId, title: 'Foundation' })
      .expect(201);
    const milestoneId = recordId(milestone.body);
    await request(app.getHttpServer())
      .post(`/api/v1/construction/milestones/${milestoneId}/transition`)
      .set('Cookie', `rerms_session=${token}`)
      .send({ status: 'COMPLETED', percentComplete: '100' })
      .expect(201);
    const pack = await request(app.getHttpServer())
      .post('/api/v1/construction/work-packages')
      .set('Cookie', `rerms_session=${token}`)
      .send({ constructionProjectId: projectId, milestoneId, title: 'Excavation' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/construction/work-packages/${recordId(pack.body)}/transition`)
      .set('Cookie', `rerms_session=${token}`)
      .send({ status: 'COMPLETED' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/construction/projects/${projectId}/transition`)
      .set('Cookie', `rerms_session=${token}`)
      .send({ status: 'ACTIVE' })
      .expect(201);

    const costKey = `cost-${suffix}`;
    const cost = await request(app.getHttpServer())
      .post('/api/v1/construction/costs')
      .set('Cookie', `rerms_session=${token}`)
      .send({
        constructionProjectId: projectId,
        category: 'MATERIALS',
        amount: '500.00',
        businessDate: '2026-09-12',
        idempotencyKey: costKey,
      })
      .expect(201);
    const costReplay = await request(app.getHttpServer())
      .post('/api/v1/construction/costs')
      .set('Cookie', `rerms_session=${token}`)
      .send({
        constructionProjectId: projectId,
        category: 'MATERIALS',
        amount: '500.00',
        businessDate: '2026-09-12',
        idempotencyKey: costKey,
      })
      .expect(201);
    expect(recordId(costReplay.body)).toBe(recordId(cost.body));

    const billKey = `bill-${suffix}`;
    const billing = await request(app.getHttpServer())
      .post('/api/v1/construction/billing')
      .set('Cookie', `rerms_session=${token}`)
      .send({
        constructionProjectId: projectId,
        contractId,
        basis: 'INSTALLMENT',
        amount: '2500.00',
        dueDate: '2026-10-01',
        installmentSequence: 1,
        idempotencyKey: billKey,
      })
      .expect(201);
    const billReplay = await request(app.getHttpServer())
      .post('/api/v1/construction/billing')
      .set('Cookie', `rerms_session=${token}`)
      .send({
        constructionProjectId: projectId,
        contractId,
        basis: 'INSTALLMENT',
        amount: '2500.00',
        dueDate: '2026-10-01',
        installmentSequence: 1,
        idempotencyKey: billKey,
      })
      .expect(201);
    expect(recordId(billReplay.body)).toBe(recordId(billing.body));

    const method = await database.paymentMethod.findFirstOrThrow({ where: { code: 'CASH' } });
    const account = await database.account.findFirstOrThrow({ where: { code: '1010' } });
    const payment = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Cookie', `rerms_session=${token}`)
      .send({
        branchId,
        payerPartyId: clientPartyId,
        methodId: method.id,
        receivingAccountId: account.id,
        currency: 'USD',
        amount: '2500.00',
        receivedAt: new Date().toISOString(),
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/payments/${recordId(payment.body)}/allocate`)
      .set('Cookie', `rerms_session=${token}`)
      .send({ allocations: [{ chargeId: nestedId(billing.body, 'chargeId'), amount: '2500.00' }] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/construction/projects/${projectId}/handover`)
      .set('Cookie', `rerms_session=${token}`)
      .expect(201);
    const completed = await request(app.getHttpServer())
      .get(`/api/v1/construction/projects/${projectId}`)
      .set('Cookie', `rerms_session=${token}`)
      .expect(200);
    expect(stringField(completed.body, 'status')).toBe('COMPLETED');

    const ownerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'owner.portal@example.test', password: 'Portal-Demo-Password1!' })
      .expect(201);
    await request(app.getHttpServer())
      .get('/api/v1/construction/overview')
      .set('Cookie', `rerms_session=${sessionToken(ownerLogin)}`)
      .expect(403);
  });

  it('converts a development plot into a canonical Property and sale listing', async () => {
    if (!sourcePropertyId) return;
    const suffix = randomUUID().slice(0, 6);
    const development = await request(app.getHttpServer())
      .post('/api/v1/development/projects')
      .set('Cookie', `rerms_session=${token}`)
      .send({
        branchId,
        sourcePropertyId,
        name: `North estate ${suffix}`,
        developmentType: 'RESIDENTIAL',
      })
      .expect(201);
    const developmentId = recordId(development.body);
    await request(app.getHttpServer())
      .post(`/api/v1/development/projects/${developmentId}/transition`)
      .set('Cookie', `rerms_session=${token}`)
      .send({ status: 'APPROVED' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/development/projects/${developmentId}/transition`)
      .set('Cookie', `rerms_session=${token}`)
      .send({ status: 'ACTIVE' })
      .expect(201);
    const block = await request(app.getHttpServer())
      .post('/api/v1/development/blocks')
      .set('Cookie', `rerms_session=${token}`)
      .send({ developmentProjectId: developmentId, code: `A${suffix.slice(0, 2)}`, name: 'Block A' })
      .expect(201);
    const plot = await request(app.getHttpServer())
      .post('/api/v1/development/plots')
      .set('Cookie', `rerms_session=${token}`)
      .send({
        developmentProjectId: developmentId,
        blockId: recordId(block.body),
        plotNumber: `P-${suffix}`,
        plannedArea: '240',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/development/plots/${recordId(plot.body)}/transition`)
      .set('Cookie', `rerms_session=${token}`)
      .send({ status: 'SALE_READY' })
      .expect(409);
    await request(app.getHttpServer())
      .post('/api/v1/development/construction')
      .set('Cookie', `rerms_session=${token}`)
      .send({ developmentProjectId: developmentId, name: `North estate works ${suffix}` })
      .expect(201);
    const converted = await request(app.getHttpServer())
      .post('/api/v1/development/convert-plot')
      .set('Cookie', `rerms_session=${token}`)
      .send({
        plotId: recordId(plot.body),
        propertyName: `Villa ${suffix}`,
        createSaleListing: true,
        askingPrice: '75000.00',
      })
      .expect(201);
    const convertedProperty = (converted.body as { property?: { propertyCode?: string; id?: string } }).property;
    expect(convertedProperty?.propertyCode).toMatch(/^PROP-/);
    expect(stringField(converted.body, 'saleListingId')).toBeTruthy();
    const ready = await request(app.getHttpServer())
      .post(`/api/v1/development/plots/${recordId(plot.body)}/transition`)
      .set('Cookie', `rerms_session=${token}`)
      .send({ status: 'SALE_READY' })
      .expect(201);
    expect(stringField(ready.body, 'status')).toBe('SALE_READY');

    const offer = await request(app.getHttpServer())
      .post('/api/v1/sale-offers')
      .set('Cookie', `rerms_session=${token}`)
      .send({
        serviceEngagementId: nestedId(converted.body, 'engagement'),
        propertyId: convertedProperty?.id ?? '',
        saleListingId: stringField(converted.body, 'saleListingId'),
        buyerPartyId: clientPartyId || undefined,
        offerAmount: '75000.00',
        currency: 'USD',
        offerDate: '2026-09-12',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/sale-offers/${recordId(offer.body)}/transition`)
      .set('Cookie', `rerms_session=${token}`)
      .send({ status: 'SUBMITTED', reason: 'Buyer submitted offer' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/sale-offers/${recordId(offer.body)}/transition`)
      .set('Cookie', `rerms_session=${token}`)
      .send({ status: 'ACCEPTED', reason: 'Company accepted company-owned sale' })
      .expect(201);
    const settlement = await request(app.getHttpServer())
      .post('/api/v1/sale-settlements')
      .set('Cookie', `rerms_session=${token}`)
      .send({ saleOfferId: recordId(offer.body), salePrice: '75000.00' })
      .expect(201);
    expect(stringField(settlement.body, 'grossCommission')).toMatch(/^0/);
    expect(stringField(settlement.body, 'companyProceeds')).toMatch(/^75000/);
  });

  it('blocks unauthorized construction project reads', async () => {
    if (!clientPartyId || otherBranchId === branchId) return;
    const created = await request(app.getHttpServer())
      .post('/api/v1/construction/projects')
      .set('Cookie', `rerms_session=${token}`)
      .send({
        branchId,
        name: `Scoped ${randomUUID().slice(0, 6)}`,
        economicModel: 'CONSTRUCTION_FOR_CLIENT',
        clientPartyId,
      })
      .expect(201);
    const ownerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'owner.portal@example.test', password: 'Portal-Demo-Password1!' })
      .expect(201);
    await request(app.getHttpServer())
      .get(`/api/v1/construction/projects/${recordId(created.body)}`)
      .set('Cookie', `rerms_session=${sessionToken(ownerLogin)}`)
      .expect(403);
  });

  it('enforces the active contract billing ceiling with idempotent retries and concurrency', async () => {
    if (!clientPartyId) return;
    const suffix = randomUUID().slice(0, 6);
    const created = await request(app.getHttpServer())
      .post('/api/v1/construction/projects')
      .set('Cookie', `rerms_session=${token}`)
      .send({
        branchId,
        name: `Ceiling ${suffix}`,
        economicModel: 'CONSTRUCTION_FOR_CLIENT',
        clientPartyId,
      })
      .expect(201);
    const projectId = recordId(created.body);
    const contract = await request(app.getHttpServer())
      .post('/api/v1/construction/contracts')
      .set('Cookie', `rerms_session=${token}`)
      .send({
        constructionProjectId: projectId,
        contractValue: '1000.00',
        paymentTermsSummary: 'Progress billing against contract value',
        effectiveDate: '2026-09-12',
        installments: [{ label: 'Progress', percent: '100' }],
      })
      .expect(201);
    const contractId = recordId(contract.body);
    await request(app.getHttpServer())
      .post(`/api/v1/construction/contracts/${contractId}/transition`)
      .set('Cookie', `rerms_session=${token}`)
      .send({ status: 'ACTIVE' })
      .expect(201);

    const below = await request(app.getHttpServer())
      .post('/api/v1/construction/billing')
      .set('Cookie', `rerms_session=${token}`)
      .send({
        constructionProjectId: projectId,
        contractId,
        basis: 'MANUAL',
        amount: '400.00',
        dueDate: '2026-10-01',
        idempotencyKey: `ceil-below-${suffix}`,
      })
      .expect(201);
    const exactKey = `ceil-exact-${suffix}`;
    const exact = await request(app.getHttpServer())
      .post('/api/v1/construction/billing')
      .set('Cookie', `rerms_session=${token}`)
      .send({
        constructionProjectId: projectId,
        contractId,
        basis: 'MANUAL',
        amount: '600.00',
        dueDate: '2026-10-02',
        idempotencyKey: exactKey,
      })
      .expect(201);
    const blocked = await request(app.getHttpServer())
      .post('/api/v1/construction/billing')
      .set('Cookie', `rerms_session=${token}`)
      .send({
        constructionProjectId: projectId,
        contractId,
        basis: 'MANUAL',
        amount: '0.01',
        dueDate: '2026-10-03',
        idempotencyKey: `ceil-over-${suffix}`,
      })
      .expect(409);
    expect(stringField(blocked.body, 'message')).toMatch(/exceeds remaining contract value/i);
    const replay = await request(app.getHttpServer())
      .post('/api/v1/construction/billing')
      .set('Cookie', `rerms_session=${token}`)
      .send({
        constructionProjectId: projectId,
        contractId,
        basis: 'MANUAL',
        amount: '600.00',
        dueDate: '2026-10-02',
        idempotencyKey: exactKey,
      })
      .expect(201);
    expect(recordId(replay.body)).toBe(recordId(exact.body));
    expect(recordId(replay.body)).not.toBe(recordId(below.body));

    const concurrent = await request(app.getHttpServer())
      .post('/api/v1/construction/projects')
      .set('Cookie', `rerms_session=${token}`)
      .send({
        branchId,
        name: `Ceil race ${suffix}`,
        economicModel: 'CONSTRUCTION_FOR_CLIENT',
        clientPartyId,
      })
      .expect(201);
    const raceProjectId = recordId(concurrent.body);
    const raceContract = await request(app.getHttpServer())
      .post('/api/v1/construction/contracts')
      .set('Cookie', `rerms_session=${token}`)
      .send({
        constructionProjectId: raceProjectId,
        contractValue: '100.00',
        paymentTermsSummary: 'Concurrent ceiling',
        effectiveDate: '2026-09-12',
        installments: [{ label: 'Progress', percent: '100' }],
      })
      .expect(201);
    const raceContractId = recordId(raceContract.body);
    await request(app.getHttpServer())
      .post(`/api/v1/construction/contracts/${raceContractId}/transition`)
      .set('Cookie', `rerms_session=${token}`)
      .send({ status: 'ACTIVE' })
      .expect(201);
    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/construction/billing')
        .set('Cookie', `rerms_session=${token}`)
        .send({
          constructionProjectId: raceProjectId,
          contractId: raceContractId,
          basis: 'MANUAL',
          amount: '80.00',
          dueDate: '2026-10-04',
          idempotencyKey: `ceil-race-a-${suffix}`,
        }),
      request(app.getHttpServer())
        .post('/api/v1/construction/billing')
        .set('Cookie', `rerms_session=${token}`)
        .send({
          constructionProjectId: raceProjectId,
          contractId: raceContractId,
          basis: 'MANUAL',
          amount: '80.00',
          dueDate: '2026-10-04',
          idempotencyKey: `ceil-race-b-${suffix}`,
        }),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);
    const billed = await database.constructionBillingEvent.aggregate({
      where: { contractId: raceContractId, status: { not: 'CANCELLED' } },
      _sum: { amount: true },
    });
    expect(Number(billed._sum.amount ?? 0)).toBeLessThanOrEqual(100);

    const ownerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'owner.portal@example.test', password: 'Portal-Demo-Password1!' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/construction/billing')
      .set('Cookie', `rerms_session=${sessionToken(ownerLogin)}`)
      .send({
        constructionProjectId: projectId,
        contractId,
        basis: 'MANUAL',
        amount: '10.00',
        dueDate: '2026-10-05',
      })
      .expect(403);
  });
});
