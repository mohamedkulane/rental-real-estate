import { Injectable, NotFoundException } from '@nestjs/common';
import {
  LeadIntent,
  LeaseStatus,
  ListingStatus,
  Prisma,
  PropertyStatus,
  RentableSpaceStatus,
  ReservationStatus,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';

export type RentalMarketStatus = 'AVAILABLE' | 'RENTED' | 'UNAVAILABLE';

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
          leaseEndDate: { gte: at },
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
          leaseEndDate: { gte: at },
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
      if (attrs?.askingRent != null && attrs.askingRent !== '') {
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
    const items = await Promise.all(
      page.map((row) => this.enrichPropertyRow(principal, row)),
    );
    return {
      items,
      pageInfo: {
        hasNextPage: rows.length > limit,
        nextCursor: rows.length > limit ? page[page.length - 1]?.id ?? null : null,
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
        nextCursor: rows.length > limit ? page[page.length - 1]?.id ?? null : null,
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
        nextCursor: rows.length > limit ? page[page.length - 1]?.id ?? null : null,
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
      if (attrs?.askingRent != null && attrs.askingRent !== '') {
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
