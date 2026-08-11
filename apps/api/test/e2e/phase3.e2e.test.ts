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
const canRun = Boolean(databaseUrl && adminEmail && adminPassword);

describe.skipIf(!canRun)('Phase 3 identity and governance API', () => {
  let app: INestApplication;
  let database: PrismaClient;
  let adminToken = '';
  let staffToken = '';
  let staffUserId = '';
  let staffEmployeeId = '';
  let hodanId = '';
  let wadajirId = '';
  const suffix = randomUUID().slice(0, 8);
  const staffEmail = `phase3.staff.${suffix}@example.test`;
  const staffPassword = 'Phase3-Staff-Password!';

  beforeAll(async () => {
    process.env.WEB_URL = 'http://localhost:3000';
    process.env.REDIS_URL ??= 'redis://localhost:56379';
    process.env.SESSION_TTL_HOURS ??= '24';
    process.env.PASSWORD_RESET_TTL_MINUTES ??= '30';
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

  it('rejects protected routes and generic invalid credentials', async () => {
    await request(app.getHttpServer()).get('/api/v1/users').expect(401);
    const invalid = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: adminEmail,
        password: 'Definitely-Wrong!',
      })
      .expect(401);
    expect(invalid.body.message).toBe('Invalid email or password.');
  });

  it('authenticates the seeded administrator and exposes no credential material', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: adminEmail,
        password: adminPassword,
      })
      .expect(201);
    adminToken = sessionToken(login);
    expect(adminToken).toBeTruthy();
    expect(login.body).not.toHaveProperty('token');
    const sessionCookie = String(login.headers['set-cookie']);
    expect(sessionCookie).toContain('HttpOnly');
    expect(sessionCookie).toContain('SameSite=Strict');
    expect(sessionCookie).toContain('Path=/api');
    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(me.body.accessMode).toBe('COMPANY_WIDE');
    expect(me.body.permissions).toContain('identity.role.manage');
    expect(JSON.stringify(me.body)).not.toContain('passwordHash');
  });

  it('creates branch-scoped staff and assigns a branch-scoped role', async () => {
    const branches = await request(app.getHttpServer())
      .get('/api/v1/branches')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    hodanId = (branches.body as Array<{ id: string; code: string }>).find(
      (branch) => branch.code === 'HODAN',
    )!.id;
    wadajirId = (branches.body as Array<{ id: string; code: string }>).find(
      (branch) => branch.code === 'WADAJIR',
    )!.id;
    const employee = await request(app.getHttpServer())
      .post('/api/v1/employees')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        employeeNumber: `T-${suffix}`,
        displayName: 'Sahra Ibrahim Aden',
        accessMode: 'BRANCH',
        branchId: hodanId,
        email: staffEmail,
        password: staffPassword,
      })
      .expect(201);
    staffEmployeeId = employee.body.id as string;
    staffUserId = employee.body.user.id as string;
    expect(JSON.stringify(employee.body)).not.toContain('passwordHash');
    const employeeList = await request(app.getHttpServer())
      .get('/api/v1/employees')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const listedEmployee = (employeeList.body as Array<{ id: string; displayName?: string }>).find(
      (item) => item.id === staffEmployeeId,
    );
    expect(listedEmployee?.displayName).toBe('Sahra Ibrahim Aden');
    const roles = await request(app.getHttpServer())
      .get('/api/v1/roles')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const receptionist = (roles.body as Array<{ id: string; code: string }>).find(
      (role) => role.code === 'RECEPTIONIST',
    )!;
    await request(app.getHttpServer())
      .post(`/api/v1/employees/${staffEmployeeId}/roles`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        roleId: receptionist.id,
        branchId: hodanId,
        effectiveFrom: new Date().toISOString().slice(0, 10),
      })
      .expect(201);
  });

  it('enforces permissions and object-level branch scope in the backend', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: staffEmail, password: staffPassword })
      .expect(201);
    staffToken = sessionToken(login);
    await request(app.getHttpServer())
      .get(`/api/v1/branches/${hodanId}`)
      .set('authorization', `Bearer ${staffToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/branches/${wadajirId}`)
      .set('authorization', `Bearer ${staffToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/roles')
      .set('authorization', `Bearer ${staffToken}`)
      .send({ code: 'FORBIDDEN', name: 'Forbidden' })
      .expect(403);
  });

  it('rejects maker self-approval and records sensitive audit evidence', async () => {
    const policy = await database.approvalPolicy.findFirstOrThrow({
      where: { code: 'FOUNDATION_MAKER_CHECKER' },
    });
    const approval = await request(app.getHttpServer())
      .post('/api/v1/approvals')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        policyId: policy.id,
        actionType: 'FOUNDATION_TEST',
        targetType: 'Employee',
        targetId: staffEmployeeId,
        branchId: hodanId,
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/approvals/steps/${approval.body.steps[0].id}/decisions`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ outcome: 'APPROVED' })
      .expect(400);
    const audit = await request(app.getHttpServer())
      .get('/api/v1/audit')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      (audit.body as Array<{ action: string }>).some(
        (row) => row.action === 'governance.approval.requested',
      ),
    ).toBe(true);
    expect(JSON.stringify(audit.body)).not.toContain(staffPassword);
  });

  it('suspends the account, revokes sessions, and prevents new login', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/users/${staffUserId}/status`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        status: 'SUSPENDED',
        reason: 'Phase 3 security regression test',
      })
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('authorization', `Bearer ${staffToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: staffEmail, password: staffPassword })
      .expect(401);
  });

  it('revokes the current session on logout', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(201);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(401);
  });
});
