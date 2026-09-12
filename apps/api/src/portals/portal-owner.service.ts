import { Injectable } from '@nestjs/common';
import {
  LeasePartyRole,
  LeaseStatus,
  MaintenanceRequestStatus,
  OwnerStatementStatus,
  PayoutStatus,
  ServiceEngagementStatus,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import { PortalAuthorizationService } from './portal-authorization.service';

@Injectable()
export class PortalOwnerService {
  constructor(
    private readonly db: DatabaseService,
    private readonly portalAuth: PortalAuthorizationService,
  ) {}

  async overview(principal: AuthenticatedPrincipal) {
    const ownerPartyId = this.portalAuth.assertOwner(principal);
    const propertyIds = await this.portalAuth.ownerPropertyIds(
      ownerPartyId,
      principal.companyId,
      principal.businessDate,
    );
    const [properties, statements, payouts, maintenance] = await Promise.all([
      this.db.property.findMany({
        where: { id: { in: propertyIds }, companyId: principal.companyId },
        select: {
          id: true,
          propertyCode: true,
          name: true,
          propertyType: true,
          status: true,
          ownerships: {
            where: { ownerPartyId },
            select: { ownershipPercent: true, effectiveFrom: true, effectiveTo: true },
          },
          branchAssignments: { select: { branch: { select: { id: true, code: true, name: true } } } },
        },
        orderBy: { name: 'asc' },
      }),
      this.db.ownerStatement.count({
        where: {
          companyId: principal.companyId,
          ownerPartyId,
          status: { in: [OwnerStatementStatus.ISSUED] },
        },
      }),
      this.db.ownerPayout.count({
        where: {
          companyId: principal.companyId,
          ownerPartyId,
          status: { in: [PayoutStatus.APPROVED, PayoutStatus.QUEUED, PayoutStatus.PAID] },
        },
      }),
      this.db.maintenanceRequest.count({
        where: {
          companyId: principal.companyId,
          propertyId: { in: propertyIds },
          status: {
            in: [
              MaintenanceRequestStatus.NEW,
              MaintenanceRequestStatus.TRIAGED,
              MaintenanceRequestStatus.ASSIGNED,
              MaintenanceRequestStatus.IN_PROGRESS,
              MaintenanceRequestStatus.ON_HOLD,
            ],
          },
        },
      }),
    ]);
    const engagements = propertyIds.length
      ? await this.db.serviceEngagement.findMany({
          where: {
            companyId: principal.companyId,
            propertyId: { in: propertyIds },
            status: ServiceEngagementStatus.ACTIVE,
          },
          select: {
            id: true,
            engagementNumber: true,
            serviceModel: true,
            propertyId: true,
            property: { select: { name: true } },
          },
        })
      : [];
    return {
      ownerPartyId,
      summary: {
        propertyCount: properties.length,
        activeServices: engagements.length,
        statements,
        pendingPayouts: payouts,
        openMaintenance: maintenance,
      },
      properties: properties.map((property) => ({
        id: property.id,
        propertyCode: property.propertyCode,
        name: property.name,
        propertyType: property.propertyType,
        status: property.status,
        ownershipShare: property.ownerships[0]?.ownershipPercent?.toString() ?? '0',
        branches: property.branchAssignments.map((row) => row.branch),
      })),
      services: engagements,
    };
  }

  async statements(principal: AuthenticatedPrincipal, limit = 25) {
    const ownerPartyId = this.portalAuth.assertOwner(principal);
    const items = await this.db.ownerStatement.findMany({
      where: {
        companyId: principal.companyId,
        ownerPartyId,
        status: { in: [OwnerStatementStatus.ISSUED] },
      },
      orderBy: [{ periodEnd: 'desc' }, { id: 'desc' }],
      take: limit,
      select: {
        id: true,
        statementNumber: true,
        periodStart: true,
        periodEnd: true,
        currency: true,
        status: true,
        property: { select: { id: true, name: true, propertyCode: true } },
      },
    });
    return {
      items: items.map((item) => ({
        ...item,
        closingBalance: null,
        openingBalance: null,
      })),
    };
  }

  async statementDetail(principal: AuthenticatedPrincipal, statementId: string) {
    const ownerPartyId = this.portalAuth.assertOwner(principal);
    await this.portalAuth.assertOwnerStatement(ownerPartyId, principal.companyId, statementId);
    const statement = await this.db.ownerStatement.findFirstOrThrow({
      where: { id: statementId, companyId: principal.companyId, ownerPartyId },
      include: {
        lines: { orderBy: { lineNo: 'asc' } },
        property: { select: { id: true, name: true, propertyCode: true } },
      },
    });
    const opening = statement.lines.find((line) => line.lineCode === 'OPENING_BALANCE');
    const closing = statement.lines.find((line) => line.lineCode === 'CLOSING_BALANCE');
    return {
      ...statement,
      openingBalance: opening?.amount.toString() ?? '0',
      closingBalance: closing?.amount.toString() ?? '0',
    };
  }

  async payouts(principal: AuthenticatedPrincipal, limit = 25) {
    const ownerPartyId = this.portalAuth.assertOwner(principal);
    const items = await this.db.ownerPayout.findMany({
      where: {
        companyId: principal.companyId,
        ownerPartyId,
        status: { in: [PayoutStatus.APPROVED, PayoutStatus.QUEUED, PayoutStatus.PAID, PayoutStatus.RECONCILED] },
      },
      orderBy: [{ periodEnd: 'desc' }, { id: 'desc' }],
      take: limit,
      select: {
        id: true,
        payoutNumber: true,
        periodEnd: true,
        netPayable: true,
        currency: true,
        status: true,
      },
    });
    return {
      items: items.map((item) => ({
        id: item.id,
        payoutNumber: item.payoutNumber,
        scheduledPayDate: item.periodEnd,
        amount: item.netPayable.toString(),
        currency: item.currency,
        status: item.status,
      })),
    };
  }

  async maintenance(principal: AuthenticatedPrincipal, limit = 25) {
    const ownerPartyId = this.portalAuth.assertOwner(principal);
    const propertyIds = await this.portalAuth.ownerPropertyIds(
      ownerPartyId,
      principal.companyId,
      principal.businessDate,
    );
    const items = await this.db.maintenanceRequest.findMany({
      where: { companyId: principal.companyId, propertyId: { in: propertyIds } },
      orderBy: [{ reportedAt: 'desc' }, { id: 'desc' }],
      take: limit,
      select: {
        id: true,
        requestNumber: true,
        title: true,
        status: true,
        priority: true,
        reportedAt: true,
        property: { select: { id: true, name: true, propertyCode: true } },
      },
    });
    return { items };
  }

  async activity(principal: AuthenticatedPrincipal, limit = 20) {
    const ownerPartyId = this.portalAuth.assertOwner(principal);
    const propertyIds = await this.portalAuth.ownerPropertyIds(
      ownerPartyId,
      principal.companyId,
      principal.businessDate,
    );
    const [maintenance, statements, payouts] = await Promise.all([
      this.db.maintenanceRequest.findMany({
        where: { companyId: principal.companyId, propertyId: { in: propertyIds } },
        orderBy: { reportedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          requestNumber: true,
          title: true,
          status: true,
          reportedAt: true,
        },
      }),
      this.db.ownerStatement.findMany({
        where: { companyId: principal.companyId, ownerPartyId },
        orderBy: { periodEnd: 'desc' },
        take: limit,
        select: {
          id: true,
          statementNumber: true,
          periodEnd: true,
          currency: true,
          status: true,
          lines: { where: { lineCode: 'CLOSING_BALANCE' }, select: { amount: true }, take: 1 },
        },
      }),
      this.db.ownerPayout.findMany({
        where: { companyId: principal.companyId, ownerPartyId },
        orderBy: { periodEnd: 'desc' },
        take: limit,
        select: {
          id: true,
          payoutNumber: true,
          periodEnd: true,
          netPayable: true,
          currency: true,
          status: true,
        },
      }),
    ]);
    return {
      items: [
        ...maintenance.map((row) => ({
          kind: 'MAINTENANCE',
          id: row.id,
          label: `${row.requestNumber} — ${row.title}`,
          status: row.status,
          occurredAt: row.reportedAt,
          linkPath: `/portal/owner/maintenance/${row.id}`,
        })),
        ...statements.map((row) => ({
          kind: 'OWNER_STATEMENT',
          id: row.id,
          label: row.statementNumber,
          status: row.status,
          occurredAt: row.periodEnd,
          linkPath: `/portal/owner/statements/${row.id}`,
        })),
        ...payouts.map((row) => ({
          kind: 'OWNER_PAYOUT',
          id: row.id,
          label: row.payoutNumber,
          status: row.status,
          occurredAt: row.periodEnd,
          linkPath: `/portal/owner/payouts/${row.id}`,
        })),
      ]
        .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())
        .slice(0, limit),
    };
  }

  async propertyOccupancy(principal: AuthenticatedPrincipal, propertyId: string) {
    const ownerPartyId = this.portalAuth.assertOwner(principal);
    await this.portalAuth.assertOwnerProperty(
      ownerPartyId,
      principal.companyId,
      principal.businessDate,
      propertyId,
    );
    const spaces = await this.db.rentableSpace.findMany({
      where: { propertyId },
      select: {
        id: true,
        spaceCode: true,
        name: true,
        status: true,
        leases: {
          where: { status: { in: [LeaseStatus.ACTIVE, LeaseStatus.SIGNED] } },
          select: {
            id: true,
            leaseNumber: true,
            leaseStartDate: true,
            leaseEndDate: true,
            rentAmount: true,
            currency: true,
            parties: {
              where: { role: LeasePartyRole.TENANT },
              select: { party: { select: { displayName: true } } },
            },
          },
        },
      },
    });
    return {
      propertyId,
      spaces: spaces.map((space) => ({
        id: space.id,
        spaceCode: space.spaceCode,
        name: space.name,
        status: space.status,
        activeLease: space.leases[0]
          ? {
              leaseNumber: space.leases[0].leaseNumber,
              tenantName: space.leases[0].parties[0]?.party.displayName ?? 'Tenant',
              leaseStartDate: space.leases[0].leaseStartDate,
              leaseEndDate: space.leases[0].leaseEndDate,
              rentAmount: space.leases[0].rentAmount.toString(),
              currency: space.leases[0].currency,
            }
          : null,
      })),
    };
  }
}
