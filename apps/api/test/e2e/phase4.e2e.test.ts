import { sessionToken } from '../session-cookie';
import { createHash, randomUUID } from 'node:crypto';
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
  let uploadedDocumentId = '';
  let uploadedDocumentVersionId = '';
  let parentSpaceId = '';
  let childSpaceId = '';
  let wadajirPropertyId = '';
  let businessDate = '';
  let date30 = '';
  let date60 = '';
  let date90 = '';
  let date120 = '';
  const suffix = randomUUID().slice(0, 8);

  beforeAll(async () => {
    process.env.WEB_URL = 'http://localhost:3000';
    process.env.AUTH_RATE_LIMIT_KEY = createHash('sha256').update(`e2e-rate-limit:`).digest('hex');
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
      .send({ name: 'Main Building', numberOfFloors: 3 })
      .expect(201);
    buildingId = building.body.id as string;
    expect(building.body.buildingCode).toMatch(/^BLD-\d{4,}$/);
    const buildingActivity = await request(app.getHttpServer())
      .get(`/api/v1/buildings/${buildingId}/activity`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(buildingActivity.body.items).toHaveLength(1);
    expect(buildingActivity.body.items[0].action).toBe('portfolio.building.created');
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
    expect(detail.body.spaces).toHaveLength(0);
    expect(detail.body._count.spaces).toBe(0);
  });

  it('serves authorized global Buildings, Property Ownership, Branch Assignments, and Activity workspaces', async () => {
    const buildings = await request(app.getHttpServer())
      .get(`/api/v1/buildings?propertyId=${propertyId}&branchId=${hodanId}&search=Main&limit=1`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(buildings.body.items).toHaveLength(1);
    expect(buildings.body.items[0]).toMatchObject({ id: buildingId, propertyId });

    const ownerships = await request(app.getHttpServer())
      .get(`/api/v1/property-ownerships?propertyId=${propertyId}&period=CURRENT`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(ownerships.body.items).toHaveLength(2);
    expect(
      (ownerships.body.items as Array<{ propertyId: string }>).every(
        (row) => row.propertyId === propertyId,
      ),
    ).toBe(true);
    const scheduledOwnerships = await request(app.getHttpServer())
      .get(`/api/v1/property-ownerships?propertyId=${propertyId}&period=SCHEDULED`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(scheduledOwnerships.body.items).toHaveLength(2);
    expect(
      (scheduledOwnerships.body.items as Array<{ period: string }>).every(
        (row) => row.period === 'SCHEDULED',
      ),
    ).toBe(true);

    const assignments = await request(app.getHttpServer())
      .get(`/api/v1/property-branch-history?propertyId=${propertyId}&period=CURRENT`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(assignments.body.items).toHaveLength(1);
    expect(assignments.body.items[0]).toMatchObject({ propertyId, branchId: hodanId });

    const activity = await request(app.getHttpServer())
      .get(`/api/v1/property-activity?propertyId=${propertyId}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(activity.body.items.length).toBeGreaterThan(0);
    expect(
      (activity.body.items as Array<{ entityId: string }>).every(
        (row) => row.entityId === propertyId,
      ),
    ).toBe(true);
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
        buildingId,
        typeCode: 'HALL',
        spaceCode: `U-${suffix}`,
        name: 'Main Hall',
        effectiveFrom: businessDate,
        usableArea: '100',
        areaUnit: 'SQM',
      })
      .expect(201);
    parentSpaceId = parent.body.id as string;
    const buildingAfterSpace = await request(app.getHttpServer())
      .get(`/api/v1/buildings/${buildingId}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(
      (buildingAfterSpace.body.spaces as Array<{ id: string }>).some(
        (space) => space.id === parentSpaceId,
      ),
    ).toBe(true);
    const propertyAfterSpace = await request(app.getHttpServer())
      .get(`/api/v1/properties/${propertyId}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(
      (propertyAfterSpace.body.spaces as Array<{ id: string }>).some(
        (space) => space.id === parentSpaceId,
      ),
    ).toBe(true);
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
    const amenityAssignments = await request(app.getHttpServer())
      .get(
        `/api/v1/property-amenities?propertyId=${propertyId}&amenitySearch=parking&branchSearch=hodan&limit=1`,
      )
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(amenityAssignments.body.items).toHaveLength(1);
    expect(amenityAssignments.body.items[0]).toMatchObject({
      propertyId,
      amenityId: parkingAmenityId,
    });

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

    const firstFile = Buffer.from('%PDF-1.4\nPhase 4 ownership evidence\n%%EOF');
    const created = await request(app.getHttpServer())
      .post('/api/v1/portfolio-documents/upload')
      .set('authorization', `Bearer ${token}`)
      .field('title', 'Ownership verification file')
      .field('categoryCode', 'OWNERSHIP_CERTIFICATE')
      .field('accessClass', 'CONFIDENTIAL')
      .field('entityType', 'Property')
      .field('entityId', propertyId)
      .field('purpose', 'OWNERSHIP_EVIDENCE')
      .field('notes', 'Verified source document')
      .attach('file', firstFile, {
        filename: 'ownership-evidence.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    uploadedDocumentId = created.body.id as string;
    uploadedDocumentVersionId = created.body.versions[0].id as string;
    expect(created.body).toMatchObject({
      displayName: 'Ownership verification file',
      status: 'ACTIVE',
    });
    expect(JSON.stringify(created.body)).not.toContain('storageKey');

    const inline = await request(app.getHttpServer())
      .get(
        `/api/v1/portfolio-documents/${uploadedDocumentId}/versions/${uploadedDocumentVersionId}/content?disposition=inline`,
      )
      .set('authorization', `Bearer ${token}`)
      .expect('content-type', /application\/pdf/)
      .expect(200);
    expect(Buffer.compare(inline.body as Buffer, firstFile)).toBe(0);
    expect(inline.headers['cache-control']).toContain('private');

    await request(app.getHttpServer())
      .get(
        `/api/v1/portfolio-documents/${uploadedDocumentId}/versions/${uploadedDocumentVersionId}/content?disposition=attachment`,
      )
      .set('authorization', `Bearer ${token}`)
      .expect('content-disposition', /attachment/)
      .expect(200);

    const secondFile = Buffer.from('%PDF-1.4\nPhase 4 corrected ownership evidence\n%%EOF');
    const version = await request(app.getHttpServer())
      .post(`/api/v1/portfolio-documents/${uploadedDocumentId}/versions`)
      .set('authorization', `Bearer ${token}`)
      .attach('file', secondFile, {
        filename: 'ownership-evidence-v2.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    expect(version.body.versions[0]).toMatchObject({
      sequence: 2,
      originalFilename: 'ownership-evidence-v2.pdf',
    });

    const listed = await request(app.getHttpServer())
      .get(
        `/api/v1/portfolio-documents?entityType=Property&entityId=${propertyId}&categoryCode=OWNERSHIP_CERTIFICATE&accessClass=CONFIDENTIAL`,
      )
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(
      (listed.body.items as Array<{ id: string }>).some((item) => item.id === uploadedDocumentId),
    ).toBe(true);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/portfolio-documents/${uploadedDocumentId}`)
      .set('authorization', `Bearer ${token}`)
      .send({
        displayName: 'Verified ownership evidence',
        notes: 'Reviewed and archived',
        status: 'ARCHIVED',
      })
      .expect(200);
    expect(updated.body).toMatchObject({
      id: uploadedDocumentId,
      displayName: 'Verified ownership evidence',
      status: 'ARCHIVED',
      notes: 'Reviewed and archived',
    });

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/portfolio-documents/${uploadedDocumentId}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    const documentDetail = detail.body as { versions: Array<{ sequence: number }> };
    expect(documentDetail.versions).toHaveLength(2);
    expect(documentDetail.versions.map((item) => item.sequence)).toEqual([2, 1]);
    expect(JSON.stringify(detail.body)).not.toContain('storageKey');
  });
  it('retrieves aggregate records beyond the first parent page without parent-page loading', async () => {
    const branch = await database.branch.findUniqueOrThrow({
      where: { id: hodanId },
      select: { companyId: true },
    });
    const adminUser = await database.user.findFirstOrThrow({
      where: { emailNormalized: adminEmail!.trim().toLowerCase() },
      select: { id: true },
    });
    const spaceType = await database.rentableSpaceType.findUniqueOrThrow({
      where: { code: 'HALL' },
      select: { id: true },
    });
    const base = randomUUID().split('-');
    const orderedId = (sequence: number) =>
      `${base[0]}-${base[1]}-${base[2]}-${base[3]}-${sequence.toString(16).padStart(12, '0')}`;
    const lookupParties = Array.from({ length: 15 }, (_, index) => ({
      id: orderedId(900 + index),
      companyId: branch.companyId,
      partyNumber: `BPTY-${suffix}-${String(index + 1).padStart(2, '0')}`,
      kind: 'PERSON' as const,
      displayName: `BoundaryParty-${suffix}-${String(index + 1).padStart(2, '0')}`,
      active: true,
    }));
    const targetLookupParty = lookupParties[14]!;
    const properties = Array.from({ length: 15 }, (_, index) => ({
      id: orderedId(index + 1),
      companyId: branch.companyId,
      propertyCode: `BOUND-${suffix}-${String(index + 1).padStart(2, '0')}`,
      name: `Boundary-${suffix}-${String(index + 1).padStart(2, '0')}`,
      propertyType: 'APARTMENT_BUILDING' as const,
      status: 'ACTIVE' as const,
      city: 'Mogadishu',
    }));
    const target = properties[14]!;
    const spaces = properties.map((property, index) => ({
      id: orderedId(100 + index),
      propertyId: property.id,
      typeId: spaceType.id,
      spaceCode: `BS-${suffix}-${String(index + 1).padStart(2, '0')}`,
      name: `BoundarySpace-${suffix}-${String(index + 1).padStart(2, '0')}`,
      status: 'ACTIVE' as const,
    }));
    const historicalMeasurementDate = new Date(`${businessDate}T00:00:00.000Z`);
    historicalMeasurementDate.setUTCDate(historicalMeasurementDate.getUTCDate() - 30);
    const spaceVersions = spaces.flatMap((space, index) => [
      ...(index === 14
        ? [
            {
              id: orderedId(850),
              rentableSpaceId: space.id,
              versionNo: 1,
              effectiveFrom: historicalMeasurementDate,
              effectiveTo: new Date(`${businessDate}T00:00:00.000Z`),
              usableArea: '90',
              totalArea: '100',
              areaUnit: 'SQM' as const,
            },
          ]
        : []),
      {
        id: orderedId(800 + index),
        rentableSpaceId: space.id,
        versionNo: index === 14 ? 2 : 1,
        effectiveFrom: new Date(`${businessDate}T00:00:00.000Z`),
        usableArea: String(100 + index),
        totalArea: String(110 + index),
        areaUnit: 'SQM' as const,
      },
    ]);
    const documents = properties.map((property, index) => ({
      id: orderedId(215 - index),
      companyId: branch.companyId,
      displayName: `BoundaryDoc-${suffix}-${String(index + 1).padStart(2, '0')}`,
      categoryCode: 'BOUNDARY_TEST',
      accessClass: 'INTERNAL',
      status: 'ACTIVE',
    }));
    const ownerships = properties.map((property, index) => ({
      id: orderedId(300 + index),
      propertyId: property.id,
      ownerPartyId,
      ownershipPercent: '100',
      effectiveFrom:
        index === 0
          ? new Date('2020-01-01T00:00:00.000Z')
          : new Date(`${businessDate}T00:00:00.000Z`),
      ...(index === 0 ? { effectiveTo: new Date('2021-01-01T00:00:00.000Z') } : {}),
    }));
    const occurredAt = new Date();

    await database.$transaction(
      async (transaction) => {
        await transaction.party.createMany({ data: lookupParties });
        await transaction.partyBranchAssignment.createMany({
          data: lookupParties.map((party, index) => ({
            id: orderedId(950 + index),
            partyId: party.id,
            branchId: hodanId,
            effectiveFrom: new Date(`${businessDate}T00:00:00.000Z`),
          })),
        });
        await transaction.ownerProfile.createMany({
          data: lookupParties.map((party, index) => ({
            partyId: party.id,
            ownerNumber: `BOWN-${suffix}-${String(index + 1).padStart(2, '0')}`,
            status: 'ACTIVE' as const,
          })),
        });
        await transaction.property.createMany({ data: properties });
        await transaction.propertyBranchAssignment.createMany({
          data: properties.map((property, index) => ({
            id: orderedId(400 + index),
            propertyId: property.id,
            branchId: hodanId,
            effectiveFrom: new Date(`${businessDate}T00:00:00.000Z`),
          })),
        });
        await transaction.propertyOwnership.createMany({ data: ownerships });
        await transaction.propertyAmenity.createMany({
          data: properties.map((property) => ({
            propertyId: property.id,
            amenityId: parkingAmenityId,
          })),
        });
        await transaction.rentableSpace.createMany({ data: spaces });
        await transaction.rentableSpaceVersion.createMany({ data: spaceVersions });
        await transaction.document.createMany({ data: documents });
        await transaction.documentVersion.createMany({
          data: documents.map((document, index) => ({
            id: orderedId(500 + index),
            documentId: document.id,
            sequence: 1,
            storageKey: `boundary/${suffix}/${index + 1}.pdf`,
            originalFilename: `boundary-${index + 1}.pdf`,
            checksum: `boundary-${suffix}-${index + 1}`,
            mimeType: 'application/pdf',
            sizeBytes: BigInt(1024 + index),
            uploadedByUserId: adminUser.id,
          })),
        });
        await transaction.documentLink.createMany({
          data: documents.map((document, index) => ({
            id: orderedId(600 + index),
            documentId: document.id,
            entityType: 'Property',
            entityId: properties[index]!.id,
            purpose: 'COMPLETENESS_TEST',
          })),
        });
        await transaction.auditLog.createMany({
          data: properties.map((property, index) => ({
            id: orderedId(700 + index),
            actorUserId: adminUser.id,
            action: `portfolio.property.boundary-${suffix}`,
            entityType: 'Property',
            entityId: property.id,
            branchId: hodanId,
            reason: 'Aggregate completeness fixture',
            occurredAt,
          })),
        });
      },
      { timeout: 20_000 },
    );

    const partyPage = await request(app.getHttpServer())
      .get(`/api/v1/parties?search=BoundaryParty-${suffix}&limit=10`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(partyPage.body.pageInfo.hasNextPage).toBe(true);
    expect(
      (partyPage.body.items as Array<{ id: string }>).some(
        (item) => item.id === targetLookupParty.id,
      ),
    ).toBe(false);
    const targetPartySearch = await request(app.getHttpServer())
      .get(`/api/v1/parties?search=${targetLookupParty.displayName}&limit=10`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(targetPartySearch.body.items).toHaveLength(1);
    expect(targetPartySearch.body.items[0].id).toBe(targetLookupParty.id);

    const ownerPage = await request(app.getHttpServer())
      .get(`/api/v1/owners?search=BoundaryParty-${suffix}&limit=10`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(ownerPage.body.pageInfo.hasNextPage).toBe(true);
    expect(
      (ownerPage.body.items as Array<{ partyId: string }>).some(
        (item) => item.partyId === targetLookupParty.id,
      ),
    ).toBe(false);
    const targetOwnerSearch = await request(app.getHttpServer())
      .get(`/api/v1/owners?search=${targetLookupParty.displayName}&limit=10`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(targetOwnerSearch.body.items).toHaveLength(1);
    expect(targetOwnerSearch.body.items[0].partyId).toBe(targetLookupParty.id);
    const propertyPage = await request(app.getHttpServer())
      .get(`/api/v1/properties?search=Boundary-${suffix}&sort=NAME&limit=10`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(propertyPage.body.items).toHaveLength(10);
    expect(propertyPage.body.pageInfo.hasNextPage).toBe(true);
    expect(
      (propertyPage.body.items as Array<{ id: string }>).some((item) => item.id === target.id),
    ).toBe(false);

    const ownershipPage = await request(app.getHttpServer())
      .get(`/api/v1/property-ownerships?propertySearch=Boundary-${suffix}&limit=10`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(ownershipPage.body.pageInfo.hasNextPage).toBe(true);
    expect(
      (ownershipPage.body.items as Array<{ propertyId: string }>).some(
        (item) => item.propertyId === target.id,
      ),
    ).toBe(false);
    const targetOwnership = await request(app.getHttpServer())
      .get(`/api/v1/property-ownerships?propertySearch=${target.name}&ownerSearch=Fadumo`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(
      (targetOwnership.body.items as Array<{ propertyId: string }>).some(
        (item) => item.propertyId === target.id,
      ),
    ).toBe(true);
    const historicalOwnership = await request(app.getHttpServer())
      .get(`/api/v1/property-ownerships?propertySearch=${properties[0]!.name}&period=HISTORICAL`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(historicalOwnership.body.items).toHaveLength(1);
    expect(historicalOwnership.body.items[0].period).toBe('HISTORICAL');

    const amenityPage = await request(app.getHttpServer())
      .get(
        `/api/v1/property-amenities?propertySearch=Boundary-${suffix}&amenitySearch=PARK&limit=10`,
      )
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(amenityPage.body.pageInfo.hasNextPage).toBe(true);
    expect(
      (amenityPage.body.items as Array<{ propertyId: string }>).some(
        (item) => item.propertyId === target.id,
      ),
    ).toBe(false);
    const targetAmenity = await request(app.getHttpServer())
      .get(`/api/v1/property-amenities?propertySearch=${target.name}&amenitySearch=parking`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(targetAmenity.body.items).toHaveLength(1);
    expect(targetAmenity.body.items[0].propertyId).toBe(target.id);

    const documentPage = await request(app.getHttpServer())
      .get(
        `/api/v1/portfolio-documents?entityType=Property&search=BoundaryDoc-${suffix}&categoryCode=boundary_test&limit=10`,
      )
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(documentPage.body.pageInfo.hasNextPage).toBe(true);
    expect(
      (documentPage.body.items as Array<{ id: string }>).some(
        (item) => item.id === documents[14]!.id,
      ),
    ).toBe(false);
    const targetDocument = await request(app.getHttpServer())
      .get(
        `/api/v1/portfolio-documents?entityType=Property&entitySearch=${target.name}&categoryCode=BOUNDARY_TEST&accessClass=INTERNAL&status=ACTIVE`,
      )
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(targetDocument.body.items).toHaveLength(1);
    expect(targetDocument.body.items[0].property.id).toBe(target.id);

    const branchAssignment = await request(app.getHttpServer())
      .get(`/api/v1/property-branch-history?propertySearch=${target.name}&branchSearch=HODAN`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(branchAssignment.body.items).toHaveLength(1);
    expect(branchAssignment.body.items[0].propertyId).toBe(target.id);

    const activity = await request(app.getHttpServer())
      .get(`/api/v1/property-activity?propertySearch=${target.name}&action=boundary-${suffix}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(activity.body.items).toHaveLength(1);
    expect(activity.body.items[0].entityId).toBe(target.id);

    const spacePage = await request(app.getHttpServer())
      .get(`/api/v1/rentable-spaces?search=BoundarySpace-${suffix}&limit=10`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(spacePage.body.pageInfo.hasNextPage).toBe(true);
    expect(
      (spacePage.body.items as Array<{ propertyId: string }>).some(
        (item) => item.propertyId === target.id,
      ),
    ).toBe(false);
    const targetSpace = await request(app.getHttpServer())
      .get(`/api/v1/rentable-spaces?propertySearch=${target.name}&typeSearch=hall&status=ACTIVE`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(targetSpace.body.items).toHaveLength(1);
    expect(targetSpace.body.items[0].propertyId).toBe(target.id);
    const measurementPage = await request(app.getHttpServer())
      .get(
        `/api/v1/rentable-spaces/measurements?search=BoundarySpace-${suffix}&period=CURRENT&limit=10`,
      )
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(measurementPage.body.items).toHaveLength(10);
    expect(measurementPage.body.pageInfo.hasNextPage).toBe(true);
    expect(
      (measurementPage.body.items as Array<{ rentableSpaceId: string }>).some(
        (item) => item.rentableSpaceId === spaces[14]!.id,
      ),
    ).toBe(false);
    const targetMeasurement = await request(app.getHttpServer())
      .get(`/api/v1/rentable-spaces/measurements?propertySearch=${target.name}&period=ALL`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    const targetMeasurementItems = (targetMeasurement.body as { items: Array<{ period: string }> })
      .items;
    expect(targetMeasurementItems).toHaveLength(2);
    expect(targetMeasurementItems.map((item) => item.period).sort()).toEqual([
      'CURRENT',
      'HISTORICAL',
    ]);
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
  it('filters rentable spaces by search, building, type, and status on the server', async () => {
    const filtered = await request(app.getHttpServer())
      .get(
        `/api/v1/rentable-spaces?propertyId=${propertyId}&buildingId=${buildingId}&typeCode=HALL&status=ACTIVE&search=Main`,
      )
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(filtered.body.items).toHaveLength(1);
    expect(filtered.body.items[0]).toMatchObject({
      id: parentSpaceId,
      propertyId,
      buildingId,
      status: 'ACTIVE',
      name: 'Main Hall',
    });
    expect(filtered.body.items[0].type.code).toBe('HALL');
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
      .get(
        `/api/v1/portfolio-documents/${uploadedDocumentId}/versions/${uploadedDocumentVersionId}/content?disposition=inline`,
      )
      .set('authorization', `Bearer ${managerToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/v1/properties/${propertyId}`)
      .set('authorization', `Bearer ${managerToken}`)
      .expect(403);
    for (const path of [
      `/api/v1/property-ownerships?propertySearch=Boundary-${suffix}`,
      `/api/v1/property-amenities?propertySearch=Boundary-${suffix}`,
      `/api/v1/portfolio-documents?entityType=Property&entitySearch=Boundary-${suffix}`,
      `/api/v1/property-branch-history?propertySearch=Boundary-${suffix}`,
      `/api/v1/property-activity?propertySearch=Boundary-${suffix}`,
      `/api/v1/rentable-spaces?search=BoundarySpace-${suffix}`,
    ]) {
      const scopedAggregate = await request(app.getHttpServer())
        .get(path)
        .set('authorization', `Bearer ${managerToken}`)
        .expect(200);
      expect(scopedAggregate.body.items).toHaveLength(0);
    }
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
    wadajirPropertyId = allowed.body.id as string;
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

  it('serves focused aggregates across both explicitly authorized MULTI_BRANCH scopes', async () => {
    const email = `phase4.multi.${suffix}@example.test`;
    const password = 'Phase4-Multi-Branch-Password!';
    const employee = await request(app.getHttpServer())
      .post('/api/v1/employees')
      .set('authorization', `Bearer ${token}`)
      .send({
        employeeNumber: `MB-${suffix}`,
        displayName: 'Ayaan Multi Branch',
        accessMode: 'MULTI_BRANCH',
        branchId: hodanId,
        email,
        password,
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/employees/${employee.body.id}/branches`)
      .set('authorization', `Bearer ${token}`)
      .send({ branchId: wadajirId, effectiveFrom: businessDate })
      .expect(201);
    const role = await database.role.findFirstOrThrow({ where: { code: 'PROPERTY_MANAGER' } });
    for (const branchId of [hodanId, wadajirId]) {
      await request(app.getHttpServer())
        .post(`/api/v1/employees/${employee.body.id}/roles`)
        .set('authorization', `Bearer ${token}`)
        .send({ roleId: role.id, branchId, effectiveFrom: businessDate })
        .expect(201);
    }
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(201);
    const multiToken = sessionToken(login);

    const hodanActivity = await request(app.getHttpServer())
      .get(`/api/v1/property-activity?propertyId=${propertyId}`)
      .set('authorization', `Bearer ${multiToken}`)
      .expect(200);
    expect(hodanActivity.body.items.length).toBeGreaterThan(0);
    const wadajirActivity = await request(app.getHttpServer())
      .get(`/api/v1/property-activity?propertyId=${wadajirPropertyId}`)
      .set('authorization', `Bearer ${multiToken}`)
      .expect(200);
    expect(wadajirActivity.body.items.length).toBeGreaterThan(0);

    const documents = await request(app.getHttpServer())
      .get(`/api/v1/portfolio-documents?entityType=Property&entityId=${propertyId}&status=ARCHIVED`)
      .set('authorization', `Bearer ${multiToken}`)
      .expect(200);
    expect(
      (documents.body.items as Array<{ property?: { id: string } }>).some(
        (document) => document.property?.id === propertyId,
      ),
    ).toBe(true);

    const spaces = await request(app.getHttpServer())
      .get(`/api/v1/rentable-spaces?propertyId=${propertyId}&search=Main`)
      .set('authorization', `Bearer ${multiToken}`)
      .expect(200);
    expect(
      (spaces.body.items as Array<{ id: string }>).some((space) => space.id === parentSpaceId),
    ).toBe(true);
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
