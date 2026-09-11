import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SaleOfferStatus, SaleSettlementStatus } from '@prisma/client';
import { uuidv7 } from '@rerms/shared';
import { cursorPage } from '../common/cursor-pagination';
import { nextRecordNumber } from '../common/record-number';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../governance/audit.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import { computeSaleSettlementAmounts, FinancePolicyService, replayIdempotentRecord } from './finance.policy';
import type {
  CreateSaleSettlementDto,
  SaleSettlementQueryDto,
  SaleSettlementTransitionDto,
} from './finance.dto';

@Injectable()
export class SaleSettlementService {
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

  async list(principal: AuthenticatedPrincipal, query: SaleSettlementQueryDto) {
    const branchIds = this.branches(principal, 'sale-settlement.read', query.branchId);
    const where: Prisma.SaleSettlementWhereInput = {
      companyId: principal.companyId,
      ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { settlementNumber: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    };
    const rows = await this.db.saleSettlement.findMany({
      where,
      take: query.limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        saleOffer: { select: { offerNumber: true, status: true } },
        property: { select: { propertyCode: true, name: true } },
      },
    });
    return cursorPage(rows, query.limit, (row) => row.id);
  }

  async create(
    principal: AuthenticatedPrincipal,
    input: CreateSaleSettlementDto,
    correlationId?: string,
  ) {
    const offer = await this.db.saleOffer.findFirst({
      where: { id: input.saleOfferId, companyId: principal.companyId, status: SaleOfferStatus.ACCEPTED },
      include: { engagement: { select: { serviceModel: true } }, settlement: { select: { id: true } } },
    });
    if (!offer) throw new ConflictException('An accepted sale offer is required.');
    this.auth.assertBranchPermission(principal, 'sale-settlement.manage', offer.branchId);
    if (offer.settlement) throw new ConflictException('This sale offer already has a settlement.');
    const terms = await this.policy.commercialTermsAt(offer.serviceEngagementId, offer.offerDate);
    const salePrice = new Prisma.Decimal(input.salePrice);
    const approvedDeductions = new Prisma.Decimal(input.approvedDeductions ?? 0);
    const amounts = computeSaleSettlementAmounts({
      serviceModel: offer.engagement.serviceModel,
      salePrice,
      commissionPercent: terms?.commissionPercent ?? null,
      approvedDeductions,
    });
    try {
      return await this.db.$transaction(async (tx) => {
        if (input.idempotencyKey) {
          const existing = replayIdempotentRecord(
            await tx.saleSettlement.findUnique({
              where: { idempotencyKey: input.idempotencyKey },
            }),
            principal.companyId,
          );
          if (existing) return existing;
        }
        const settlement = await tx.saleSettlement.create({
          data: {
            id: uuidv7(),
            companyId: principal.companyId,
            branchId: offer.branchId,
            saleOfferId: offer.id,
            serviceEngagementId: offer.serviceEngagementId,
            propertyId: offer.propertyId,
            settlementNumber: await nextRecordNumber(tx, 'SALE_SETTLEMENT'),
            salePrice,
            grossCommission: amounts.grossCommission,
            sellerProceeds: amounts.sellerProceeds,
            companyProceeds: amounts.companyProceeds,
            approvedDeductions,
            currency: offer.currency,
            status: SaleSettlementStatus.DRAFT,
            closingDate: input.closingDate
              ? new Date(`${input.closingDate.slice(0, 10)}T00:00:00.000Z`)
              : null,
            idempotencyKey: input.idempotencyKey ?? null,
          },
        });
        await this.audit.write(tx, {
          actorUserId: principal.userId,
          action: 'sale-settlement.created',
          entityType: 'SaleSettlement',
          entityId: settlement.id,
          branchId: settlement.branchId,
          correlationId,
          after: {
            settlementNumber: settlement.settlementNumber,
            grossCommission: settlement.grossCommission.toString(),
            companyProceeds: settlement.companyProceeds.toString(),
          },
        });
        return settlement;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && input.idempotencyKey) {
        const existing = replayIdempotentRecord(
          await this.db.saleSettlement.findUnique({
            where: { idempotencyKey: input.idempotencyKey },
          }),
          principal.companyId,
        );
        if (existing) return existing;
      }
      throw error;
    }
  }

  async transition(
    principal: AuthenticatedPrincipal,
    settlementId: string,
    input: SaleSettlementTransitionDto,
    correlationId?: string,
  ) {
    const current = await this.db.saleSettlement.findFirst({
      where: { id: settlementId, companyId: principal.companyId },
    });
    if (!current) throw new NotFoundException('Sale settlement not found.');
    this.auth.assertBranchPermission(principal, 'sale-settlement.manage', current.branchId);
    const allowed: Record<SaleSettlementStatus, readonly SaleSettlementStatus[]> = {
      DRAFT: [SaleSettlementStatus.APPROVED, SaleSettlementStatus.CANCELLED],
      APPROVED: [SaleSettlementStatus.SETTLED, SaleSettlementStatus.CANCELLED],
      SETTLED: [],
      CANCELLED: [],
    };
    if (!allowed[current.status].includes(input.status)) {
      throw new ConflictException(`Settlement cannot transition from ${current.status} to ${input.status}.`);
    }
    return this.db.$transaction(async (tx) => {
      const row = await tx.saleSettlement.update({
        where: { id: settlementId },
        data: {
          status: input.status,
          settledAt: input.status === SaleSettlementStatus.SETTLED ? new Date() : current.settledAt,
        },
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'sale-settlement.transitioned',
        entityType: 'SaleSettlement',
        entityId: settlementId,
        branchId: current.branchId,
        correlationId,
        reason: input.reason,
        before: { status: current.status },
        after: { status: row.status },
      });
      return row;
    });
  }

  async get(principal: AuthenticatedPrincipal, settlementId: string) {
    const settlement = await this.db.saleSettlement.findFirst({
      where: { id: settlementId, companyId: principal.companyId },
      include: { saleOffer: true, property: true },
    });
    if (!settlement) throw new NotFoundException('Sale settlement not found.');
    this.auth.assertBranchPermission(principal, 'sale-settlement.read', settlement.branchId);
    return settlement;
  }
}
