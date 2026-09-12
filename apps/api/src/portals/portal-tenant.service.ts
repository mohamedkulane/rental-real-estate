import { Injectable } from '@nestjs/common';
import {
  ChargeStatus,
  InvoiceStatus,
  LeasePartyRole,
  LeaseStatus,
  MaintenancePriority,
  MaintenanceRequestStatus,
  MoveInStatus,
  RenewalStatus,
} from '@prisma/client';
import { uuidv7 } from '@rerms/shared';
import { nextRecordNumber } from '../common/record-number';
import { DatabaseService } from '../database/database.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import { PortalAuthorizationService } from './portal-authorization.service';

@Injectable()
export class PortalTenantService {
  constructor(
    private readonly db: DatabaseService,
    private readonly portalAuth: PortalAuthorizationService,
  ) {}

  async overview(principal: AuthenticatedPrincipal) {
    const tenantPartyId = this.portalAuth.assertTenant(principal);
    const lease = await this.db.lease.findFirst({
      where: {
        companyId: principal.companyId,
        status: { in: [LeaseStatus.ACTIVE, LeaseStatus.SIGNED] },
        parties: { some: { partyId: tenantPartyId, role: LeasePartyRole.TENANT } },
      },
      orderBy: { leaseStartDate: 'desc' },
      include: {
        rentableSpace: {
          select: {
            id: true,
            spaceCode: true,
            name: true,
            property: { select: { id: true, name: true, propertyCode: true, city: true } },
          },
        },
        moveIn: { select: { id: true, status: true, scheduledDate: true, completedDate: true } },
        renewalRequests: {
          where: { status: { in: [RenewalStatus.PROPOSED, RenewalStatus.APPROVED] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, status: true, createdAt: true, proposedEndDate: true },
        },
      },
    });
    const [openInvoices, outstandingBalance, maintenanceOpen] = await Promise.all([
      this.db.invoice.count({
        where: {
          companyId: principal.companyId,
          debtorPartyId: tenantPartyId,
          status: InvoiceStatus.ISSUED,
        },
      }),
      this.db.charge.aggregate({
        where: {
          companyId: principal.companyId,
          debtorPartyId: tenantPartyId,
          status: { in: [ChargeStatus.OPEN, ChargeStatus.PARTIALLY_PAID] },
        },
        _sum: { outstandingAmount: true },
      }),
      this.db.maintenanceRequest.count({
        where: {
          companyId: principal.companyId,
          tenantPartyId,
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
    return {
      tenantPartyId,
      lease: lease
        ? {
            id: lease.id,
            leaseNumber: lease.leaseNumber,
            status: lease.status,
            leaseStartDate: lease.leaseStartDate,
            leaseEndDate: lease.leaseEndDate,
            rentAmount: lease.rentAmount.toString(),
            currency: lease.currency,
            space: lease.rentableSpace,
            moveIn: lease.moveIn,
            renewal: lease.renewalRequests[0] ?? null,
          }
        : null,
      summary: {
        openInvoices,
        outstandingBalance: outstandingBalance._sum.outstandingAmount?.toString() ?? '0',
        openMaintenance: maintenanceOpen,
      },
    };
  }

  async invoices(principal: AuthenticatedPrincipal, limit = 25) {
    const tenantPartyId = this.portalAuth.assertTenant(principal);
    const items = await this.db.invoice.findMany({
      where: { companyId: principal.companyId, debtorPartyId: tenantPartyId },
      orderBy: [{ issueDate: 'desc' }, { id: 'desc' }],
      take: limit,
      select: {
        id: true,
        invoiceNumber: true,
        issueDate: true,
        dueDate: true,
        currency: true,
        status: true,
        lines: { select: { displayAmount: true } },
      },
    });
    return {
      items: items.map((item) => ({
        id: item.id,
        invoiceNumber: item.invoiceNumber,
        issueDate: item.issueDate,
        dueDate: item.dueDate,
        currency: item.currency,
        status: item.status,
        totalAmount: item.lines
          .reduce((sum, line) => sum + Number(line.displayAmount), 0)
          .toFixed(2),
      })),
    };
  }

  async payments(principal: AuthenticatedPrincipal, limit = 25) {
    const tenantPartyId = this.portalAuth.assertTenant(principal);
    const items = await this.db.payment.findMany({
      where: { companyId: principal.companyId, payerPartyId: tenantPartyId },
      orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
      take: limit,
      select: {
        id: true,
        paymentNumber: true,
        receivedAt: true,
        amount: true,
        currency: true,
        status: true,
      },
    });
    return { items };
  }

  async receipts(principal: AuthenticatedPrincipal, limit = 25) {
    const tenantPartyId = this.portalAuth.assertTenant(principal);
    const items = await this.db.receipt.findMany({
      where: { companyId: principal.companyId, payerPartyId: tenantPartyId },
      orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
      take: limit,
      select: {
        id: true,
        receiptNumber: true,
        issuedAt: true,
        amount: true,
        currency: true,
      },
    });
    return { items };
  }

  async maintenance(principal: AuthenticatedPrincipal, limit = 25) {
    const tenantPartyId = this.portalAuth.assertTenant(principal);
    const items = await this.db.maintenanceRequest.findMany({
      where: { companyId: principal.companyId, tenantPartyId },
      orderBy: [{ reportedAt: 'desc' }, { id: 'desc' }],
      take: limit,
      select: {
        id: true,
        requestNumber: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        reportedAt: true,
        property: { select: { name: true, propertyCode: true } },
        rentableSpace: { select: { name: true, spaceCode: true } },
      },
    });
    return { items };
  }

  async createMaintenance(
    principal: AuthenticatedPrincipal,
    input: { title: string; description: string; categoryCode?: string; priority?: string },
  ) {
    const tenantPartyId = this.portalAuth.assertTenant(principal);
    const lease = await this.db.lease.findFirstOrThrow({
      where: {
        companyId: principal.companyId,
        status: { in: [LeaseStatus.ACTIVE, LeaseStatus.SIGNED] },
        parties: { some: { partyId: tenantPartyId, role: LeasePartyRole.TENANT } },
      },
      select: {
        branchId: true,
        rentableSpaceId: true,
        serviceEngagementId: true,
        rentableSpace: { select: { propertyId: true } },
      },
    });
    const propertyId = lease.rentableSpace.propertyId;
    return this.db.$transaction(async (tx) =>
      tx.maintenanceRequest.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          branchId: lease.branchId,
          requestNumber: await nextRecordNumber(tx, 'MAINTENANCE_REQUEST'),
          propertyId,
          rentableSpaceId: lease.rentableSpaceId,
          tenantPartyId,
          reportedByPartyId: tenantPartyId,
          serviceEngagementId: lease.serviceEngagementId,
          title: input.title,
          description: input.description,
          categoryCode: input.categoryCode ?? 'GENERAL',
          priority: (input.priority as MaintenancePriority | undefined) ?? MaintenancePriority.MEDIUM,
          reportedAt: new Date(),
        },
        select: {
          id: true,
          requestNumber: true,
          title: true,
          status: true,
          reportedAt: true,
        },
      }),
    );
  }

  async profile(principal: AuthenticatedPrincipal) {
    const tenantPartyId = this.portalAuth.assertTenant(principal);
    const profile = await this.db.tenantProfile.findUniqueOrThrow({
      where: { partyId: tenantPartyId },
      include: {
        party: {
          select: {
            displayName: true,
            partyNumber: true,
            contacts: { select: { type: true, primary: true } },
            addresses: { select: { type: true, line1: true, city: true, countryCode: true } },
          },
        },
      },
    });
    return {
      tenantNumber: profile.tenantNumber,
      status: profile.status,
      displayName: profile.party.displayName,
      partyNumber: profile.party.partyNumber,
      contacts: profile.party.contacts.map((row) => ({ type: row.type, primary: row.primary })),
      addresses: profile.party.addresses,
    };
  }

  async moveIn(principal: AuthenticatedPrincipal) {
    const tenantPartyId = this.portalAuth.assertTenant(principal);
    const moveIn = await this.db.moveIn.findFirst({
      where: {
        lease: {
          companyId: principal.companyId,
          parties: { some: { partyId: tenantPartyId, role: LeasePartyRole.TENANT } },
        },
      },
      select: {
        id: true,
        status: true,
        scheduledDate: true,
        completedDate: true,
        notes: true,
        lease: {
          select: {
            leaseNumber: true,
            rentableSpace: {
              select: { name: true, property: { select: { name: true, addressLine1: true, city: true } } },
            },
          },
        },
      },
    });
    if (!moveIn) return { moveIn: null };
    return {
      moveIn: {
        ...moveIn,
        notes: moveIn.status === MoveInStatus.COMPLETED ? moveIn.notes : null,
      },
    };
  }
}
