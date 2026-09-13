import { Injectable } from '@nestjs/common';
import {
  ApplicationStatus,
  ChargeStatus,
  LeaseStatus,
  MaintenanceRequestStatus,
  PaymentStatus,
  PayoutStatus,
  PropertyStatus,
  RentableSpaceStatus,
  RenewalStatus,
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

  private branchFilter(principal: AuthenticatedPrincipal, permission: string) {
    const branchIds = this.auth.authorizedBranchIds(principal, permission);
    return branchIds === null ? {} : { branchId: { in: [...branchIds] } };
  }

  private propertyBranchFilter(principal: AuthenticatedPrincipal) {
    const branchIds = this.auth.authorizedBranchIds(principal, 'portfolio.property.read');
    if (branchIds === null) return {};
    return { branchAssignments: { some: { branchId: { in: [...branchIds] } } } };
  }

  async summary(principal: AuthenticatedPrincipal) {
    const companyId = principal.companyId;
    const branchFilter = this.branchFilter(principal, 'application.read');
    const propertyBranchFilter = this.propertyBranchFilter(principal);
    const leaseBranchFilter = this.branchFilter(principal, 'lease.read');
    const [
      totalProperties,
      rentableSpaces,
      activeTenants,
      activeLeases,
      openApplications,
      openMaintenance,
      monthlyRevenue,
      outstandingReceivables,
      upcomingRenewals,
      pendingOwnerPayouts,
    ] = await Promise.all([
      this.db.property.count({ where: { companyId, status: PropertyStatus.ACTIVE, ...propertyBranchFilter } }),
      this.db.rentableSpace.count({
        where: {
          property: { companyId, ...propertyBranchFilter },
          status: { in: [RentableSpaceStatus.ACTIVE] },
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
          ...this.branchFilter(principal, 'maintenance.read'),
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
          ...this.branchFilter(principal, 'payment.read'),
          receivedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
          status: { in: [PaymentStatus.POSTED, PaymentStatus.VERIFIED, PaymentStatus.PARTIALLY_ALLOCATED] },
        },
        _sum: { amount: true },
      }),
      this.db.charge.aggregate({
        where: {
          companyId,
          ...this.branchFilter(principal, 'billing.read'),
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
          ...this.branchFilter(principal, 'payout.read'),
          status: { in: [PayoutStatus.DRAFT, PayoutStatus.REVIEW, PayoutStatus.APPROVED, PayoutStatus.QUEUED] },
        },
      }),
    ]);
    const recentActivity = await this.recentActivity(principal);
    return {
      widgets: {
        totalProperties,
        rentableSpaces,
        occupancyRate: rentableSpaces
          ? Number(((activeLeases / rentableSpaces) * 100).toFixed(1))
          : 0,
        activeTenants,
        activeLeases,
        openApplications,
        openMaintenance,
        monthlyRevenue: monthlyRevenue._sum.amount?.toString() ?? '0',
        outstandingReceivables: outstandingReceivables._sum.outstandingAmount?.toString() ?? '0',
        upcomingRenewals,
        pendingOwnerPayouts,
      },
      recentActivity,
    };
  }

  private async recentActivity(principal: AuthenticatedPrincipal) {
    const companyId = principal.companyId;
    const branchFilter = this.branchFilter(principal, 'invoice.read');
    const [invoices, payments, maintenance] = await Promise.all([
      this.db.invoice.findMany({
        where: { companyId, ...branchFilter },
        orderBy: { issueDate: 'desc' },
        take: 5,
        select: { id: true, invoiceNumber: true, issueDate: true, status: true },
      }),
      this.db.payment.findMany({
        where: { companyId, ...this.branchFilter(principal, 'payment.read') },
        orderBy: { receivedAt: 'desc' },
        take: 5,
        select: { id: true, paymentNumber: true, receivedAt: true, amount: true, currency: true },
      }),
      this.db.maintenanceRequest.findMany({
        where: { companyId, ...this.branchFilter(principal, 'maintenance.read') },
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
