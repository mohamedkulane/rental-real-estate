import { Injectable } from '@nestjs/common';
import {
  ApplicationStatus,
  AgreementStatus,
  ChargeStatus,
  LeasePossessionStatus,
  LeaseStatus,
  MaintenanceRequestStatus,
  PaymentStatus,
  PayoutStatus,
  Prisma,
  PropertyStatus,
  PropertyServiceIntent,
  RentableSpaceStatus,
  ReservationStatus,
  RenewalStatus,
  ViewingStatus,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';

@Injectable()
export class DashboardReadModelService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auth: AuthorizationService,
  ) {}

  private branchFilter(principal: AuthenticatedPrincipal, permission: string, branchId?: string) {
    if (branchId) {
      this.auth.assertBranchPermission(principal, permission, branchId);
      return { branchId };
    }
    const branchIds = this.auth.authorizedBranchIds(principal, permission);
    return branchIds === null ? {} : { branchId: { in: [...branchIds] } };
  }

  private propertyBranchFilter(principal: AuthenticatedPrincipal, branchId?: string) {
    if (branchId) {
      this.auth.assertBranchPermission(principal, 'portfolio.property.read', branchId);
      return { branchAssignments: { some: { branchId, effectiveTo: null } } };
    }
    const branchIds = this.auth.authorizedBranchIds(principal, 'portfolio.property.read');
    if (branchIds === null) return {};
    return { branchAssignments: { some: { branchId: { in: [...branchIds] } } } };
  }

  async summary(principal: AuthenticatedPrincipal, branchId?: string) {
    const companyId = principal.companyId;
    const branchFilter = this.branchFilter(principal, 'application.read', branchId);
    const propertyBranchFilter = this.propertyBranchFilter(principal, branchId);
    const leaseBranchFilter = this.branchFilter(principal, 'lease.read', branchId);
    const at = new Date(`${principal.businessDate}T00:00:00.000Z`);
    const tomorrow = new Date(at);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const monthStart = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
    const sixMonthsAgo = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() - 5, 1));
    const leaseHorizon = new Date(at);
    leaseHorizon.setUTCDate(leaseHorizon.getUTCDate() + 45);
    const inventoryWhere: Prisma.RentableSpaceWhereInput = {
      status: RentableSpaceStatus.ACTIVE,
      property: {
        companyId,
        status: PropertyStatus.ACTIVE,
        serviceIntent: {
          in: [PropertyServiceIntent.RENTAL_BROKERAGE, PropertyServiceIntent.FULL_MANAGEMENT],
        },
        ...propertyBranchFilter,
      },
      parentRelations: {
        none: {
          effectiveFrom: { lte: at },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
          child: { status: RentableSpaceStatus.ACTIVE },
        },
      },
    };
    const [
      totalProperties,
      rentableSpaces,
      occupiedUnits,
      availableUnits,
      activeTenants,
      activeLeases,
      openApplications,
      openMaintenance,
      monthlyRevenue,
      outstandingReceivables,
      upcomingRenewals,
      pendingOwnerPayouts,
      todayViewings,
      upcomingViewings,
      rentOutstanding,
      brokerageOutstanding,
      leasesEndingSoon,
      salesInProgress,
      paymentMethods,
    ] = await Promise.all([
      this.db.property.count({ where: { companyId, status: PropertyStatus.ACTIVE, ...propertyBranchFilter } }),
      this.db.rentableSpace.count({ where: inventoryWhere }),
      this.db.rentableSpace.count({
        where: {
          ...inventoryWhere,
          OR: [
            {
              leases: {
                some: {
                  status: { in: [LeaseStatus.SIGNED, LeaseStatus.ACTIVE] },
                  leaseStartDate: { lte: at },
                  OR: [{ leaseEndDate: null }, { leaseEndDate: { gte: at } }],
                },
              },
            },
            {
              leasePossessions: {
                some: {
                  status: LeasePossessionStatus.ACTIVE,
                  possessionFrom: { lte: at },
                  OR: [{ possessionTo: null }, { possessionTo: { gt: at } }],
                },
              },
            },
          ],
        },
      }),
      this.db.rentableSpace.count({
        where: {
          ...inventoryWhere,
          leases: {
            none: {
              status: { in: [LeaseStatus.SIGNED, LeaseStatus.ACTIVE] },
              leaseStartDate: { lte: at },
              OR: [{ leaseEndDate: null }, { leaseEndDate: { gte: at } }],
            },
          },
          leasePossessions: {
            none: {
              status: LeasePossessionStatus.ACTIVE,
              possessionFrom: { lte: at },
              OR: [{ possessionTo: null }, { possessionTo: { gt: at } }],
            },
          },
          reservations: {
            none: {
              status: ReservationStatus.ACTIVE,
              startsAt: { lte: at },
              expiresAt: { gt: at },
            },
          },
        },
      }),
      this.db.tenantProfile.count({ where: { companyId, status: 'ACTIVE' } }),
      this.db.lease.count({ where: { companyId, status: LeaseStatus.ACTIVE, ...leaseBranchFilter } }),
      this.db.rentalApplication.count({
        where: { companyId, ...branchFilter, status: { in: [ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW] } },
      }),
      this.db.maintenanceRequest.count({
        where: {
          companyId,
          ...this.branchFilter(principal, 'maintenance.read', branchId),
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
      this.db.payment.aggregate({
        where: {
          companyId,
          ...this.branchFilter(principal, 'payment.read', branchId),
          receivedAt: { gte: monthStart, lt: tomorrow },
          status: { in: [PaymentStatus.POSTED, PaymentStatus.VERIFIED, PaymentStatus.PARTIALLY_ALLOCATED] },
        },
        _sum: { amount: true },
      }),
      this.db.charge.aggregate({
        where: {
          companyId,
          ...this.branchFilter(principal, 'billing.read', branchId),
          status: { in: [ChargeStatus.OPEN, ChargeStatus.PARTIALLY_PAID] },
        },
        _sum: { outstandingAmount: true },
      }),
      this.db.leaseRenewal.count({
        where: {
          status: { in: [RenewalStatus.PROPOSED, RenewalStatus.APPROVED] },
          originalLease: { companyId, ...leaseBranchFilter },
        },
      }),
      this.db.ownerPayout.count({
        where: {
          companyId,
          ...this.branchFilter(principal, 'payout.read', branchId),
          status: { in: [PayoutStatus.DRAFT, PayoutStatus.REVIEW, PayoutStatus.APPROVED, PayoutStatus.QUEUED] },
        },
      }),
      this.db.viewing.count({
        where: {
          companyId,
          ...this.branchFilter(principal, 'viewing.read', branchId),
          scheduledAt: { gte: at, lt: tomorrow },
          status: { in: [ViewingStatus.SCHEDULED, ViewingStatus.CONFIRMED] },
        },
      }),
      this.db.viewing.count({
        where: {
          companyId,
          ...this.branchFilter(principal, 'viewing.read', branchId),
          scheduledAt: { gte: tomorrow },
          status: { in: [ViewingStatus.SCHEDULED, ViewingStatus.CONFIRMED] },
        },
      }),
      this.db.charge.aggregate({
        where: {
          companyId,
          ...this.branchFilter(principal, 'billing.read', branchId),
          brokerageDealId: null,
          status: { in: [ChargeStatus.OPEN, ChargeStatus.PARTIALLY_PAID] },
        },
        _sum: { outstandingAmount: true },
      }),
      this.db.charge.aggregate({
        where: {
          companyId,
          ...this.branchFilter(principal, 'billing.read', branchId),
          brokerageDealId: { not: null },
          status: { in: [ChargeStatus.OPEN, ChargeStatus.PARTIALLY_PAID] },
        },
        _sum: { outstandingAmount: true },
      }),
      this.db.lease.count({
        where: {
          companyId,
          ...leaseBranchFilter,
          status: LeaseStatus.ACTIVE,
          leaseEndDate: { gte: at, lte: leaseHorizon },
        },
      }),
      this.db.saleAgreement.count({
        where: {
          companyId,
          ...this.branchFilter(principal, 'sale-offer.read', branchId),
          status: { in: [AgreementStatus.DRAFT, AgreementStatus.CONFIRMED] },
        },
      }),
      this.db.payment.groupBy({
        by: ['methodId'],
        where: {
          companyId,
          ...this.branchFilter(principal, 'payment.read', branchId),
          receivedAt: { gte: monthStart, lt: tomorrow },
          status: { in: [PaymentStatus.POSTED, PaymentStatus.VERIFIED, PaymentStatus.PARTIALLY_ALLOCATED] },
        },
        _sum: { amount: true },
      }),
    ]);
    const methodNames = paymentMethods.length
      ? await this.db.paymentMethod.findMany({
          where: { companyId, id: { in: paymentMethods.map((row) => row.methodId) } },
          select: { id: true, name: true },
        })
      : [];
    const methodNameById = new Map(methodNames.map((method) => [method.id, method.name]));
    const paymentBranchIds = this.auth.authorizedBranchIds(principal, 'payment.read');
    const scopedPaymentBranchIds = branchId ? [branchId] : paymentBranchIds === null ? null : [...paymentBranchIds];
    const collectionsByMonth = await this.db.$queryRaw<Array<{ month: string; amount: string }>>`
      SELECT to_char(date_trunc('month', p."receivedAt"), 'YYYY-MM') AS month,
             COALESCE(SUM(p.amount), 0)::text AS amount
      FROM payments p
      WHERE p."companyId" = ${companyId}::uuid
        AND p."receivedAt" >= ${sixMonthsAgo}
        AND p."receivedAt" < ${tomorrow}
        AND p.status IN ('POSTED', 'VERIFIED', 'PARTIALLY_ALLOCATED')
        AND (${scopedPaymentBranchIds === null} OR p."branchId" = ANY(${scopedPaymentBranchIds ?? []}::uuid[]))
      GROUP BY date_trunc('month', p."receivedAt")
      ORDER BY date_trunc('month', p."receivedAt")
    `;
    const recentActivity = await this.recentActivity(principal, branchId);
    return {
      widgets: {
        totalProperties,
        rentableSpaces,
        availableUnits,
        occupiedUnits,
        unavailableUnits: Math.max(0, rentableSpaces - occupiedUnits - availableUnits),
        occupancyRate: rentableSpaces ? Number(((occupiedUnits / rentableSpaces) * 100).toFixed(1)) : 0,
        activeTenants,
        activeLeases,
        openApplications,
        openMaintenance,
        monthlyRevenue: monthlyRevenue._sum.amount?.toString() ?? '0',
        outstandingReceivables: outstandingReceivables._sum.outstandingAmount?.toString() ?? '0',
        upcomingRenewals,
        pendingOwnerPayouts,
      },
      operational: {
        todayViewings,
        upcomingViewings,
        rentOutstanding: rentOutstanding._sum.outstandingAmount?.toString() ?? '0',
        brokerageOutstanding: brokerageOutstanding._sum.outstandingAmount?.toString() ?? '0',
        leasesEndingSoon,
        openMaintenance,
        salesInProgress,
        ownerPayoutsDue: pendingOwnerPayouts,
      },
      charts: {
        collectionsByMonth,
        paymentMethods: paymentMethods.map((row) => ({
          label: methodNameById.get(row.methodId) ?? 'Other',
          amount: row._sum.amount?.toString() ?? '0',
        })),
      },
      recentActivity,
    };
  }

  private async recentActivity(principal: AuthenticatedPrincipal, branchId?: string) {
    const companyId = principal.companyId;
    const branchFilter = this.branchFilter(principal, 'invoice.read', branchId);
    const [invoices, payments, maintenance] = await Promise.all([
      this.db.invoice.findMany({
        where: { companyId, ...branchFilter },
        orderBy: { issueDate: 'desc' },
        take: 5,
        select: { id: true, invoiceNumber: true, issueDate: true, status: true },
      }),
      this.db.payment.findMany({
        where: { companyId, ...this.branchFilter(principal, 'payment.read', branchId) },
        orderBy: { receivedAt: 'desc' },
        take: 5,
        select: { id: true, paymentNumber: true, receivedAt: true, amount: true, currency: true },
      }),
      this.db.maintenanceRequest.findMany({
        where: { companyId, ...this.branchFilter(principal, 'maintenance.read', branchId) },
        orderBy: { reportedAt: 'desc' },
        take: 5,
        select: { id: true, requestNumber: true, title: true, status: true, reportedAt: true },
      }),
    ]);
    return [
      ...invoices.map((row) => ({
        kind: 'INVOICE',
        label: row.invoiceNumber,
        status: row.status,
        occurredAt: row.issueDate,
        href: '/finance/invoices',
      })),
      ...payments.map((row) => ({
        kind: 'PAYMENT',
        label: row.paymentNumber,
        status: 'POSTED',
        occurredAt: row.receivedAt,
        href: '/finance/payments',
      })),
      ...maintenance.map((row) => ({
        kind: 'MAINTENANCE',
        label: `${row.requestNumber} — ${row.title}`,
        status: row.status,
        occurredAt: row.reportedAt,
        href: `/operations/maintenance/${row.id}`,
      })),
    ]
      .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
      .slice(0, 8);
  }
}
