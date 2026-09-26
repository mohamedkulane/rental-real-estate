import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AgreementCommissionMethod,
  AgreementStatus,
  BrokerageDealStatus,
  LeadIntent,
  Prisma,
  PropertyStatus,
  SaleOfferEventType,
  SaleOfferStatus,
  ServiceEngagementStatus,
  ServiceModel,
  ViewingStatus,
} from '@prisma/client';
import { uuidv7 } from '@rerms/shared';
import { nextRecordNumber } from '../common/record-number';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../governance/audit.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import type {
  AgreementTransitionDto,
  CommissionTermsDto,
  CreateRentalAgreementDto,
  CreateSaleAgreementDto,
} from './rental.dto';
import { interestedViewingOutcomeFilter } from './viewing-outcome';

const asDate = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00.000Z`);

function positive(value: string, field: string): Prisma.Decimal {
  const amount = new Prisma.Decimal(value);
  if (!amount.gt(0)) throw new BadRequestException(`${field} must be greater than zero.`);
  return amount;
}

function commissionAmount(
  terms: { method: AgreementCommissionMethod; value: Prisma.Decimal } | null,
  basis: Prisma.Decimal,
): Prisma.Decimal {
  if (!terms) return new Prisma.Decimal(0);
  return terms.method === AgreementCommissionMethod.PERCENT
    ? basis.mul(terms.value).div(100)
    : terms.value;
}

@Injectable()
export class AgreementService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auth: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  private commission(terms: CommissionTermsDto | undefined, label: string) {
    if (!terms) return null;
    const value = positive(terms.value, `${label} commission`);
    if (terms.method === AgreementCommissionMethod.PERCENT && value.gt(100)) {
      throw new BadRequestException(`${label} commission percentage cannot exceed 100.`);
    }
    return { method: terms.method, value };
  }

  private async rentalContext(principal: AuthenticatedPrincipal, input: CreateRentalAgreementDto) {
    const viewing = await this.db.viewing.findFirst({
      where: {
        id: input.viewingId,
        companyId: principal.companyId,
        leadId: input.leadId,
        rentableSpaceId: input.rentableSpaceId,
        status: ViewingStatus.COMPLETED,
        outcome: interestedViewingOutcomeFilter,
      },
      select: { id: true, branchId: true },
    });
    if (!viewing) throw new ConflictException('An interested completed viewing is required before an agreement.');
    this.auth.assertBranchPermission(principal, 'lease.create', viewing.branchId);

    const lead = await this.db.lead.findFirst({
      where: { id: input.leadId, companyId: principal.companyId, intent: LeadIntent.RENT },
      select: { id: true, partyId: true },
    });
    if (!lead?.partyId) throw new ConflictException('The rental customer needs a saved identity.');
    const property = await this.db.property.findFirst({
      where: { id: input.propertyId, companyId: principal.companyId, status: PropertyStatus.ACTIVE },
      include: {
        ownerships: { where: { effectiveTo: null }, orderBy: { effectiveFrom: 'desc' }, take: 1 },
        spaces: { where: { id: input.rentableSpaceId, status: 'ACTIVE' }, include: { versions: { orderBy: { versionNo: 'desc' }, take: 1 } } },
      },
    });
    if (!property?.spaces[0] || !property.ownerships[0]) {
      throw new ConflictException('The selected property, unit, or owner is unavailable.');
    }
    const engagement = await this.db.serviceEngagement.findFirst({
      where: {
        companyId: principal.companyId,
        propertyId: property.id,
        status: ServiceEngagementStatus.ACTIVE,
        serviceModel: { in: [ServiceModel.RENTAL_BROKERAGE, ServiceModel.FULL_MANAGEMENT] },
        OR: [{ rentableSpaceId: null }, { rentableSpaceId: input.rentableSpaceId }],
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!engagement) throw new ConflictException('An active rental service is required before an agreement.');
    const attributes = property.spaces[0].versions[0]?.attributes as { askingRent?: string; currency?: string } | null;
    if (!attributes?.askingRent) throw new ConflictException('Set the unit asking rent before creating an agreement.');
    return { viewing, lead, property, engagement, askingRent: positive(String(attributes.askingRent), 'Asking rent'), currency: attributes.currency ?? 'USD' };
  }

  async createRental(principal: AuthenticatedPrincipal, input: CreateRentalAgreementDto, correlationId?: string) {
    const start = asDate(input.leaseStartDate);
    const end = input.leaseEndDate ? asDate(input.leaseEndDate) : null;
    if (end && end <= start) throw new BadRequestException('Lease end date must be after the start date.');
    const context = await this.rentalContext(principal, input);
    const ownerCommission = this.commission(input.ownerCommission, 'Owner');
    const tenantCommission = this.commission(input.tenantCommission, 'Tenant');
    if (context.engagement.serviceModel === ServiceModel.RENTAL_BROKERAGE && (!ownerCommission || !tenantCommission)) {
      throw new BadRequestException('Rental Brokerage agreements require owner and tenant commissions.');
    }
    if (context.engagement.serviceModel === ServiceModel.FULL_MANAGEMENT && ownerCommission) {
      throw new BadRequestException('Full Management agreements do not include an owner brokerage commission.');
    }
    return this.db.$transaction(async (tx) => {
      const agreement = await tx.rentalAgreement.create({
        data: {
          id: uuidv7(), companyId: principal.companyId, branchId: context.viewing.branchId,
          agreementNumber: await nextRecordNumber(tx, 'RENTAL_AGREEMENT'), leadId: context.lead.id,
          viewingId: context.viewing.id, propertyId: context.property.id, rentableSpaceId: input.rentableSpaceId,
          serviceEngagementId: context.engagement.id, ownerPartyId: context.property.ownerships[0]!.ownerPartyId,
          customerPartyId: context.lead.partyId!, originalAskingRent: context.askingRent,
          finalRent: positive(input.finalRent, 'Final agreed rent'), currency: context.currency.toUpperCase(),
          leaseStartDate: start, leaseEndDate: end,
          depositAmount: input.depositAmount ? positive(input.depositAmount, 'Deposit') : null,
          ownerCommissionMethod: ownerCommission?.method ?? null, ownerCommissionValue: ownerCommission?.value ?? null,
          tenantCommissionMethod: tenantCommission?.method ?? null, tenantCommissionValue: tenantCommission?.value ?? null,
          notes: input.notes?.trim() || null, createdByUserId: principal.userId,
        },
      });
      await this.audit.write(tx, { actorUserId: principal.userId, action: 'rental-agreement.created', entityType: 'RentalAgreement', entityId: agreement.id, branchId: agreement.branchId, correlationId, after: { agreementNumber: agreement.agreementNumber, finalRent: agreement.finalRent.toString() } });
      return agreement;
    });
  }

  async confirmRental(principal: AuthenticatedPrincipal, id: string, input: AgreementTransitionDto, correlationId?: string) {
    const agreement = await this.db.rentalAgreement.findFirst({ where: { id, companyId: principal.companyId }, include: { serviceEngagement: true } });
    if (!agreement) throw new NotFoundException('Rental agreement not found.');
    this.auth.assertBranchPermission(principal, 'lease.create', agreement.branchId);
    if (agreement.status !== AgreementStatus.DRAFT) throw new ConflictException('Only a draft agreement can be confirmed.');
    const viewing = await this.db.viewing.findFirst({
      where: {
        id: agreement.viewingId,
        status: ViewingStatus.COMPLETED,
        outcome: interestedViewingOutcomeFilter,
      },
    });
    if (!viewing || agreement.serviceEngagement.status !== ServiceEngagementStatus.ACTIVE) throw new ConflictException('The viewing or service is no longer eligible for agreement confirmation.');
    return this.db.$transaction(async (tx) => {
      const changed = await tx.rentalAgreement.updateMany({ where: { id, status: AgreementStatus.DRAFT, version: input.expectedVersion }, data: { status: AgreementStatus.CONFIRMED, confirmedAt: new Date(), version: { increment: 1 } } });
      if (changed.count !== 1) throw new ConflictException('Agreement is stale or has already changed.');
      const confirmed = await tx.rentalAgreement.findUniqueOrThrow({ where: { id } });
      if (agreement.serviceEngagement.serviceModel === ServiceModel.RENTAL_BROKERAGE) {
        const owner = commissionAmount(confirmed.ownerCommissionMethod && confirmed.ownerCommissionValue ? { method: confirmed.ownerCommissionMethod, value: confirmed.ownerCommissionValue } : null, confirmed.finalRent);
        const tenant = commissionAmount(confirmed.tenantCommissionMethod && confirmed.tenantCommissionValue ? { method: confirmed.tenantCommissionMethod, value: confirmed.tenantCommissionValue } : null, confirmed.finalRent);
        await tx.brokerageDeal.create({ data: { id: uuidv7(), companyId: principal.companyId, branchId: confirmed.branchId, serviceEngagementId: confirmed.serviceEngagementId, rentableSpaceId: confirmed.rentableSpaceId, leadId: confirmed.leadId, viewingId: confirmed.viewingId, rentalAgreementId: confirmed.id, dealNumber: await nextRecordNumber(tx, 'BROKERAGE_DEAL'), status: BrokerageDealStatus.CONFIRMED, rentBasis: confirmed.finalRent, grossCommission: owner.plus(tenant), currency: confirmed.currency } });
      }
      await this.audit.write(tx, { actorUserId: principal.userId, action: 'rental-agreement.confirmed', entityType: 'RentalAgreement', entityId: id, branchId: agreement.branchId, correlationId, reason: input.reason, before: { status: agreement.status }, after: { status: AgreementStatus.CONFIRMED } });
      return confirmed;
    });
  }

  async createSale(principal: AuthenticatedPrincipal, input: CreateSaleAgreementDto, correlationId?: string) {
    const viewing = await this.db.viewing.findFirst({
      where: {
        id: input.viewingId,
        companyId: principal.companyId,
        leadId: input.leadId,
        status: ViewingStatus.COMPLETED,
        outcome: interestedViewingOutcomeFilter,
      },
      select: {
        id: true,
        branchId: true,
        rentableSpace: { select: { propertyId: true } },
        property: { select: { id: true } },
        saleListing: { select: { propertyId: true } },
      },
    });
    if (!viewing || (viewing.property?.id ?? viewing.rentableSpace?.propertyId ?? viewing.saleListing?.propertyId) !== input.propertyId) throw new ConflictException('An interested completed viewing for this property is required before an agreement.');
    this.auth.assertBranchPermission(principal, 'sale-offer.manage', viewing.branchId);
    const [lead, property] = await Promise.all([
      this.db.lead.findFirst({ where: { id: input.leadId, companyId: principal.companyId, intent: LeadIntent.BUY }, select: { id: true, partyId: true } }),
      this.db.property.findFirst({ where: { id: input.propertyId, companyId: principal.companyId, status: PropertyStatus.ACTIVE }, include: { ownerships: { where: { effectiveTo: null }, orderBy: { effectiveFrom: 'desc' }, take: 1 }, company: { select: { legalPartyId: true } } } }),
    ]);
    if (!lead?.partyId || !property?.ownerships[0] || !property.salePrice) throw new ConflictException('The buyer, seller, or sale asking price is unavailable.');
    const engagement = await this.db.serviceEngagement.findFirst({ where: { companyId: principal.companyId, propertyId: property.id, status: ServiceEngagementStatus.ACTIVE, serviceModel: { in: [ServiceModel.SALE_BROKERAGE, ServiceModel.COMPANY_OWNED] } }, orderBy: { createdAt: 'desc' } });
    if (!engagement) throw new ConflictException('An active sale service is required before an agreement.');
    const companyOwned = engagement.serviceModel === ServiceModel.COMPANY_OWNED || property.company.legalPartyId === property.ownerships[0].ownerPartyId;
    const sellerCommission = this.commission(input.sellerCommission, 'Seller');
    const buyerCommission = this.commission(input.buyerCommission, 'Buyer');
    if (!companyOwned && !sellerCommission) throw new BadRequestException('Seller commission is required for an external-owner sale.');
    return this.db.$transaction(async (tx) => tx.saleAgreement.create({ data: { id: uuidv7(), companyId: principal.companyId, branchId: viewing.branchId, agreementNumber: await nextRecordNumber(tx, 'SALE_AGREEMENT'), leadId: lead.id, viewingId: viewing.id, propertyId: property.id, serviceEngagementId: engagement.id, sellerPartyId: property.ownerships[0]!.ownerPartyId, buyerPartyId: lead.partyId!, originalAskingPrice: property.salePrice!, finalSalePrice: positive(input.finalSalePrice, 'Final sale price'), currency: (property.salePriceCurrency ?? 'USD').toUpperCase(), companyOwned, sellerCommissionMethod: sellerCommission?.method ?? null, sellerCommissionValue: sellerCommission?.value ?? null, buyerCommissionMethod: buyerCommission?.method ?? null, buyerCommissionValue: buyerCommission?.value ?? null, notes: input.notes?.trim() || null, createdByUserId: principal.userId } }));
  }

  async confirmSale(principal: AuthenticatedPrincipal, id: string, input: AgreementTransitionDto, correlationId?: string) {
    const agreement = await this.db.saleAgreement.findFirst({ where: { id, companyId: principal.companyId }, include: { serviceEngagement: true } });
    if (!agreement) throw new NotFoundException('Sale agreement not found.');
    this.auth.assertBranchPermission(principal, 'sale-offer.manage', agreement.branchId);
    if (agreement.status !== AgreementStatus.DRAFT) throw new ConflictException('Only a draft agreement can be confirmed.');
    if (!agreement.companyOwned && (!agreement.sellerCommissionMethod || !agreement.sellerCommissionValue)) throw new ConflictException('Seller commission is required for an external-owner sale.');
    return this.db.$transaction(async (tx) => {
      const changed = await tx.saleAgreement.updateMany({ where: { id, status: AgreementStatus.DRAFT, version: input.expectedVersion }, data: { status: AgreementStatus.CONFIRMED, confirmedAt: new Date(), version: { increment: 1 } } });
      if (changed.count !== 1) throw new ConflictException('Agreement is stale or has already changed.');
      const confirmed = await tx.saleAgreement.findUniqueOrThrow({ where: { id } });
      const offer = await tx.saleOffer.create({ data: { id: uuidv7(), companyId: principal.companyId, branchId: confirmed.branchId, serviceEngagementId: confirmed.serviceEngagementId, propertyId: confirmed.propertyId, leadId: confirmed.leadId, buyerPartyId: confirmed.buyerPartyId, saleAgreementId: confirmed.id, offerNumber: await nextRecordNumber(tx, 'SALE_OFFER'), status: SaleOfferStatus.ACCEPTED, offerAmount: confirmed.finalSalePrice, currency: confirmed.currency, offerDate: new Date(), acceptedAt: new Date(), termsNotes: confirmed.notes } });
      await tx.saleOfferEvent.create({ data: { id: uuidv7(), saleOfferId: offer.id, eventType: SaleOfferEventType.ACCEPTED, toAmount: offer.offerAmount, actorUserId: principal.userId, notes: 'Accepted from confirmed sale agreement' } });
      await this.audit.write(tx, { actorUserId: principal.userId, action: 'sale-agreement.confirmed', entityType: 'SaleAgreement', entityId: id, branchId: agreement.branchId, correlationId, reason: input.reason, before: { status: agreement.status }, after: { status: AgreementStatus.CONFIRMED, saleOfferId: offer.id } });
      return { agreement: confirmed, saleOfferId: offer.id };
    });
  }
}
