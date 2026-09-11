import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';

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

type HistoricalChange = 'TRANSFERRED' | 'DEACTIVATED' | 'REASSIGNED';

async function historicalFollowUp(change: HistoricalChange, includeSecondTask = false) {
  const leadId = await createRentLead(`LEAD-${Date.now()}${Math.floor(Math.random() * 100000)}`);
  const destination = await database.branch.findFirstOrThrow({
    where: { companyId: fixture.companyId, id: { not: fixture.branchId } },
  });
  const employeeParty = await database.party.create({
    data: {
      id: randomUUID(),
      companyId: fixture.companyId,
      partyNumber: `TEST-${randomUUID().slice(0, 30)}`,
      kind: 'PERSON',
      displayName: 'Historical task employee',
    },
  });
  const yesterday = new Date(new Date().toISOString().slice(0, 10));
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const today = new Date(new Date().toISOString().slice(0, 10));
  const employee = await database.employee.create({
    data: {
      id: randomUUID(),
      companyId: fixture.companyId,
      partyId: employeeParty.id,
      employeeNumber: `TEST-${randomUUID().slice(0, 30)}`,
      accessMode: 'BRANCH',
      branchAssignments: {
        create: { id: randomUUID(), branchId: fixture.branchId, effectiveFrom: yesterday },
      },
    },
  });
  const followUp = await database.leadFollowUp.create({
    data: {
      id: randomUUID(),
      leadId,
      branchId: fixture.branchId,
      responsibleEmployeeId: employee.id,
      subject: 'Historical scope task',
      dueAt: new Date(Date.now() + 86400000),
      createdByUserId: fixture.userId,
    },
  });
  const secondFollowUp = includeSecondTask
    ? await database.leadFollowUp.create({
        data: {
          id: randomUUID(),
          leadId,
          branchId: fixture.branchId,
          responsibleEmployeeId: employee.id,
          subject: 'Second historical scope task',
          dueAt: followUp.dueAt,
          createdByUserId: fixture.userId,
        },
      })
    : null;
  if (change === 'TRANSFERRED') {
    const transferredAt = new Date(Date.now() + 1);
    await database.$transaction(async (tx) => {
      await tx.leadBranchHistory.updateMany({
        where: { leadId, assignedTo: null },
        data: { assignedTo: transferredAt },
      });
      await tx.leadBranchHistory.create({
        data: {
          id: randomUUID(),
          leadId,
          branchId: destination.id,
          assignedFrom: transferredAt,
          actorUserId: fixture.userId,
          reason: 'Prospective transfer regression',
        },
      });
      await tx.lead.update({
        where: { id: leadId },
        data: { responsibleBranchId: destination.id, version: { increment: 1 } },
      });
    });
  } else if (change === 'DEACTIVATED') {
    await database.employee.update({ where: { id: employee.id }, data: { active: false } });
  } else {
    await database.$transaction(async (tx) => {
      await tx.employeeBranchAssignment.updateMany({
        where: { employeeId: employee.id, effectiveTo: null },
        data: { effectiveTo: today },
      });
      await tx.employeeBranchAssignment.create({
        data: {
          id: randomUUID(),
          employeeId: employee.id,
          branchId: destination.id,
          effectiveFrom: today,
        },
      });
    });
  }
  return { leadId, followUp, secondFollowUp, employee, destination };
}

async function resolveFollowUp(
  tx: Prisma.TransactionClient,
  followUpId: string,
  state: 'COMPLETED' | 'CANCELLED',
  reason = 'Resolved historical task',
) {
  const current = await tx.leadFollowUp.findUniqueOrThrow({ where: { id: followUpId } });
  const occurredAt = new Date();
  await tx.leadFollowUp.update({
    where: { id: followUpId, version: current.version },
    data: {
      state,
      outcomeActorUserId: fixture.userId,
      outcomeAt: occurredAt,
      outcomeReason: reason,
      version: { increment: 1 },
    },
  });
  await tx.leadFollowUpOutcome.create({
    data: {
      id: randomUUID(),
      followUpId,
      fromState: 'OPEN',
      toState: state,
      actorUserId: fixture.userId,
      reason,
      followUpVersion: current.version + 1,
      occurredAt,
    },
  });
}

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
    const source = await database.leadSource.findFirstOrThrow({
      where: { companyId: company.id, code: 'REFERRAL' },
    });
    const employee = await database.employee.findFirstOrThrow({
      where: {
        companyId: company.id,
        employeeNumber: 'EMP-0001',
        active: true,
        userId: { not: null },
      },
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

  describe.each<HistoricalChange>(['TRANSFERRED', 'DEACTIVATED', 'REASSIGNED'])(
    'P502-DB-001: %s',
    (change) => {
      it.each(['COMPLETED', 'CANCELLED'] as const)(
        'allows %s without rewriting historical snapshots',
        async (state) => {
          const { followUp } = await historicalFollowUp(change);
          await database.$transaction((tx) => resolveFollowUp(tx, followUp.id, state));
          const resolved = await database.leadFollowUp.findUniqueOrThrow({
            where: { id: followUp.id },
            include: { outcomeHistory: true },
          });
          expect(resolved).toMatchObject({
            state,
            version: 2,
            branchId: followUp.branchId,
            responsibleEmployeeId: followUp.responsibleEmployeeId,
          });
          expect(resolved.outcomeHistory).toHaveLength(1);
        },
      );

      it('allows a versioned open reschedule', async () => {
        const { followUp } = await historicalFollowUp(change);
        const dueAt = new Date(followUp.dueAt.getTime() + 86400000);
        await database.leadFollowUp.update({
          where: { id: followUp.id, version: 1 },
          data: { dueAt, version: { increment: 1 } },
        });
        const stale = await database.leadFollowUp.updateMany({
          where: { id: followUp.id, version: 1 },
          data: { dueAt: followUp.dueAt, version: { increment: 1 } },
        });
        expect(stale.count).toBe(0);
        await expect(
          database.leadFollowUp.update({
            where: { id: followUp.id },
            data: { dueAt: followUp.dueAt, version: 2 },
          }),
        ).rejects.toThrow(/version by exactly one/u);
        await expect(
          database.leadFollowUp.findUniqueOrThrow({ where: { id: followUp.id } }),
        ).resolves.toMatchObject({
          state: 'OPEN',
          version: 2,
          dueAt,
          branchId: followUp.branchId,
          responsibleEmployeeId: followUp.responsibleEmployeeId,
        });
      });

      it('atomically cancels existing tasks when the Lead becomes LOST', async () => {
        const { leadId, followUp } = await historicalFollowUp(change);
        await database.$transaction(async (tx) => {
          const lead = await tx.lead.update({
            where: { id: leadId },
            data: { stage: 'LOST', lostReason: 'NO_LONGER_INTERESTED', version: { increment: 1 } },
          });
          await tx.leadStageHistory.create({
            data: {
              id: randomUUID(),
              leadId,
              fromStage: 'NEW',
              toStage: 'LOST',
              actorUserId: fixture.userId,
              leadVersion: lead.version,
            },
          });
          await resolveFollowUp(tx, followUp.id, 'CANCELLED', 'SYSTEM_LEAD_TERMINAL');
        });
        await expect(
          database.lead.findUniqueOrThrow({ where: { id: leadId } }),
        ).resolves.toMatchObject({ stage: 'LOST' });
        await expect(
          database.leadFollowUp.findUniqueOrThrow({ where: { id: followUp.id } }),
        ).resolves.toMatchObject({
          state: 'CANCELLED',
          outcomeReason: 'SYSTEM_LEAD_TERMINAL',
          branchId: followUp.branchId,
        });
      });

      it('still rejects a new task with stale Branch or ineligible employee', async () => {
        const { leadId, followUp } = await historicalFollowUp(change);
        await expect(
          database.leadFollowUp.create({
            data: {
              id: randomUUID(),
              leadId,
              branchId: followUp.branchId,
              responsibleEmployeeId: followUp.responsibleEmployeeId,
              subject: 'Invalid new task',
              dueAt: followUp.dueAt,
              createdByUserId: fixture.userId,
            },
          }),
        ).rejects.toThrow(/Branch snapshot|must be active/u);
      });
    },
  );

  it('preserves stale-version, immutable snapshot, terminal and history protections after transfer', async () => {
    const { followUp, destination } = await historicalFollowUp('TRANSFERRED');
    await expect(
      database.leadFollowUp.update({
        where: { id: followUp.id },
        data: { subject: 'Unversioned mutation' },
      }),
    ).rejects.toThrow(/version by exactly one/u);
    await expect(
      database.leadFollowUp.update({
        where: { id: followUp.id },
        data: { branchId: destination.id, version: 2 },
      }),
    ).rejects.toThrow(/immutable/u);
    await expect(
      database.leadFollowUp.update({
        where: { id: followUp.id },
        data: { responsibleEmployeeId: fixture.employeeId, version: 2 },
      }),
    ).rejects.toThrow(/immutable/u);
    await expect(
      database.leadFollowUp.update({
        where: { id: followUp.id },
        data: {
          state: 'COMPLETED',
          outcomeActorUserId: fixture.userId,
          outcomeAt: new Date(),
          outcomeReason: 'Missing history',
          version: 2,
        },
      }),
    ).rejects.toThrow(/append-only outcome history/u);
    await database.$transaction((tx) => resolveFollowUp(tx, followUp.id, 'COMPLETED'));
    await expect(
      database.leadFollowUp.update({
        where: { id: followUp.id },
        data: {
          state: 'OPEN',
          outcomeActorUserId: null,
          outcomeAt: null,
          outcomeReason: null,
          version: 3,
        },
      }),
    ).rejects.toThrow(/cannot be changed or reopened/u);
    await expect(
      database.leadFollowUp.update({
        where: { id: followUp.id },
        data: { outcomeReason: 'Rewrite outcome', version: 3 },
      }),
    ).rejects.toThrow(/cannot be changed or reopened/u);
    await expect(
      database.leadFollowUpOutcome.updateMany({
        where: { followUpId: followUp.id },
        data: { reason: 'Rewrite history' },
      }),
    ).rejects.toThrow(/append-only/u);
  });

  it('rolls back terminal closure and all tasks when one outcome history is missing', async () => {
    const { leadId, followUp, secondFollowUp } = await historicalFollowUp('TRANSFERRED', true);
    if (!secondFollowUp) throw new Error('Second task fixture missing');
    await expect(
      database.$transaction(async (tx) => {
        const lead = await tx.lead.update({
          where: { id: leadId },
          data: { stage: 'LOST', lostReason: 'NO_LONGER_INTERESTED', version: { increment: 1 } },
        });
        await tx.leadStageHistory.create({
          data: {
            id: randomUUID(),
            leadId,
            fromStage: 'NEW',
            toStage: 'LOST',
            actorUserId: fixture.userId,
            leadVersion: lead.version,
          },
        });
        await resolveFollowUp(tx, followUp.id, 'CANCELLED', 'SYSTEM_LEAD_TERMINAL');
        await tx.leadFollowUp.update({
          where: { id: secondFollowUp.id, version: 1 },
          data: {
            state: 'CANCELLED',
            outcomeActorUserId: fixture.userId,
            outcomeAt: new Date(),
            outcomeReason: 'SYSTEM_LEAD_TERMINAL',
            version: 2,
          },
        });
      }),
    ).rejects.toThrow(/append-only outcome history/u);
    await expect(database.lead.findUniqueOrThrow({ where: { id: leadId } })).resolves.toMatchObject(
      { stage: 'NEW', version: 2, lostReason: null },
    );
    expect(await database.leadStageHistory.count({ where: { leadId } })).toBe(1);
    const tasks = await database.leadFollowUp.findMany({
      where: { leadId },
      include: { outcomeHistory: true },
    });
    expect(tasks).toHaveLength(2);
    for (const task of tasks)
      expect(task).toMatchObject({
        state: 'OPEN',
        version: 1,
        outcomeReason: null,
        outcomeHistory: [],
        branchId: followUp.branchId,
      });
  });

  it('allows a linked successor at the current destination without rewriting its predecessor', async () => {
    const { leadId, followUp, destination } = await historicalFollowUp('TRANSFERRED');
    await database.$transaction((tx) => resolveFollowUp(tx, followUp.id, 'COMPLETED'));
    const successor = await database.leadFollowUp.create({
      data: {
        id: randomUUID(),
        leadId,
        branchId: destination.id,
        responsibleEmployeeId: fixture.employeeId,
        subject: 'Destination successor',
        dueAt: new Date(Date.now() + 86400000),
        createdByUserId: fixture.userId,
        predecessorFollowUpId: followUp.id,
      },
    });
    expect(successor).toMatchObject({
      state: 'OPEN',
      branchId: destination.id,
      predecessorFollowUpId: followUp.id,
    });
    await expect(
      database.leadFollowUp.findUniqueOrThrow({ where: { id: followUp.id } }),
    ).resolves.toMatchObject({
      state: 'COMPLETED',
      branchId: followUp.branchId,
      responsibleEmployeeId: followUp.responsibleEmployeeId,
    });
  });
});
