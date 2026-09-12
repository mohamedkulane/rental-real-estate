import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  LeasePartyRole,
  LeaseStatus,
  OwnerStatementStatus,
  PayoutStatus,
  PropertyStatus,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import type { AuthenticatedPrincipal } from '../security/security.types';

@Injectable()
export class PortalAuthorizationService {
  constructor(private readonly db: DatabaseService) {}

  assertOwner(principal: AuthenticatedPrincipal): string {
    if (principal.kind !== 'OWNER' || !principal.partyId)
      throw new ForbiddenException('Owner portal access required.');
    return principal.partyId;
  }

  assertTenant(principal: AuthenticatedPrincipal): string {
    if (principal.kind !== 'TENANT' || !principal.partyId)
      throw new ForbiddenException('Tenant portal access required.');
    return principal.partyId;
  }

  async ownerPropertyIds(ownerPartyId: string, companyId: string, businessDate: string): Promise<string[]> {
    const at = new Date(businessDate);
    const rows = await this.db.propertyOwnership.findMany({
      where: {
        ownerPartyId,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
        property: { companyId, status: PropertyStatus.ACTIVE },
      },
      select: { propertyId: true },
    });
    return [...new Set(rows.map((row) => row.propertyId))];
  }

  async assertOwnerProperty(
    ownerPartyId: string,
    companyId: string,
    businessDate: string,
    propertyId: string,
  ): Promise<void> {
    const propertyIds = await this.ownerPropertyIds(ownerPartyId, companyId, businessDate);
    if (!propertyIds.includes(propertyId)) throw new NotFoundException('Property not found.');
  }

  async tenantLeaseIds(tenantPartyId: string, companyId: string): Promise<string[]> {
    const rows = await this.db.leaseParty.findMany({
      where: {
        partyId: tenantPartyId,
        role: LeasePartyRole.TENANT,
        lease: { companyId, status: { in: [LeaseStatus.ACTIVE, LeaseStatus.SIGNED] } },
      },
      select: { leaseId: true },
    });
    return rows.map((row) => row.leaseId);
  }

  async assertTenantLease(
    tenantPartyId: string,
    companyId: string,
    leaseId: string,
  ): Promise<void> {
    const leaseIds = await this.tenantLeaseIds(tenantPartyId, companyId);
    if (!leaseIds.includes(leaseId)) throw new NotFoundException('Lease not found.');
  }

  async assertOwnerStatement(ownerPartyId: string, companyId: string, statementId: string): Promise<void> {
    const statement = await this.db.ownerStatement.findFirst({
      where: {
        id: statementId,
        companyId,
        ownerPartyId,
        status: { in: [OwnerStatementStatus.ISSUED] },
      },
      select: { id: true },
    });
    if (!statement) throw new NotFoundException('Owner statement not found.');
  }

  async assertOwnerPayout(ownerPartyId: string, companyId: string, payoutId: string): Promise<void> {
    const payout = await this.db.ownerPayout.findFirst({
      where: {
        id: payoutId,
        companyId,
        ownerPartyId,
        status: { in: [PayoutStatus.APPROVED, PayoutStatus.QUEUED, PayoutStatus.PAID, PayoutStatus.RECONCILED] },
      },
      select: { id: true },
    });
    if (!payout) throw new NotFoundException('Owner payout not found.');
  }
}
