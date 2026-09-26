import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

type DbClient = {
  $queryRaw: <T = unknown>(query: Prisma.Sql) => Promise<T>;
};

export const ACTIVE_RESIDENTIAL_TENANCY_MESSAGE =
  'This tenant already has an active residential lease. End the current tenancy before activating another.';

export async function assertActiveResidentialTenancyAvailable(
  db: DbClient,
  input: {
    companyId: string;
    rentableSpaceId: string;
    tenantPartyIds: readonly string[];
    excludeLeaseId: string;
  },
) {
  if (!input.tenantPartyIds.length) return;

  const [target] = await db.$queryRaw<Array<{ residential: boolean }>>(Prisma.sql`
    SELECT is_residential_rentable_space(${input.rentableSpaceId}::uuid) AS residential
  `);
  if (!target?.residential) return;

  const tenantPartyIds = [...new Set(input.tenantPartyIds)].sort();
  for (const partyId of tenantPartyIds) {
    await db.$queryRaw(Prisma.sql`
      SELECT TRUE AS acquired
      FROM (
        SELECT pg_advisory_xact_lock(
          hashtextextended('active-residential-tenancy:' || ${partyId}::text, 0)
        )
      ) AS tenant_lock
    `);
  }

  const conflicts = await db.$queryRaw<Array<{ leaseNumber: string }>>(Prisma.sql`
    SELECT l."leaseNumber"
    FROM "lease_parties" lp
    JOIN "leases" l ON l.id = lp."leaseId"
    WHERE lp.role = 'TENANT'
      AND lp."partyId" = ANY(ARRAY[${Prisma.join(tenantPartyIds)}]::uuid[])
      AND l."companyId" = ${input.companyId}::uuid
      AND l.status = 'ACTIVE'
      AND l.id <> ${input.excludeLeaseId}::uuid
      AND is_residential_rentable_space(l."rentableSpaceId")
    LIMIT 1
  `);
  if (conflicts.length) throw new ConflictException(ACTIVE_RESIDENTIAL_TENANCY_MESSAGE);
}

export function isActiveResidentialTenancyConstraint(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }
  return JSON.stringify(error.meta ?? {}).includes('active_residential_tenancies');
}
