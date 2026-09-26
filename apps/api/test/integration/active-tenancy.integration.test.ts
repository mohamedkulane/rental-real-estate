import { randomUUID } from 'node:crypto';
import {
  BranchAccessMode,
  LeasePartyRole,
  LeaseStatus,
  PrismaClient,
  PropertyType,
  ServiceModel,
} from '@prisma/client';
import type { ApiEnvironment } from '@rerms/config';
import { uuidv7 } from '@rerms/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../../src/governance/audit.service';
import { LeasingService } from '../../src/leasing/leasing.service';
import { AuthorizationService } from '../../src/security/authorization.service';
import type { AuthenticatedPrincipal } from '../../src/security/security.types';
import { WorkflowPayloadCipher } from '../../src/workflow/workflow-payload-cipher';

const url = process.env.PHASE5_TEST_DATABASE_URL;
const permissions = ['lease.read', 'lease.approve', 'lease.activate', 'lease.manage'];

describe.skipIf(!url)('active residential tenancy database invariant', () => {
  let database: PrismaClient;
  let leasing: LeasingService;
  let principal: AuthenticatedPrincipal;
  let companyId: string;
  let branchId: string;
  let userId: string;
  let companyPartyId: string;
  let engagementId: string;
  let spaceIds: string[];
  const suffix = randomUUID().slice(0, 8).toUpperCase();

  beforeAll(async () => {
    if (!url || !/^\/rerms_phase5_[a-z0-9_]+$/u.test(new URL(url).pathname)) {
      throw new Error('Active tenancy tests require a dedicated rerms_phase5_* database.');
    }
    database = new PrismaClient({ datasourceUrl: url, transactionOptions: { timeout: 60_000 } });
    const company = await database.company.findFirstOrThrow();
    const branch = await database.branch.findFirstOrThrow({
      where: { companyId: company.id, code: 'HQ', active: true },
    });
    const user = await database.user.findFirstOrThrow({ where: { employee: { companyId: company.id } } });
    const employee = await database.employee.findFirstOrThrow({ where: { userId: user.id } });
    const type = await database.rentableSpaceType.findUniqueOrThrow({ where: { code: 'APARTMENT' } });
    companyId = company.id;
    branchId = branch.id;
    userId = user.id;
    companyPartyId = company.legalPartyId!;

    const property = await database.property.create({
      data: {
        id: uuidv7(), companyId, propertyCode: `PROP-ACT-${suffix}`,
        name: `Active Tenancy ${suffix}`, propertyType: PropertyType.APARTMENT_BUILDING,
        status: 'ACTIVE', city: 'Mogadishu',
        branchAssignments: { create: { id: uuidv7(), branchId, effectiveFrom: new Date('2026-01-01') } },
        ownerships: { create: { id: uuidv7(), ownerPartyId: companyPartyId, ownershipPercent: '100', effectiveFrom: new Date('2026-01-01') } },
      },
    });
    const spaces = await Promise.all(Array.from({ length: 4 }, (_, index) =>
      database.rentableSpace.create({
        data: {
          id: uuidv7(), propertyId: property.id, typeId: type.id,
          spaceCode: `ACT-${suffix}-${index + 1}`, name: `Residential Unit ${index + 1}`,
          status: 'ACTIVE',
        },
      }),
    ));
    spaceIds = spaces.map((space) => space.id);
    const engagement = await database.serviceEngagement.create({
      data: {
        id: uuidv7(), companyId, engagementNumber: `ENG-ACT-${suffix}`,
        serviceModel: ServiceModel.COMPANY_OWNED, status: 'ACTIVE', propertyId: property.id,
        effectiveFrom: new Date('2026-01-01'), createdByUserId: userId,
      },
    });
    engagementId = engagement.id;
    principal = {
      userId, employeeId: employee.id, sessionId: randomUUID(), companyId,
      businessDate: '2026-09-26', accessMode: BranchAccessMode.COMPANY_WIDE,
      roles: [], permissions: new Set(permissions),
      permissionBranchScopes: new Map(permissions.map((permission) => [permission, new Set<string | null>([null])])),
      branchIds: new Set([branchId]),
    };
    const environment = {
      PARTY_DATA_ENCRYPTION_KEY_VERSION: 'v1',
      PARTY_DATA_ENCRYPTION_KEY: '11'.repeat(32),
    } as ApiEnvironment;
    leasing = new LeasingService(
      database as never,
      new AuthorizationService(),
      new AuditService(),
      new WorkflowPayloadCipher(environment),
    );
  }, 60_000);

  afterAll(async () => database?.$disconnect());

  async function createTenant(label: string) {
    return database.party.create({
      data: {
        id: uuidv7(), companyId, partyNumber: `PTY-ACT-${suffix}-${label}`,
        kind: 'PERSON', displayName: `Residential Tenant ${label}`,
        person: { create: { givenName: 'Residential', familyName: `Tenant ${label}` } },
        tenant: { create: { companyId, tenantNumber: `TEN-ACT-${suffix}-${label}`, status: 'ACTIVE' } },
      },
    });
  }

  async function createLease(tenantPartyId: string, rentableSpaceId: string, label: string) {
    return database.lease.create({
      data: {
        id: uuidv7(), companyId, branchId, leaseNumber: `LSE-ACT-${suffix}-${label}`,
        rentableSpaceId, serviceEngagementId: engagementId, status: LeaseStatus.DRAFT,
        leaseStartDate: new Date('2026-01-01'), leaseEndDate: new Date('2027-01-01'),
        rentAmount: '1200', currency: 'USD', createdByUserId: userId,
        parties: { create: [
          { id: uuidv7(), partyId: tenantPartyId, role: LeasePartyRole.TENANT },
          { id: uuidv7(), partyId: companyPartyId, role: LeasePartyRole.LANDLORD },
        ] },
      },
    });
  }

  async function submitLease(lease: { id: string; version: number }) {
    return leasing.transitionLease(principal, lease.id, {
      expectedVersion: lease.version,
      status: LeaseStatus.PENDING_APPROVAL,
      reason: 'Integration test submission',
    });
  }

  it('blocks a second active lease and permits a successor after the first lease ends', async () => {
    const tenant = await createTenant('SERVICE');
    const first = await submitLease(await createLease(tenant.id, spaceIds[0]!, 'SERVICE-1'));
    const second = await submitLease(await createLease(tenant.id, spaceIds[1]!, 'SERVICE-2'));
    const active = await leasing.transitionLease(principal, first.id, {
      expectedVersion: first.version,
      status: LeaseStatus.ACTIVE,
      reason: 'Activate first tenancy',
    });

    await expect(leasing.transitionLease(principal, second.id, {
      expectedVersion: second.version,
      status: LeaseStatus.ACTIVE,
      reason: 'Attempt overlapping active tenancy',
    })).rejects.toThrow('already has an active residential lease');

    await leasing.transitionLease(principal, active.id, {
      expectedVersion: active.version,
      status: LeaseStatus.ENDED,
      reason: 'Tenant moved out',
    });
    const successor = await leasing.transitionLease(principal, second.id, {
      expectedVersion: second.version,
      status: LeaseStatus.ACTIVE,
      reason: 'Activate successor tenancy',
    });
    expect(successor.status).toBe(LeaseStatus.ACTIVE);
  }, 60_000);

  it('allows only one winner when direct activations race', async () => {
    const tenant = await createTenant('RACE');
    const leases = await Promise.all([
      createLease(tenant.id, spaceIds[2]!, 'RACE-1'),
      createLease(tenant.id, spaceIds[3]!, 'RACE-2'),
    ]);
    const attempts = await Promise.allSettled(leases.map((lease) =>
      database.lease.update({ where: { id: lease.id }, data: { status: LeaseStatus.ACTIVE } }),
    ));
    expect(attempts.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await database.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "active_residential_tenancies"
      WHERE "partyId" = ${tenant.id}::uuid
    `).toEqual([{ count: 1n }]);
  }, 60_000);
});
