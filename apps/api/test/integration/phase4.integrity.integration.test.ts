import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const databaseUrl = process.env.DATABASE_URL ?? '';

describe.skipIf(!databaseUrl)('Phase 4 native data integrity', () => {
  let database: PrismaClient;
  let companyId = '';
  let branchId = '';
  let uploaderId = '';
  let hallTypeId = '';
  let roomTypeId = '';

  beforeAll(async () => {
    database = new PrismaClient({ datasourceUrl: databaseUrl });
    const company = await database.company.findFirstOrThrow();
    const branch = await database.branch.findFirstOrThrow({ where: { companyId: company.id } });
    const user = await database.user.findFirstOrThrow();
    companyId = company.id;
    branchId = branch.id;
    uploaderId = user.id;
    hallTypeId = (await database.rentableSpaceType.findFirstOrThrow({ where: { code: 'HALL' } }))
      .id;
    roomTypeId = (await database.rentableSpaceType.findFirstOrThrow({ where: { code: 'ROOM' } }))
      .id;
  });

  afterAll(async () => database?.$disconnect());

  async function draftProperty(label: string) {
    return database.property.create({
      data: {
        id: randomUUID(),
        companyId,
        propertyCode: `${label}-${randomUUID().slice(0, 7)}`,
        name: label,
        propertyType: 'HOUSE',
        status: 'DRAFT',
        city: 'Mogadishu',
        propertyLifecycleHistories: {
          create: {
            id: randomUUID(),
            status: 'DRAFT',
            effectiveFrom: new Date('2026-01-01'),
            reason: 'Integration draft baseline',
            actorUserId: uploaderId,
          },
        },
        branchAssignments: {
          create: { id: randomUUID(), branchId, effectiveFrom: new Date('2026-01-01') },
        },
      },
    });
  }

  async function space(propertyId: string, typeId: string, code: string, area: string) {
    return database.rentableSpace.create({
      data: {
        id: randomUUID(),
        propertyId,
        typeId,
        spaceCode: `${code}-${randomUUID().slice(0, 6)}`,
        name: code,
        status: 'ACTIVE',
        versions: {
          create: {
            id: randomUUID(),
            versionNo: 1,
            effectiveFrom: new Date('2026-01-01'),
            usableArea: area,
            areaUnit: 'SQM',
          },
        },
      },
    });
  }

  it('rejects activation until ownership, payout, owner status, and branch configuration are complete', async () => {
    const property = await draftProperty('Incomplete activation');
    await expect(
      database.$transaction(async (transaction) => {
        const activationDate = new Date(new Date().toISOString().slice(0, 10));
        await transaction.propertyLifecycleHistory.updateMany({
          where: { propertyId: property.id, effectiveTo: null },
          data: { effectiveTo: activationDate },
        });
        await transaction.propertyLifecycleHistory.create({
          data: {
            id: randomUUID(),
            propertyId: property.id,
            status: 'ACTIVE',
            effectiveFrom: activationDate,
            reason: 'Invalid activation proof',
            actorUserId: uploaderId,
          },
        });
        await transaction.property.update({
          where: { id: property.id },
          data: { status: 'ACTIVE' },
        });
      }),
    ).rejects.toThrow(/ownership must total 100/i);
    expect((await database.property.findUniqueOrThrow({ where: { id: property.id } })).status).toBe(
      'DRAFT',
    );
  });

  it('rejects overlapping effective branch assignments', async () => {
    const property = await draftProperty('Branch overlap');
    await expect(
      database.propertyBranchAssignment.create({
        data: {
          id: randomUUID(),
          propertyId: property.id,
          branchId,
          effectiveFrom: new Date('2026-06-01'),
        },
      }),
    ).rejects.toThrow();
  });

  it('rejects child area above parent area even when writes are performed directly', async () => {
    const property = await draftProperty('Area control');
    const parent = await space(property.id, hallTypeId, 'Parent', '100');
    await expect(
      database.$transaction(async (transaction) => {
        const child = await transaction.rentableSpace.create({
          data: {
            id: randomUUID(),
            propertyId: property.id,
            typeId: roomTypeId,
            spaceCode: `Oversize-${randomUUID().slice(0, 6)}`,
            name: 'Oversized child',
            status: 'ACTIVE',
            versions: {
              create: {
                id: randomUUID(),
                versionNo: 1,
                effectiveFrom: new Date('2026-01-01'),
                usableArea: '101',
                areaUnit: 'SQM',
              },
            },
          },
        });
        await transaction.rentableSpaceParentHistory.create({
          data: {
            id: randomUUID(),
            childSpaceId: child.id,
            parentSpaceId: parent.id,
            effectiveFrom: new Date('2026-01-01'),
          },
        });
      }),
    ).rejects.toThrow(/exceeds parent usable area/i);
  });

  it('rejects hierarchy cycles and cross-property parents at the database boundary', async () => {
    const firstProperty = await draftProperty('Hierarchy one');
    const secondProperty = await draftProperty('Hierarchy two');
    const parent = await space(firstProperty.id, hallTypeId, 'Root', '100');
    const child = await space(firstProperty.id, roomTypeId, 'Child', '40');
    const external = await space(secondProperty.id, hallTypeId, 'External', '100');
    const initialRelation = await database.rentableSpaceParentHistory.create({
      data: {
        id: randomUUID(),
        childSpaceId: child.id,
        parentSpaceId: parent.id,
        effectiveFrom: new Date('2026-01-01'),
      },
    });
    await expect(
      database.rentableSpaceParentHistory.create({
        data: {
          id: randomUUID(),
          childSpaceId: parent.id,
          parentSpaceId: child.id,
          effectiveFrom: new Date('2026-01-01'),
        },
      }),
    ).rejects.toThrow(/cycle/i);
    await database.rentableSpaceParentHistory.update({
      where: { id: initialRelation.id },
      data: { effectiveTo: new Date('2027-01-01') },
    });
    await expect(
      database.rentableSpaceParentHistory.create({
        data: {
          id: randomUUID(),
          childSpaceId: child.id,
          parentSpaceId: external.id,
          effectiveFrom: new Date('2027-01-01'),
        },
      }),
    ).rejects.toThrow(/same Property/i);
  });

  it('serializes concurrent child allocations and preserves the parent area invariant', async () => {
    const property = await draftProperty('Concurrent area control');
    const parent = await space(property.id, hallTypeId, 'Concurrent parent', '100');
    const firstChild = await space(property.id, roomTypeId, 'Concurrent child one', '60');
    const secondChild = await space(property.id, roomTypeId, 'Concurrent child two', '60');
    const effectiveFrom = new Date('2026-01-01');

    const results = await Promise.allSettled(
      [firstChild.id, secondChild.id].map((childSpaceId) =>
        database.$transaction((transaction) =>
          transaction.rentableSpaceParentHistory.create({
            data: {
              id: randomUUID(),
              childSpaceId,
              parentSpaceId: parent.id,
              effectiveFrom,
            },
          }),
        ),
      ),
    );

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(
      await database.rentableSpaceParentHistory.count({
        where: { parentSpaceId: parent.id, effectiveFrom },
      }),
    ).toBe(1);
  });

  it('allows only one winner for a concurrent duplicate business number', async () => {
    const propertyCode = `CONCURRENT-${randomUUID().slice(0, 8)}`;
    const createProperty = (name: string) =>
      database.property.create({
        data: {
          id: randomUUID(),
          companyId,
          propertyCode,
          name,
          propertyType: 'HOUSE',
          status: 'DRAFT',
          city: 'Mogadishu',
          propertyLifecycleHistories: {
            create: {
              id: randomUUID(),
              status: 'DRAFT',
              effectiveFrom: new Date('2026-01-01'),
              reason: 'Concurrent business-number proof',
              actorUserId: uploaderId,
            },
          },
          branchAssignments: {
            create: { id: randomUUID(), branchId, effectiveFrom: new Date('2026-01-01') },
          },
        },
      });

    const results = await Promise.allSettled([
      createProperty('Concurrent property one'),
      createProperty('Concurrent property two'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await database.property.count({ where: { companyId, propertyCode } })).toBe(1);
  });
  it('preserves document versions as immutable evidence', async () => {
    const documentId = randomUUID();
    const versionId = randomUUID();
    await database.document.create({
      data: {
        id: documentId,
        companyId,
        displayName: 'Title document',
        categoryCode: 'TITLE',
        accessClass: 'RESTRICTED',
        status: 'ACTIVE',
        versions: {
          create: {
            id: versionId,
            sequence: 1,
            storageKey: `documents/${documentId}/1`,
            originalFilename: 'integrity-document.pdf',
            checksum: '0123456789abcdef',
            mimeType: 'application/pdf',
            sizeBytes: 128,
            uploadedByUserId: uploaderId,
          },
        },
      },
    });
    await expect(
      database.documentVersion.update({
        where: { id: versionId },
        data: { checksum: 'fedcba9876543210' },
      }),
    ).rejects.toThrow(/immutable/i);
    await expect(database.documentVersion.delete({ where: { id: versionId } })).rejects.toThrow(
      /immutable/i,
    );
  });
});
