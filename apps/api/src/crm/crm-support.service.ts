import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { LeadIntent, Prisma, type Lead } from '@prisma/client';
import { uuidv7 } from '@rerms/shared';
import { DatabaseService } from '../database/database.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import { AuditService } from '../governance/audit.service';
import { resolveCapabilitySet } from '../commercial/service-engagement.policy';

export type CrmTx = Prisma.TransactionClient;
export type CrmDb = CrmTx | DatabaseService;
export const correlation = (value?: string) =>
  value && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
export const textValue = (value?: string | null) => value?.trim() || null;
export const dateValue = (value?: string) =>
  value ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : null;
export const ack = (row: { id: string; version: number }) => ({ id: row.id, version: row.version });

@Injectable()
export class CrmSupportService {
  constructor(
    readonly database: DatabaseService,
    readonly authorization: AuthorizationService,
    private readonly auditService: AuditService,
  ) {}

  branches(
    principal: AuthenticatedPrincipal,
    permissions: string[],
    requested?: string[],
  ): string[] | null {
    let result: Set<string> | null = null;
    for (const permission of permissions) {
      if (!principal.permissions.has(permission)) return [];
      const allowed = this.authorization.authorizedBranchIds(principal, permission);
      if (allowed !== null) {
        const allowedIds = allowed;
        if (result === null) result = new Set<string>(allowedIds);
        else {
          const intersection: string[] = Array.from(result).filter((id: string) => allowedIds.has(id));
          result = new Set<string>(intersection);
        }
      }
    }
    if (requested?.length)
      result = new Set(requested.filter((id) => result === null || result.has(id)));
    return result === null ? null : [...result].sort();
  }

  assert(principal: AuthenticatedPrincipal, permission: string, branchId: string) {
    if (!principal.permissions.has(permission)) throw new ForbiddenException('CRM_FORBIDDEN');
    this.authorization.assertBranchPermission(principal, permission, branchId);
  }
  assertCompany(principal: AuthenticatedPrincipal, permission: string) {
    if (!principal.permissions.has(permission)) throw new ForbiddenException('CRM_FORBIDDEN');
    this.authorization.assertCompanyPermission(principal, permission);
  }
  async branch(
    principal: AuthenticatedPrincipal,
    id: string,
    db: CrmDb = this.database,
    active = false,
  ) {
    const branch = await db.branch.findFirst({
      where: { id, companyId: principal.companyId, ...(active ? { active: true } : {}) },
      select: { id: true, code: true, name: true, active: true },
    });
    if (!branch) throw new NotFoundException('CRM_NOT_FOUND');
    return branch;
  }
  async lead(
    principal: AuthenticatedPrincipal,
    id: string,
    permissions: string[],
    db: CrmDb = this.database,
  ): Promise<Lead> {
    const lead = await db.lead.findFirst({ where: { id, companyId: principal.companyId } });
    if (!lead) throw new NotFoundException('CRM_NOT_FOUND');
    for (const permission of permissions)
      this.assert(principal, permission, lead.responsibleBranchId);
    return lead;
  }
  async lockedLead(
    tx: CrmTx,
    principal: AuthenticatedPrincipal,
    id: string,
    permission: string,
    version?: number,
  ) {
    await this.lead(principal, id, [permission], tx);
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM leads WHERE id=${id}::uuid AND "companyId"=${principal.companyId}::uuid FOR UPDATE`,
    );
    const lead = await this.lead(principal, id, [permission], tx);
    if (version !== undefined && version !== lead.version)
      throw new ConflictException('CRM_VERSION_CONFLICT');
    return lead;
  }
  async instant(tx: CrmTx) {
    const [row] = await tx.$queryRaw<Array<{ now: Date }>>(
      Prisma.sql`SELECT clock_timestamp() AS now`,
    );
    return row!.now;
  }
  async eligible(tx: CrmDb, companyId: string, employeeId: string, branchId: string) {
    const rows = await tx.$queryRaw<Array<{ eligible: boolean }>>(
      Prisma.sql`SELECT crm_employee_eligible(${employeeId}::uuid,${companyId}::uuid,${branchId}::uuid) AS eligible`,
    );
    if (!rows[0]?.eligible) throw new BadRequestException('CRM_INELIGIBLE_EMPLOYEE');
  }
  async audit(
    tx: CrmTx,
    principal: AuthenticatedPrincipal,
    action: string,
    entityType: string,
    entityId: string,
    branchId: string | null,
    before: Prisma.InputJsonObject,
    after: Prisma.InputJsonObject,
    correlationId?: string,
  ) {
    await this.auditService.write(tx, {
      actorUserId: principal.userId,
      action,
      entityType,
      entityId,
      branchId,
      correlationId,
      reason: action.toUpperCase().replaceAll('.', '_'),
      before: { companyId: principal.companyId, ...before },
      after: { companyId: principal.companyId, ...after },
    });
  }
  async source(principal: AuthenticatedPrincipal, id: string, tx: CrmDb) {
    const source = await tx.leadSource.findFirst({
      where: { id, companyId: principal.companyId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!source) throw new NotFoundException('CRM_NOT_FOUND');
  }
  partyWhere(principal: AuthenticatedPrincipal): Prisma.PartyWhereInput {
    const branches = this.branches(principal, ['party.read']);
    const at = new Date(`${principal.businessDate}T00:00:00.000Z`);
    const active = {
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
    };
    return {
      companyId: principal.companyId,
      employee: { is: null },
      ...(branches === null
        ? {}
        : {
            OR: [
              { branchAssignments: { some: { branchId: { in: branches }, ...active } } },
              {
                propertyOwnerships: {
                  some: {
                    ...active,
                    property: {
                      branchAssignments: { some: { branchId: { in: branches }, ...active } },
                    },
                  },
                },
              },
            ],
          }),
    };
  }
  async party(principal: AuthenticatedPrincipal, id: string, tx: CrmDb, required: boolean) {
    const value = await tx.party.findFirst({
      where: { AND: [{ id }, this.partyWhere(principal)] },
      select: { id: true, partyNumber: true, displayName: true, active: true },
    });
    if (required && !value) throw new NotFoundException('CRM_NOT_FOUND');
    return value;
  }
  async asset(
    principal: AuthenticatedPrincipal,
    intent: LeadIntent,
    propertyId: string | null | undefined,
    spaceId: string | null | undefined,
    tx: CrmDb,
    required: boolean,
  ) {
    if (!propertyId && !spaceId) return null;
    const at = new Date(`${principal.businessDate}T00:00:00.000Z`);
    const space = spaceId
      ? await tx.rentableSpace.findFirst({
          where: { id: spaceId, property: { companyId: principal.companyId } },
          select: { id: true, spaceCode: true, name: true, propertyId: true },
        })
      : null;
    if (spaceId && !space) {
      if (required) throw new NotFoundException('CRM_NOT_FOUND');
      return null;
    }
    const property = await tx.property.findFirst({
      where: { id: space?.propertyId ?? propertyId!, companyId: principal.companyId },
      select: {
        id: true,
        propertyCode: true,
        name: true,
        branchAssignments: {
          where: {
            effectiveFrom: { lte: at },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
          },
          select: { branchId: true },
          take: 1,
        },
      },
    });
    const branch = property?.branchAssignments[0]?.branchId;
    const permissions = [
      'portfolio.property.read',
      ...(spaceId ? ['portfolio.space.read'] : []),
      ...(intent !== 'CONSTRUCTION_SERVICE' ? ['service-engagement.capability.read'] : []),
    ];
    if (
      !property ||
      !branch ||
      permissions.some(
        (permission) =>
          !principal.permissions.has(permission) ||
          !this.authorization.canPerformInBranch(principal, permission, branch),
      )
    ) {
      if (required) throw new NotFoundException('CRM_NOT_FOUND');
      return null;
    }
    if (required && intent !== 'CONSTRUCTION_SERVICE') {
      const engagements = await tx.serviceEngagement.findMany({
        where: {
          companyId: principal.companyId,
          propertyId: property.id,
          status: 'ACTIVE',
          effectiveFrom: { lte: at },
          AND: [
            { OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] },
            { OR: [{ rentableSpaceId: null }, ...(spaceId ? [{ rentableSpaceId: spaceId }] : [])] },
          ],
        },
        select: { serviceModel: true, rentableSpaceId: true },
      });
      const capability = resolveCapabilitySet(
        engagements.filter((e) => e.rentableSpaceId === null).map((e) => e.serviceModel),
        engagements.filter((e) => e.rentableSpaceId === spaceId).map((e) => e.serviceModel),
      );
      const allowed =
        intent === 'RENT'
          ? capability.canReceiveRentalLead
          : intent === 'BUY'
            ? capability.canReceiveBuyerLead
            : capability.canReceiveSellerLead;
      if (!allowed) throw new BadRequestException('CRM_CAPABILITY_DENIED');
    }
    return {
      property: { id: property.id, propertyCode: property.propertyCode, name: property.name },
      rentableSpace: space,
    };
  }
  async cancelOpen(
    tx: CrmTx,
    principal: AuthenticatedPrincipal,
    lead: Lead,
    target: string,
    correlationId?: string,
  ) {
    const open = await tx.leadFollowUp.findMany({
      where: { leadId: lead.id, lead: { companyId: principal.companyId }, state: 'OPEN' },
      select: { id: true, version: true },
    });
    if (!open.length) return;
    const now = await this.instant(tx);
    const reason = `SYSTEM_LEAD_${target}`;
    await tx.leadFollowUp.updateMany({
      where: {
        id: { in: open.map((row) => row.id) },
        lead: { companyId: principal.companyId },
        state: 'OPEN',
      },
      data: {
        state: 'CANCELLED',
        outcomeActorUserId: principal.userId,
        outcomeAt: now,
        outcomeReason: reason,
        version: { increment: 1 },
      },
    });
    await tx.leadFollowUpOutcome.createMany({
      data: open.map((row) => ({
        id: uuidv7(),
        followUpId: row.id,
        fromState: 'OPEN',
        toState: 'CANCELLED',
        actorUserId: principal.userId,
        reason,
        followUpVersion: row.version + 1,
        correlationId: correlation(correlationId),
        occurredAt: now,
      })),
    });
    await tx.auditLog.createMany({
      data: open.map((row) => ({
        id: uuidv7(),
        actorUserId: principal.userId,
        effectiveActorUserId: principal.userId,
        action: 'crm.followup.system-cancelled',
        entityType: 'LeadFollowUp',
        entityId: row.id,
        branchId: lead.responsibleBranchId,
        correlationId: correlation(correlationId),
        reason,
        beforeSnapshot: { companyId: principal.companyId, state: 'OPEN', version: row.version },
        afterSnapshot: {
          companyId: principal.companyId,
          state: 'CANCELLED',
          version: row.version + 1,
        },
      })),
    });
  }
}
