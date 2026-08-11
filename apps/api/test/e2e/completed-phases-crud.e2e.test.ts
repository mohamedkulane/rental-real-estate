import { sessionToken } from '../session-cookie';
import { createHash } from 'node:crypto';
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
  'Completed Phase 2-4 CRUD operations',
  () => {
    let app: INestApplication;
    let database: PrismaClient;
    let token = '';
    let originalCompanyName = '';
    let branchOneId = '';
    let branchTwoId = '';
    let employeeId = '';
    let userId = '';
    let roleId = '';
    let permissionId = '';
    let assignmentId = '';
    let ownerPartyId = '';
    let propertyId = '';
    let parentOneId = '';
    let parentTwoId = '';
    let childId = '';
    let amenityId = '';
    const suffix = randomUUID().slice(0, 8);
    const employeeEmail = `crud.employee.${suffix}@example.test`;
    const initialPassword = 'Completed-Phases-Initial!';
    const changedPassword = 'Completed-Phases-Changed!';

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
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: adminEmail, password: adminPassword })
        .expect(201);
      token = sessionToken(login);
    });

    afterAll(async () => {
      if (token && originalCompanyName) {
        await request(app.getHttpServer())
          .patch('/api/v1/company')
          .set('authorization', `Bearer ${token}`)
          .send({ displayName: originalCompanyName });
      }
      await app?.close();
      await database?.$disconnect();
    });

    it('reads and updates the singleton company', async () => {
      const before = await request(app.getHttpServer())
        .get('/api/v1/company')
        .set('authorization', `Bearer ${token}`)
        .expect(200);
      originalCompanyName = before.body.displayName as string;
      const updated = await request(app.getHttpServer())
        .patch('/api/v1/company')
        .set('authorization', `Bearer ${token}`)
        .send({ displayName: `Barwaaqo Rental Operations`, timezone: 'Africa/Nairobi' })
        .expect(200);
      expect(updated.body.displayName).toBe(`Barwaaqo Rental Operations`);
      expect(updated.body.timezone).toBe('Africa/Nairobi');
    });

    it('creates, lists, reads, and updates branches', async () => {
      const first = await request(app.getHttpServer())
        .post('/api/v1/branches')
        .set('authorization', `Bearer ${token}`)
        .send({
          name: `Hodan Service Office`,
          phone: '+252610000001',
        })
        .expect(201);
      branchOneId = first.body.id as string;
      expect(first.body.code).toMatch(/^BR-\d{3,}$/);
      const second = await request(app.getHttpServer())
        .post('/api/v1/branches')
        .set('authorization', `Bearer ${token}`)
        .send({ code: `C2${suffix}`, name: `Wadajir Service Office` })
        .expect(201);
      branchTwoId = second.body.id as string;
      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/branches/${branchOneId}`)
        .set('authorization', `Bearer ${token}`)
        .send({ name: `Hodan Central Office`, email: `branch.${suffix}@example.test` })
        .expect(200);
      expect(updated.body.name).toBe(`Hodan Central Office`);
      const detail = await request(app.getHttpServer())
        .get(`/api/v1/branches/${branchOneId}`)
        .set('authorization', `Bearer ${token}`)
        .expect(200);
      expect(detail.body.email).toBe(`branch.${suffix}@example.test`);
      const list = await request(app.getHttpServer())
        .get('/api/v1/branches')
        .set('authorization', `Bearer ${token}`)
        .expect(200);
      expect((list.body as Array<{ id: string }>).some((item) => item.id === branchOneId)).toBe(
        true,
      );
    });

    it('creates an employee and returns a human-readable name from list operations', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set('authorization', `Bearer ${token}`)
        .send({
          displayName: `Ayaan Cabdi`,
          accessMode: 'MULTI_BRANCH',
          branchId: branchOneId,
          jobTitle: 'Operations Tester',
        })
        .expect(201);
      employeeId = created.body.id as string;
      expect(created.body.employeeNumber).toMatch(/^EMP-\d{4,}$/);
      await request(app.getHttpServer())
        .post(`/api/v1/employees/${employeeId}/branches`)
        .set('authorization', `Bearer ${token}`)
        .send({ branchId: branchTwoId, effectiveFrom: '2027-01-01' })
        .expect(201);
      const list = await request(app.getHttpServer())
        .get('/api/v1/employees')
        .set('authorization', `Bearer ${token}`)
        .expect(200);
      const listed = (
        list.body as Array<{ id: string; displayName?: string; branchAssignments: unknown[] }>
      ).find((item) => item.id === employeeId);
      expect(listed?.displayName).toBe(`Ayaan Cabdi`);
      expect(listed?.displayName).not.toBe('Not available');
      expect(listed?.branchAssignments).toHaveLength(2);
    });

    it('reads, edits, deactivates, and reactivates an employee without deleting history', async () => {
      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/employees/${employeeId}`)
        .set('authorization', `Bearer ${token}`)
        .send({
          displayName: `Ayaan Cabdi Warsame`,
          jobTitle: 'Senior Operations Tester',
          accessMode: 'MULTI_BRANCH',
        })
        .expect(200);
      expect(updated.body.displayName).toBe(`Ayaan Cabdi Warsame`);
      expect(updated.body.jobTitle).toBe('Senior Operations Tester');
      const detail = await request(app.getHttpServer())
        .get(`/api/v1/employees/${employeeId}`)
        .set('authorization', `Bearer ${token}`)
        .expect(200);
      expect(detail.body.displayName).toBe(`Ayaan Cabdi Warsame`);
      await request(app.getHttpServer())
        .patch(`/api/v1/employees/${employeeId}/status`)
        .set('authorization', `Bearer ${token}`)
        .send({ active: false, reason: 'Completed employee lifecycle verification' })
        .expect(200)
        .expect(({ body }) => expect(body.active).toBe(false));
      await request(app.getHttpServer())
        .patch(`/api/v1/employees/${employeeId}/status`)
        .set('authorization', `Bearer ${token}`)
        .send({ active: true, reason: 'Management approved employment reactivation' })
        .expect(200)
        .expect(({ body }) => expect(body.active).toBe(true));
    });

    it('creates roles, grants and revokes permissions, and ends effective assignments', async () => {
      const role = await request(app.getHttpServer())
        .post('/api/v1/roles')
        .set('authorization', `Bearer ${token}`)
        .send({ code: `CRUD_${suffix}`, name: `Portfolio Coordinator` })
        .expect(201);
      roleId = role.body.id as string;
      const permissions = await request(app.getHttpServer())
        .get('/api/v1/permissions')
        .set('authorization', `Bearer ${token}`)
        .expect(200);
      permissionId = (permissions.body as Array<{ id: string; code: string }>).find(
        (item) => item.code === 'organization.branch.read',
      )!.id;
      await request(app.getHttpServer())
        .post(`/api/v1/roles/${roleId}/permissions`)
        .set('authorization', `Bearer ${token}`)
        .send({ permissionId })
        .expect(201);
      const assignment = await request(app.getHttpServer())
        .post(`/api/v1/employees/${employeeId}/roles`)
        .set('authorization', `Bearer ${token}`)
        .send({
          roleId,
          branchId: branchOneId,
          effectiveFrom: new Date().toISOString().slice(0, 10),
        })
        .expect(201);
      assignmentId = assignment.body.id as string;
      await request(app.getHttpServer())
        .post(`/api/v1/roles/employee-assignments/${assignmentId}/end`)
        .set('authorization', `Bearer ${token}`)
        .send({ reason: 'Routine access review' })
        .expect(201);
      await request(app.getHttpServer())
        .delete(`/api/v1/roles/${roleId}/permissions/${permissionId}`)
        .set('authorization', `Bearer ${token}`)
        .send({ reason: 'Routine access review' })
        .expect(200);
      const roles = await request(app.getHttpServer())
        .get('/api/v1/roles')
        .set('authorization', `Bearer ${token}`)
        .expect(200);
      const listedRole = (
        roles.body as Array<{ id: string; permissions: Array<{ permissionId: string }> }>
      ).find((item) => item.id === roleId);
      expect(listedRole?.permissions).toHaveLength(0);
      const persistedAssignment = await database.employeeRole.findUnique({
        where: { id: assignmentId },
      });
      expect(persistedAssignment).toBeNull();
      const renamed = await request(app.getHttpServer())
        .patch(`/api/v1/roles/${roleId}`)
        .set('authorization', `Bearer ${token}`)
        .send({ name: `Senior Portfolio Coordinator` })
        .expect(200);
      expect(renamed.body.name).toBe(`Senior Portfolio Coordinator`);
      await request(app.getHttpServer())
        .patch(`/api/v1/roles/${roleId}`)
        .set('authorization', `Bearer ${token}`)
        .send({ active: false, reason: 'Completed role lifecycle verification' })
        .expect(200)
        .expect(({ body }) => expect(body.active).toBe(false));
      await request(app.getHttpServer())
        .patch(`/api/v1/roles/${roleId}`)
        .set('authorization', `Bearer ${token}`)
        .send({ active: true })
        .expect(200)
        .expect(({ body }) => expect(body.active).toBe(true));
    });

    it('creates users, changes passwords, lists and revokes sessions, and updates status', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('authorization', `Bearer ${token}`)
        .send({ employeeId, email: employeeEmail, password: initialPassword })
        .expect(201);
      userId = created.body.id as string;
      const employeeLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: employeeEmail, password: initialPassword })
        .expect(201);
      const employeeToken = sessionToken(employeeLogin);
      await request(app.getHttpServer())
        .post('/api/v1/auth/change-password')
        .set('authorization', `Bearer ${employeeToken}`)
        .send({ currentPassword: initialPassword, newPassword: changedPassword })
        .expect(201);
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: employeeEmail, password: initialPassword })
        .expect(401);
      const changedLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: employeeEmail, password: changedPassword })
        .expect(201);
      const changedToken = sessionToken(changedLogin);
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('authorization', `Bearer ${changedToken}`)
        .expect(200);
      const users = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('authorization', `Bearer ${token}`)
        .expect(200);
      const listed = (
        users.body as Array<{
          id: string;
          sessions: Array<{ id: string; revokedAt: string | null }>;
        }>
      ).find((item) => item.id === userId)!;
      const changedTokenHash = createHash('sha256').update(changedToken).digest('hex');
      const changedDatabaseSession = await database.session.findUniqueOrThrow({
        where: { tokenHash: changedTokenHash },
      });
      const activeSession = listed.sessions.find(
        (session) => session.id === changedDatabaseSession.id,
      )!;
      expect(activeSession.revokedAt).toBeNull();
      await request(app.getHttpServer())
        .post(`/api/v1/auth/sessions/${activeSession.id}/revoke`)
        .set('authorization', `Bearer ${token}`)
        .send({ reason: 'Administrator security review' })
        .expect(201);
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('authorization', `Bearer ${changedToken}`)
        .expect(401);
      const suspended = await request(app.getHttpServer())
        .patch(`/api/v1/users/${userId}/status`)
        .set('authorization', `Bearer ${token}`)
        .send({ status: 'SUSPENDED', reason: 'Temporary access hold requested by management' })
        .expect(200);
      expect(suspended.body.status).toBe('SUSPENDED');
      await request(app.getHttpServer())
        .patch(`/api/v1/users/${userId}/status`)
        .set('authorization', `Bearer ${token}`)
        .send({ status: 'ACTIVE', reason: 'Management approved access restoration' })
        .expect(200);
      const resetRequest = await request(app.getHttpServer())
        .post('/api/v1/auth/password-reset/request')
        .send({ email: employeeEmail })
        .expect(201);
      expect(resetRequest.body.accepted).toBe(true);
      const reset = await database.passwordResetToken.findFirstOrThrow({
        where: { userId, usedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      expect(reset.tokenHash).toHaveLength(64);
    });

    it('creates, lists, reads, and updates parties and owners', async () => {
      const party = await request(app.getHttpServer())
        .post('/api/v1/parties')
        .set('authorization', `Bearer ${token}`)
        .send({
          branchId: branchOneId,
          kind: 'PERSON',
          displayName: `Hodan Property Holdings`,
          person: { givenName: 'CRUD', familyName: 'Owner' },
          contacts: [{ type: 'EMAIL', value: `owner.${suffix}@example.test`, primary: true }],
          addresses: [{ line1: 'Maka Al-Mukarama Road', city: 'Mogadishu', countryCode: 'SO' }],
        })
        .expect(201);
      ownerPartyId = party.body.id as string;
      expect(party.body.partyNumber).toMatch(/^PTY-\d{4,}$/);
      const updatedParty = await request(app.getHttpServer())
        .patch(`/api/v1/parties/${ownerPartyId}`)
        .set('authorization', `Bearer ${token}`)
        .send({ displayName: `Hodan Property Holdings Ltd` })
        .expect(200);
      expect(updatedParty.body.displayName).toBe(`Hodan Property Holdings Ltd`);
      const partyDetail = await request(app.getHttpServer())
        .get(`/api/v1/parties/${ownerPartyId}`)
        .set('authorization', `Bearer ${token}`)
        .expect(200);
      expect(partyDetail.body.contacts[0].value).toBe(`owner.${suffix}@example.test`);
      const partyList = await request(app.getHttpServer())
        .get('/api/v1/parties')
        .set('authorization', `Bearer ${token}`)
        .expect(200);
      expect(
        (partyList.body as Array<{ id: string }>).some((item) => item.id === ownerPartyId),
      ).toBe(true);
      await request(app.getHttpServer())
        .post('/api/v1/owners')
        .set('authorization', `Bearer ${token}`)
        .send({
          partyId: ownerPartyId,
          status: 'ACTIVE',
          communicationPreference: 'EMAIL',
        })
        .expect(201)
        .expect(({ body }) => expect(body.ownerNumber).toMatch(/^OWN-\d{4,}$/));
      const updatedOwner = await request(app.getHttpServer())
        .patch(`/api/v1/owners/${ownerPartyId}`)
        .set('authorization', `Bearer ${token}`)
        .send({
          communicationPreference: 'WHATSAPP',
          notes: 'Prefers WhatsApp for monthly owner statements',
        })
        .expect(200);
      expect(updatedOwner.body.communicationPreference).toBe('WHATSAPP');
      const ownerList = await request(app.getHttpServer())
        .get('/api/v1/owners')
        .set('authorization', `Bearer ${token}`)
        .expect(200);
      expect(
        (ownerList.body as Array<{ partyId: string }>).some(
          (item) => item.partyId === ownerPartyId,
        ),
      ).toBe(true);
      await request(app.getHttpServer())
        .get(`/api/v1/owners/${ownerPartyId}`)
        .set('authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('covers property, ownership, branch history, building, and amenity operations', async () => {
      const property = await request(app.getHttpServer())
        .post('/api/v1/properties')
        .set('authorization', `Bearer ${token}`)
        .send({
          name: `Barwaaqo Residence`,
          propertyType: 'COMMERCIAL_BUILDING',
          branchId: branchOneId,
          effectiveFrom: '2026-01-01',
          city: 'Mogadishu',
          addressLine1: 'KM4 Avenue',
        })
        .expect(201);
      propertyId = property.body.id as string;
      expect(property.body.propertyCode).toMatch(/^PROP-\d{4,}$/);
      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/properties/${propertyId}`)
        .set('authorization', `Bearer ${token}`)
        .send({ name: `Barwaaqo Residence Tower`, district: 'Hodan' })
        .expect(200);
      expect(updated.body.name).toBe(`Barwaaqo Residence Tower`);
      await request(app.getHttpServer())
        .put(`/api/v1/properties/${propertyId}/ownership`)
        .set('authorization', `Bearer ${token}`)
        .send({
          effectiveFrom: '2026-01-01',
          shares: [{ ownerPartyId, ownershipPercent: '100', payoutPercent: '100' }],
          reason: 'Ownership documents verified by portfolio manager',
        })
        .expect(200);
      const ownership = await request(app.getHttpServer())
        .get(`/api/v1/properties/${propertyId}/ownership`)
        .set('authorization', `Bearer ${token}`)
        .expect(200);
      expect(ownership.body).toHaveLength(1);
      await request(app.getHttpServer())
        .post(`/api/v1/properties/${propertyId}/activate`)
        .set('authorization', `Bearer ${token}`)
        .send({ reason: 'Ownership and operating setup approved' })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/properties/${propertyId}/branch-transfers`)
        .set('authorization', `Bearer ${token}`)
        .send({
          branchId: branchTwoId,
          effectiveFrom: '2027-01-01',
          reason: 'Property operations transferred to the service branch',
        })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/properties/${propertyId}/buildings`)
        .set('authorization', `Bearer ${token}`)
        .send({ buildingCode: `CB-${suffix}`, name: 'Main Residential Block', numberOfFloors: 2 })
        .expect(201);
      const createdAmenity = await request(app.getHttpServer())
        .post('/api/v1/amenities')
        .set('authorization', `Bearer ${token}`)
        .send({ code: `ROOFTOP_${suffix}`, name: 'Rooftop terrace' })
        .expect(201);
      amenityId = createdAmenity.body.id as string;
      const updatedAmenity = await request(app.getHttpServer())
        .patch(`/api/v1/amenities/${amenityId}`)
        .set('authorization', `Bearer ${token}`)
        .send({ name: 'Rooftop event terrace' })
        .expect(200);
      expect(updatedAmenity.body.name).toBe('Rooftop event terrace');
      const amenities = await request(app.getHttpServer())
        .get('/api/v1/amenities')
        .set('authorization', `Bearer ${token}`)
        .expect(200);
      expect((amenities.body as Array<{ id: string }>).some((item) => item.id === amenityId)).toBe(
        true,
      );
      await request(app.getHttpServer())
        .post(`/api/v1/properties/${propertyId}/amenities`)
        .set('authorization', `Bearer ${token}`)
        .send({ amenityId })
        .expect(201);
      const detail = await request(app.getHttpServer())
        .get(`/api/v1/properties/${propertyId}`)
        .set('authorization', `Bearer ${token}`)
        .expect(200);
      expect(detail.body.branchAssignments).toHaveLength(2);
      expect(detail.body.buildings).toHaveLength(1);
      expect(detail.body.amenities).toHaveLength(1);
      const list = await request(app.getHttpServer())
        .get('/api/v1/properties')
        .set('authorization', `Bearer ${token}`)
        .expect(200);
      expect((list.body as Array<{ id: string }>).some((item) => item.id === propertyId)).toBe(
        true,
      );
    });

    it('discards only an unused draft Property and preserves protected Property history', async () => {
      const draft = await request(app.getHttpServer())
        .post('/api/v1/properties')
        .set('authorization', `Bearer ${token}`)
        .send({
          propertyCode: `DD-${suffix}`,
          name: `Discardable Draft ${suffix}`,
          propertyType: 'HOUSE',
          branchId: branchOneId,
          effectiveFrom: '2026-01-01',
          city: 'Mogadishu',
        })
        .expect(201);
      await request(app.getHttpServer())
        .delete(`/api/v1/properties/${draft.body.id}/draft`)
        .set('authorization', `Bearer ${token}`)
        .send({ reason: 'Duplicate setup draft created during verification' })
        .expect(200)
        .expect(({ body }) => expect(body.discarded).toBe(true));
      await request(app.getHttpServer())
        .get(`/api/v1/properties/${draft.body.id}`)
        .set('authorization', `Bearer ${token}`)
        .expect(404);
      await request(app.getHttpServer())
        .delete(`/api/v1/properties/${propertyId}/draft`)
        .set('authorization', `Bearer ${token}`)
        .send({ reason: 'Protected history must prevent deletion' })
        .expect(400);
    });

    it('covers rentable-space list, read, measurement, hierarchy, amenity, and retirement operations', async () => {
      const createSpace = (spaceCode: string, name: string) =>
        request(app.getHttpServer())
          .post('/api/v1/rentable-spaces')
          .set('authorization', `Bearer ${token}`)
          .send({
            propertyId,
            typeCode: 'HALL',
            spaceCode,
            name,
            effectiveFrom: '2026-01-01',
            usableArea: '100',
            areaUnit: 'SQM',
          });
      const parentOne = await createSpace(`P1-${suffix}`, 'East Wing').expect(201);
      parentOneId = parentOne.body.id as string;
      const parentTwo = await createSpace(`P2-${suffix}`, 'West Wing').expect(201);
      parentTwoId = parentTwo.body.id as string;
      const child = await request(app.getHttpServer())
        .post('/api/v1/rentable-spaces')
        .set('authorization', `Bearer ${token}`)
        .send({
          propertyId,
          parentSpaceId: parentOneId,
          typeCode: 'ROOM',
          name: 'Office Suite 101',
          effectiveFrom: '2026-01-01',
          usableArea: '40',
          areaUnit: 'SQM',
          residential: { bedrooms: 1, bathrooms: '1' },
        })
        .expect(201);
      childId = child.body.id as string;
      expect(child.body.spaceCode).toMatch(/^SPC-\d{4,}$/);
      await request(app.getHttpServer())
        .post(`/api/v1/rentable-spaces/${childId}/measurements`)
        .set('authorization', `Bearer ${token}`)
        .send({
          effectiveFrom: '2026-02-01',
          usableArea: '35',
          areaUnit: 'SQM',
          reason: 'Surveyor supplied the corrected usable area',
        })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/rentable-spaces/${childId}/parent`)
        .set('authorization', `Bearer ${token}`)
        .send({
          parentSpaceId: parentTwoId,
          effectiveFrom: '2026-03-01',
          reason: 'Space reassigned to the correct building wing',
        })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/rentable-spaces/${childId}/amenities`)
        .set('authorization', `Bearer ${token}`)
        .send({ amenityId })
        .expect(201);
      const detail = await request(app.getHttpServer())
        .get(`/api/v1/rentable-spaces/${childId}`)
        .set('authorization', `Bearer ${token}`)
        .expect(200);
      expect(detail.body.versions).toHaveLength(2);
      expect(detail.body.childRelations).toHaveLength(2);
      expect(detail.body.amenities).toHaveLength(1);
      const list = await request(app.getHttpServer())
        .get(`/api/v1/rentable-spaces?propertyId=${propertyId}`)
        .set('authorization', `Bearer ${token}`)
        .expect(200);
      expect((list.body as Array<{ id: string }>).some((item) => item.id === childId)).toBe(true);
      const retired = await request(app.getHttpServer())
        .post(`/api/v1/rentable-spaces/${childId}/retire`)
        .set('authorization', `Bearer ${token}`)
        .send({
          effectiveDate: '2026-04-01',
          reason: 'Space removed from future rental availability',
        })
        .expect(201);
      expect(retired.body.status).toBe('RETIRED');
    });

    it('creates document metadata and verifies audit evidence for completed operations', async () => {
      const document = await request(app.getHttpServer())
        .post('/api/v1/portfolio-documents')
        .set('authorization', `Bearer ${token}`)
        .send({
          categoryCode: 'TITLE_DEED',
          accessClass: 'CONFIDENTIAL',
          status: 'ACTIVE',
          storageKey: `properties/${propertyId}/title-deed-${suffix}.pdf`,
          checksum: `0123456789abcdef${suffix}`,
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          entityType: 'Property',
          entityId: propertyId,
          purpose: 'OWNERSHIP_EVIDENCE',
        })
        .expect(201);
      expect(document.body.versions[0]?.storageKey).toContain(propertyId);
      const approvals = await request(app.getHttpServer())
        .get('/api/v1/approvals')
        .set('authorization', `Bearer ${token}`)
        .expect(200);
      expect(Array.isArray(approvals.body)).toBe(true);
      const audit = await request(app.getHttpServer())
        .get('/api/v1/audit')
        .set('authorization', `Bearer ${token}`)
        .expect(200);
      const actions = new Set((audit.body as Array<{ action: string }>).map((item) => item.action));
      expect(actions).toContain('organization.branch.created');
      expect(actions).toContain('identity.employee.created');
      expect(actions).toContain('identity.employee.updated');
      expect(actions).toContain('identity.employee.deactivated');
      expect(actions).toContain('identity.employee.activated');
      expect(actions).toContain('identity.role.updated');
      expect(actions).toContain('identity.role.deactivated');
      expect(actions).toContain('identity.role.activated');
      expect(actions).toContain('party.updated');
      expect(actions).toContain('portfolio.property.branch-transferred');
      expect(actions).toContain('portfolio.amenity.created');
      expect(actions).toContain('portfolio.amenity.updated');
      expect(actions).toContain('portfolio.property.draft-discarded');
      expect(actions).toContain('portfolio.space.measurement-corrected');
      expect(actions).toContain('portfolio.document.metadata-created');
      expect(JSON.stringify(audit.body)).not.toContain(initialPassword);
      expect(JSON.stringify(audit.body)).not.toContain(changedPassword);
    });
  },
);
