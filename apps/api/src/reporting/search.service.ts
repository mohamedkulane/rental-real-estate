import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import { isStaffPrincipal } from '../security/security.types';

export type SearchResult = {
  type: string;
  id: string;
  label: string;
  context: string;
  branch?: string | undefined;
  href: string;
};

@Injectable()
export class SearchService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auth: AuthorizationService,
  ) {}

  async search(principal: AuthenticatedPrincipal, query: string, branchId?: string, limit = 12) {
    if (!isStaffPrincipal(principal)) return { items: [] as SearchResult[] };
    const term = query.trim();
    if (term.length < 2) return { items: [] as SearchResult[] };
    const companyId = principal.companyId;
    const perType = Math.max(2, Math.ceil(limit / 6));
    const propertyBranch =
      branchId && this.auth.canPerformInBranch(principal, 'portfolio.property.read', branchId)
        ? { branchAssignments: { some: { branchId } } }
        : this.auth.authorizedBranchIds(principal, 'portfolio.property.read') === null
          ? {}
          : {
              branchAssignments: {
                some: { branchId: { in: [...(this.auth.authorizedBranchIds(principal, 'portfolio.property.read') ?? [])] } },
              },
            };
    const branchFilter =
      branchId && this.auth.canPerformInBranch(principal, 'crm.lead.read', branchId)
        ? { branchId }
        : this.auth.authorizedBranchIds(principal, 'crm.lead.read') === null
          ? {}
          : { branchId: { in: [...(this.auth.authorizedBranchIds(principal, 'crm.lead.read') ?? [])] } };

    const [properties, owners, tenants, leads, leases, listings, invoices] = await Promise.all([
      this.auth.hasPermission(principal, 'portfolio.property.read')
        ? this.db.property.findMany({
            where: {
              companyId,
              ...propertyBranch,
              OR: [
                { name: { contains: term, mode: 'insensitive' } },
                { propertyCode: { contains: term, mode: 'insensitive' } },
              ],
            },
            take: perType,
            select: {
              id: true,
              name: true,
              propertyCode: true,
              branchAssignments: { select: { branch: { select: { name: true } } }, take: 1 },
            },
          })
        : [],
      this.auth.hasPermission(principal, 'owner.read')
        ? this.db.party.findMany({
            where: {
              companyId,
              owner: { isNot: null },
              displayName: { contains: term, mode: 'insensitive' },
            },
            take: perType,
            select: { id: true, displayName: true, partyNumber: true },
          })
        : [],
      this.auth.hasPermission(principal, 'tenant.read')
        ? this.db.party.findMany({
            where: {
              companyId,
              tenant: { isNot: null },
              displayName: { contains: term, mode: 'insensitive' },
            },
            take: perType,
            select: { id: true, displayName: true, partyNumber: true },
          })
        : [],
      this.auth.hasPermission(principal, 'crm.lead.read')
        ? this.db.lead.findMany({
            where: {
              companyId,
              ...branchFilter,
              OR: [
                { displayName: { contains: term, mode: 'insensitive' } },
                { leadNumber: { contains: term, mode: 'insensitive' } },
              ],
            },
            take: perType,
            select: {
              id: true,
              displayName: true,
              leadNumber: true,
              intent: true,
              responsibleBranch: { select: { name: true } },
            },
          })
        : [],
      this.auth.hasPermission(principal, 'lease.read')
        ? this.db.lease.findMany({
            where: {
              companyId,
              ...(branchId ? { branchId } : this.branchFilterLease(principal)),
              leaseNumber: { contains: term, mode: 'insensitive' },
            },
            take: perType,
            select: { id: true, leaseNumber: true, branch: { select: { name: true } } },
          })
        : [],
      this.auth.hasPermission(principal, 'rental-listing.read')
        ? this.db.rentalListing.findMany({
            where: {
              companyId,
              title: { contains: term, mode: 'insensitive' },
            },
            take: perType,
            select: { id: true, title: true, branch: { select: { name: true } } },
          })
        : [],
      this.auth.hasPermission(principal, 'invoice.read')
        ? this.db.invoice.findMany({
            where: {
              companyId,
              ...(branchId ? { branchId } : this.branchFilterInvoice(principal)),
              invoiceNumber: { contains: term, mode: 'insensitive' },
            },
            take: perType,
            select: { id: true, invoiceNumber: true, branch: { select: { name: true } } },
          })
        : [],
    ]);

    const items: SearchResult[] = [
      ...properties.map((row) => ({
        type: 'Property',
        id: row.id,
        label: `${row.propertyCode} — ${row.name}`,
        context: 'Portfolio',
        branch: row.branchAssignments[0]?.branch.name,
        href: `/portfolio/properties/${row.id}`,
      })),
      ...owners.map((row) => ({
        type: 'Owner',
        id: row.id,
        label: row.displayName,
        context: row.partyNumber,
        href: `/portfolio?owner=${row.id}`,
      })),
      ...tenants.map((row) => ({
        type: 'Tenant',
        id: row.id,
        label: row.displayName,
        context: row.partyNumber,
        href: `/rental/customers`,
      })),
      ...leads.map((row) => ({
        type: 'Lead',
        id: row.id,
        label: `${row.leadNumber} — ${row.displayName}`,
        context: 'CRM',
        branch: row.responsibleBranch.name,
        href:
          row.intent === 'RENT'
            ? `/rental/customers/${row.id}`
            : row.intent === 'BUY'
              ? `/sales/buyers/${row.id}`
              : `/crm/leads/${row.id}`,
      })),
      ...leases.map((row) => ({
        type: 'Lease',
        id: row.id,
        label: row.leaseNumber,
        context: 'Leasing',
        branch: row.branch.name,
        href: `/leasing/leases/${row.id}`,
      })),
      ...listings.map((row) => ({
        type: 'Listing',
        id: row.id,
        label: row.title,
        context: 'Marketing',
        branch: row.branch.name,
        href: `/rental/properties`,
      })),
      ...invoices.map((row) => ({
        type: 'Invoice',
        id: row.id,
        label: row.invoiceNumber,
        context: 'Finance',
        branch: row.branch.name,
        href: `/finance/invoices`,
      })),
    ].slice(0, limit);

    return { items };
  }

  private branchFilterLease(principal: AuthenticatedPrincipal) {
    const branchIds = this.auth.authorizedBranchIds(principal, 'lease.read');
    return branchIds === null ? {} : { branchId: { in: [...branchIds] } };
  }

  private branchFilterInvoice(principal: AuthenticatedPrincipal) {
    const branchIds = this.auth.authorizedBranchIds(principal, 'invoice.read');
    return branchIds === null ? {} : { branchId: { in: [...branchIds] } };
  }
}
