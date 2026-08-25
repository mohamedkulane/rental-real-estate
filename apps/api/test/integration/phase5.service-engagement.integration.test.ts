import { randomUUID } from 'node:crypto';
import { PrismaClient, ServiceEngagementStatus, ServiceModel } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const databaseUrl = process.env.DATABASE_URL ?? '';

describe.skipIf(!databaseUrl)('Phase 5.1 native Service Engagement integrity', () => {
  let database: PrismaClient;
  let companyId = '';
  let companyPartyId = '';
  let externalOwnerId = '';
  let branchId = '';
  let userId = '';

  beforeAll(async () => {
    database = new PrismaClient({ datasourceUrl: databaseUrl });
    const company = await database.company.findFirstOrThrow({ include: { legalParty: true } });
    companyId = company.id;
    companyPartyId = company.legalPartyId!;
    branchId = (await database.branch.findFirstOrThrow({ where: { companyId } })).id;
    userId = (
      await database.user.findFirstOrThrow({
        where: { employee: { companyId } },
      })
    ).id;
    externalOwnerId = (
      await database.ownerProfile.findFirstOrThrow({
        where: { party: { companyId }, partyId: { not: companyPartyId }, status: 'ACTIVE' },
      })
    ).partyId;
  });

  afterAll(async () => database?.$disconnect());

  async function activeProperty(ownerPartyId = companyPartyId) {
    const id = randomUUID();
    const from = new Date('2026-01-01');
    return database.property.create({
      data: {
        id,
        companyId,
        propertyCode: `P5I-${id.slice(0, 8)}`,
        name: 'Phase 5.1 integrity Property',
        propertyType: 'HOUSE',
        status: 'ACTIVE',
        city: 'Mogadishu',
        branchAssignments: { create: { id: randomUUID(), branchId, effectiveFrom: from } },
        propertyLifecycleHistories: {
          create: {
            id: randomUUID(),
            status: 'ACTIVE',
            effectiveFrom: from,
            reason: 'Phase 5.1 integration fixture',
            actorUserId: userId,
          },
        },
        ownerships: {
          create: {
            id: randomUUID(),
            ownerPartyId,
            ownershipPercent: '100',
            effectiveFrom: from,
            entitlements: {
              create: {
                id: randomUUID(),
                payoutPercent: '100',
                effectiveFrom: from,
              },
            },
          },
        },
      },
    });
  }

  async function engagement(
    propertyId: string,
    model: ServiceModel,
    status: ServiceEngagementStatus = ServiceEngagementStatus.DRAFT,
  ) {
    return database.serviceEngagement.create({
      data: {
        id: randomUUID(),
        companyId,
        engagementNumber: `ENG-I-${randomUUID().slice(0, 12)}`,
        serviceModel: model,
        status,
        propertyId,
        effectiveFrom: new Date('2026-08-01'),
        effectiveTo: new Date('2027-08-01'),
        createdByUserId: userId,
      },
    });
  }

  it('rejects incompatible overlap but permits Sale Brokerage beside rental authority', async () => {
    const property = await activeProperty();
    await engagement(property.id, ServiceModel.FULL_MANAGEMENT, ServiceEngagementStatus.ACTIVE);
    await expect(
      engagement(property.id, ServiceModel.RENTAL_BROKERAGE, ServiceEngagementStatus.ACTIVE),
    ).rejects.toThrow(/incompatible active Service Engagement/i);
    await expect(
      engagement(property.id, ServiceModel.SALE_BROKERAGE, ServiceEngagementStatus.ACTIVE),
    ).resolves.toMatchObject({ status: ServiceEngagementStatus.ACTIVE });
  });

  it('requires actual effective Company Party ownership for Company Owned authority', async () => {
    const thirdPartyProperty = await activeProperty(externalOwnerId);
    await expect(
      engagement(thirdPartyProperty.id, ServiceModel.COMPANY_OWNED, ServiceEngagementStatus.ACTIVE),
    ).rejects.toThrow(/requires effective Property ownership by the Company Party/i);
  });

  it('serializes concurrent activation and allows only one incompatible winner', async () => {
    const property = await activeProperty();
    const first = await engagement(property.id, ServiceModel.FULL_MANAGEMENT);
    const second = await engagement(property.id, ServiceModel.RENTAL_BROKERAGE);
    const results = await Promise.allSettled(
      [first.id, second.id].map((id) =>
        database.serviceEngagement.update({
          where: { id },
          data: { status: ServiceEngagementStatus.ACTIVE },
        }),
      ),
    );
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });

  it('preserves activated policy and lifecycle history at the database boundary', async () => {
    const property = await activeProperty();
    const record = await engagement(
      property.id,
      ServiceModel.RENTAL_BROKERAGE,
      ServiceEngagementStatus.ACTIVE,
    );
    await expect(
      database.serviceEngagement.update({
        where: { id: record.id },
        data: { serviceModel: ServiceModel.FULL_MANAGEMENT },
      }),
    ).rejects.toThrow(/commercial policy are immutable/i);
    const history = await database.serviceEngagementHistory.create({
      data: {
        id: randomUUID(),
        serviceEngagementId: record.id,
        fromStatus: ServiceEngagementStatus.DRAFT,
        toStatus: ServiceEngagementStatus.ACTIVE,
        action: 'ACTIVATED',
        reason: 'Integration history fixture',
        actorUserId: userId,
      },
    });
    await expect(
      database.serviceEngagementHistory.update({
        where: { id: history.id },
        data: { reason: 'Attempted rewrite' },
      }),
    ).rejects.toThrow(/history is append-only/i);
  });
});
