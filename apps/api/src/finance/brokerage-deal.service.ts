import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BrokerageDealStatus, Prisma, ServiceModel } from '@prisma/client';
import { uuidv7 } from '@rerms/shared';
import { cursorPage } from '../common/cursor-pagination';
import { nextRecordNumber } from '../common/record-number';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../governance/audit.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import {
  assertLifecycleTransition,
  brokerageDealTransitions,
  FinancePolicyService,
} from './finance.policy';
import type {
  BrokerageDealQueryDto,
  BrokerageDealTransitionDto,
  CreateBrokerageDealDto,
} from './finance.dto';

@Injectable()
export class BrokerageDealService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auth: AuthorizationService,
    private readonly audit: AuditService,
    private readonly policy: FinancePolicyService,
  ) {}

  private branches(principal: AuthenticatedPrincipal, permission: string, branchId?: string) {
    const allowed = this.auth.authorizedBranchIds(principal, permission);
    if (allowed === null) return branchId ? [branchId] : null;
    return [...allowed].filter((id) => !branchId || id === branchId);
  }

  async list(principal: AuthenticatedPrincipal, query: BrokerageDealQueryDto) {
    const branchIds = this.branches(principal, 'brokerage-deal.read', query.branchId);
    const where: Prisma.BrokerageDealWhereInput = {
      companyId: principal.companyId,
      ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { dealNumber: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    };
    const rows = await this.db.brokerageDeal.findMany({
      where,
      take: query.limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        rentableSpace: { select: { spaceCode: true, name: true } },
        lease: { select: { leaseNumber: true } },
      },
    });
    return cursorPage(rows, query.limit, (row) => row.id);
  }

  async create(principal: AuthenticatedPrincipal, input: CreateBrokerageDealDto, correlationId?: string) {
    const space = await this.db.rentableSpace.findFirst({
      where: { id: input.rentableSpaceId, property: { companyId: principal.companyId } },
      select: { id: true, propertyId: true },
    });
    if (!space) throw new ConflictException('Rentable space is unavailable.');
    const context = await this.policy.activeEngagement(
      principal,
      input.serviceEngagementId,
      space.propertyId,
      input.rentableSpaceId,
    );
    if (context.engagement.serviceModel !== ServiceModel.RENTAL_BROKERAGE) {
      throw new ConflictException('Brokerage deals require a Rental Brokerage engagement.');
    }
    this.auth.assertBranchPermission(principal, 'brokerage-deal.manage', context.branchId);
    try {
      return await this.db.$transaction(async (tx) => {
        if (input.idempotencyKey) {
          const existing = await tx.brokerageDeal.findUnique({
            where: { idempotencyKey: input.idempotencyKey },
          });
          if (existing) return existing;
        }
        const deal = await tx.brokerageDeal.create({
          data: {
            id: uuidv7(),
            companyId: principal.companyId,
            branchId: context.branchId,
            serviceEngagementId: input.serviceEngagementId,
            leaseId: input.leaseId ?? null,
            rentableSpaceId: input.rentableSpaceId,
            leadId: input.leadId ?? null,
            viewingId: input.viewingId ?? null,
            rentalApplicationId: input.rentalApplicationId ?? null,
            dealNumber: await nextRecordNumber(tx, 'BROKERAGE_DEAL'),
            status: BrokerageDealStatus.DRAFT,
            rentBasis: input.rentBasis ? new Prisma.Decimal(input.rentBasis) : null,
            grossCommission: new Prisma.Decimal(input.grossCommission),
            agentCommission: input.agentCommission ? new Prisma.Decimal(input.agentCommission) : null,
            currency: input.currency.toUpperCase(),
            idempotencyKey: input.idempotencyKey ?? null,
          },
        });
        await this.audit.write(tx, {
          actorUserId: principal.userId,
          action: 'brokerage-deal.created',
          entityType: 'BrokerageDeal',
          entityId: deal.id,
          branchId: deal.branchId,
          correlationId,
          after: { dealNumber: deal.dealNumber, grossCommission: deal.grossCommission.toString() },
        });
        return deal;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && input.idempotencyKey) {
        const existing = await this.db.brokerageDeal.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (existing) return existing;
      }
      throw error;
    }
  }

  async transition(
    principal: AuthenticatedPrincipal,
    dealId: string,
    input: BrokerageDealTransitionDto,
    correlationId?: string,
  ) {
    const current = await this.db.brokerageDeal.findFirst({
      where: { id: dealId, companyId: principal.companyId },
    });
    if (!current) throw new NotFoundException('Brokerage deal not found.');
    this.auth.assertBranchPermission(principal, 'brokerage-deal.manage', current.branchId);
    assertLifecycleTransition(current.status, input.status, brokerageDealTransitions);
    if (input.status === BrokerageDealStatus.CLOSED && !current.leaseId) {
      throw new ConflictException('A linked lease is required before closing a brokerage deal.');
    }
    return this.db.$transaction(async (tx) => {
      const row = await tx.brokerageDeal.update({
        where: { id: dealId },
        data: {
          status: input.status,
          closedAt: input.status === BrokerageDealStatus.CLOSED ? new Date() : current.closedAt,
        },
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'brokerage-deal.transitioned',
        entityType: 'BrokerageDeal',
        entityId: dealId,
        branchId: current.branchId,
        correlationId,
        reason: input.reason,
        before: { status: current.status },
        after: { status: row.status },
      });
      return row;
    });
  }

  async get(principal: AuthenticatedPrincipal, dealId: string) {
    const deal = await this.db.brokerageDeal.findFirst({
      where: { id: dealId, companyId: principal.companyId },
      include: { lease: true, rentableSpace: true },
    });
    if (!deal) throw new NotFoundException('Brokerage deal not found.');
    this.auth.assertBranchPermission(principal, 'brokerage-deal.read', deal.branchId);
    return deal;
  }
}
