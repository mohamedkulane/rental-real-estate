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

describe.skipIf(!(databaseUrl && adminEmail && adminPassword))('Phase 4 portfolio API', () => {
  let app: INestApplication;
  let database: PrismaClient;
  let token = '';
  let hodanId = '';
  let wadajirId = '';
  let ownerPartyId = '';
  let organizationOwnerId = '';
  let propertyId = '';
  let buildingId = '';
  let parkingAmenityId = '';
  let parentSpaceId = '';
  let childSpaceId = '';
  let businessDate = '';
  let date30 = '';
  let date60 = '';
  let date90 = '';
  let date120 = '';
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
    token = sessionToken(login);
    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    businessDate = me.body.businessDate as string;
    const offsetDate = (days: number) => {
      const value = new Date(`${businessDate}T00:00:00.000Z`);
      value.setUTCDate(value.getUTCDate() + days);
      return value.toISOString().slice(0, 10);
    };
    date30 = offsetDate(30);
    date60 = offsetDate(60);
    date90 = offsetDate(90);
    date120 = offsetDate(120);
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
    const parking = (amenities.body as Array<{ id: string; code: string }>).find(
      (item) => item.code === 'PARKING',
    );
    expect(parking).toBeDefined();
    parkingAmenityId = parking!.id;
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
    expect(detail.body.contacts[0].masked).toBe(false);
    const directory = await request(app.getHttpServer())
      .get(`/api/v1/parties?search=P-${suffix}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    const directoryParty = (
      directory.body as {
        items: Array<{
          id: string;
          contacts: Array<{ value: string; masked: boolean }>;
        }>;
      }
    ).items.find((party) => party.id === ownerPartyId);
    expect(directoryParty?.contacts[0]).toMatchObject({ value: '***4567', masked: true });
    expect(JSON.stringify(directory.body)).not.toContain('valueEncrypted');
    expect(JSON.stringify(directory.body)).not.toContain('normalizedHash');
    await request(app.getHttpServer())
      .post('/api/v1/parties')
      .set('authorization', `Bearer ${token}`)
      .send({
        branchId: hodanId,
        kind: 'PERSON',
        displayName: 'Unsafe Identity Metadata',
        person: {
          givenName: 'Unsafe',
          familyName: 'Metadata',
          identificationMetadata: { passportNumber: 'P1234567' },
        },
      })
      .expect(400);
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
        branchId: hodanId,
        effectiveFrom: businessDate,
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
        branchId: hodanId,
        effectiveFrom: businessDate,
        city: 'Mogadishu',
      })
      .expect(409);
    await request(app.getHttpServer())
      .put(`/api/v1/properties/${propertyId}/ownership`)
      .set('authorization', `Bearer ${token}`)
      .send({
        effectiveFrom: businessDate,
        shares: [{ ownerPartyId, ownershipPercent: '100', payoutPercent: '99' }],
        reason: 'Invalid payout total proof',
      })
      .expect(400);
    await request(app.getHttpServer())
      .put(`/api/v1/properties/${propertyId}/ownership`)
      .set('authorization', `Bearer ${token}`)
      .send({
        effectiveFrom: businessDate,
        shares: [
          { ownerPartyId, ownershipPercent: '60', payoutPercent: '55' },
          { ownerPartyId: organizationOwnerId, ownershipPercent: '40', payoutPercent: '45' },
        ],
        reason: 'Initial verified ownership',
      })
      .expect(200);
    const activated = await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/activate`)
      .set('authorization', `Bearer ${token}`)
      .send({ reason: 'Ownership and operating setup approved' })
      .expect(201);
    expect(activated.body.status).toBe('ACTIVE');
    const building = await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/buildings`)
      .set('authorization', `Bearer ${token}`)
      .send({ buildingCode: `B-${suffix}`, name: 'Main Building', numberOfFloors: 3 })
      .expect(201);
    buildingId = building.body.id as string;
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
        effectiveFrom: date120,
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
      history.filter((row) => row.effectiveTo?.toISOString().startsWith(date120)),
    ).toHaveLength(2);
  });

  it('supports building read, update, and reversible lifecycle transitions', async () => {
    const list = await request(app.getHttpServer())
      .get(`/api/v1/properties/${propertyId}/buildings`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect((list.body as Array<{ id: string }>).some((item) => item.id === buildingId)).toBe(true);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/buildings/${buildingId}`)
      .set('authorization', `Bearer ${token}`)
      .send({ name: 'Main Operations Building', numberOfFloors: 4 })
      .expect(200);
    expect(updated.body).toMatchObject({ name: 'Main Operations Building', numberOfFloors: 4 });

    await request(app.getHttpServer())
      .post(`/api/v1/buildings/${buildingId}/status`)
      .set('authorization', `Bearer ${token}`)
      .send({ status: 'INACTIVE', reason: 'Building lifecycle verification' })
      .expect(201);
    const active = await request(app.getHttpServer())
      .post(`/api/v1/buildings/${buildingId}/status`)
      .set('authorization', `Bearer ${token}`)
      .send({ status: 'ACTIVE', reason: 'Building returned to operations' })
      .expect(201);
    expect(active.body.status).toBe('ACTIVE');

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/buildings/${buildingId}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(detail.body.id).toBe(buildingId);
  });

  it('paginates and searches party records with stable cursors', async () => {
    const first = await request(app.getHttpServer())
      .get('/api/v1/parties?limit=1')
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(first.body.items).toHaveLength(1);
    expect(first.body.pageInfo.hasNextPage).toBe(true);
    expect(first.body.pageInfo.nextCursor).toBeTypeOf('string');

    const second = await request(app.getHttpServer())
      .get(`/api/v1/parties?limit=1&cursor=${first.body.pageInfo.nextCursor}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(second.body.items).toHaveLength(1);
    expect(second.body.items[0].id).not.toBe(first.body.items[0].id);

    const searched = await request(app.getHttpServer())
      .get(`/api/v1/parties?search=${suffix}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(
      (searched.body.items as Array<{ id: string }>).some((item) => item.id === ownerPartyId),
    ).toBe(true);
  });
  it('supports the standalone Villa to ENTIRE_PROPERTY space pattern', async () => {
    const villa = await request(app.getHttpServer())
      .post('/api/v1/properties')
      .set('authorization', `Bearer ${token}`)
      .send({
        propertyCode: `V-${suffix}`,
        name: 'Standalone Villa',
        propertyType: 'VILLA',
        branchId: hodanId,
        effectiveFrom: businessDate,
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
        effectiveFrom: businessDate,
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
        effectiveFrom: businessDate,
        usableArea: '100',
        areaUnit: 'SQM',
      })
      .expect(201);
    parentSpaceId = parent.body.id as string;
    const partition = await request(app.getHttpServer())
      .post(`/api/v1/rentable-spaces/${parentSpaceId}/partition`)
      .set('authorization', `Bearer ${token}`)
      .send({
        effectiveFrom: date30,
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

  it('assigns and removes amenities and supports document read/update metadata workflows', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/amenities`)
      .set('authorization', `Bearer ${token}`)
      .send({ amenityId: parkingAmenityId })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/api/v1/properties/${propertyId}/amenities/${parkingAmenityId}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(
      await database.propertyAmenity.count({ where: { propertyId, amenityId: parkingAmenityId } }),
    ).toBe(0);

    await request(app.getHttpServer())
      .post(`/api/v1/rentable-spaces/${childSpaceId}/amenities`)
      .set('authorization', `Bearer ${token}`)
      .send({ amenityId: parkingAmenityId })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/api/v1/rentable-spaces/${childSpaceId}/amenities/${parkingAmenityId}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(
      await database.spaceAmenity.count({
        where: { rentableSpaceId: childSpaceId, amenityId: parkingAmenityId },
      }),
    ).toBe(0);

    const created = await request(app.getHttpServer())
      .post('/api/v1/portfolio-documents')
      .set('authorization', `Bearer ${token}`)
      .send({
        displayName: 'Ownership verification file',
        categoryCode: 'OWNERSHIP',
        accessClass: 'CONFIDENTIAL',
        status: 'ACTIVE',
        storageKey: `properties/${propertyId}/ownership-${suffix}.pdf`,
        checksum: '0123456789abcdef0123456789abcdef',
        mimeType: 'application/pdf',
        sizeBytes: 4096,
        entityType: 'Property',
        entityId: propertyId,
        purpose: 'OWNERSHIP_EVIDENCE',
      })
      .expect(201);
    const documentId = created.body.id as string;
    expect(created.body.displayName).toBe('Ownership verification file');

    const listed = await request(app.getHttpServer())
      .get(`/api/v1/portfolio-documents?entityType=Property&entityId=${propertyId}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(
      (listed.body.items as Array<{ id: string }>).some((item) => item.id === documentId),
    ).toBe(true);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/portfolio-documents/${documentId}`)
      .set('authorization', `Bearer ${token}`)
      .send({ displayName: 'Verified ownership evidence', status: 'ARCHIVED' })
      .expect(200);
    expect(updated.body).toMatchObject({
      id: documentId,
      displayName: 'Verified ownership evidence',
      status: 'ARCHIVED',
    });

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/portfolio-documents/${documentId}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(detail.body.versions).toHaveLength(1);
    expect(JSON.stringify(detail.body)).not.toContain('valueEncrypted');
  });
  it('combines property filtering with cursor pagination without cross-property leakage', async () => {
    const first = await request(app.getHttpServer())
      .get(`/api/v1/rentable-spaces?propertyId=${propertyId}&limit=1`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(first.body.items).toHaveLength(1);
    expect(first.body.items[0].propertyId).toBe(propertyId);
    expect(first.body.pageInfo.hasNextPage).toBe(true);

    const second = await request(app.getHttpServer())
      .get(
        `/api/v1/rentable-spaces?propertyId=${propertyId}&limit=1&cursor=${first.body.pageInfo.nextCursor}`,
      )
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(second.body.items).toHaveLength(1);
    expect(second.body.items[0].propertyId).toBe(propertyId);
    expect(second.body.items[0].id).not.toBe(first.body.items[0].id);
  });
  it('rejects excess partition area and hierarchy cycles', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/rentable-spaces/${parentSpaceId}/partition`)
      .set('authorization', `Bearer ${token}`)
      .send({
        effectiveFrom: date60,
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
        effectiveFrom: date60,
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
        effectiveFrom: businessDate,
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
        effectiveFrom: businessDate,
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
        effectiveFrom: businessDate,
        usableArea: '15',
        areaUnit: 'SQM',
      })
      .expect(201);
    const retired = await request(app.getHttpServer())
      .post(`/api/v1/rentable-spaces/${parking.body.id}/retire`)
      .set('authorization', `Bearer ${token}`)
      .send({ effectiveDate: date90, reason: 'Physical parking reconfiguration' })
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
      .send({
        roleId: role.id,
        branchId: wadajirId,
        effectiveFrom: new Date().toISOString().slice(0, 10),
      })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(201);
    const managerToken = sessionToken(login);
    await request(app.getHttpServer())
      .get(`/api/v1/parties/${ownerPartyId}`)
      .set('authorization', `Bearer ${managerToken}`)
      .expect(403);
    const scopedParties = await request(app.getHttpServer())
      .get(`/api/v1/parties?search=P-${suffix}`)
      .set('authorization', `Bearer ${managerToken}`)
      .expect(200);
    expect(
      (scopedParties.body as { items: Array<{ id: string }> }).items.some(
        (party) => party.id === ownerPartyId,
      ),
    ).toBe(false);
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
        branchId: wadajirId,
        effectiveFrom: businessDate,
        city: 'Mogadishu',
      })
      .expect(201);
    await request(app.getHttpServer())
      .get(`/api/v1/properties/${allowed.body.id}`)
      .set('authorization', `Bearer ${managerToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/properties')
      .set('authorization', `Bearer ${managerToken}`)
      .send({
        propertyCode: `W2-${suffix}`,
        name: 'Second Wadajir Scope Proof',
        propertyType: 'APARTMENT_BUILDING',
        branchId: wadajirId,
        effectiveFrom: businessDate,
        city: 'Mogadishu',
      })
      .expect(201);
    const list = await request(app.getHttpServer())
      .get('/api/v1/properties?limit=1')
      .set('authorization', `Bearer ${managerToken}`)
      .expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].id).not.toBe(propertyId);
    expect(list.body.pageInfo.hasNextPage).toBe(true);
    const next = await request(app.getHttpServer())
      .get(`/api/v1/properties?limit=1&cursor=${list.body.pageInfo.nextCursor}`)
      .set('authorization', `Bearer ${managerToken}`)
      .expect(200);
    expect(next.body.items).toHaveLength(1);
    expect(next.body.items[0].id).not.toBe(propertyId);
    expect(next.body.items[0].id).not.toBe(list.body.items[0].id);
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
  it('enforces every allowed and forbidden Property lifecycle transition', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/activate`)
      .set('authorization', `Bearer ${token}`)
      .send({ reason: 'Duplicate activation must not be accepted' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/retire`)
      .set('authorization', `Bearer ${token}`)
      .send({ reason: 'Active properties must be deactivated before retirement' })
      .expect(400);
    const inactive = await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/deactivate`)
      .set('authorization', `Bearer ${token}`)
      .send({ reason: 'Temporary operational closure' })
      .expect(201);
    expect(inactive.body.status).toBe('INACTIVE');
    const activeAgain = await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/reactivate`)
      .set('authorization', `Bearer ${token}`)
      .send({ reason: 'Operations resumed after review' })
      .expect(201);
    expect(activeAgain.body.status).toBe('ACTIVE');
    await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/deactivate`)
      .set('authorization', `Bearer ${token}`)
      .send({ reason: 'Permanent operating closure' })
      .expect(201);
    const retired = await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/retire`)
      .set('authorization', `Bearer ${token}`)
      .send({ reason: 'Asset permanently removed from operations' })
      .expect(201);
    expect(retired.body.status).toBe('RETIRED');
    await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/reactivate`)
      .set('authorization', `Bearer ${token}`)
      .send({ reason: 'Retired status is terminal' })
      .expect(400);
  });
});
