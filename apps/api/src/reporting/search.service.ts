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
  matchKind: 'EXACT' | 'PREFIX' | 'CONTAINS' | 'TOKEN' | 'FUZZY';
  score: number;
};

type SearchRow = Omit<SearchResult, 'branch'> & { branch: string | null };

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

  private scope(principal: AuthenticatedPrincipal, permission: string, branchId?: string) {
    if (!this.auth.hasPermission(principal, permission)) return undefined;
    if (branchId) {
      return this.auth.canPerformInBranch(principal, permission, branchId) ? [branchId] : [];
    }
    const ids = this.auth.authorizedBranchIds(principal, permission);
    return ids === null ? null : [...ids];
  }

  async search(principal: AuthenticatedPrincipal, query: string, branchId?: string, limit = 12) {
    if (!isStaffPrincipal(principal)) return { items: [] as SearchResult[] };
    const normalizedTerm = normalizeSearchTerm(query);
    if (normalizedTerm.length < 2) return { items: [] as SearchResult[] };
    const boundedLimit = Math.min(Math.max(limit, 1), 30);
    const companyId = principal.companyId;
    const propertyScope = this.scope(principal, 'portfolio.property.read', branchId);
    const ownerScope = this.scope(principal, 'owner.read', branchId);
    const leadScope = this.scope(principal, 'crm.lead.read', branchId);
    const leaseScope = this.scope(principal, 'lease.read', branchId);
    const paymentScope = this.scope(principal, 'payment.read', branchId);
    const saleAgreementScope = this.scope(principal, 'sale-offer.read', branchId);
    const settlementScope = this.scope(principal, 'sale-settlement.read', branchId);
    const maintenanceScope = this.scope(principal, 'maintenance.read', branchId);
    const workOrderScope = this.scope(principal, 'work-order.read', branchId);

    const rows = await this.db.$queryRaw<SearchRow[]>(Prisma.sql`
      WITH candidates AS (
        SELECT 'Property'::text AS type, p.id, p."propertyCode" || ' - ' || p.name AS label,
          'Portfolio'::text AS context, branch.name AS branch,
          '/portfolio/properties/' || p.id::text AS href,
          p."propertyCode" || ' ' || p.name AS "searchText"
        FROM properties p
        LEFT JOIN LATERAL (
          SELECT b.name FROM property_branch_assignments pba
          JOIN branches b ON b.id = pba."branchId"
          WHERE pba."propertyId" = p.id AND pba."effectiveTo" IS NULL
          ORDER BY pba."effectiveFrom" DESC LIMIT 1
        ) branch ON true
        WHERE ${propertyScope !== undefined} AND p."companyId" = ${companyId}::uuid
          AND (${propertyScope === null} OR EXISTS (
            SELECT 1 FROM property_branch_assignments scope
            WHERE scope."propertyId" = p.id AND scope."effectiveTo" IS NULL
              AND scope."branchId" = ANY(${propertyScope ?? []}::uuid[])
          ))

        UNION ALL
        SELECT 'Unit', rs.id, rs."spaceCode" || ' - ' || rs.name,
          p."propertyCode" || ' - ' || p.name, branch.name,
          '/portfolio/properties/' || p.id::text || '?tab=spaces',
          rs."spaceCode" || ' ' || rs.name || ' ' || p."propertyCode" || ' ' || p.name
        FROM rentable_spaces rs JOIN properties p ON p.id = rs."propertyId"
        LEFT JOIN LATERAL (
          SELECT b.name FROM property_branch_assignments pba
          JOIN branches b ON b.id = pba."branchId"
          WHERE pba."propertyId" = p.id AND pba."effectiveTo" IS NULL
          ORDER BY pba."effectiveFrom" DESC LIMIT 1
        ) branch ON true
        WHERE ${propertyScope !== undefined} AND p."companyId" = ${companyId}::uuid
          AND (${propertyScope === null} OR EXISTS (
            SELECT 1 FROM property_branch_assignments scope
            WHERE scope."propertyId" = p.id AND scope."effectiveTo" IS NULL
              AND scope."branchId" = ANY(${propertyScope ?? []}::uuid[])
          ))

        UNION ALL
        SELECT 'Owner', party.id, party."displayName", party."partyNumber", NULL::text,
          '/portfolio?owner=' || party.id::text,
          party."partyNumber" || ' ' || party."displayName"
        FROM parties party JOIN owner_profiles owner ON owner."partyId" = party.id
        WHERE ${ownerScope !== undefined} AND party."companyId" = ${companyId}::uuid
          AND (${ownerScope === null} OR EXISTS (
            SELECT 1 FROM property_ownerships po
            JOIN property_branch_assignments pba ON pba."propertyId" = po."propertyId"
            WHERE po."ownerPartyId" = party.id AND po."effectiveTo" IS NULL
              AND pba."effectiveTo" IS NULL AND pba."branchId" = ANY(${ownerScope ?? []}::uuid[])
          ))

        UNION ALL
        SELECT CASE WHEN lead.intent = 'BUY' THEN 'Buyer' ELSE 'Rental Customer' END,
          lead.id, lead."leadNumber" || ' - ' || lead."displayName",
          CASE WHEN lead.intent = 'BUY' THEN 'Sales' ELSE 'Rental' END,
          branch.name,
          CASE WHEN lead.intent = 'BUY' THEN '/sales/buyers/' ELSE '/rental/customers/' END || lead.id::text,
          lead."leadNumber" || ' ' || lead."displayName"
        FROM leads lead JOIN branches branch ON branch.id = lead."responsibleBranchId"
        WHERE ${leadScope !== undefined} AND lead."companyId" = ${companyId}::uuid
          AND lead.intent IN ('RENT', 'BUY')
          AND (${leadScope === null} OR lead."responsibleBranchId" = ANY(${leadScope ?? []}::uuid[]))

        UNION ALL
        SELECT 'Lease', lease.id, lease."leaseNumber",
          p."propertyCode" || ' - ' || rs."spaceCode", branch.name,
          '/leasing/leases/' || lease.id::text,
          lease."leaseNumber" || ' ' || p."propertyCode" || ' ' || p.name || ' ' || rs."spaceCode" || ' ' || rs.name
        FROM leases lease JOIN branches branch ON branch.id = lease."branchId"
        JOIN rentable_spaces rs ON rs.id = lease."rentableSpaceId"
        JOIN properties p ON p.id = rs."propertyId"
        WHERE ${leaseScope !== undefined} AND lease."companyId" = ${companyId}::uuid
          AND (${leaseScope === null} OR lease."branchId" = ANY(${leaseScope ?? []}::uuid[]))

        UNION ALL
        SELECT 'Payment', payment.id, payment."paymentNumber",
          payer."displayName", branch.name, '/finance/payments/' || payment.id::text,
          payment."paymentNumber" || ' ' || COALESCE(payment."externalRef", '') || ' ' || payer."displayName"
        FROM payments payment JOIN branches branch ON branch.id = payment."branchId"
        JOIN parties payer ON payer.id = payment."payerPartyId"
        WHERE ${paymentScope !== undefined} AND payment."companyId" = ${companyId}::uuid
          AND (${paymentScope === null} OR payment."branchId" = ANY(${paymentScope ?? []}::uuid[]))

        UNION ALL
        SELECT 'Sale Agreement', agreement.id, agreement."agreementNumber",
          p."propertyCode" || ' - ' || p.name, branch.name,
          '/sales/deals/' || agreement.id::text,
          agreement."agreementNumber" || ' ' || p."propertyCode" || ' ' || p.name || ' ' || buyer."displayName"
        FROM sale_agreements agreement JOIN branches branch ON branch.id = agreement."branchId"
        JOIN properties p ON p.id = agreement."propertyId" JOIN parties buyer ON buyer.id = agreement."buyerPartyId"
        WHERE ${saleAgreementScope !== undefined} AND agreement."companyId" = ${companyId}::uuid
          AND (${saleAgreementScope === null} OR agreement."branchId" = ANY(${saleAgreementScope ?? []}::uuid[]))

        UNION ALL
        SELECT 'Sale Settlement', settlement.id, settlement."settlementNumber",
          p."propertyCode" || ' - ' || p.name, branch.name,
          '/sales/deals', settlement."settlementNumber" || ' ' || p."propertyCode" || ' ' || p.name
        FROM sale_settlements settlement JOIN branches branch ON branch.id = settlement."branchId"
        JOIN properties p ON p.id = settlement."propertyId"
        WHERE ${settlementScope !== undefined} AND settlement."companyId" = ${companyId}::uuid
          AND (${settlementScope === null} OR settlement."branchId" = ANY(${settlementScope ?? []}::uuid[]))

        UNION ALL
        SELECT 'Maintenance', request.id, request."requestNumber" || ' - ' || request.title,
          p."propertyCode" || ' - ' || p.name, branch.name,
          '/operations/maintenance/' || request.id::text,
          request."requestNumber" || ' ' || request.title || ' ' || p."propertyCode" || ' ' || p.name
        FROM maintenance_requests request JOIN branches branch ON branch.id = request."branchId"
        JOIN properties p ON p.id = request."propertyId"
        WHERE ${maintenanceScope !== undefined} AND request."companyId" = ${companyId}::uuid
          AND (${maintenanceScope === null} OR request."branchId" = ANY(${maintenanceScope ?? []}::uuid[]))

        UNION ALL
        SELECT 'Work Order', work.id, work."workOrderNumber",
          p."propertyCode" || ' - ' || p.name, branch.name,
          '/operations/work-orders/' || work.id::text,
          work."workOrderNumber" || ' ' || p."propertyCode" || ' ' || p.name
        FROM work_orders work JOIN branches branch ON branch.id = work."branchId"
        JOIN properties p ON p.id = work."propertyId"
        WHERE ${workOrderScope !== undefined} AND work."companyId" = ${companyId}::uuid
          AND (${workOrderScope === null} OR work."branchId" = ANY(${workOrderScope ?? []}::uuid[]))
      ), ranked AS (
        SELECT type, id, label, context, branch, href,
          CASE
            WHEN translate(lower("searchText"), '-_', '  ') = ${normalizedTerm} THEN 'EXACT'
            WHEN translate(lower("searchText"), '-_', '  ') LIKE ${`${normalizedTerm}%`} THEN 'PREFIX'
            WHEN translate(lower("searchText"), '-_', '  ') LIKE ${`%${normalizedTerm}%`} THEN 'CONTAINS'
            WHEN word_similarity(${normalizedTerm}, translate(lower("searchText"), '-_', '  ')) >= 0.65 THEN 'TOKEN'
            ELSE 'FUZZY'
          END AS "matchKind",
          GREATEST(
            similarity(translate(lower("searchText"), '-_', '  '), ${normalizedTerm}),
            word_similarity(${normalizedTerm}, translate(lower("searchText"), '-_', '  '))
          )::float8 AS score
        FROM candidates
        WHERE translate(lower("searchText"), '-_', '  ') LIKE ${`%${normalizedTerm}%`}
          OR similarity(translate(lower("searchText"), '-_', '  '), ${normalizedTerm}) >= 0.30
          OR word_similarity(${normalizedTerm}, translate(lower("searchText"), '-_', '  ')) >= 0.58
      )
      SELECT * FROM ranked
      ORDER BY CASE "matchKind"
        WHEN 'EXACT' THEN 1 WHEN 'PREFIX' THEN 2 WHEN 'CONTAINS' THEN 3 WHEN 'TOKEN' THEN 4 ELSE 5
      END, score DESC, label ASC
      LIMIT ${boundedLimit}
    `);

    const items = rows.map((row) => ({ ...row, branch: row.branch ?? undefined }));
    return {
      items,
      closestMatches:
        items.length > 0 &&
        items.every((item) => item.matchKind === 'TOKEN' || item.matchKind === 'FUZZY'),
    };
  }
}
