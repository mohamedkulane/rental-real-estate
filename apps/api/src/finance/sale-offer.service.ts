import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SaleOfferEventType, SaleOfferStatus } from '@prisma/client';
import { uuidv7 } from '@rerms/shared';
import { cursorPage } from '../common/cursor-pagination';
import { nextRecordNumber } from '../common/record-number';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../governance/audit.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import { assertLifecycleTransition, FinancePolicyService, saleOfferTransitions } from './finance.policy';
import type { CreateSaleOfferDto, SaleOfferQueryDto, SaleOfferTransitionDto } from './finance.dto';

const isoDate = (value: string): Date => new Date(`${value.slice(0, 10)}T00:00:00.000Z`);

@Injectable()
export class SaleOfferService {
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

  async list(principal: AuthenticatedPrincipal, query: SaleOfferQueryDto) {
    const branchIds = this.branches(principal, 'sale-offer.read', query.branchId);
    const where: Prisma.SaleOfferWhereInput = {
      companyId: principal.companyId,
      ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.propertyId ? { propertyId: query.propertyId } : {}),
      ...(query.search
        ? { offerNumber: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    };
    const rows = await this.db.saleOffer.findMany({
      where,
      take: query.limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { property: { select: { propertyCode: true, name: true } } },
    });
    return cursorPage(rows, query.limit, (row) => row.id);
  }

  async create(principal: AuthenticatedPrincipal, input: CreateSaleOfferDto, correlationId?: string) {
    const context = await this.policy.activeEngagement(
      principal,
      input.serviceEngagementId,
      input.propertyId,
    );
    this.policy.assertCapability(context, 'canMarketPropertyForSale');
    this.auth.assertBranchPermission(principal, 'sale-offer.manage', context.branchId);
    const amount = new Prisma.Decimal(input.offerAmount);
    if (amount.lte(0)) throw new BadRequestException('Offer amount must be positive.');
    return this.db.$transaction(async (tx) => {
      const offer = await tx.saleOffer.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          branchId: context.branchId,
          serviceEngagementId: input.serviceEngagementId,
          propertyId: input.propertyId,
          saleListingId: input.saleListingId ?? null,
          leadId: input.leadId ?? null,
          buyerPartyId: input.buyerPartyId ?? null,
          offerNumber: await nextRecordNumber(tx, 'SALE_OFFER'),
          status: SaleOfferStatus.DRAFT,
          offerAmount: amount,
          currency: input.currency.toUpperCase(),
          offerDate: isoDate(input.offerDate),
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          termsNotes: input.termsNotes?.trim() || null,
        },
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'sale-offer.created',
        entityType: 'SaleOffer',
        entityId: offer.id,
        branchId: offer.branchId,
        correlationId,
        after: { offerNumber: offer.offerNumber, offerAmount: offer.offerAmount.toString() },
      });
      return offer;
    });
  }

  async transition(
    principal: AuthenticatedPrincipal,
    offerId: string,
    input: SaleOfferTransitionDto,
    correlationId?: string,
  ) {
    const current = await this.db.saleOffer.findFirst({
      where: { id: offerId, companyId: principal.companyId },
    });
    if (!current) throw new NotFoundException('Sale offer not found.');
    this.auth.assertBranchPermission(principal, 'sale-offer.manage', current.branchId);
    assertLifecycleTransition(current.status, input.status, saleOfferTransitions);
    if (input.status === SaleOfferStatus.COUNTERED && !input.counterAmount) {
      throw new BadRequestException('Counter amount is required.');
    }
    const eventType =
      input.status === SaleOfferStatus.COUNTERED
        ? SaleOfferEventType.COUNTER
        : input.status === SaleOfferStatus.ACCEPTED
          ? SaleOfferEventType.ACCEPTED
          : input.status === SaleOfferStatus.REJECTED
            ? SaleOfferEventType.REJECTED
            : input.status === SaleOfferStatus.WITHDRAWN
              ? SaleOfferEventType.WITHDRAWN
              : input.status === SaleOfferStatus.EXPIRED
                ? SaleOfferEventType.EXPIRED
                : SaleOfferEventType.SUBMITTED;
    return this.db.$transaction(async (tx) => {
      const row = await tx.saleOffer.update({
        where: { id: offerId },
        data: {
          status: input.status,
          offerAmount:
            input.status === SaleOfferStatus.COUNTERED && input.counterAmount
              ? new Prisma.Decimal(input.counterAmount)
              : current.offerAmount,
          acceptedAt: input.status === SaleOfferStatus.ACCEPTED ? new Date() : current.acceptedAt,
        },
      });
      await tx.saleOfferEvent.create({
        data: {
          id: uuidv7(),
          saleOfferId: offerId,
          eventType,
          fromAmount: current.offerAmount,
          toAmount: row.offerAmount,
          actorUserId: principal.userId,
          notes: input.reason,
        },
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'sale-offer.transitioned',
        entityType: 'SaleOffer',
        entityId: offerId,
        branchId: current.branchId,
        correlationId,
        reason: input.reason,
        before: { status: current.status, offerAmount: current.offerAmount.toString() },
        after: { status: row.status, offerAmount: row.offerAmount.toString() },
      });
      return row;
    });
  }

  async get(principal: AuthenticatedPrincipal, offerId: string) {
    const offer = await this.db.saleOffer.findFirst({
      where: { id: offerId, companyId: principal.companyId },
      include: { events: { orderBy: [{ occurredAt: 'desc' }] }, settlement: true },
    });
    if (!offer) throw new NotFoundException('Sale offer not found.');
    this.auth.assertBranchPermission(principal, 'sale-offer.read', offer.branchId);
    return offer;
  }
}
