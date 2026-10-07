import { Injectable, NotFoundException } from '@nestjs/common';
import {
  LeadIntent,
  LeasePossessionStatus,
  LeaseStatus,
  ListingStatus,
  Prisma,
  PropertyStatus,
  PropertyServiceIntent,
  RentableSpaceStatus,
  ReservationStatus,
  SaleOfferStatus,
  SaleSettlementStatus,
  ServiceEngagementStatus,
  ServiceModel,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';

export type RentalMarketStatus = 'AVAILABLE' | 'RENTED' | 'UNAVAILABLE';
export type RentalOccupancyState =
  'VACANT' | 'PARTIALLY_OCCUPIED' | 'FULLY_OCCUPIED' | 'UNAVAILABLE';

@Injectable()
export class RentalPresentationService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auth: AuthorizationService,
  ) {}

  private at(principal: AuthenticatedPrincipal): Date {
    return new Date(`${principal.businessDate}T00:00:00.000Z`);
  }

  private occupiedSpaceWhere(at: Date): Prisma.RentableSpaceWhereInput {
    return {
      leases: {
        some: {
          status: { in: [LeaseStatus.SIGNED, LeaseStatus.ACTIVE] },
          leaseStartDate: { lte: at },
          OR: [{ leaseEndDate: null }, { leaseEndDate: { gte: at } }],
        },
      },
    };
  }

  private availableSpaceWhere(at: Date): Prisma.RentableSpaceWhereInput {
    return {
      status: RentableSpaceStatus.ACTIVE,
      leases: {
        none: {
          status: { in: [LeaseStatus.SIGNED, LeaseStatus.ACTIVE] },
          leaseStartDate: { lte: at },
          OR: [{ leaseEndDate: null }, { leaseEndDate: { gte: at } }],
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

  async resolvePropertyRentalStatus(
    principal: AuthenticatedPrincipal,
    propertyId: string,
  ): Promise<RentalMarketStatus> {
    const property = await this.db.property.findFirst({
      where: { id: propertyId, companyId: principal.companyId },
      select: { id: true, status: true },
    });
    if (!property || property.status !== PropertyStatus.ACTIVE) return 'UNAVAILABLE';

    const at = this.at(principal);
    const spaces = await this.db.rentableSpace.findMany({
      where: { propertyId, status: RentableSpaceStatus.ACTIVE },
      select: { id: true },
    });
    if (!spaces.length) return 'UNAVAILABLE';

    const occupied = await this.db.rentableSpace.count({
      where: { propertyId, AND: [this.occupiedSpaceWhere(at)] },
    });
    if (occupied === spaces.length) return 'RENTED';

    const available = await this.db.rentableSpace.count({
      where: { propertyId, AND: [this.availableSpaceWhere(at)] },
    });
    if (available > 0) return 'AVAILABLE';

    return 'UNAVAILABLE';
  }

  async enrichPropertyRow(
    principal: AuthenticatedPrincipal,
    property: {
      id: string;
      propertyCode: string;
      name: string;
      propertyType: string;
      status: PropertyStatus;
      city: string;
      district: string | null;
    },
  ) {
    const rentalStatus = await this.resolvePropertyRentalStatus(principal, property.id);
    const at = this.at(principal);
    const listing = await this.db.rentalListing.findFirst({
      where: {
        companyId: principal.companyId,
        status: { in: [ListingStatus.DRAFT, ListingStatus.PUBLISHED, ListingStatus.PAUSED] },
        rentableSpace: { propertyId: property.id },
      },
      orderBy: { createdAt: 'desc' },
      select: { askingRent: true, currency: true },
    });
    let monthlyRent = listing?.askingRent?.toString() ?? null;
    let currency = listing?.currency ?? 'USD';
    if (!monthlyRent) {
      const version = await this.db.rentableSpaceVersion.findFirst({
        where: {
          space: { propertyId: property.id, status: RentableSpaceStatus.ACTIVE },
          effectiveFrom: { lte: at },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
        },
        orderBy: [{ versionNo: 'desc' }],
        select: { attributes: true },
      });
      const attrs =
        version?.attributes &&
        typeof version.attributes === 'object' &&
        !Array.isArray(version.attributes)
          ? (version.attributes as Record<string, unknown>)
          : null;
      if (typeof attrs?.askingRent === 'string' || typeof attrs?.askingRent === 'number') {
        monthlyRent = String(attrs.askingRent);
        if (typeof attrs.currency === 'string' && attrs.currency.trim()) {
          currency = attrs.currency.trim().toUpperCase();
        }
      }
    }
    return {
      id: property.id,
      propertyCode: property.propertyCode,
      name: property.name,
      propertyType: property.propertyType,
      location: [property.city, property.district].filter(Boolean).join(', '),
      rentalStatus,
      monthlyRent,
      currency,
    };
  }

  async listRentalProperties(
    principal: AuthenticatedPrincipal,
    query: { search?: string; limit?: number; cursor?: string },
  ) {
    const limit = query.limit ?? 25;
    this.auth.assertCompanyPermission(principal, 'portfolio.property.read');
    const branchIds = this.auth.authorizedBranchIds(principal, 'portfolio.property.read');
    const rows = await this.db.property.findMany({
      where: {
        companyId: principal.companyId,
        status: PropertyStatus.ACTIVE,
        serviceIntent: {
          in: [PropertyServiceIntent.RENTAL_BROKERAGE, PropertyServiceIntent.FULL_MANAGEMENT],
        },
        ...(branchIds === null
          ? {}
          : {
              branchAssignments: {
                some: { branchId: { in: [...branchIds] }, effectiveTo: null },
              },
            }),
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { propertyCode: { contains: query.search, mode: 'insensitive' } },
                { city: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { id: 'desc' },
      take: limit + 1,
      select: {
        id: true,
        propertyCode: true,
        name: true,
        propertyType: true,
        status: true,
        city: true,
        district: true,
      },
    });
    const page = rows.slice(0, limit);
    const propertyIds = page.map((row) => row.id);
    const at = this.at(principal);
    const spaces = propertyIds.length
      ? await this.db.rentableSpace.findMany({
          where: {
            propertyId: { in: propertyIds },
            status: RentableSpaceStatus.ACTIVE,
          },
          select: {
            id: true,
            propertyId: true,
            childRelations: {
              where: {
                effectiveFrom: { lte: at },
                OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
              },
              select: { parentSpaceId: true },
            },
            parentRelations: {
              where: {
                effectiveFrom: { lte: at },
                OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
                child: { status: RentableSpaceStatus.ACTIVE },
              },
              select: { childSpaceId: true },
            },
            leases: {
              where: {
                status: { in: [LeaseStatus.SIGNED, LeaseStatus.ACTIVE] },
                leaseStartDate: { lte: at },
                OR: [{ leaseEndDate: null }, { leaseEndDate: { gte: at } }],
              },
              select: { id: true },
              take: 1,
            },
            leasePossessions: {
              where: {
                status: LeasePossessionStatus.ACTIVE,
                possessionFrom: { lte: at },
                OR: [{ possessionTo: null }, { possessionTo: { gt: at } }],
              },
              select: { id: true },
              take: 1,
            },
            reservations: {
              where: {
                status: ReservationStatus.ACTIVE,
                startsAt: { lte: at },
                expiresAt: { gt: at },
              },
              select: { id: true },
              take: 1,
            },
            rentalListings: {
              where: {
                status: {
                  in: [ListingStatus.DRAFT, ListingStatus.PUBLISHED, ListingStatus.PAUSED],
                },
              },
              orderBy: { createdAt: 'desc' },
              select: { askingRent: true, currency: true },
              take: 1,
            },
            versions: {
              where: {
                effectiveFrom: { lte: at },
                OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
              },
              orderBy: { versionNo: 'desc' },
              select: { attributes: true },
              take: 1,
            },
          },
        })
      : [];

    const spacesByProperty = new Map<string, typeof spaces>();
    const spacesById = new Map(spaces.map((space) => [space.id, space]));
    for (const space of spaces) {
      const existing = spacesByProperty.get(space.propertyId) ?? [];
      existing.push(space);
      spacesByProperty.set(space.propertyId, existing);
    }

    const hasStateInHierarchy = (
      startId: string,
      predicate: (space: (typeof spaces)[number]) => boolean,
    ) => {
      const visited = new Set<string>();
      let current = spacesById.get(startId);
      while (current && !visited.has(current.id)) {
        if (predicate(current)) return true;
        visited.add(current.id);
        const parentId = current.childRelations[0]?.parentSpaceId;
        current = parentId ? spacesById.get(parentId) : undefined;
      }
      return false;
    };

    const items = page.map((property) => {
      const propertySpaces = spacesByProperty.get(property.id) ?? [];
      const inventory = propertySpaces.filter((space) => space.parentRelations.length === 0);
      const occupiedUnits = inventory.filter((space) =>
        hasStateInHierarchy(
          space.id,
          (candidate) => candidate.leases.length > 0 || candidate.leasePossessions.length > 0,
        ),
      ).length;
      const unavailableUnits = inventory.filter(
        (space) =>
          !hasStateInHierarchy(
            space.id,
            (candidate) => candidate.leases.length > 0 || candidate.leasePossessions.length > 0,
          ) && hasStateInHierarchy(space.id, (candidate) => candidate.reservations.length > 0),
      ).length;
      const totalUnits = inventory.length;
      const availableUnits = Math.max(0, totalUnits - occupiedUnits - unavailableUnits);
      const occupancyState: RentalOccupancyState =
        totalUnits === 0
          ? 'UNAVAILABLE'
          : occupiedUnits === totalUnits
            ? 'FULLY_OCCUPIED'
            : occupiedUnits > 0
              ? 'PARTIALLY_OCCUPIED'
              : availableUnits > 0
                ? 'VACANT'
                : 'UNAVAILABLE';
      const rentalStatus: RentalMarketStatus =
        availableUnits > 0
          ? 'AVAILABLE'
          : occupiedUnits === totalUnits && totalUnits > 0
            ? 'RENTED'
            : 'UNAVAILABLE';
      const pricedSpace = inventory.find(
        (space) => space.rentalListings[0]?.askingRent || space.versions[0]?.attributes,
      );
      const listing = pricedSpace?.rentalListings[0];
      const attributes =
        pricedSpace?.versions[0]?.attributes &&
        typeof pricedSpace.versions[0].attributes === 'object' &&
        !Array.isArray(pricedSpace.versions[0].attributes)
          ? (pricedSpace.versions[0].attributes as Record<string, unknown>)
          : null;
      const versionRent =
        typeof attributes?.askingRent === 'string' || typeof attributes?.askingRent === 'number'
          ? String(attributes.askingRent)
          : null;
      const versionCurrency =
        typeof attributes?.currency === 'string' && attributes.currency.trim()
          ? attributes.currency.trim().toUpperCase()
          : null;

      return {
        id: property.id,
        propertyCode: property.propertyCode,
        name: property.name,
        propertyType: property.propertyType,
        location: [property.city, property.district].filter(Boolean).join(', '),
        rentalStatus,
        occupancyState,
        totalUnits,
        occupiedUnits,
        availableUnits,
        unavailableUnits,
        monthlyRent: listing?.askingRent?.toString() ?? versionRent,
        currency: listing?.currency ?? versionCurrency ?? 'USD',
      };
    });
    return {
      items,
      pageInfo: {
        hasNextPage: rows.length > limit,
        nextCursor: rows.length > limit ? (page[page.length - 1]?.id ?? null) : null,
      },
    };
  }

  async listRentalCustomers(
    principal: AuthenticatedPrincipal,
    query: { search?: string; limit?: number; cursor?: string },
  ) {
    const limit = query.limit ?? 25;
    this.auth.assertCompanyPermission(principal, 'crm.lead.read');
    const branchIds = this.auth.authorizedBranchIds(principal, 'crm.lead.read');
    const rows = await this.db.lead.findMany({
      where: {
        companyId: principal.companyId,
        intent: LeadIntent.RENT,
        ...(branchIds === null ? {} : { responsibleBranchId: { in: [...branchIds] } }),
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
        ...(query.search
          ? {
              OR: [
                { displayName: { contains: query.search, mode: 'insensitive' } },
                { leadNumber: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { id: 'desc' },
      take: limit + 1,
      select: {
        id: true,
        leadNumber: true,
        displayName: true,
        stage: true,
        createdAt: true,
        preferenceVersions: {
          where: { effectiveTo: null },
          orderBy: { versionNo: 'desc' },
          take: 1,
          select: {
            preferredAreaText: true,
            rent: {
              select: {
                propertyTypeCodes: true,
                minRent: true,
                maxRent: true,
                currency: true,
              },
            },
          },
        },
      },
    });
    const page = rows.slice(0, limit);
    return {
      items: page.map((row) => {
        const preference = row.preferenceVersions[0];
        const rent = preference?.rent;
        const minRent = rent?.minRent?.toString() ?? null;
        const maxRent = rent?.maxRent?.toString() ?? null;
        return {
          id: row.id,
          leadNumber: row.leadNumber,
          displayName: row.displayName,
          stage: row.stage,
          createdAt: row.createdAt,
          wantedType: rent?.propertyTypeCodes?.[0] ?? null,
          preferredLocation: preference?.preferredAreaText?.[0] ?? null,
          preferredLocations: preference?.preferredAreaText ?? [],
          minRentBudget: minRent,
          maxRentBudget: maxRent,
          currency: rent?.currency ?? 'USD',
        };
      }),
      pageInfo: {
        hasNextPage: rows.length > limit,
        nextCursor: rows.length > limit ? (page[page.length - 1]?.id ?? null) : null,
      },
    };
  }

  async listSaleProperties(
    principal: AuthenticatedPrincipal,
    query: { search?: string; limit?: number; cursor?: string },
  ) {
    this.auth.assertCompanyPermission(principal, 'portfolio.property.read');
    const limit = query.limit ?? 25;
    const at = this.at(principal);
    const branchIds = this.auth.authorizedBranchIds(principal, 'portfolio.property.read');
    const baseWhere: Prisma.PropertyWhereInput = {
      companyId: principal.companyId,
      status: PropertyStatus.ACTIVE,
      serviceIntent: PropertyServiceIntent.SALE,
      ...(branchIds === null
        ? {}
        : { branchAssignments: { some: { branchId: { in: [...branchIds] }, effectiveTo: null } } }),
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
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { propertyCode: { contains: query.search, mode: 'insensitive' } },
              { city: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const rows = await this.db.property.findMany({
      where: { ...baseWhere, ...(query.cursor ? { id: { lt: query.cursor } } : {}) },
      orderBy: { id: 'desc' },
      take: limit + 1,
      include: {
        serviceEngagements: {
          where: {
            status: ServiceEngagementStatus.ACTIVE,
            effectiveFrom: { lte: at },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
          },
          select: { id: true, serviceModel: true, status: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        ownerships: {
          where: { effectiveTo: null },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
          select: { owner: { select: { displayName: true } } },
        },
        branchAssignments: {
          where: { effectiveTo: null },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
          select: { branchId: true },
        },
      },
    });
    const items = rows.slice(0, limit).map((row) => ({
      id: row.id,
      propertyCode: row.propertyCode,
      name: row.name,
      propertyType: row.propertyType,
      location: [row.city, row.district].filter(Boolean).join(', '),
      salePrice: row.salePrice?.toString() ?? null,
      currency: row.salePriceCurrency ?? 'USD',
      serviceModel: row.serviceEngagements[0]?.serviceModel ?? null,
      ownerDisplayName: row.ownerships[0]?.owner.displayName ?? null,
      branchId: row.branchAssignments[0]?.branchId ?? null,
      status: row.status,
    }));
    return {
      items,
      pageInfo: {
        hasNextPage: rows.length > limit,
        nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null,
      },
    };
  }

  async listBuyers(
    principal: AuthenticatedPrincipal,
    query: { search?: string; limit?: number; cursor?: string },
  ) {
    const limit = query.limit ?? 25;
    this.auth.assertCompanyPermission(principal, 'crm.lead.read');
    const branchIds = this.auth.authorizedBranchIds(principal, 'crm.lead.read');
    const rows = await this.db.lead.findMany({
      where: {
        companyId: principal.companyId,
        intent: LeadIntent.BUY,
        ...(branchIds === null ? {} : { responsibleBranchId: { in: [...branchIds] } }),
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
        ...(query.search
          ? {
              OR: [
                { displayName: { contains: query.search, mode: 'insensitive' } },
                { leadNumber: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { id: 'desc' },
      take: limit + 1,
      select: {
        id: true,
        leadNumber: true,
        displayName: true,
        stage: true,
        preferenceVersions: {
          where: { effectiveTo: null },
          orderBy: { versionNo: 'desc' },
          take: 1,
          select: {
            preferredAreaText: true,
            buy: {
              select: {
                propertyTypeCodes: true,
                minBudget: true,
                maxBudget: true,
                currency: true,
              },
            },
          },
        },
      },
    });
    const page = rows.slice(0, limit);
    return {
      items: page.map((row) => {
        const preference = row.preferenceVersions[0];
        const buy = preference?.buy;
        const minBudget = buy?.minBudget?.toString() ?? null;
        const maxBudget = buy?.maxBudget?.toString() ?? null;
        return {
          id: row.id,
          leadNumber: row.leadNumber,
          displayName: row.displayName,
          stage: row.stage,
          wantedType: buy?.propertyTypeCodes?.[0] ?? null,
          preferredLocation: preference?.preferredAreaText?.[0] ?? null,
          preferredLocations: preference?.preferredAreaText ?? [],
          minPurchaseBudget: minBudget,
          maxPurchaseBudget: maxBudget,
          currency: buy?.currency ?? 'USD',
        };
      }),
      pageInfo: {
        hasNextPage: rows.length > limit,
        nextCursor: rows.length > limit ? (page[page.length - 1]?.id ?? null) : null,
      },
    };
  }

  async getRentalProperty(principal: AuthenticatedPrincipal, propertyId: string) {
    const property = await this.db.property.findFirst({
      where: { id: propertyId, companyId: principal.companyId },
      select: {
        id: true,
        propertyCode: true,
        name: true,
        propertyType: true,
        status: true,
        city: true,
        district: true,
        addressLine1: true,
        description: true,
      },
    });
    if (!property) throw new NotFoundException('Property not found.');
    this.auth.assertBranchPermission(
      principal,
      'portfolio.property.read',
      await this.currentBranchId(property.id),
    );
    const rentalStatus = await this.resolvePropertyRentalStatus(principal, property.id);
    const spaces = await this.db.rentableSpace.findMany({
      where: { propertyId: property.id, status: RentableSpaceStatus.ACTIVE },
      select: { id: true, spaceCode: true, name: true },
      orderBy: { createdAt: 'asc' },
    });
    const listing = await this.db.rentalListing.findFirst({
      where: {
        companyId: principal.companyId,
        rentableSpace: { propertyId: property.id },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        listingNumber: true,
        title: true,
        status: true,
        askingRent: true,
        currency: true,
      },
    });
    let monthlyRent = listing?.askingRent?.toString() ?? null;
    let currency = listing?.currency ?? 'USD';
    if (!monthlyRent) {
      const at = this.at(principal);
      const version = await this.db.rentableSpaceVersion.findFirst({
        where: {
          space: { propertyId: property.id, status: RentableSpaceStatus.ACTIVE },
          effectiveFrom: { lte: at },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
        },
        orderBy: [{ versionNo: 'desc' }],
        select: { attributes: true },
      });
      const attrs =
        version?.attributes &&
        typeof version.attributes === 'object' &&
        !Array.isArray(version.attributes)
          ? (version.attributes as Record<string, unknown>)
          : null;
      if (typeof attrs?.askingRent === 'string' || typeof attrs?.askingRent === 'number') {
        monthlyRent = String(attrs.askingRent);
        if (typeof attrs.currency === 'string' && attrs.currency.trim()) {
          currency = attrs.currency.trim().toUpperCase();
        }
      }
    }
    const ownership = await this.db.propertyOwnership.findFirst({
      where: { propertyId: property.id, effectiveTo: null },
      select: {
        owner: {
          select: {
            displayName: true,
            owner: { select: { ownerNumber: true } },
          },
        },
      },
    });
    return {
      ...property,
      location: [property.city, property.district].filter(Boolean).join(', '),
      rentalStatus,
      monthlyRent,
      currency,
      listing,
      spaces,
      ownerDisplayName: ownership?.owner.displayName ?? null,
      ownerNumber: ownership?.owner.owner?.ownerNumber ?? null,
    };
  }

  private async currentBranchId(propertyId: string): Promise<string> {
    const assignment = await this.db.propertyBranchAssignment.findFirst({
      where: { propertyId, effectiveTo: null },
      select: { branchId: true },
    });
    if (!assignment) throw new NotFoundException('Property branch assignment not found.');
    return assignment.branchId;
  }
}
