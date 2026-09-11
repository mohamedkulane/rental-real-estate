import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BranchAccessMode, PrismaClient, WorkflowType } from '@prisma/client';
import { uuidv7 } from '@rerms/shared';
import type { ApiEnvironment } from '@rerms/config';
import { BusinessDateService } from '../../src/common/business-date.service';
import { EffectiveDatingService } from '../../src/common/effective-dating.service';
import { ServiceEngagementService } from '../../src/commercial/service-engagement.service';
import { AuditService } from '../../src/governance/audit.service';
import { AuthorizationService } from '../../src/security/authorization.service';
import type { AuthenticatedPrincipal } from '../../src/security/security.types';
import { PartyService } from '../../src/portfolio/party.service';
import { PartyCryptoService } from '../../src/portfolio/party-crypto.service';
import { PortfolioService } from '../../src/portfolio/portfolio.service';
import { WorkflowService } from '../../src/workflow/workflow.service';
import { WorkflowPayloadCipher } from '../../src/workflow/workflow-payload-cipher';
import { WorkflowCommandService } from '../../src/workflow/workflow-command.service';
import type { WorkflowCommandDto } from '../../src/workflow/workflow.dto';

const url = process.env.PHASE5_TEST_DATABASE_URL;
describe.skipIf(!url)('Property Onboarding canonical commands', () => {
  let db: PrismaClient;
  let principal: AuthenticatedPrincipal;
  let workflows: WorkflowService;
  let commands: WorkflowCommandService;
  beforeAll(async () => {
    if (!url || !/^\/rerms_phase5_[a-z0-9_]+$/u.test(new URL(url).pathname))
      throw new Error('A dedicated disposable Phase 5 database is required.');
    db = new PrismaClient({ datasourceUrl: url });
    const company = await db.company.findFirstOrThrow();
    const branch = await db.branch.findFirstOrThrow({
      where: { companyId: company.id, active: true },
    });
    const employee = await db.employee.findFirstOrThrow({
      where: { companyId: company.id, userId: { not: null } },
    });
    const permissions = [
      'workflow.draft.read',
      'workflow.draft.update',
      'workflow.draft.complete',
      'workflow.draft.cancel',
      'party.read',
      'party.create',
      'owner.read',
      'owner.create',
      'portfolio.property.read',
      'portfolio.property.create',
      'portfolio.property.update',
      'portfolio.ownership.read',
      'portfolio.ownership.manage',
      'portfolio.building.read',
      'portfolio.building.manage',
      'portfolio.space.read',
      'portfolio.space.create',
      'service-engagement.create',
      'service-engagement.read',
      'service-engagement.activate',
    ];
    const auth = new AuthorizationService();
    const audit = new AuditService();
    const date = new BusinessDateService(db as never);
    const effective = new EffectiveDatingService(date);
    principal = {
      userId: employee.userId!,
      employeeId: employee.id,
      companyId: company.id,
      sessionId: uuidv7(),
      businessDate: (await date.today(company.id)).toISOString().slice(0, 10),
      accessMode: BranchAccessMode.COMPANY_WIDE,
      permissions: new Set(permissions),
      permissionBranchScopes: new Map(
        permissions.map((code) => [code, new Set<string | null>([null])]),
      ),
      branchIds: new Set([branch.id]),
      roles: [],
    };
    const environment = {
      PARTY_DATA_ENCRYPTION_KEY_VERSION: 'v1',
      PARTY_DATA_ENCRYPTION_KEY: '11'.repeat(32),
      PARTY_DATA_DECRYPTION_KEYS: '',
      PARTY_CONTACT_LOOKUP_KEY: '22'.repeat(32),
    } as ApiEnvironment;
    const cipher = new WorkflowPayloadCipher(environment);
    const parties = new PartyService(
      db as never,
      date,
      new PartyCryptoService(environment),
      audit,
      auth,
    );
    const portfolio = new PortfolioService(db as never, date, effective, auth, audit, {} as never);
    workflows = new WorkflowService(db as never, auth, audit, cipher);
    commands = new WorkflowCommandService(
      db as never,
      auth,
      workflows,
      parties,
      portfolio,
      cipher,
      audit,
      new ServiceEngagementService(db as never, date, effective, auth, audit),
    );
  });
  afterAll(async () => db?.$disconnect());

  it('offers company-wide branches without assignments and intersects domain scope', async () => {
    const companyWide = { ...principal, branchIds: new Set<string>() };
    const first = await workflows.listBranches(companyWide, { limit: 1 });
    expect(first.items).toHaveLength(1);
    const branchId = first.items[0]!.id;
    const restricted = {
      ...principal,
      accessMode: BranchAccessMode.BRANCH,
      branchIds: new Set([branchId]),
    };
    expect(
      (await workflows.listBranches(restricted, { limit: 20 })).items.map((row) => row.id),
    ).toEqual([branchId]);
    const scopes = new Map(principal.permissionBranchScopes);
    scopes.set('portfolio.property.read', new Set());
    expect(
      (
        await workflows.listBranches(
          { ...companyWide, permissionBranchScopes: scopes },
          { limit: 20 },
        )
      ).items,
    ).toEqual([]);
    expect(
      (await workflows.listBranches({ ...companyWide, companyId: uuidv7() }, { limit: 20 })).items,
    ).toEqual([]);
    const next = await workflows.listBranches(companyWide, { limit: 1, cursor: branchId });
    expect(next.items.every((row) => row.id > branchId)).toBe(true);
    expect(
      (
        await workflows.listBranches(companyWide, {
          limit: 20,
          search: first.items[0]!.name.toUpperCase(),
        })
      ).items.some((row) => row.id === branchId),
    ).toBe(true);
  });

  it('creates and resumes Owner → Ownership → Property → Building → Space without duplicate retry writes', async () => {
    let draft = await workflows.create(principal, {
      branchId: [...principal.branchIds][0]!,
      type: WorkflowType.PROPERTY_ONBOARDING,
      payloadSchemaVersion: 1,
      payload: {},
    });
    const partyCommand: WorkflowCommandDto = {
      command: 'PARTY',
      expectedVersion: draft.version,
      idempotencyKey: uuidv7(),
      party: {
        kind: 'PERSON',
        branchId: draft.branchId,
        displayName: 'Onboarding Test Owner',
        person: { givenName: 'Onboarding', familyName: 'Test Owner' },
      },
    };
    draft = await commands.execute(principal, draft.id, partyCommand);
    const partyId = draft.payload.partyId!;
    expect((await commands.execute(principal, draft.id, partyCommand)).payload.partyId).toBe(
      partyId,
    );
    expect(
      await db.workflowCommand.count({ where: { workflowId: draft.id, command: 'PARTY' } }),
    ).toBe(1);
    draft = await commands.execute(principal, draft.id, {
      command: 'OWNER',
      expectedVersion: draft.version,
      idempotencyKey: uuidv7(),
      owner: { partyId },
    });
    draft = await workflows.update(principal, draft.id, {
      expectedVersion: draft.version,
      currentStep: 2,
      payload: draft.payload,
    });
    draft = await workflows.update(principal, draft.id, {
      expectedVersion: draft.version,
      currentStep: 3,
      payload: {
        ...draft.payload,
        ownershipPlan: {
          effectiveFrom: principal.businessDate,
          reason: 'Initial onboarding',
          shares: [{ ownerPartyId: partyId, ownershipPercent: '100', payoutPercent: '100' }],
        },
      },
    });
    const propertyCommand: WorkflowCommandDto = {
      command: 'PROPERTY',
      expectedVersion: draft.version,
      idempotencyKey: uuidv7(),
      property: {
        branchId: draft.branchId,
        name: 'Onboarding Test Property',
        propertyType: 'VILLA',
        city: 'Mogadishu',
        effectiveFrom: principal.businessDate,
      },
    };
    draft = await commands.execute(principal, draft.id, propertyCommand);
    expect((await commands.execute(principal, draft.id, propertyCommand)).payload.propertyId).toBe(
      draft.payload.propertyId,
    );
    draft = await commands.execute(principal, draft.id, {
      command: 'OWNERSHIP',
      expectedVersion: draft.version,
      idempotencyKey: uuidv7(),
    });
    expect(
      await db.propertyOwnership.count({ where: { propertyId: draft.payload.propertyId! } }),
    ).toBe(1);
    draft = await workflows.update(principal, draft.id, {
      expectedVersion: draft.version,
      currentStep: 4,
      payload: draft.payload,
    });
    const expectedVersion = draft.version;
    const attempts = await Promise.allSettled(
      [1, 2].map((number) =>
        commands.execute(principal, draft.id, {
          command: 'BUILDING',
          expectedVersion,
          idempotencyKey: uuidv7(),
          building: { name: 'Main structure ' + number },
        }),
      ),
    );
    expect(attempts.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await db.building.count({ where: { propertyId: draft.payload.propertyId! } })).toBe(1);
    draft = await workflows.get(principal, draft.id);
    draft = await workflows.update(principal, draft.id, {
      expectedVersion: draft.version,
      currentStep: 5,
      payload: draft.payload,
    });
    const type = await db.rentableSpaceType.findFirstOrThrow({
      where: { active: true, code: 'ROOM' },
    });
    draft = await commands.execute(principal, draft.id, {
      command: 'SPACE',
      expectedVersion: draft.version,
      idempotencyKey: uuidv7(),
      space: {
        propertyId: draft.payload.propertyId!,
        buildingId: draft.payload.buildingIds![0]!,
        typeCode: type.code,
        name: 'First Room',
        effectiveFrom: principal.businessDate,
      },
    });
    expect(draft.payload.rentableSpaceIds).toHaveLength(1);
    const denied = {
      ...principal,
      accessMode: BranchAccessMode.BRANCH,
      branchIds: new Set<string>(),
    };
    await expect(workflows.get(denied, draft.id)).rejects.toThrow();
    await expect(workflows.get({ ...principal, companyId: uuidv7() }, draft.id)).rejects.toThrow();
    const register = await workflows.list(principal, { limit: 50 });
    expect(register.items.find((row) => row.id === draft.id)).not.toHaveProperty('payload');
    for (let currentStep = 6; currentStep <= 8; currentStep++)
      draft = await workflows.update(principal, draft.id, {
        expectedVersion: draft.version,
        currentStep,
        payload: draft.payload,
      });
    draft = await commands.execute(principal, draft.id, {
      command: 'ACTIVATE_PROPERTY',
      expectedVersion: draft.version,
      idempotencyKey: uuidv7(),
    });
    draft = await workflows.update(principal, draft.id, {
      expectedVersion: draft.version,
      currentStep: 8,
      payload: draft.payload,
    });
    expect(
      (await db.property.findUniqueOrThrow({ where: { id: draft.payload.propertyId! } })).status,
    ).toBe('ACTIVE');
    const completion = { expectedVersion: draft.version, idempotencyKey: uuidv7() };
    const result = await workflows.complete(principal, draft.id, completion);
    expect(await workflows.complete(principal, draft.id, completion)).toEqual(result);
    expect(await db.workflowCompletion.count({ where: { workflowId: draft.id } })).toBe(1);
  }, 120000);
});
