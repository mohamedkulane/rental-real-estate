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

describe.skipIf(!(databaseUrl && adminEmail && adminPassword))('Phase 4 portfolio API', () => {
  let app: INestApplication;
  let database: PrismaClient;
  let token = '';
  let hodanId = '';
  let wadajirId = '';
  let ownerPartyId = '';
  let organizationOwnerId = '';
  let propertyId = '';
  let parentSpaceId = '';
  let childSpaceId = '';
  const suffix = randomUUID().slice(0, 8);

  beforeAll(async () => {
    process.env.WEB_URL = 'http://localhost:3000';
    process.env.REDIS_URL ??= 'redis://localhost:56379';
    process.env.PARTY_DATA_ENCRYPTION_KEY ??=
      '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';
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

  it('authenticates the administrator and loads portfolio reference data', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(201);
    token = login.body.token as string;
    const branches = await request(app.getHttpServer())
      .get('/api/v1/branches')
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    hodanId = (branches.body as Array<{ id: string; code: string }>).find(
      (branch) => branch.code === 'HODAN',
    )!.id;
    wadajirId = (branches.body as Array<{ id: string; code: string }>).find(
      (branch) => branch.code === 'WADAJIR',
    )!.id;
    const types = await request(app.getHttpServer())
      .get('/api/v1/rentable-spaces/types')
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(types.body).toHaveLength(13);
    const amenities = await request(app.getHttpServer())
      .get('/api/v1/amenities')
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect((amenities.body as Array<{ code: string }>).length).toBeGreaterThanOrEqual(10);
    expect(
      (amenities.body as Array<{ code: string }>).some((item) => item.code === 'PARKING'),
    ).toBe(true);
  });

  it('creates a party and owner without exposing encrypted contact storage', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/parties')
      .set('authorization', `Bearer ${token}`)
      .send({
        branchId: hodanId,
        partyNumber: `P-${suffix}`,
        kind: 'PERSON',
        displayName: 'Fadumo Ali Mohamed',
        person: { givenName: 'Phase', familyName: 'Owner' },
        contacts: [{ type: 'PHONE', value: '+252611234567', primary: true }],
      })
      .expect(201);
    ownerPartyId = created.body.id as string;
    expect(JSON.stringify(created.body)).not.toContain('valueEncrypted');
    expect(JSON.stringify(created.body)).not.toContain('+252611234567');
    const stored = await database.contactPoint.findFirstOrThrow({
      where: { partyId: ownerPartyId },
    });
    expect(stored.valueEncrypted).not.toContain('+252611234567');
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/parties/${ownerPartyId}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(detail.body.contacts[0].value).toBe('+252611234567');
    await request(app.getHttpServer())
      .post('/api/v1/owners')
      .set('authorization', `Bearer ${token}`)
      .send({ partyId: ownerPartyId, ownerNumber: `O-${suffix}`, status: 'ACTIVE' })
      .expect(201);
    const organization = await request(app.getHttpServer())
      .post('/api/v1/parties')
      .set('authorization', `Bearer ${token}`)
      .send({
        branchId: hodanId,
        partyNumber: `C-${suffix}`,
        kind: 'ORGANIZATION',
        displayName: 'Daryeel Property Holdings',
        organization: {
          legalName: 'Daryeel Property Holdings Limited',
          registrationNumber: `REG-${suffix}`,
        },
      })
      .expect(201);
    organizationOwnerId = organization.body.id as string;
    await request(app.getHttpServer())
      .post('/api/v1/owners')
      .set('authorization', `Bearer ${token}`)
      .send({ partyId: organizationOwnerId, ownerNumber: `CO-${suffix}`, status: 'ACTIVE' })
      .expect(201);
  });

  it('creates a draft property, completes ownership, and activates it', async () => {
    const property = await request(app.getHttpServer())
      .post('/api/v1/properties')
      .set('authorization', `Bearer ${token}`)
      .send({
        propertyCode: `PR-${suffix}`,
        name: 'Daryeel Business Centre',
        propertyType: 'MIXED_USE',
        status: 'DRAFT',
        branchId: hodanId,
        effectiveFrom: '2026-01-01',
        city: 'Mogadishu',
      })
      .expect(201);
    propertyId = property.body.id as string;
    await request(app.getHttpServer())
      .post('/api/v1/properties')
      .set('authorization', `Bearer ${token}`)
      .send({
        propertyCode: `PR-${suffix}`,
        name: 'Duplicate code proof',
        propertyType: 'HOUSE',
        status: 'DRAFT',
        branchId: hodanId,
        effectiveFrom: '2026-01-01',
        city: 'Mogadishu',
      })
      .expect(409);
    await request(app.getHttpServer())
      .put(`/api/v1/properties/${propertyId}/ownership`)
      .set('authorization', `Bearer ${token}`)
      .send({
        effectiveFrom: '2026-01-01',
        shares: [{ ownerPartyId, ownershipPercent: '100', payoutPercent: '99' }],
        reason: 'Invalid payout total proof',
      })
      .expect(400);
    await request(app.getHttpServer())
      .put(`/api/v1/properties/${propertyId}/ownership`)
      .set('authorization', `Bearer ${token}`)
      .send({
        effectiveFrom: '2026-01-01',
        shares: [
          { ownerPartyId, ownershipPercent: '60', payoutPercent: '55' },
          { ownerPartyId: organizationOwnerId, ownershipPercent: '40', payoutPercent: '45' },
        ],
        reason: 'Initial verified ownership',
      })
      .expect(200);
    const activated = await request(app.getHttpServer())
      .patch(`/api/v1/properties/${propertyId}`)
      .set('authorization', `Bearer ${token}`)
      .send({ status: 'ACTIVE' })
      .expect(200);
    expect(activated.body.status).toBe('ACTIVE');
    await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/buildings`)
      .set('authorization', `Bearer ${token}`)
      .send({ buildingCode: `B-${suffix}`, name: 'Main Building', numberOfFloors: 3 })
      .expect(201);
    const ownerPortfolio = await request(app.getHttpServer())
      .get(`/api/v1/owners/${ownerPartyId}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    const portfolioBody = ownerPortfolio.body as {
      ownerships: Array<{ propertyId: string }>;
    };
    expect(portfolioBody.ownerships.some((row) => row.propertyId === propertyId)).toBe(true);
    await request(app.getHttpServer())
      .put(`/api/v1/properties/${propertyId}/ownership`)
      .set('authorization', `Bearer ${token}`)
      .send({
        effectiveFrom: '2027-01-01',
        shares: [
          { ownerPartyId, ownershipPercent: '50', payoutPercent: '50' },
          { ownerPartyId: organizationOwnerId, ownershipPercent: '50', payoutPercent: '50' },
        ],
        reason: 'Future ownership configuration',
      })
      .expect(200);
    const history = await database.propertyOwnership.findMany({ where: { propertyId } });
    expect(history).toHaveLength(4);
    expect(
      history.filter((row) => row.effectiveTo?.toISOString().startsWith('2027-01-01')),
    ).toHaveLength(2);
  });

  it('supports the standalone Villa to ENTIRE_PROPERTY space pattern', async () => {
    const villa = await request(app.getHttpServer())
      .post('/api/v1/properties')
      .set('authorization', `Bearer ${token}`)
      .send({
        propertyCode: `V-${suffix}`,
        name: 'Standalone Villa',
        propertyType: 'VILLA',
        status: 'DRAFT',
        branchId: hodanId,
        effectiveFrom: '2026-01-01',
        city: 'Mogadishu',
      })
      .expect(201);
    const villaId = villa.body.id as string;
    const entire = await request(app.getHttpServer())
      .post('/api/v1/rentable-spaces')
      .set('authorization', `Bearer ${token}`)
      .send({
        propertyId: villaId,
        typeCode: 'ENTIRE_PROPERTY',
        spaceCode: `EV-${suffix}`,
        name: 'Entire Villa',
        effectiveFrom: '2026-01-01',
        usableArea: '240',
        areaUnit: 'SQM',
        residential: { bedrooms: 4, bathrooms: '3' },
      })
      .expect(201);
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/rentable-spaces/${entire.body.id}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(detail.body.type.code).toBe('ENTIRE_PROPERTY');
    expect(detail.body.childRelations).toHaveLength(0);
  });

  it('creates and partitions rentable space while preserving the parent identity', async () => {
    const parent = await request(app.getHttpServer())
      .post('/api/v1/rentable-spaces')
      .set('authorization', `Bearer ${token}`)
      .send({
        propertyId,
        typeCode: 'HALL',
        spaceCode: `U-${suffix}`,
        name: 'Main Hall',
        effectiveFrom: '2026-01-01',
        usableArea: '100',
        areaUnit: 'SQM',
      })
      .expect(201);
    parentSpaceId = parent.body.id as string;
    const partition = await request(app.getHttpServer())
      .post(`/api/v1/rentable-spaces/${parentSpaceId}/partition`)
      .set('authorization', `Bearer ${token}`)
      .send({
        effectiveFrom: '2026-02-01',
        areaUnit: 'SQM',
        reason: 'Approved subdivision',
        children: [
          { typeCode: 'ROOM', spaceCode: `R1-${suffix}`, name: 'Room One', usableArea: '40' },
          { typeCode: 'ROOM', spaceCode: `R2-${suffix}`, name: 'Room Two', usableArea: '60' },
        ],
      })
      .expect(201);
    childSpaceId = partition.body[0].id as string;
    const parentAfter = await database.rentableSpace.findUniqueOrThrow({
      where: { id: parentSpaceId },
    });
    expect(parentAfter.spaceCode).toBe(`U-${suffix}`.toUpperCase());
    expect(await database.rentableSpaceParentHistory.count({ where: { parentSpaceId } })).toBe(2);
  });

  it('rejects excess partition area and hierarchy cycles', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/rentable-spaces/${parentSpaceId}/partition`)
      .set('authorization', `Bearer ${token}`)
      .send({
        effectiveFrom: '2026-03-01',
        areaUnit: 'SQM',
        reason: 'Invalid excess area proof',
        children: [
          { typeCode: 'ROOM', spaceCode: `BAD-${suffix}`, name: 'Too Large', usableArea: '101' },
        ],
      })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/v1/rentable-spaces/${parentSpaceId}/parent`)
      .set('authorization', `Bearer ${token}`)
      .send({
        parentSpaceId: childSpaceId,
        effectiveFrom: '2026-03-01',
        reason: 'Invalid cycle proof',
      })
      .expect(400);
  });

  it('supports vacant land as a physical specialization', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/rentable-spaces')
      .set('authorization', `Bearer ${token}`)
      .send({
        propertyId,
        typeCode: 'LAND',
        spaceCode: `BADL-${suffix}`,
        name: 'Invalid Land',
        effectiveFrom: '2026-01-01',
        land: { permittedUse: 'Agriculture' },
        residential: { bedrooms: 2 },
      })
      .expect(400);
    const land = await request(app.getHttpServer())
      .post('/api/v1/rentable-spaces')
      .set('authorization', `Bearer ${token}`)
      .send({
        propertyId,
        typeCode: 'LAND',
        spaceCode: `L-${suffix}`,
        name: 'East Plot',
        effectiveFrom: '2026-01-01',
        usableArea: '2.5',
        areaUnit: 'ACRE',
        land: { permittedUse: 'Agriculture', fenced: true, roadAccess: 'Eastern road' },
      })
      .expect(201);
    expect(land.body.landProfile.permittedUse).toBe('Agriculture');
    const parking = await request(app.getHttpServer())
      .post('/api/v1/rentable-spaces')
      .set('authorization', `Bearer ${token}`)
      .send({
        propertyId,
        typeCode: 'PARKING_SPACE',
        spaceCode: `PK-${suffix}`,
        name: 'Parking Bay',
        effectiveFrom: '2026-01-01',
        usableArea: '15',
        areaUnit: 'SQM',
      })
      .expect(201);
    const retired = await request(app.getHttpServer())
      .post(`/api/v1/rentable-spaces/${parking.body.id}/retire`)
      .set('authorization', `Bearer ${token}`)
      .send({ effectiveDate: '2026-04-01', reason: 'Physical parking reconfiguration' })
      .expect(201);
    expect(retired.body.status).toBe('RETIRED');
  });

  it('enforces object-level branch scope for portfolio records', async () => {
    const email = `phase4.manager.${suffix}@example.test`;
    const password = 'Phase4-Branch-Manager-Password!';
    const employee = await request(app.getHttpServer())
      .post('/api/v1/employees')
      .set('authorization', `Bearer ${token}`)
      .send({
        employeeNumber: `PM-${suffix}`,
        displayName: 'Mohamed Nur Hassan',
        accessMode: 'BRANCH',
        branchId: wadajirId,
        email,
        password,
      })
      .expect(201);
    const role = await database.role.findFirstOrThrow({ where: { code: 'PROPERTY_MANAGER' } });
    await request(app.getHttpServer())
      .post(`/api/v1/employees/${employee.body.id}/roles`)
      .set('authorization', `Bearer ${token}`)
      .send({ roleId: role.id, branchId: wadajirId, effectiveFrom: '2026-01-01' })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(201);
    const managerToken = login.body.token as string;
    await request(app.getHttpServer())
      .get(`/api/v1/properties/${propertyId}`)
      .set('authorization', `Bearer ${managerToken}`)
      .expect(403);
    const allowed = await request(app.getHttpServer())
      .post('/api/v1/properties')
      .set('authorization', `Bearer ${managerToken}`)
      .send({
        propertyCode: `W-${suffix}`,
        name: 'Wadajir Scope Proof',
        propertyType: 'HOUSE',
        status: 'DRAFT',
        branchId: wadajirId,
        effectiveFrom: '2026-01-01',
        city: 'Mogadishu',
      })
      .expect(201);
    await request(app.getHttpServer())
      .get(`/api/v1/properties/${allowed.body.id}`)
      .set('authorization', `Bearer ${managerToken}`)
      .expect(200);
    const list = await request(app.getHttpServer())
      .get('/api/v1/properties')
      .set('authorization', `Bearer ${managerToken}`)
      .expect(200);
    expect(
      (list.body as Array<{ id: string }>).some((property) => property.id === propertyId),
    ).toBe(false);
  });

  it('writes sensitive portfolio audit evidence without contact values', async () => {
    const rows = await database.auditLog.findMany({
      where: { entityId: { in: [ownerPartyId, propertyId, parentSpaceId] } },
    });
    expect(rows.some((row) => row.action === 'party.created')).toBe(true);
    expect(rows.some((row) => row.action === 'portfolio.ownership.replaced')).toBe(true);
    expect(rows.some((row) => row.action === 'portfolio.space.partitioned')).toBe(true);
    expect(JSON.stringify(rows)).not.toContain('+252611234567');
  });
});
