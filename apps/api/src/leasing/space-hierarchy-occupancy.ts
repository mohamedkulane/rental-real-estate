import { ConflictException } from '@nestjs/common';
import { LeaseStatus, Prisma, ReservationStatus } from '@prisma/client';

type DbClient = {
  $queryRaw: <T = unknown>(query: Prisma.Sql) => Promise<T>;
  lease: {
    findFirst: (args: Prisma.LeaseFindFirstArgs) => Promise<{ id: string; leaseNumber: string } | null>;
  };
  reservation: {
    findFirst: (
      args: Prisma.ReservationFindFirstArgs,
    ) => Promise<{ id: string; reservationNumber: string } | null>;
  };
};

async function relatedSpaceIds(
  db: DbClient,
  spaceId: string,
  direction: 'ancestors' | 'descendants',
  at: Date,
): Promise<string[]> {
  const rows =
    direction === 'ancestors'
      ? await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          WITH RECURSIVE walk AS (
            SELECT h."parentSpaceId" AS id
            FROM rentable_space_parent_history h
            WHERE h."childSpaceId" = ${spaceId}::uuid
              AND h."effectiveFrom" <= ${at}::date
              AND (h."effectiveTo" IS NULL OR h."effectiveTo" > ${at}::date)
            UNION
            SELECT h."parentSpaceId"
            FROM rentable_space_parent_history h
            JOIN walk w ON w.id = h."childSpaceId"
            WHERE h."effectiveFrom" <= ${at}::date
              AND (h."effectiveTo" IS NULL OR h."effectiveTo" > ${at}::date)
          )
          SELECT id FROM walk
        `)
      : await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          WITH RECURSIVE walk AS (
            SELECT h."childSpaceId" AS id
            FROM rentable_space_parent_history h
            WHERE h."parentSpaceId" = ${spaceId}::uuid
              AND h."effectiveFrom" <= ${at}::date
              AND (h."effectiveTo" IS NULL OR h."effectiveTo" > ${at}::date)
            UNION
            SELECT h."childSpaceId"
            FROM rentable_space_parent_history h
            JOIN walk w ON w.id = h."parentSpaceId"
            WHERE h."effectiveFrom" <= ${at}::date
              AND (h."effectiveTo" IS NULL OR h."effectiveTo" > ${at}::date)
          )
          SELECT id FROM walk
        `);
  return rows.map((row) => row.id);
}

export async function assertHierarchyOccupancyAvailable(
  db: DbClient,
  input: {
    companyId: string;
    rentableSpaceId: string;
    businessDate: string;
    excludeLeaseId?: string;
  },
) {
  const at = new Date(`${input.businessDate}T00:00:00.000Z`);
  const [ancestors, descendants] = await Promise.all([
    relatedSpaceIds(db, input.rentableSpaceId, 'ancestors', at),
    relatedSpaceIds(db, input.rentableSpaceId, 'descendants', at),
  ]);

  if (ancestors.length) {
    const parentLease = await db.lease.findFirst({
      where: {
        companyId: input.companyId,
        rentableSpaceId: { in: ancestors },
        status: { in: [LeaseStatus.SIGNED, LeaseStatus.ACTIVE] },
        leaseStartDate: { lte: at },
        OR: [{ leaseEndDate: null }, { leaseEndDate: { gte: at } }],
        ...(input.excludeLeaseId ? { id: { not: input.excludeLeaseId } } : {}),
      },
      select: { id: true, leaseNumber: true },
    });
    if (parentLease) {
      throw new ConflictException(
        `This unit cannot be leased while parent unit lease ${parentLease.leaseNumber} is active.`,
      );
    }
  }

  if (descendants.length) {
    const childLease = await db.lease.findFirst({
      where: {
        companyId: input.companyId,
        rentableSpaceId: { in: descendants },
        status: { in: [LeaseStatus.SIGNED, LeaseStatus.ACTIVE] },
        leaseStartDate: { lte: at },
        OR: [{ leaseEndDate: null }, { leaseEndDate: { gte: at } }],
        ...(input.excludeLeaseId ? { id: { not: input.excludeLeaseId } } : {}),
      },
      select: { id: true, leaseNumber: true },
    });
    if (childLease) {
      throw new ConflictException(
        `This unit cannot be leased as a whole while room lease ${childLease.leaseNumber} is active.`,
      );
    }

    const childReservation = await db.reservation.findFirst({
      where: {
        companyId: input.companyId,
        rentableSpaceId: { in: descendants },
        status: ReservationStatus.ACTIVE,
        startsAt: { lte: at },
        expiresAt: { gt: at },
      },
      select: { id: true, reservationNumber: true },
    });
    if (childReservation) {
      throw new ConflictException(
        `This unit cannot be leased as a whole while room reservation ${childReservation.reservationNumber} is active.`,
      );
    }
  }

  if (ancestors.length) {
    const parentReservation = await db.reservation.findFirst({
      where: {
        companyId: input.companyId,
        rentableSpaceId: { in: ancestors },
        status: ReservationStatus.ACTIVE,
        startsAt: { lte: at },
        expiresAt: { gt: at },
      },
      select: { id: true, reservationNumber: true },
    });
    if (parentReservation) {
      throw new ConflictException(
        `This unit cannot be reserved while parent reservation ${parentReservation.reservationNumber} is active.`,
      );
    }
  }
}
