import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, type LeadIntent } from '@prisma/client';
import type { AuthenticatedPrincipal } from '../security/security.types';
import { resolveCapabilitySet } from '../commercial/service-engagement.policy';
import { CrmSupportService } from './crm-support.service';
import { CrmReadService, branchSql, clauses, matchText } from './crm-read.service';
import { BranchSelectorPurpose, EmployeeSelectorPurpose, ReferenceSelectorPurpose } from './crm.dto';
import type {
  BranchSelectorQueryDto,
  EmployeeSelectorQueryDto,
  ReferenceSelectorQueryDto,
} from './crm.dto';

@Injectable()
export class CrmSelectorsService {
  constructor(
    private readonly support: CrmSupportService,
    private readonly read: CrmReadService,
  ) {}
  private invalid(): never {
    throw new BadRequestException('CRM_VALIDATION_FAILED');
  }
  async branches(principal: AuthenticatedPrincipal, query: BranchSelectorQueryDto) {
    const map: Record<string, string[]> = {
      LEAD_REGISTER: ['crm.lead.read'],
      PIPELINE: ['crm.lead.read'],
      FOLLOW_UPS: ['crm.lead.read', 'crm.followup.read'],
      CREATE_LEAD: ['crm.lead.create'],
      TRANSFER_LEAD: ['crm.lead.branch.transfer'],
    };
    const permissions = map[query.purpose];
    if (!permissions) this.invalid();
    let sourceBranch: string | undefined;
    if (query.purpose === BranchSelectorPurpose.TRANSFER_LEAD) {
      if (!query.leadId) this.invalid();
      sourceBranch = (await this.support.lead(principal, query.leadId, permissions))
        .responsibleBranchId;
    } else if (query.leadId) this.invalid();
    const filters = [
      Prisma.sql`b."companyId"=${principal.companyId}::uuid`,
      branchSql(Prisma.sql`b.id`, this.support.branches(principal, permissions)),
    ];
    if (query.purpose === BranchSelectorPurpose.CREATE_LEAD || query.purpose === BranchSelectorPurpose.TRANSFER_LEAD)
      filters.push(Prisma.sql`b.active=TRUE`);
    if (sourceBranch) filters.push(Prisma.sql`b.id<>${sourceBranch}::uuid`);
    if (query.search?.trim()) {
      const term = matchText(query.search);
      filters.push(Prisma.sql`(b.code ILIKE ${term} OR b.name ILIKE ${term})`);
    }
    return this.read.page(
      Prisma.sql`SELECT ARRAY[b.code,b.id::text] AS key,jsonb_build_object('id',b.id,'code',b.code,'name',b.name,'active',b.active) AS data FROM branches b WHERE ${clauses(filters)}`,
      query,
      'branch-options',
      this.read.scope(
        principal,
        permissions,
        { purpose: query.purpose, search: query.search },
        { leadId: query.leadId, sourceBranch },
      ),
    );
  }
  async employees(principal: AuthenticatedPrincipal, query: EmployeeSelectorQueryDto) {
    let target: string;
    let permissions: string[];
    let source: string | undefined;
    if (query.purpose === EmployeeSelectorPurpose.INITIAL_ASSIGNMENT) {
      if (!query.branchId || query.leadId || query.destinationBranchId) this.invalid();
      target = (await this.support.branch(principal, query.branchId, undefined, true)).id;
      permissions = ['crm.lead.create', 'crm.assignment.manage'];
    } else if (query.purpose === EmployeeSelectorPurpose.ASSIGNMENT_READ) {
      if (Boolean(query.branchId) === Boolean(query.leadId) || query.destinationBranchId)
        this.invalid();
      permissions = ['crm.lead.read', 'crm.assignment.read'];
      target = query.leadId
        ? (await this.support.lead(principal, query.leadId, permissions)).responsibleBranchId
        : (await this.support.branch(principal, query.branchId!)).id;
    } else if (query.purpose === EmployeeSelectorPurpose.VIEWING_ASSIGN) {
      if (Boolean(query.branchId) === Boolean(query.leadId) || query.destinationBranchId)
        this.invalid();
      permissions = ['viewing.create'];
      target = query.leadId
        ? (await this.support.lead(principal, query.leadId, permissions)).responsibleBranchId
        : (await this.support.branch(principal, query.branchId!)).id;
    } else {
      const map: Record<string, string[]> = {
        ASSIGN_LEAD: ['crm.assignment.manage'],
        REASSIGN_LEAD: ['crm.assignment.manage'],
        CREATE_FOLLOW_UP: ['crm.followup.create'],
        TRANSFER_REPLACEMENT: ['crm.lead.branch.transfer'],
      };
      permissions = map[query.purpose] ?? [];
      if (!permissions.length || !query.leadId || query.branchId) this.invalid();
      source = (await this.support.lead(principal, query.leadId, permissions)).responsibleBranchId;
      target = source;
      if (query.purpose === EmployeeSelectorPurpose.TRANSFER_REPLACEMENT) {
        if (!query.destinationBranchId) this.invalid();
        target = (await this.support.branch(principal, query.destinationBranchId, undefined, true))
          .id;
      } else if (query.destinationBranchId) this.invalid();
    }
    for (const permission of permissions) this.support.assert(principal, permission, target);
    const filters = [
      Prisma.sql`e."companyId"=${principal.companyId}::uuid`,
      Prisma.sql`e.active=TRUE`,
      Prisma.sql`crm_employee_eligible(e.id,${principal.companyId}::uuid,${target}::uuid)`,
    ];
    if (query.search?.trim()) {
      const term = matchText(query.search);
      filters.push(Prisma.sql`(e."employeeNumber" ILIKE ${term} OR p."displayName" ILIKE ${term})`);
    }
    return this.read.page(
      Prisma.sql`SELECT ARRAY[e."employeeNumber",e.id::text] AS key,jsonb_build_object('id',e.id,'employeeNumber',e."employeeNumber",'displayName',p."displayName") AS data FROM employees e JOIN parties p ON p.id=e."partyId" AND p."companyId"=e."companyId" WHERE ${clauses(filters)}`,
      query,
      'employee-options',
      this.read.scope(
        principal,
        permissions,
        { purpose: query.purpose, search: query.search },
        { target, source, leadId: query.leadId },
      ),
    );
  }
  private async referenceContext(
    principal: AuthenticatedPrincipal,
    query: ReferenceSelectorQueryDto,
    party: boolean,
  ) {
    if (party && (query.intent || query.propertyId)) this.invalid();
    let permission: string;
    let branch: string;
    let intent: LeadIntent | undefined = query.intent;
    if (query.purpose === ReferenceSelectorPurpose.CREATE_LEAD) {
      if (!query.branchId || query.leadId) this.invalid();
      branch = (await this.support.branch(principal, query.branchId, undefined, true)).id;
      permission = 'crm.lead.create';
      this.support.assert(principal, permission, branch);
      if (!party && !intent) this.invalid();
    } else if (query.purpose === ReferenceSelectorPurpose.UPDATE_LEAD) {
      if (!query.leadId || query.branchId) this.invalid();
      permission = 'crm.lead.update';
      const lead = await this.support.lead(principal, query.leadId, [permission]);
      branch = lead.responsibleBranchId;
      if (intent && intent !== lead.intent && lead.stage !== 'NEW' && lead.stage !== 'CONTACTED')
        this.invalid();
      intent ??= lead.intent;
    } else return this.invalid();
    return { permission, branch, intent };
  }
  async parties(principal: AuthenticatedPrincipal, query: ReferenceSelectorQueryDto) {
    const context = await this.referenceContext(principal, query, true);
    const permissions = [context.permission, 'party.read'];
    const branches = this.support.branches(principal, ['party.read']);
    const at = principal.businessDate;
    const scope =
      branches === null
        ? Prisma.sql`TRUE`
        : Prisma.sql`(EXISTS(SELECT 1 FROM party_branch_assignments a WHERE a."partyId"=p.id AND a."effectiveFrom"<=${at}::date AND(a."effectiveTo" IS NULL OR a."effectiveTo">${at}::date) AND ${branchSql(Prisma.sql`a."branchId"`, branches)}) OR EXISTS(SELECT 1 FROM property_ownerships o JOIN property_branch_assignments a ON a."propertyId"=o."propertyId" WHERE o."ownerPartyId"=p.id AND o."effectiveFrom"<=${at}::date AND(o."effectiveTo" IS NULL OR o."effectiveTo">${at}::date) AND a."effectiveFrom"<=${at}::date AND(a."effectiveTo" IS NULL OR a."effectiveTo">${at}::date) AND ${branchSql(Prisma.sql`a."branchId"`, branches)}))`;
    const filters = [
      Prisma.sql`p."companyId"=${principal.companyId}::uuid`,
      Prisma.sql`NOT EXISTS(SELECT 1 FROM employees e WHERE e."partyId"=p.id)`,
      scope,
    ];
    if (query.search?.trim()) {
      const term = matchText(query.search);
      filters.push(Prisma.sql`(p."partyNumber" ILIKE ${term} OR p."displayName" ILIKE ${term})`);
    }
    return this.read.page(
      Prisma.sql`SELECT ARRAY[p."displayName",p.id::text] AS key,jsonb_build_object('id',p.id,'partyNumber',p."partyNumber",'displayName',p."displayName",'active',p.active) AS data FROM parties p WHERE ${clauses(filters)}`,
      query,
      'party-options',
      this.read.scope(
        principal,
        permissions,
        { purpose: query.purpose, search: query.search },
        context,
      ),
    );
  }
  async assets(
    principal: AuthenticatedPrincipal,
    query: ReferenceSelectorQueryDto,
    space: boolean,
  ) {
    const context = await this.referenceContext(principal, query, false);
    const intent = context.intent!;
    if (
      (space && intent !== 'RENT') ||
      (!space && intent === 'RENT') ||
      (!space && query.propertyId)
    )
      this.invalid();
    const resourcePermissions = [
      'portfolio.property.read',
      ...(space ? ['portfolio.space.read'] : []),
      ...(intent !== 'CONSTRUCTION_SERVICE' ? ['service-engagement.capability.read'] : []),
    ];
    const branches = this.support.branches(principal, resourcePermissions);
    const at = principal.businessDate;
    const filters = [
      Prisma.sql`p."companyId"=${principal.companyId}::uuid`,
      Prisma.sql`EXISTS(SELECT 1 FROM property_branch_assignments a WHERE a."propertyId"=p.id AND a."effectiveFrom"<=${at}::date AND(a."effectiveTo" IS NULL OR a."effectiveTo">${at}::date) AND ${branchSql(Prisma.sql`a."branchId"`, branches)})`,
    ];
    if (query.propertyId) filters.push(Prisma.sql`p.id=${query.propertyId}::uuid`);
    if (query.search?.trim()) {
      const term = matchText(query.search);
      filters.push(
        space
          ? Prisma.sql`(s."spaceCode" ILIKE ${term} OR s.name ILIKE ${term})`
          : Prisma.sql`(p."propertyCode" ILIKE ${term} OR p.name ILIKE ${term})`,
      );
    }
    const base = space
      ? Prisma.sql`SELECT ARRAY[s."spaceCode",s.id::text] AS key,jsonb_build_object('id',s.id,'spaceCode',s."spaceCode",'name',s.name,'propertyId',p.id) AS data FROM rentable_spaces s JOIN properties p ON p.id=s."propertyId" WHERE ${clauses(filters)}`
      : Prisma.sql`SELECT ARRAY[p."propertyCode",p.id::text] AS key,jsonb_build_object('id',p.id,'propertyCode',p."propertyCode",'name',p.name) AS data FROM properties p WHERE ${clauses(filters)}`;
    const page = await this.read.page(
      base,
      query,
      space ? 'space-options' : 'property-options',
      this.read.scope(
        principal,
        [context.permission, ...resourcePermissions],
        { purpose: query.purpose, search: query.search, propertyId: query.propertyId },
        context,
      ),
    );
    if (intent === 'CONSTRUCTION_SERVICE')
      return {
        ...page,
        items: page.items.map((item) => ({ ...item, capability: null, capabilityAllowed: null })),
      };
    const propertyIds = [
      ...new Set(page.items.map((item) => String(space ? item.propertyId : item.id))),
    ];
    const engagements = propertyIds.length
      ? await this.support.database.serviceEngagement.findMany({
          where: {
            companyId: principal.companyId,
            propertyId: { in: propertyIds },
            status: 'ACTIVE',
            effectiveFrom: { lte: new Date(at) },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date(at) } }],
          },
          select: { propertyId: true, rentableSpaceId: true, serviceModel: true },
        })
      : [];
    const capability =
      intent === 'RENT'
        ? 'canReceiveRentalLead'
        : intent === 'BUY'
          ? 'canReceiveBuyerLead'
          : 'canReceiveSellerLead';
    return {
      ...page,
      items: page.items.map((item) => {
        const related = engagements.filter(
          (row) => row.propertyId === String(space ? item.propertyId : item.id),
        );
        const set = resolveCapabilitySet(
          related.filter((row) => row.rentableSpaceId === null).map((row) => row.serviceModel),
          space
            ? related
                .filter((row) => row.rentableSpaceId === item.id)
                .map((row) => row.serviceModel)
            : [],
        );
        return { ...item, capability, capabilityAllowed: set[capability] };
      }),
    };
  }
}
