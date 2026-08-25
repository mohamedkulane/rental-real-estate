import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

const database = new PrismaClient();

type Fixture = {
  companyId: string;
  branchId: string;
  sourceId: string;
  userId: string;
  employeeId: string;
  partyId: string;
};

let fixture: Fixture;

async function createRentLead(leadNumber: string): Promise<string> {
  const leadId = randomUUID();
  const preferenceId = randomUUID();
  const occurredAt = new Date();

  await database.$transaction(async (transaction) => {
    await transaction.$executeRaw`
      INSERT INTO "leads" (
        "id", "companyId", "leadNumber", "intent", "stage", "sourceId",
        "responsibleBranchId", "partyId", "displayName", "createdByUserId"
      ) VALUES (
        ${leadId}::uuid, ${fixture.companyId}::uuid, ${leadNumber}, 'RENT'::"LeadIntent",
        'NEW'::"LeadStage", ${fixture.sourceId}::uuid, ${fixture.branchId}::uuid,
        ${fixture.partyId}::uuid, 'CRM database test Lead', ${fixture.userId}::uuid
      )`;
    await transaction.$executeRaw`
      INSERT INTO "lead_preference_versions" (
        "id", "leadId", "intent", "versionNo", "preferredAreaText",
        "effectiveFrom", "actorUserId", "reason"
      ) VALUES (
        ${preferenceId}::uuid, ${leadId}::uuid, 'RENT'::"LeadIntent", 1,
        ARRAY['Mogadishu']::text[], ${occurredAt}, ${fixture.userId}::uuid,
        'Database integration fixture'
      )`;
    await transaction.$executeRaw`
      INSERT INTO "rent_lead_preferences" ("preferenceVersionId", "maxRent", "currency", "rentPeriod", "moveInDate")
      VALUES (${preferenceId}::uuid, 1000, 'USD', 'MONTHLY'::"LeadRentPeriod", CURRENT_DATE)`;
    await transaction.$executeRaw`
      INSERT INTO "lead_stage_history" ("id", "leadId", "toStage", "actorUserId", "leadVersion", "occurredAt")
      VALUES (${randomUUID()}::uuid, ${leadId}::uuid, 'NEW'::"LeadStage", ${fixture.userId}::uuid, 1, ${occurredAt})`;
    await transaction.$executeRaw`
      INSERT INTO "lead_branch_history" ("id", "leadId", "branchId", "assignedFrom", "actorUserId", "reason")
      VALUES (${randomUUID()}::uuid, ${leadId}::uuid, ${fixture.branchId}::uuid, ${occurredAt}, ${fixture.userId}::uuid, 'Database integration fixture')`;
  });

  return leadId;
}

describe('Phase 5.2 CRM PostgreSQL invariants', () => {
  beforeAll(async () => {
    const company = await database.company.findFirstOrThrow();
    const branch = await database.branch.findFirstOrThrow({ where: { companyId: company.id } });
    const source = await database.leadSource.findFirstOrThrow({ where: { companyId: company.id } });
    const employee = await database.employee.findFirstOrThrow({
      where: { companyId: company.id, active: true, userId: { not: null } },
    });
    const userId = employee.userId;
    if (!userId) throw new Error('Seeded CRM fixture employee must have a User');
    fixture = {
      companyId: company.id,
      branchId: branch.id,
      sourceId: source.id,
      userId,
      employeeId: employee.id,
      partyId: employee.partyId,
    };
  });

  afterAll(async () => database.$disconnect());

  it('seeds a complete Lead aggregate with matching current snapshots', async () => {
    const lead = await database.lead.findFirstOrThrow({
      where: { companyId: fixture.companyId, leadNumber: 'LEAD-000001' },
      include: {
        preferenceVersions: { where: { effectiveTo: null }, include: { rent: true } },
        assignments: { where: { assignedTo: null } },
        branchHistory: { where: { assignedTo: null } },
        stageHistory: true,
      },
    });

    expect(lead.currentAssigneeEmployeeId).toBe(fixture.employeeId);
    expect(lead.preferenceVersions).toHaveLength(1);
    expect(lead.preferenceVersions[0]?.intent).toBe('RENT');
    expect(lead.preferenceVersions[0]?.rent).not.toBeNull();
    expect(lead.assignments).toHaveLength(1);
    expect(lead.branchHistory).toHaveLength(1);
    expect(lead.branchHistory[0]?.branchId).toBe(lead.responsibleBranchId);
    expect(lead.stageHistory).toHaveLength(1);
  });

  it('applies the Security-owned CRM permission matrix exactly', async () => {
    const all = [
      'crm.activity.correct',
      'crm.activity.create',
      'crm.activity.read',
      'crm.assignment.manage',
      'crm.assignment.read',
      'crm.followup.cancel',
      'crm.followup.complete',
      'crm.followup.create',
      'crm.followup.read',
      'crm.followup.update',
      'crm.lead.branch.transfer',
      'crm.lead.contact.export',
      'crm.lead.contact.read',
      'crm.lead.create',
      'crm.lead.read',
      'crm.lead.stage',
      'crm.lead.update',
      'crm.source.manage',
      'crm.source.read',
    ];
    const without = (...excluded: string[]) => all.filter((code) => !excluded.includes(code));
    const expected: Record<string, string[]> = {
      SUPER_ADMIN: all,
      GENERAL_MANAGER: all,
      BRANCH_MANAGER: without('crm.source.manage', 'crm.lead.contact.export'),
      PROPERTY_MANAGER: without('crm.source.manage', 'crm.lead.contact.export'),
      LEASING_AGENT: without(
        'crm.activity.correct',
        'crm.assignment.manage',
        'crm.lead.branch.transfer',
        'crm.source.manage',
        'crm.lead.contact.export',
      ),
      RECEPTIONIST: [
        'crm.activity.create',
        'crm.activity.read',
        'crm.assignment.read',
        'crm.followup.create',
        'crm.followup.read',
        'crm.lead.contact.read',
        'crm.lead.create',
        'crm.lead.read',
        'crm.lead.update',
        'crm.source.read',
      ],
      ACCOUNTANT: [],
      MAINTENANCE_COORDINATOR: [],
      INSPECTOR: [],
    };
    const roles = await database.role.findMany({
      where: { companyId: fixture.companyId },
      include: { permissions: { include: { permission: true } } },
    });
    for (const [roleCode, expectedCodes] of Object.entries(expected)) {
      const role = roles.find(({ code }) => code === roleCode);
      expect(role, `missing seeded role ${roleCode}`).toBeDefined();
      const actual =
        role?.permissions
          .map(({ permission }) => permission.code)
          .filter((code) => code.startsWith('crm.'))
          .sort() ?? [];
      expect(actual).toEqual([...expectedCodes].sort());
    }
  });

  it('rejects an intent without its matching typed preference variant', async () => {
    const leadId = randomUUID();
    const preferenceId = randomUUID();
    await expect(
      database.$transaction(async (transaction) => {
        await transaction.$executeRaw`
          INSERT INTO "leads" ("id", "companyId", "leadNumber", "intent", "sourceId", "responsibleBranchId", "partyId", "displayName", "createdByUserId")
          VALUES (${leadId}::uuid, ${fixture.companyId}::uuid, ${`LEAD-${Date.now()}1`}, 'BUY'::"LeadIntent", ${fixture.sourceId}::uuid, ${fixture.branchId}::uuid, ${fixture.partyId}::uuid, 'Invalid typed preference', ${fixture.userId}::uuid)`;
        await transaction.$executeRaw`
          INSERT INTO "lead_preference_versions" ("id", "leadId", "intent", "versionNo", "preferredAreaText", "effectiveFrom", "actorUserId")
          VALUES (${preferenceId}::uuid, ${leadId}::uuid, 'BUY'::"LeadIntent", 1, ARRAY[]::text[], CURRENT_TIMESTAMP, ${fixture.userId}::uuid)`;
        await transaction.$executeRaw`
          INSERT INTO "rent_lead_preferences" ("preferenceVersionId") VALUES (${preferenceId}::uuid)`;
        await transaction.$executeRaw`
          INSERT INTO "lead_stage_history" ("id", "leadId", "toStage", "actorUserId", "leadVersion")
          VALUES (${randomUUID()}::uuid, ${leadId}::uuid, 'NEW'::"LeadStage", ${fixture.userId}::uuid, 1)`;
        await transaction.$executeRaw`
          INSERT INTO "lead_branch_history" ("id", "leadId", "branchId", "assignedFrom", "actorUserId", "reason")
          VALUES (${randomUUID()}::uuid, ${leadId}::uuid, ${fixture.branchId}::uuid, CURRENT_TIMESTAMP, ${fixture.userId}::uuid, 'Invalid fixture')`;
      }),
    ).rejects.toThrow(/typed variant matching its intent/u);
  });

  it('serializes concurrent attempts to open a second assignment interval', async () => {
    const leadId = await createRentLead(`LEAD-${Date.now()}2`);
    const assign = (assignmentId: string) =>
      database.$transaction(async (transaction) => {
        await transaction.$executeRaw`
          INSERT INTO "lead_assignments" ("id", "leadId", "employeeId", "branchId", "assignedFrom", "actorUserId", "reason")
          VALUES (${assignmentId}::uuid, ${leadId}::uuid, ${fixture.employeeId}::uuid, ${fixture.branchId}::uuid, CURRENT_TIMESTAMP, ${fixture.userId}::uuid, 'Concurrent assignment test')`;
        await transaction.$executeRaw`
          UPDATE "leads" SET "currentAssigneeEmployeeId" = ${fixture.employeeId}::uuid, "version" = "version" + 1 WHERE "id" = ${leadId}::uuid`;
      });

    const outcomes = await Promise.allSettled([assign(randomUUID()), assign(randomUUID())]);
    expect(outcomes.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    const openCount = await database.leadAssignment.count({ where: { leadId, assignedTo: null } });
    expect(openCount).toBe(1);
  });

  it('accepts the documented contact edge and rejects a lifecycle shortcut', async () => {
    const leadId = await createRentLead(`LEAD-${Date.now()}4`);
    await expect(
      database.$executeRaw`
        UPDATE "leads" SET "stage" = 'QUALIFIED'::"LeadStage", "version" = 2 WHERE "id" = ${leadId}::uuid`,
    ).rejects.toThrow(/Illegal Lead stage transition/u);

    await database.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        INSERT INTO "lead_activities" ("id", "leadId", "branchId", "type", "direction", "summary", "occurredAt", "recordedByUserId")
        VALUES (${randomUUID()}::uuid, ${leadId}::uuid, ${fixture.branchId}::uuid, 'CALL'::"LeadActivityType", 'OUTBOUND'::"LeadActivityDirection", 'Completed contact call', CURRENT_TIMESTAMP, ${fixture.userId}::uuid)`;
      await transaction.$executeRaw`
        UPDATE "leads" SET "stage" = 'CONTACTED'::"LeadStage", "version" = 2 WHERE "id" = ${leadId}::uuid`;
      await transaction.$executeRaw`
        INSERT INTO "lead_stage_history" ("id", "leadId", "fromStage", "toStage", "actorUserId", "leadVersion")
        VALUES (${randomUUID()}::uuid, ${leadId}::uuid, 'NEW'::"LeadStage", 'CONTACTED'::"LeadStage", ${fixture.userId}::uuid, 2)`;
    });

    await expect(database.lead.findUniqueOrThrow({ where: { id: leadId } })).resolves.toMatchObject(
      {
        stage: 'CONTACTED',
        version: 2,
      },
    );
  });

  it('prevents Activity overwrite and preserves correction-by-append', async () => {
    const leadId = await createRentLead(`LEAD-${Date.now()}3`);
    const activityId = randomUUID();
    await database.$executeRaw`
      INSERT INTO "lead_activities" ("id", "leadId", "branchId", "type", "direction", "summary", "occurredAt", "recordedByUserId")
      VALUES (${activityId}::uuid, ${leadId}::uuid, ${fixture.branchId}::uuid, 'NOTE'::"LeadActivityType", 'INTERNAL'::"LeadActivityDirection", 'Original factual note', CURRENT_TIMESTAMP, ${fixture.userId}::uuid)`;

    await expect(
      database.$executeRaw`UPDATE "lead_activities" SET "summary" = 'overwritten' WHERE "id" = ${activityId}::uuid`,
    ).rejects.toThrow(/append-only/u);

    await expect(
      database.$executeRaw`
        INSERT INTO "lead_activities" ("id", "leadId", "branchId", "type", "direction", "recordKind", "summary", "occurredAt", "recordedByUserId", "originalActivityId", "correctionReason")
        VALUES (${randomUUID()}::uuid, ${leadId}::uuid, ${fixture.branchId}::uuid, 'NOTE'::"LeadActivityType", 'INTERNAL'::"LeadActivityDirection", 'CORRECTION'::"LeadActivityRecordKind", 'Corrected factual note', CURRENT_TIMESTAMP, ${fixture.userId}::uuid, ${activityId}::uuid, 'Correcting the recorded fact')`,
    ).resolves.toBe(1);
  });

  it('requires append-only outcome history for a terminal Follow-up transition', async () => {
    const leadId = await createRentLead(`LEAD-${Date.now()}5`);
    const followUpId = randomUUID();
    await database.$executeRaw`
      INSERT INTO "lead_follow_ups" ("id", "leadId", "branchId", "responsibleEmployeeId", "subject", "dueAt", "createdByUserId")
      VALUES (${followUpId}::uuid, ${leadId}::uuid, ${fixture.branchId}::uuid, ${fixture.employeeId}::uuid, 'Confirm requirements', CURRENT_TIMESTAMP + INTERVAL '1 day', ${fixture.userId}::uuid)`;

    await expect(
      database.$executeRaw`
        UPDATE "lead_follow_ups" SET "state" = 'COMPLETED'::"LeadFollowUpState", "outcomeActorUserId" = ${fixture.userId}::uuid, "outcomeAt" = CURRENT_TIMESTAMP, "outcomeReason" = 'Completed test task', "version" = 2 WHERE "id" = ${followUpId}::uuid`,
    ).rejects.toThrow(/append-only outcome history/u);

    await database.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        UPDATE "lead_follow_ups" SET "state" = 'COMPLETED'::"LeadFollowUpState", "outcomeActorUserId" = ${fixture.userId}::uuid, "outcomeAt" = CURRENT_TIMESTAMP, "outcomeReason" = 'Completed test task', "version" = 2 WHERE "id" = ${followUpId}::uuid`;
      await transaction.$executeRaw`
        INSERT INTO "lead_follow_up_outcomes" ("id", "followUpId", "fromState", "toState", "actorUserId", "reason", "followUpVersion")
        VALUES (${randomUUID()}::uuid, ${followUpId}::uuid, 'OPEN'::"LeadFollowUpState", 'COMPLETED'::"LeadFollowUpState", ${fixture.userId}::uuid, 'Completed test task', 2)`;
    });

    const outcomes = await database.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*) AS count FROM "lead_follow_up_outcomes" WHERE "followUpId" = ${followUpId}::uuid`;
    expect(outcomes[0]?.count).toBe(1n);
  });
});
