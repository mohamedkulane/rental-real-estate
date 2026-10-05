import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { PrismaClient, ServiceEngagementStatus, ServiceModel } from '@prisma/client';
import { uuidv7 } from '@rerms/shared';
import { parseApiEnvironment } from '@rerms/config';
import { nextRecordNumber } from '../apps/api/src/common/record-number';

loadEnvFile(resolve(__dirname, '../.env'));
const environment = parseApiEnvironment(process.env);
const apply = process.argv.includes('--apply');
const database = new PrismaClient({ datasourceUrl: environment.DATABASE_URL });

const onboardingNote = new Set([
  'Created from full management onboarding.',
  'Created from rental brokerage onboarding.',
]);

function provenWholePropertyOnboarding(notes: string | null): boolean {
  if (!notes) return false;
  if (onboardingNote.has(notes.trim())) return true;
  try {
    const parsed = JSON.parse(notes) as { source?: unknown };
    return (
      parsed.source === 'simplified-full-management' ||
      parsed.source === 'simplified-rental-brokerage'
    );
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const candidates = await database.serviceEngagement.findMany({
    where: {
      serviceModel: { in: [ServiceModel.FULL_MANAGEMENT, ServiceModel.RENTAL_BROKERAGE] },
      status: ServiceEngagementStatus.ACTIVE,
      rentableSpaceId: { not: null },
    },
    include: {
      property: {
        select: {
          propertyCode: true,
          name: true,
          branchAssignments: {
            where: { effectiveTo: null },
            select: { branchId: true },
            orderBy: { effectiveFrom: 'desc' },
            take: 1,
          },
        },
      },
      rentableSpace: { select: { spaceCode: true, name: true } },
      commercialTerms: true,
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const proven = candidates.filter((record) => provenWholePropertyOnboarding(record.notes));
  console.log(
    JSON.stringify(
      {
        mode: apply ? 'APPLY' : 'DRY_RUN',
        reviewedUnitScopedRecords: candidates.length,
        provenWholePropertyRecords: proven.length,
        records: proven.map((record) => ({
          engagementNumber: record.engagementNumber,
          serviceModel: record.serviceModel,
          property: `${record.property.propertyCode} — ${record.property.name}`,
          oldUnit: record.rentableSpace
            ? `${record.rentableSpace.spaceCode} — ${record.rentableSpace.name}`
            : null,
          proof: record.notes,
        })),
      },
      null,
      2,
    ),
  );
  if (!apply || !proven.length) return;
  for (const record of proven) {
    await database.$transaction(async (tx) => {
      const repairDate = new Date();
      repairDate.setUTCHours(0, 0, 0, 0);
      if (repairDate < record.effectiveFrom) repairDate.setTime(record.effectiveFrom.getTime());
      const existingReplacement = await tx.serviceEngagement.findFirst({
        where: {
          companyId: record.companyId,
          propertyId: record.propertyId,
          rentableSpaceId: null,
          serviceModel: record.serviceModel,
          status: ServiceEngagementStatus.ACTIVE,
          notes: { contains: `authority-repair:${record.id}` },
        },
        select: { id: true },
      });
      if (existingReplacement) return;
      const changed = await tx.serviceEngagement.updateMany({
        where: {
          id: record.id,
          status: ServiceEngagementStatus.ACTIVE,
          rentableSpaceId: record.rentableSpaceId,
        },
        data: {
          status: ServiceEngagementStatus.INACTIVE,
          ...(repairDate > record.effectiveFrom ? { effectiveTo: repairDate } : {}),
          version: { increment: 1 },
        },
      });
      if (!changed.count) return;
      await tx.serviceEngagementHistory.create({
        data: {
          id: uuidv7(),
          serviceEngagementId: record.id,
          fromStatus: ServiceEngagementStatus.ACTIVE,
          toStatus: ServiceEngagementStatus.INACTIVE,
          action: 'AUTHORITY_REPAIR',
          reason: 'Superseded by proven whole-property onboarding authority repair.',
          actorUserId: record.createdByUserId,
        },
      });
      const replacementId = uuidv7();
      const replacement = await tx.serviceEngagement.create({
        data: {
          id: replacementId,
          companyId: record.companyId,
          engagementNumber: await nextRecordNumber(tx, 'ENGAGEMENT'),
          serviceModel: record.serviceModel,
          status: ServiceEngagementStatus.ACTIVE,
          propertyId: record.propertyId,
          rentableSpaceId: null,
          effectiveFrom: repairDate,
          effectiveTo: record.effectiveTo,
          notes: `${record.notes ?? ''}\nauthority-repair:${record.id}`.trim(),
          createdByUserId: record.createdByUserId,
          version: 1,
        },
      });
      await tx.serviceEngagementHistory.create({
        data: {
          id: uuidv7(),
          serviceEngagementId: replacementId,
          fromStatus: null,
          toStatus: ServiceEngagementStatus.ACTIVE,
          action: 'AUTHORITY_REPAIR',
          reason: `Replaces ${record.engagementNumber} with property-level authority.`,
          actorUserId: record.createdByUserId,
        },
      });
      if (record.commercialTerms) {
        await tx.serviceEngagementCommercialTerms.create({
          data: {
            id: uuidv7(),
            serviceEngagementId: replacementId,
            managementFeePercent: record.commercialTerms.managementFeePercent,
            commissionPercent: record.commercialTerms.commissionPercent,
            commissionMethod: record.commercialTerms.commissionMethod,
            billingDayOfMonth: record.commercialTerms.billingDayOfMonth,
            effectiveFrom: repairDate,
            effectiveTo: record.commercialTerms.effectiveTo,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          id: uuidv7(),
          action: 'service-engagement.authority-repaired',
          entityType: 'ServiceEngagement',
          entityId: record.id,
          branchId: record.property.branchAssignments[0]?.branchId ?? null,
          reason:
            'Repair proven whole-property onboarding authority created by the historical first-unit bug.',
          beforeSnapshot: {
            rentableSpaceId: record.rentableSpaceId,
            proof: record.notes,
          },
          afterSnapshot: {
            status: ServiceEngagementStatus.INACTIVE,
            effectiveTo:
              repairDate > record.effectiveFrom
                ? repairDate.toISOString().slice(0, 10)
                : (record.effectiveTo?.toISOString().slice(0, 10) ?? null),
            replacementEngagementId: replacement.id,
            replacementEngagementNumber: replacement.engagementNumber,
            replacementRentableSpaceId: null,
          },
        },
      });
    });
  }
  console.log(
    `Replaced ${proven.length} proven whole-property engagement record(s) without overwriting history.`,
  );
}

void main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Authority repair failed.');
    process.exitCode = 1;
  })
  .finally(async () => database.$disconnect());
