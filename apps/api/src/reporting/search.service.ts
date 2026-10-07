import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
  matchKind?: 'EXACT' | 'PREFIX' | 'CONTAINS' | 'TOKEN' | 'FUZZY';
  score?: number;
};

type PropertySearchRow = {
  id: string;
  name: string;
  propertyCode: string;
  branch: string | null;
  matchKind: SearchResult['matchKind'];
  score: number;
};

function normalizeSearchTerm(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/[\p{P}\p{S}_-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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
    const normalizedTerm = normalizeSearchTerm(term);
    const propertyBranchIds = this.auth.authorizedBranchIds(principal, 'portfolio.property.read');
    if (branchId) {
      this.auth.assertBranchPermission(principal, 'portfolio.property.read', branchId);
    }
    const scopedPropertyBranchIds = branchId
      ? [branchId]
      : propertyBranchIds === null
        ? null
        : [...propertyBranchIds];
    const branchFilter =
      branchId && this.auth.canPerformInBranch(principal, 'crm.lead.read', branchId)
        ? { branchId }
        : this.auth.authorizedBranchIds(principal, 'crm.lead.read') === null
          ? {}
          : {
              branchId: {
                in: [...(this.auth.authorizedBranchIds(principal, 'crm.lead.read') ?? [])],
              },
            };

    const [properties, owners, tenants, leads, leases, listings, invoices] = await Promise.all([
      this.auth.hasPermission(principal, 'portfolio.property.read')
        ? this.db.$queryRaw<PropertySearchRow[]>(Prisma.sql`
            WITH ranked_properties AS (
              SELECT
                p.id,
                p.name,
                p."propertyCode",
                branch.name AS branch,
                CASE
                  WHEN translate(lower(p.name), '-_', '  ') = ${normalizedTerm}
                    OR translate(lower(p."propertyCode"), '-_', '  ') = ${normalizedTerm} THEN 'EXACT'
                  WHEN translate(lower(p.name), '-_', '  ') LIKE ${`${normalizedTerm}%`}
                    OR translate(lower(p."propertyCode"), '-_', '  ') LIKE ${`${normalizedTerm}%`} THEN 'PREFIX'
                  WHEN translate(lower(p.name), '-_', '  ') LIKE ${`%${normalizedTerm}%`}
                    OR translate(lower(p."propertyCode"), '-_', '  ') LIKE ${`%${normalizedTerm}%`} THEN 'CONTAINS'
                  WHEN word_similarity(${normalizedTerm}, translate(lower(p.name), '-_', '  ')) >= 0.65 THEN 'TOKEN'
                  ELSE 'FUZZY'
                END AS "matchKind",
                GREATEST(
                  similarity(translate(lower(p.name), '-_', '  '), ${normalizedTerm}),
                  similarity(translate(lower(p."propertyCode"), '-_', '  '), ${normalizedTerm}),
                  word_similarity(${normalizedTerm}, translate(lower(p.name), '-_', '  '))
                )::float8 AS score
              FROM properties p
              LEFT JOIN LATERAL (
                SELECT b.name
                FROM property_branch_assignments pba
                JOIN branches b ON b.id = pba."branchId"
                WHERE pba."propertyId" = p.id AND pba."effectiveTo" IS NULL
                ORDER BY pba."effectiveFrom" DESC
                LIMIT 1
              ) branch ON true
              WHERE p."companyId" = ${companyId}::uuid
                AND (
                  ${scopedPropertyBranchIds === null}
                  OR EXISTS (
                    SELECT 1
                    FROM property_branch_assignments scope
                    WHERE scope."propertyId" = p.id
                      AND scope."effectiveTo" IS NULL
                      AND scope."branchId" = ANY(${scopedPropertyBranchIds ?? []}::uuid[])
                  )
                )
                AND (
                  translate(lower(p.name), '-_', '  ') LIKE ${`%${normalizedTerm}%`}
                  OR translate(lower(p."propertyCode"), '-_', '  ') LIKE ${`%${normalizedTerm}%`}
                  OR similarity(translate(lower(p.name), '-_', '  '), ${normalizedTerm}) >= 0.32
                  OR similarity(translate(lower(p."propertyCode"), '-_', '  '), ${normalizedTerm}) >= 0.32
                  OR word_similarity(${normalizedTerm}, translate(lower(p.name), '-_', '  ')) >= 0.60
                )
            )
            SELECT *
            FROM ranked_properties
            ORDER BY
              CASE "matchKind"
                WHEN 'EXACT' THEN 1
                WHEN 'PREFIX' THEN 2
                WHEN 'CONTAINS' THEN 3
                WHEN 'TOKEN' THEN 4
                ELSE 5
              END,
              score DESC,
              name ASC
            LIMIT ${perType}
          `)
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
        branch: row.branch ?? undefined,
        href: `/portfolio/properties/${row.id}`,
        matchKind: row.matchKind,
        score: row.score,
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

    const propertyMatches = items.filter((item) => item.type === 'Property');
    const closestMatches =
      propertyMatches.length > 0 &&
      propertyMatches.every((item) => item.matchKind === 'TOKEN' || item.matchKind === 'FUZZY');
    return { items, closestMatches };
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
