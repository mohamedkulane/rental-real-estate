import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { LeadIntent, ListingStatus, Prisma, PropertyStatus, RentableSpaceStatus, ServiceEngagementStatus } from '@prisma/client';
import { uuidv7 } from '@rerms/shared';
import { nextRecordNumber } from '../common/record-number';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../governance/audit.service';
import { resolveCapabilitySet } from '../commercial/service-engagement.policy';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import type { CreateRentalListingDto, CreateSaleListingDto, ListingQueryDto, MatchListingsDto, VersionedTransitionDto } from './phase5-operations.dto';

export const listingTransitions: Record<ListingStatus, readonly ListingStatus[]> = {
  DRAFT: [ListingStatus.PENDING_REVIEW],
  PENDING_REVIEW: [ListingStatus.PUBLISHED, ListingStatus.DRAFT],
  PUBLISHED: [ListingStatus.PAUSED, ListingStatus.UNPUBLISHED, ListingStatus.CLOSED],
  PAUSED: [ListingStatus.PUBLISHED, ListingStatus.UNPUBLISHED, ListingStatus.CLOSED],
  UNPUBLISHED: [ListingStatus.ARCHIVED],
  CLOSED: [ListingStatus.ARCHIVED],
  ARCHIVED: [],
};

@Injectable()
export class ListingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auth: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  private branchIds(principal: AuthenticatedPrincipal, permission: string, branchId?: string) {
    const allowed = this.auth.authorizedBranchIds(principal, permission);
    if (allowed === null) return branchId ? [branchId] : null;
    return [...allowed].filter((id) => !branchId || id === branchId);
  }

  private async propertyBranch(principal: AuthenticatedPrincipal, propertyId: string, permission: string) {
    const at = new Date(`${principal.businessDate}T00:00:00.000Z`);
    const property = await this.db.property.findFirst({
      where: { id: propertyId, companyId: principal.companyId },
      select: {
        id: true,
        status: true,
        propertyType: true,
        branchAssignments: {
          where: { effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] },
          select: { branchId: true },
          orderBy: [{ effectiveFrom: 'desc' }, { id: 'desc' }],
          take: 1,
        },
      },
    });
    const branchId = property?.branchAssignments[0]?.branchId;
    if (!property || !branchId) throw new NotFoundException('Property is unavailable.');
    this.auth.assertBranchPermission(principal, permission, branchId);
    return { ...property, branchId };
  }

  private currentEngagementWhere(principal: AuthenticatedPrincipal): Prisma.ServiceEngagementWhereInput {
    const at = new Date(`${principal.businessDate}T00:00:00.000Z`);
    return {
      status: ServiceEngagementStatus.ACTIVE,
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
    };
  }

  private assertTransition(current: ListingStatus, target: ListingStatus) {
    if (!listingTransitions[current].includes(target))
      throw new BadRequestException(`Listing cannot transition from ${current} to ${target}.`);
  }

  async listRental(principal: AuthenticatedPrincipal, query: ListingQueryDto) {
    const branchIds = this.branchIds(principal, 'listing.read', query.branchId);
    const baseWhere: Prisma.RentalListingWhereInput = {
      companyId: principal.companyId,
      ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { OR: [
        { listingNumber: { contains: query.search, mode: 'insensitive' } },
        { title: { contains: query.search, mode: 'insensitive' } },
        { rentableSpace: { is: { name: { contains: query.search, mode: 'insensitive' } } } },
        { rentableSpace: { is: { spaceCode: { contains: query.search, mode: 'insensitive' } } } },
      ] } : {}),
    };
    const where = { ...baseWhere, ...(query.cursor ? { id: { lt: query.cursor } } : {}) };
    const [rows, total] = await this.db.$transaction([
      this.db.rentalListing.findMany({
        where,
        orderBy: { id: 'desc' },
        take: query.limit + 1,
        include: { rentableSpace: { select: { id: true, spaceCode: true, name: true, property: { select: { id: true, propertyCode: true, name: true } } } }, serviceEngagement: { select: { id: true, serviceModel: true, status: true } } },
      }),
      this.db.rentalListing.count({ where: baseWhere }),
    ]);
    const hasNextPage = rows.length > query.limit;
    const items = rows.slice(0, query.limit);
    return { items, total, pageInfo: { hasNextPage, nextCursor: hasNextPage ? items.at(-1)?.id ?? null : null } };
  }

  async listSale(principal: AuthenticatedPrincipal, query: ListingQueryDto) {
    const branchIds = this.branchIds(principal, 'listing.read', query.branchId);
    const baseWhere: Prisma.SaleListingWhereInput = {
      companyId: principal.companyId,
      ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { OR: [
        { listingNumber: { contains: query.search, mode: 'insensitive' } },
        { title: { contains: query.search, mode: 'insensitive' } },
        { property: { is: { name: { contains: query.search, mode: 'insensitive' } } } },
        { property: { is: { propertyCode: { contains: query.search, mode: 'insensitive' } } } },
      ] } : {}),
    };
    const where = { ...baseWhere, ...(query.cursor ? { id: { lt: query.cursor } } : {}) };
    const [rows, total] = await this.db.$transaction([
      this.db.saleListing.findMany({
        where,
        orderBy: { id: 'desc' },
        take: query.limit + 1,
        include: { property: { select: { id: true, propertyCode: true, name: true, propertyType: true } }, serviceEngagement: { select: { id: true, serviceModel: true, status: true } } },
      }),
      this.db.saleListing.count({ where: baseWhere }),
    ]);
    const hasNextPage = rows.length > query.limit;
    const items = rows.slice(0, query.limit);
    return { items, total, pageInfo: { hasNextPage, nextCursor: hasNextPage ? items.at(-1)?.id ?? null : null } };
  }

  async getRental(principal: AuthenticatedPrincipal, id: string) {
    const row = await this.db.rentalListing.findFirst({ where: { id, companyId: principal.companyId }, include: { rentableSpace: { include: { property: true, type: true } }, serviceEngagement: true } });
    if (!row) throw new NotFoundException('Rental Listing not found.');
    this.auth.assertBranchPermission(principal, 'listing.read', row.branchId);
    return row;
  }

  async getSale(principal: AuthenticatedPrincipal, id: string) {
    const row = await this.db.saleListing.findFirst({ where: { id, companyId: principal.companyId }, include: { property: true, serviceEngagement: true } });
    if (!row) throw new NotFoundException('Sale Listing not found.');
    this.auth.assertBranchPermission(principal, 'listing.read', row.branchId);
    return row;
  }

  async createRental(principal: AuthenticatedPrincipal, input: CreateRentalListingDto, correlationId?: string) {
    const space = await this.db.rentableSpace.findFirst({ where: { id: input.rentableSpaceId, property: { companyId: principal.companyId } }, include: { property: true } });
    if (!space || space.status !== RentableSpaceStatus.ACTIVE) throw new ConflictException('Only an active Rentable Space may be listed.');
    const property = await this.propertyBranch(principal, space.propertyId, 'listing.create');
    const engagement = await this.db.serviceEngagement.findFirst({ where: { id: input.serviceEngagementId, companyId: principal.companyId, propertyId: space.propertyId, AND: [this.currentEngagementWhere(principal), { OR: [{ rentableSpaceId: null }, { rentableSpaceId: space.id }] }] } });
    if (!engagement) throw new ConflictException('An active compatible Service Engagement is required.');
    if (!resolveCapabilitySet(engagement.rentableSpaceId ? [] : [engagement.serviceModel], engagement.rentableSpaceId ? [engagement.serviceModel] : []).canCreateRentalListing)
      throw new ConflictException('The Service Engagement does not permit Rental Listings.');
    return this.db.$transaction(async (tx) => {
      const row = await tx.rentalListing.create({ data: {
        id: uuidv7(), companyId: principal.companyId, branchId: property.branchId,
        listingNumber: await nextRecordNumber(tx, 'RENTAL_LISTING'), rentableSpaceId: space.id,
        serviceEngagementId: engagement.id, title: input.title.trim(), description: input.description?.trim() || null,
        askingRent: input.askingRent ? new Prisma.Decimal(input.askingRent) : null, currency: input.currency.toUpperCase(),
        availableFrom: input.availableFrom ? new Date(input.availableFrom) : null, createdByUserId: principal.userId,
      } });
      await this.audit.write(tx, { actorUserId: principal.userId, action: 'rental-listing.created', entityType: 'RentalListing', entityId: row.id, branchId: row.branchId, correlationId, after: { listingNumber: row.listingNumber, rentableSpaceId: row.rentableSpaceId, serviceEngagementId: row.serviceEngagementId } });
      return row;
    }).catch((error: unknown) => { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('An open Rental Listing already exists for this Rentable Space.'); throw error; });
  }

  async createSale(principal: AuthenticatedPrincipal, input: CreateSaleListingDto, correlationId?: string) {
    const property = await this.propertyBranch(principal, input.propertyId, 'listing.create');
    if (property.status !== PropertyStatus.ACTIVE) throw new ConflictException('Only an active Property may be listed for sale.');
    const engagement = await this.db.serviceEngagement.findFirst({ where: { id: input.serviceEngagementId, companyId: principal.companyId, propertyId: input.propertyId, rentableSpaceId: null, AND: [this.currentEngagementWhere(principal)] } });
    if (!engagement) throw new ConflictException('An active Property-scoped Service Engagement is required.');
    if (!resolveCapabilitySet([engagement.serviceModel]).canCreateSaleListing) throw new ConflictException('The Service Engagement does not permit Sale Listings.');
    return this.db.$transaction(async (tx) => {
      const row = await tx.saleListing.create({ data: {
        id: uuidv7(), companyId: principal.companyId, branchId: property.branchId,
        listingNumber: await nextRecordNumber(tx, 'SALE_LISTING'), propertyId: property.id,
        serviceEngagementId: engagement.id, title: input.title.trim(), description: input.description?.trim() || null,
        askingPrice: input.askingPrice ? new Prisma.Decimal(input.askingPrice) : null, currency: input.currency.toUpperCase(), createdByUserId: principal.userId,
      } });
      await this.audit.write(tx, { actorUserId: principal.userId, action: 'sale-listing.created', entityType: 'SaleListing', entityId: row.id, branchId: row.branchId, correlationId, after: { listingNumber: row.listingNumber, propertyId: row.propertyId, serviceEngagementId: row.serviceEngagementId } });
      return row;
    }).catch((error: unknown) => { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('An open Sale Listing already exists for this Property.'); throw error; });
  }

  private async transitionRentalOrSale(kind: 'rental' | 'sale', principal: AuthenticatedPrincipal, id: string, target: ListingStatus, input: VersionedTransitionDto, correlationId?: string) {
    const model = kind === 'rental' ? this.db.rentalListing : this.db.saleListing;
    const current = await (model as typeof this.db.rentalListing).findFirst({ where: { id, companyId: principal.companyId } });
    if (!current) throw new NotFoundException('Listing not found.');
    this.auth.assertBranchPermission(principal, target === ListingStatus.PENDING_REVIEW ? 'listing.review' : 'listing.publish', current.branchId);
    this.assertTransition(current.status, target);
    const updateData = { status: target, version: { increment: 1 }, ...(target === ListingStatus.PUBLISHED ? { publishedAt: new Date() } : {}) };
    return this.db.$transaction(async (tx) => {
      const delegate = kind === 'rental' ? tx.rentalListing : tx.saleListing;
      const changed = await (delegate as typeof tx.rentalListing).updateMany({ where: { id, companyId: principal.companyId, version: input.expectedVersion, status: current.status }, data: updateData });
      if (changed.count !== 1) throw new ConflictException('Listing is stale or has already changed.');
      const row = await (delegate as typeof tx.rentalListing).findUniqueOrThrow({ where: { id } });
      await this.audit.write(tx, { actorUserId: principal.userId, action: `${kind}-listing.transitioned`, entityType: kind === 'rental' ? 'RentalListing' : 'SaleListing', entityId: id, branchId: current.branchId, correlationId, reason: input.reason, before: { status: current.status, version: current.version }, after: { status: target, version: row.version } });
      return row;
    }).catch((error: unknown) => { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Another open Listing already exists for this target.'); throw error; });
  }

  transitionRental(principal: AuthenticatedPrincipal, id: string, target: ListingStatus, input: VersionedTransitionDto, correlationId?: string) { return this.transitionRentalOrSale('rental', principal, id, target, input, correlationId); }
  transitionSale(principal: AuthenticatedPrincipal, id: string, target: ListingStatus, input: VersionedTransitionDto, correlationId?: string) { return this.transitionRentalOrSale('sale', principal, id, target, input, correlationId); }

  async match(principal: AuthenticatedPrincipal, query: MatchListingsDto) {
    const lead = await this.db.lead.findFirst({
      where: { id: query.leadId, companyId: principal.companyId },
      include: { preferenceVersions: { where: { effectiveTo: null }, orderBy: { versionNo: 'desc' }, take: 1, include: { rent: true, buy: true } } },
    });
    if (!lead) throw new NotFoundException('Lead not found.');
    this.auth.assertBranchPermission(principal, 'listing.match', lead.responsibleBranchId);
    const preference = lead.preferenceVersions[0];
    if (lead.intent === LeadIntent.RENT) {
      const where: Prisma.RentalListingWhereInput = {
        companyId: principal.companyId, branchId: lead.responsibleBranchId, status: ListingStatus.PUBLISHED,
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
        ...(query.search ? { OR: [{ title: { contains: query.search, mode: 'insensitive' } }, { listingNumber: { contains: query.search, mode: 'insensitive' } }] } : {}),
        ...(preference?.rent?.currency ? { currency: preference.rent.currency } : {}),
        ...(preference?.rent?.minRent || preference?.rent?.maxRent ? { askingRent: { ...(preference.rent.minRent ? { gte: preference.rent.minRent } : {}), ...(preference.rent.maxRent ? { lte: preference.rent.maxRent } : {}) } } : {}),
      };
      const rows = await this.db.rentalListing.findMany({ where, orderBy: { id: 'desc' }, take: query.limit + 1, include: { rentableSpace: { include: { property: true, type: true } } } });
      const hasNextPage = rows.length > query.limit;
      const items = rows.slice(0, query.limit).map((row) => ({ listingType: 'RENTAL' as const, listing: row, score: 100, reasons: ['Published in the Lead branch', ...(preference?.rent?.minRent || preference?.rent?.maxRent ? ['Rent is within the requested budget'] : [])] }));
      return { items, pageInfo: { hasNextPage, nextCursor: hasNextPage ? items.at(-1)?.listing.id ?? null : null } };
    }
    if (lead.intent === LeadIntent.BUY) {
      const where: Prisma.SaleListingWhereInput = {
        companyId: principal.companyId, branchId: lead.responsibleBranchId, status: ListingStatus.PUBLISHED,
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
        ...(query.search ? { OR: [{ title: { contains: query.search, mode: 'insensitive' } }, { listingNumber: { contains: query.search, mode: 'insensitive' } }] } : {}),
        ...(preference?.buy?.currency ? { currency: preference.buy.currency } : {}),
        ...(preference?.buy?.minBudget || preference?.buy?.maxBudget ? { askingPrice: { ...(preference.buy.minBudget ? { gte: preference.buy.minBudget } : {}), ...(preference.buy.maxBudget ? { lte: preference.buy.maxBudget } : {}) } } : {}),
      };
      const rows = await this.db.saleListing.findMany({ where, orderBy: { id: 'desc' }, take: query.limit + 1, include: { property: true } });
      const hasNextPage = rows.length > query.limit;
      const items = rows.slice(0, query.limit).map((row) => ({ listingType: 'SALE' as const, listing: row, score: 100, reasons: ['Published in the Lead branch', ...(preference?.buy?.minBudget || preference?.buy?.maxBudget ? ['Price is within the requested budget'] : [])] }));
      return { items, pageInfo: { hasNextPage, nextCursor: hasNextPage ? items.at(-1)?.listing.id ?? null : null } };
    }
    return { items: [], pageInfo: { hasNextPage: false, nextCursor: null }, message: 'Matching is available only for Rent and Buy Leads.' };
  }
}
