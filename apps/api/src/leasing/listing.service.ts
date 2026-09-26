import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  LeadIntent,
  LeaseStatus,
  ListingStatus,
  Prisma,
  PropertyStatus,
  PropertyType,
  RentableSpaceStatus,
  ReservationStatus,
  SaleOfferStatus,
  SaleSettlementStatus,
  ServiceEngagementStatus,
  ServiceModel,
} from '@prisma/client';
import { uuidv7 } from '@rerms/shared';
import { nextRecordNumber } from '../common/record-number';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../governance/audit.service';
import { resolveCapabilitySet } from '../commercial/service-engagement.policy';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import type { CreateRentalListingDto, CreateSaleListingDto, ListingQueryDto, MatchListingsDto, VersionedTransitionDto } from './phase5-operations.dto';
import { assertHierarchyOccupancyAvailable } from './space-hierarchy-occupancy';

export function propertyTypeMatchesPreference(
  propertyType: PropertyType | null | undefined,
  preferences: readonly PropertyType[],
): boolean {
  return !preferences.length || (!!propertyType && preferences.map(String).includes(String(propertyType)));
}

export function preferPropertyTypeMatches<T extends { reasonKeys: readonly string[] }>(
  items: readonly T[],
  preferences: readonly PropertyType[],
): T[] {
  if (!preferences.length) return [...items];
  const preferred = items.filter((item) => item.reasonKeys.includes('property_type_match'));
  return preferred.length ? [...preferred, ...items.filter((item) => !item.reasonKeys.includes('property_type_match'))] : [...items];
}

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

  private matchBusinessDate(principal: AuthenticatedPrincipal): Date {
    return new Date(`${principal.businessDate}T00:00:00.000Z`);
  }

  private availableRentableSpaceWhere(at: Date): Prisma.RentableSpaceWhereInput {
    return {
      status: RentableSpaceStatus.ACTIVE,
      leases: {
        none: {
          status: { in: [LeaseStatus.SIGNED, LeaseStatus.ACTIVE] },
          leaseStartDate: { lte: at },
          OR: [{ leaseEndDate: null }, { leaseEndDate: { gte: at } }],
        },
      },
      leasePossessions: {
        none: {
          status: 'ACTIVE',
          possessionFrom: { lte: at },
          OR: [{ possessionTo: null }, { possessionTo: { gt: at } }],
        },
      },
      reservations: {
        none: {
          status: ReservationStatus.ACTIVE,
          startsAt: { lte: at },
          expiresAt: { gt: at },
        },
      },
    };
  }

  private availableSalePropertyWhere(at = new Date()): Prisma.PropertyWhereInput {
    return {
      status: PropertyStatus.ACTIVE,
      serviceIntent: 'SALE',
      serviceEngagements: {
        some: {
          status: ServiceEngagementStatus.ACTIVE,
          serviceModel: { in: [ServiceModel.SALE_BROKERAGE, ServiceModel.COMPANY_OWNED] },
          effectiveFrom: { lte: at },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
        },
      },
      saleSettlements: { none: { status: SaleSettlementStatus.SETTLED } },
      saleOffers: { none: { status: SaleOfferStatus.ACCEPTED } },
      saleAgreements: { none: { status: { in: ['DRAFT', 'CONFIRMED'] } } },
    };
  }

  private preferredAreaPropertyWhere(areas: string[]): Prisma.PropertyWhereInput | undefined {
    const terms = areas.map((area) => area.trim()).filter(Boolean);
    if (!terms.length) return undefined;
    return {
      OR: terms.flatMap((term) => [
        { city: { contains: term, mode: 'insensitive' } },
        { district: { contains: term, mode: 'insensitive' } },
        { neighborhood: { contains: term, mode: 'insensitive' } },
      ]),
    };
  }

  private buildRentableSpaceMatchWhere(
    at: Date,
    rent: {
      propertyTypeCodes?: string[];
      rentableSpaceTypeCodes?: string[];
      minBedrooms?: number | null;
      maxBedrooms?: number | null;
    } | null | undefined,
    preferredAreas: string[],
  ): Prisma.RentableSpaceWhereInput {
    const parts: Prisma.RentableSpaceWhereInput[] = [this.availableRentableSpaceWhere(at)];
    const propertyFilters: Prisma.PropertyWhereInput[] = [];
    if (rent?.propertyTypeCodes?.length) {
      propertyFilters.push({ propertyType: { in: rent.propertyTypeCodes as PropertyType[] } });
    }
    const areaFilter = this.preferredAreaPropertyWhere(preferredAreas);
    if (areaFilter) propertyFilters.push(areaFilter);
    if (propertyFilters.length) {
      parts.push({
        property: { is: propertyFilters.length === 1 ? propertyFilters[0]! : { AND: propertyFilters } },
      });
    }
    if (rent?.rentableSpaceTypeCodes?.length) {
      parts.push({ type: { code: { in: rent.rentableSpaceTypeCodes } } });
    }
    if (rent?.minBedrooms != null || rent?.maxBedrooms != null) {
      parts.push({
        residentialProfile: {
          is: {
            ...(rent.minBedrooms != null ? { bedrooms: { gte: rent.minBedrooms } } : {}),
            ...(rent.maxBedrooms != null ? { bedrooms: { lte: rent.maxBedrooms } } : {}),
          },
        },
      });
    }
    return parts.length === 1 ? parts[0]! : { AND: parts };
  }

  private buildSalePropertyMatchWhere(
    at: Date,
    buy: {
      propertyTypeCodes?: string[];
      minBedrooms?: number | null;
      maxBedrooms?: number | null;
    } | null | undefined,
    preferredAreas: string[],
  ): Prisma.PropertyWhereInput {
    const parts: Prisma.PropertyWhereInput[] = [this.availableSalePropertyWhere(at)];
    if (buy?.propertyTypeCodes?.length) {
      parts.push({ propertyType: { in: buy.propertyTypeCodes as PropertyType[] } });
    }
    const areaFilter = this.preferredAreaPropertyWhere(preferredAreas);
    if (areaFilter) parts.push(areaFilter);
    if (buy?.minBedrooms != null || buy?.maxBedrooms != null) {
      parts.push({
        spaces: {
          some: {
            status: RentableSpaceStatus.ACTIVE,
            residentialProfile: {
              is: {
                ...(buy.minBedrooms != null ? { bedrooms: { gte: buy.minBedrooms } } : {}),
                ...(buy.maxBedrooms != null ? { bedrooms: { lte: buy.maxBedrooms } } : {}),
              },
            },
          },
        },
      });
    }
    return parts.length === 1 ? parts[0]! : { AND: parts };
  }

  private rentMatchReasonKeys(
    rent: {
      minRent?: Prisma.Decimal | null;
      maxRent?: Prisma.Decimal | null;
      propertyTypeCodes?: string[];
      minBedrooms?: number | null;
      maxBedrooms?: number | null;
    } | null | undefined,
    preferredAreas: string[],
  ): string[] {
    const keys = ['intent_rent', 'published_branch', 'space_available'];
    if (rent?.minRent || rent?.maxRent) keys.push('within_rent_budget');
    if (rent?.propertyTypeCodes?.length) keys.push('property_type_match');
    if (rent?.minBedrooms != null || rent?.maxBedrooms != null) keys.push('bedroom_match');
    if (preferredAreas.some((area) => area.trim())) keys.push('preferred_area_match');
    return keys;
  }

  private buyMatchReasonKeys(
    buy: {
      minBudget?: Prisma.Decimal | null;
      maxBudget?: Prisma.Decimal | null;
      propertyTypeCodes?: string[];
      minBedrooms?: number | null;
      maxBedrooms?: number | null;
    } | null | undefined,
    preferredAreas: string[],
  ): string[] {
    const keys = ['intent_buy', 'published_branch', 'property_available'];
    if (buy?.minBudget || buy?.maxBudget) keys.push('within_buy_budget');
    if (buy?.propertyTypeCodes?.length) keys.push('property_type_match');
    if (buy?.minBedrooms != null || buy?.maxBedrooms != null) keys.push('bedroom_match');
    if (preferredAreas.some((area) => area.trim())) keys.push('preferred_area_match');
    return keys;
  }

  private async assertRentableSpaceLeasable(principal: AuthenticatedPrincipal, rentableSpaceId: string) {
    const at = this.matchBusinessDate(principal);
    const occupied = await this.db.lease.count({
      where: {
        rentableSpaceId,
        status: { in: [LeaseStatus.SIGNED, LeaseStatus.ACTIVE] },
        leaseStartDate: { lte: at },
        OR: [{ leaseEndDate: null }, { leaseEndDate: { gte: at } }],
      },
    });
    if (occupied > 0) {
      throw new ConflictException(
        'This Rentable Space already has a signed or active lease and cannot be listed for rent.',
      );
    }
    const reserved = await this.db.reservation.count({
      where: {
        rentableSpaceId,
        status: ReservationStatus.ACTIVE,
        startsAt: { lte: at },
        expiresAt: { gt: at },
      },
    });
    if (reserved > 0) {
      throw new ConflictException(
        'This Rentable Space has an active reservation and cannot be listed for rent.',
      );
    }
    await assertHierarchyOccupancyAvailable(this.db, {
      companyId: principal.companyId,
      rentableSpaceId,
      businessDate: principal.businessDate,
    });
  }

  private async assertPropertySaleable(principal: AuthenticatedPrincipal, propertyId: string) {
    const property = await this.db.property.findFirst({
      where: { id: propertyId, companyId: principal.companyId, ...this.availableSalePropertyWhere() },
      select: { id: true },
    });
    if (!property) {
      throw new ConflictException(
        'This Property is not available for sale (inactive, sold, or under accepted offer).',
      );
    }
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
    await this.assertRentableSpaceLeasable(principal, space.id);
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
    await this.assertPropertySaleable(principal, property.id);
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
    if (target === ListingStatus.PUBLISHED) {
      if (kind === 'rental') {
        const rental = await this.db.rentalListing.findFirst({
          where: { id, companyId: principal.companyId },
          select: { rentableSpaceId: true },
        });
        if (rental) await this.assertRentableSpaceLeasable(principal, rental.rentableSpaceId);
      } else {
        const sale = await this.db.saleListing.findFirst({
          where: { id, companyId: principal.companyId },
          select: { propertyId: true },
        });
        if (sale) await this.assertPropertySaleable(principal, sale.propertyId);
      }
    }
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

  private locationMatchScore(
    property: { city?: string | null; district?: string | null; neighborhood?: string | null },
    preferredAreas: string[],
  ): { points: number; matched: boolean } {
    const terms = preferredAreas.map((area) => area.trim().toLowerCase()).filter(Boolean);
    if (!terms.length) return { points: 15, matched: true };
    const haystack = [property.city, property.district, property.neighborhood]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!haystack) return { points: 4, matched: false };
    const hits = terms.filter((term) => haystack.includes(term));
    if (!hits.length) return { points: 0, matched: false };
    return {
      points: Math.min(25, Math.round(12 + (hits.length / terms.length) * 13)),
      matched: true,
    };
  }

  private budgetMatchScore(
    asking: Prisma.Decimal | null | undefined,
    min: Prisma.Decimal | null | undefined,
    max: Prisma.Decimal | null | undefined,
  ): { points: number; matched: boolean } {
    if (!asking) return { points: 8, matched: false };
    const value = Number(asking);
    const minValue = min != null ? Number(min) : null;
    const maxValue = max != null ? Number(max) : null;
    if (minValue == null && maxValue == null) return { points: 15, matched: true };
    const within =
      (minValue == null || value >= minValue) && (maxValue == null || value <= maxValue);
    if (within) {
      if (minValue != null && maxValue != null && maxValue > minValue) {
        const mid = (minValue + maxValue) / 2;
        const span = (maxValue - minValue) / 2 || 1;
        const closeness = 1 - Math.min(1, Math.abs(value - mid) / span);
        return { points: Math.round(18 + closeness * 7), matched: true };
      }
      return { points: 22, matched: true };
    }
    const lower = minValue ?? 0;
    const upper = maxValue ?? Number.POSITIVE_INFINITY;
    const distance =
      value < lower ? lower - value : value > upper ? value - upper : 0;
    const reference = Math.max(lower || value, upper === Number.POSITIVE_INFINITY ? value : upper, 1);
    const ratio = distance / reference;
    if (ratio <= 0.15) return { points: 14, matched: false };
    if (ratio <= 0.3) return { points: 8, matched: false };
    return { points: 2, matched: false };
  }

  private typeMatchScore(
    propertyType: PropertyType | string | null | undefined,
    codes: string[] | undefined,
  ): { points: number; matched: boolean } {
    if (!codes?.length) return { points: 12, matched: true };
    if (!propertyType) return { points: 4, matched: false };
    const matched = codes.includes(String(propertyType));
    return { points: matched ? 20 : 3, matched };
  }

  private bedroomMatchScore(
    bedrooms: number | null | undefined,
    minBedrooms?: number | null,
    maxBedrooms?: number | null,
  ): { points: number; matched: boolean } {
    if (minBedrooms == null && maxBedrooms == null) return { points: 8, matched: true };
    if (bedrooms == null) return { points: 3, matched: false };
    const matched =
      (minBedrooms == null || bedrooms >= minBedrooms) &&
      (maxBedrooms == null || bedrooms <= maxBedrooms);
    return { points: matched ? 10 : 2, matched };
  }

  private matchBranchFilter(
    principal: AuthenticatedPrincipal,
    permission: string,
  ): string[] | null {
    return this.branchIds(principal, permission);
  }

  private askingRentFromAttributes(attributes: Prisma.JsonValue | null | undefined): {
    askingRent: Prisma.Decimal | null;
    currency: string;
  } {
    if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) {
      return { askingRent: null, currency: 'USD' };
    }
    const record = attributes as Record<string, unknown>;
    const raw = record.askingRent ?? record.monthlyRent ?? record.rent;
    const currency =
      typeof record.currency === 'string' && record.currency.trim()
        ? record.currency.trim().toUpperCase()
        : 'USD';
    if (raw == null || raw === '') return { askingRent: null, currency };
    try {
      return { askingRent: new Prisma.Decimal(String(raw)), currency };
    } catch {
      return { askingRent: null, currency };
    }
  }

  private openListingStatuses(): ListingStatus[] {
    return [
      ListingStatus.PUBLISHED,
      ListingStatus.DRAFT,
      ListingStatus.PENDING_REVIEW,
      ListingStatus.PAUSED,
    ];
  }

  private marketPurposeFromAttributes(
    attributes: Prisma.JsonValue | null | undefined,
  ): 'RENTAL' | 'SALE' | null {
    if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) return null;
    const purpose = (attributes as Record<string, unknown>).marketPurpose;
    if (purpose === 'RENTAL' || purpose === 'SALE') return purpose;
    if ((attributes as Record<string, unknown>).askingPrice != null) return 'SALE';
    if ((attributes as Record<string, unknown>).askingRent != null) return 'RENTAL';
    return null;
  }

  private isSaleOnlyProperty(property: {
    saleListings?: { id: string }[];
    serviceEngagements?: { serviceModel: ServiceModel }[];
  }): boolean {
    if (property.saleListings?.length) return true;
    return (property.serviceEngagements ?? []).some(
      (engagement) => engagement.serviceModel === ServiceModel.SALE_BROKERAGE,
    );
  }

  private isRentalRegisteredInventory(input: {
    openListing: { id: string } | null;
    askingRent: Prisma.Decimal | null;
    marketPurpose: 'RENTAL' | 'SALE' | null;
    serviceEngagements?: { serviceModel: ServiceModel }[];
  }): boolean {
    // Active registered units are matchable without brokerage or published listing.
    if (input.marketPurpose === 'SALE') return false;
    return true;
  }

  private compositeMatchScore(parts: {
    location: { points: number; matched: boolean };
    budget: { points: number; matched: boolean };
    type: { points: number; matched: boolean };
    bedrooms: { points: number; matched: boolean };
  }): number {
    // Location, rent closeness, and preferred type dominate ranking.
    const weighted =
      parts.location.points * 1.35 +
      parts.budget.points * 1.45 +
      parts.type.points * 1.25 +
      parts.bedrooms.points;
    return Math.min(99, Math.max(35, Math.round(32 + weighted - 18)));
  }

  async match(principal: AuthenticatedPrincipal, query: MatchListingsDto) {
    const lead = await this.db.lead.findFirst({
      where: { id: query.leadId, companyId: principal.companyId },
      include: {
        preferenceVersions: {
          where: { effectiveTo: null },
          orderBy: { versionNo: 'desc' },
          take: 1,
          include: { rent: true, buy: true },
        },
      },
    });
    if (!lead) throw new NotFoundException('Lead not found.');
    this.auth.assertBranchPermission(principal, 'listing.match', lead.responsibleBranchId);
    const preference = lead.preferenceVersions[0];
    const preferredAreas = preference?.preferredAreaText ?? [];
    const at = this.matchBusinessDate(principal);
    const authorizedBranches = this.matchBranchFilter(principal, 'listing.match');
    const reasonLabels: Record<string, string> = {
      intent_rent: 'Looking to rent',
      intent_buy: 'Looking to buy',
      published_listing: 'Has a published rental listing',
      registered_inventory: 'Registered available rental unit',
      space_available: 'Available to rent',
      property_available: 'Available for sale',
      within_rent_budget: 'Within rent budget',
      within_buy_budget: 'Within purchase budget',
      property_type_match: 'Property type matches',
      bedroom_match: 'Bedrooms match',
      preferred_area_match: 'Location matches preferred areas',
    };

    if (lead.intent === LeadIntent.RENT) {
      const rentPrefs = preference?.rent ?? null;
      const branchPropertyFilter: Prisma.PropertyWhereInput | undefined =
        authorizedBranches === null
          ? undefined
          : {
              branchAssignments: {
                some: {
                  branchId: { in: authorizedBranches },
                  effectiveFrom: { lte: at },
                  OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
                },
              },
            };
      // Availability only in SQL. Preferences (area, budget, type, bedrooms) are scored in memory
      // so registered inventory can still surface when location spelling is close but not exact.
      const spaceWhere: Prisma.RentableSpaceWhereInput = {
        AND: [
          this.buildRentableSpaceMatchWhere(at, null, []),
          {
            property: {
              is: {
                companyId: principal.companyId,
                status: PropertyStatus.ACTIVE,
                ...(branchPropertyFilter ?? {}),
              },
            },
          },
          ...(query.cursor ? [{ id: { lt: query.cursor } }] : []),
          ...(query.search
            ? [
                {
                  OR: [
                    { name: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
                    { spaceCode: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
                    {
                      property: {
                        is: {
                          OR: [
                            {
                              name: {
                                contains: query.search,
                                mode: Prisma.QueryMode.insensitive,
                              },
                            },
                            {
                              propertyCode: {
                                contains: query.search,
                                mode: Prisma.QueryMode.insensitive,
                              },
                            },
                          ],
                        },
                      },
                    },
                  ],
                } satisfies Prisma.RentableSpaceWhereInput,
              ]
            : []),
        ],
      };

      const spaces = await this.db.rentableSpace.findMany({
        where: spaceWhere,
        orderBy: { id: 'desc' },
        take: Math.min(query.limit * 8, 200),
        include: {
          property: {
            include: {
              saleListings: {
                where: {
                  companyId: principal.companyId,
                  status: {
                    in: [
                      ListingStatus.PUBLISHED,
                      ListingStatus.DRAFT,
                      ListingStatus.PENDING_REVIEW,
                      ListingStatus.PAUSED,
                    ],
                  },
                },
                select: { id: true },
                take: 1,
              },
              serviceEngagements: {
                where: {
                  status: ServiceEngagementStatus.ACTIVE,
                  rentableSpaceId: null,
                  effectiveFrom: { lte: at },
                  OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
                },
                select: { serviceModel: true },
                take: 8,
              },
            },
          },
          type: true,
          residentialProfile: true,
          versions: {
            where: {
              effectiveFrom: { lte: at },
              OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
            },
            orderBy: [{ versionNo: 'desc' }],
            take: 1,
            select: { attributes: true },
          },
          rentalListings: {
            where: {
              companyId: principal.companyId,
              status: {
                in: [
                  ListingStatus.PUBLISHED,
                  ListingStatus.DRAFT,
                  ListingStatus.PENDING_REVIEW,
                  ListingStatus.PAUSED,
                ],
              },
              ...(authorizedBranches === null ? {} : { branchId: { in: authorizedBranches } }),
            },
            orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
            take: 5,
          },
          serviceEngagements: {
            where: {
              status: ServiceEngagementStatus.ACTIVE,
              effectiveFrom: { lte: at },
              OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
            },
            select: { serviceModel: true },
            take: 8,
          },
        },
      });

      const scored = spaces
        .map((space) => {
          const property = space.property;
          const rentalAuthority = resolveCapabilitySet(
            property.serviceEngagements.map((engagement) => engagement.serviceModel),
            space.serviceEngagements.map((engagement) => engagement.serviceModel),
          );
          if (!rentalAuthority.canMarketRentalSpace) return null;
          const published = space.rentalListings.find(
            (row) => row.status === ListingStatus.PUBLISHED,
          );
          const openListing = published ?? space.rentalListings[0] ?? null;
          const fromAttributes = this.askingRentFromAttributes(space.versions[0]?.attributes);
          const marketPurpose = this.marketPurposeFromAttributes(space.versions[0]?.attributes);
          if (this.isSaleOnlyProperty(property) || marketPurpose === 'SALE') {
            return null;
          }
          const askingRent = openListing?.askingRent ?? fromAttributes.askingRent;
          const currency = openListing?.currency ?? fromAttributes.currency;
          // Registered Active units match even when monthly rent is not set yet.
          // Budget score soft-fails when asking rent is unknown (portfolio units often lack it).
          const location = this.locationMatchScore(property, preferredAreas);
          const budget = this.budgetMatchScore(
            askingRent,
            rentPrefs?.minRent,
            rentPrefs?.maxRent,
          );
          const type = this.typeMatchScore(property.propertyType, rentPrefs?.propertyTypeCodes);
          const bedrooms = this.bedroomMatchScore(
            space.residentialProfile?.bedrooms ?? null,
            rentPrefs?.minBedrooms,
            rentPrefs?.maxBedrooms,
          );
          // Prefer units that hit at least one strong preference signal.
          if (
            preferredAreas.some((area) => area.trim()) &&
            !location.matched &&
            rentPrefs?.propertyTypeCodes?.length &&
            !type.matched
          ) {
            return null;
          }
          const score = this.compositeMatchScore({ location, budget, type, bedrooms });
          const reasonKeys = [
            'intent_rent',
            published ? 'published_listing' : 'registered_inventory',
            'space_available',
            ...(budget.matched ? ['within_rent_budget'] : []),
            ...(type.matched && rentPrefs?.propertyTypeCodes?.length
              ? ['property_type_match']
              : []),
            ...(bedrooms.matched &&
            (rentPrefs?.minBedrooms != null || rentPrefs?.maxBedrooms != null)
              ? ['bedroom_match']
              : []),
            ...(location.matched && preferredAreas.some((area) => area.trim())
              ? ['preferred_area_match']
              : []),
            ...(!askingRent ? ['rent_not_set'] : []),
          ];
          const {
            saleListings: _saleListings,
            serviceEngagements: _serviceEngagements,
            ...propertyPublic
          } = property;
          const listing = openListing
            ? {
                ...openListing,
                askingRent,
                currency,
                rentableSpace: {
                  id: space.id,
                  spaceCode: space.spaceCode,
                  name: space.name,
                  type: space.type,
                  residentialProfile: space.residentialProfile,
                  property: propertyPublic,
                },
              }
            : {
                id: space.id,
                listingNumber: space.spaceCode,
                title: `${property.name} · ${space.name}`,
                status: 'INVENTORY',
                askingRent,
                currency,
                availableFrom: null,
                rentableSpace: {
                  id: space.id,
                  spaceCode: space.spaceCode,
                  name: space.name,
                  type: space.type,
                  residentialProfile: space.residentialProfile,
                  property: propertyPublic,
                },
              };
          return {
            listingType: 'RENTAL' as const,
            matchSource: published ? ('PUBLISHED_LISTING' as const) : ('INVENTORY' as const),
            // Inventory units schedule via rentableSpaceId — no brokerage/listing required.
            canScheduleViewing: true,
            listing,
            score,
            reasonKeys,
            reasons: reasonKeys
              .filter((key) => key !== 'rent_not_set')
              .map((key) => reasonLabels[key] ?? key)
              .concat(!askingRent ? ['Monthly rent not set on unit'] : []),
          };
        })
        .filter((item): item is NonNullable<typeof item> => item != null)
        .filter((item) => {
          if (preferredAreas.length === 0) return item.score >= 45;
          return item.score >= 50 || item.reasonKeys.includes('preferred_area_match');
        })
        .sort((a, b) => b.score - a.score || b.listing.id.localeCompare(a.listing.id));

      const page = scored.slice(0, query.limit);
      const hasNextPage = scored.length > query.limit;
      return {
        items: page,
        pageInfo: {
          hasNextPage,
          nextCursor: hasNextPage ? page.at(-1)?.listing.id ?? null : null,
        },
      };
    }

    if (lead.intent === LeadIntent.BUY) {
      const buyPrefs = preference?.buy ?? null;
      const where: Prisma.PropertyWhereInput = {
        companyId: principal.companyId,
        ...(authorizedBranches === null
          ? {}
          : { branchAssignments: { some: { branchId: { in: authorizedBranches }, effectiveTo: null } } }),
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
                { propertyCode: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
              ],
            }
          : {}),
        ...this.buildSalePropertyMatchWhere(at, buyPrefs, preferredAreas),
      };
      const rows = await this.db.property.findMany({
        where,
        orderBy: { id: 'desc' },
        take: Math.min(query.limit * 4, 100),
        include: {
          spaces: {
            where: { status: RentableSpaceStatus.ACTIVE },
            take: 1,
            include: { residentialProfile: true },
          },
          serviceEngagements: {
            where: {
              status: ServiceEngagementStatus.ACTIVE,
              serviceModel: { in: [ServiceModel.SALE_BROKERAGE, ServiceModel.COMPANY_OWNED] },
            },
            select: { serviceModel: true },
            take: 1,
          },
        },
      });
      const scored = rows
        .map((row) => {
          const location = this.locationMatchScore(row, preferredAreas);
          const budget = this.budgetMatchScore(
            row.salePrice,
            buyPrefs?.minBudget,
            buyPrefs?.maxBudget,
          );
          const type = this.typeMatchScore(row.propertyType, buyPrefs?.propertyTypeCodes);
          const bedrooms = this.bedroomMatchScore(
            row.spaces[0]?.residentialProfile?.bedrooms ?? null,
            buyPrefs?.minBedrooms,
            buyPrefs?.maxBedrooms,
          );
          const score = this.compositeMatchScore({ location, budget, type, bedrooms });
          const reasonKeys = [
            'intent_buy',
            'property_inventory',
            'property_available',
            ...(budget.matched ? ['within_buy_budget'] : []),
            ...(type.matched && buyPrefs?.propertyTypeCodes?.length
              ? ['property_type_match']
              : []),
            ...(bedrooms.matched &&
            (buyPrefs?.minBedrooms != null || buyPrefs?.maxBedrooms != null)
              ? ['bedroom_match']
              : []),
            ...(location.matched && preferredAreas.some((area) => area.trim())
              ? ['preferred_area_match']
              : []),
          ];
          return {
            listingType: 'SALE' as const,
            matchSource: 'PROPERTY_INVENTORY' as const,
            canScheduleViewing: true,
            listing: {
              id: row.id,
              listingNumber: row.propertyCode,
              title: row.name,
              status: 'INVENTORY',
              askingPrice: row.salePrice,
              currency: row.salePriceCurrency ?? 'USD',
              property: row,
            },
            score,
            reasonKeys,
            reasons: reasonKeys.map((key) => reasonLabels[key] ?? key),
          };
        })
        .filter((item) => {
          if (preferredAreas.length === 0) return item.score >= 45;
          return item.score >= 50 || item.reasonKeys.includes('preferred_area_match');
        })
        .sort((a, b) => b.score - a.score || b.listing.id.localeCompare(a.listing.id));
      const page = scored.slice(0, query.limit);
      const hasNextPage = scored.length > query.limit;
      return {
        items: page,
        pageInfo: {
          hasNextPage,
          nextCursor: hasNextPage ? page.at(-1)?.listing.id ?? null : null,
        },
      };
    }

    return {
      items: [],
      pageInfo: { hasNextPage: false, nextCursor: null },
      message: 'Matching is available only for Rent and Buy Leads.',
    };
  }
}
