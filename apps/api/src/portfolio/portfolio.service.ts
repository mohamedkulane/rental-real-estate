import { createHash } from 'node:crypto';
import { uuidv7 } from '@rerms/shared';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BuildingStatus, LeaseStatus, ListingStatus, Prisma, PropertyStatus, RentableSpaceStatus } from '@prisma/client';
import { BusinessDateService } from '../common/business-date.service';
import { cursorPage } from '../common/cursor-pagination';
import { EffectiveDatingService } from '../common/effective-dating.service';
import { nextRecordNumber } from '../common/record-number';
import type { CommandCheckpoint } from '../common/command-checkpoint';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../governance/audit.service';
import { ObjectStorageService } from './object-storage.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import type {
  AmenityAssignmentDto,
  BuildingLifecycleDto,
  CorrectMeasurementDto,
  CreateAmenityDto,
  CreateBuildingDto,
  CreateDocumentMetadataDto,
  CreatePropertyDto,
  CreateSpaceDto,
  DocumentEntityType,
  ListDocumentsQueryDto,
  ListPropertiesQueryDto,
  ListBuildingsQueryDto,
  ListBuildingActivityQueryDto,
  ListPropertyOwnershipsQueryDto,
  ListPropertyBranchHistoryQueryDto,
  ListPropertyActivityQueryDto,
  ListPropertyAmenitiesQueryDto,
  ListSpacesQueryDto,
  ListSpaceMeasurementsQueryDto,
  DiscardPropertyDraftDto,
  PartitionSpaceDto,
  PropertyLifecycleTransitionDto,
  ReplaceOwnershipDto,
  ReparentSpaceDto,
  RetireSpaceDto,
  TransferPropertyBranchDto,
  UpdateAmenityDto,
  UpdateBuildingDto,
  UpdateDocumentMetadataDto,
  UpdatePropertyDto,
  UpdateSpaceDto,
  UploadDocumentDto,
} from './portfolio.dto';

const decimal = (value?: string) => (value === undefined ? null : new Prisma.Decimal(value));

@Injectable()
export class PortfolioService {
  constructor(
    private readonly database: DatabaseService,
    private readonly businessDate: BusinessDateService,
    private readonly effectiveDating: EffectiveDatingService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
    private readonly objectStorage: ObjectStorageService,
  ) {}

  private async assertActivePropertyConfiguration(
    transaction: Prisma.TransactionClient,
    propertyId: string,
    effectiveDate: Date,
  ): Promise<void> {
    const activeOwnership = {
      propertyId,
      effectiveFrom: { lte: effectiveDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveDate } }],
    };
    const ownershipTotal = await transaction.propertyOwnership.aggregate({
      where: activeOwnership,
      _sum: { ownershipPercent: true },
    });
    const ownership = ownershipTotal._sum.ownershipPercent ?? new Prisma.Decimal(0);
    if (!ownership.equals(100)) {
      throw new ConflictException(
        'Active Property ownership must total 100% for the effective period.',
      );
    }

    const entitlements = await transaction.propertyOwnerEntitlement.findMany({
      where: {
        ownership: activeOwnership,
        effectiveFrom: { lte: effectiveDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveDate } }],
      },
      select: { payoutPercent: true },
    });
    const payout = entitlements.reduce(
      (sum, row) => sum.plus(row.payoutPercent),
      new Prisma.Decimal(0),
    );
    if (!payout.equals(100)) {
      throw new ConflictException(
        'Active Property payout entitlement must total 100% for the effective period.',
      );
    }

    const branchCount = await transaction.propertyBranchAssignment.count({
      where: activeOwnership,
    });
    if (branchCount !== 1) {
      throw new ConflictException(
        'Active Property requires exactly one operating branch for the effective period.',
      );
    }

    const missingOwnerProfiles = await transaction.propertyOwnership.count({
      where: {
        ...activeOwnership,
        owner: { owner: { is: null } },
      },
    });
    if (missingOwnerProfiles > 0) {
      throw new ConflictException('Property ownership requires an Owner profile.');
    }
  }

  private async currentPropertyBranch(companyId: string, propertyId: string): Promise<string> {
    const at = await this.businessDate.today(companyId);
    const assignment = await this.database.propertyBranchAssignment.findFirst({
      where: {
        propertyId,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
      },
    });
    if (!assignment) throw new NotFoundException('Property has no current operating branch.');
    return assignment.branchId;
  }

  private async assertPropertyPermission(
    principal: AuthenticatedPrincipal,
    propertyId: string,
    permission: string,
  ) {
    const branchId = await this.currentPropertyBranch(principal.companyId, propertyId);
    this.authorization.assertBranchPermission(principal, permission, branchId);
    return branchId;
  }

  private async assertOwnerPermission(
    principal: AuthenticatedPrincipal,
    partyId: string,
    permission: string,
  ): Promise<string[]> {
    const at = await this.businessDate.today(principal.companyId);
    const owner = await this.database.ownerProfile.findFirstOrThrow({
      where: { partyId, party: { companyId: principal.companyId } },
      select: {
        party: {
          select: {
            branchAssignments: {
              where: {
                effectiveFrom: { lte: at },
                OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
              },
              select: { branchId: true },
            },
            propertyOwnerships: {
              where: {
                effectiveFrom: { lte: at },
                OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
              },
              select: {
                property: {
                  select: {
                    branchAssignments: {
                      where: {
                        effectiveFrom: { lte: at },
                        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
                      },
                      select: { branchId: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    const branchIds = [
      ...new Set([
        ...owner.party.branchAssignments.map((assignment) => assignment.branchId),
        ...owner.party.propertyOwnerships.flatMap((ownership) =>
          ownership.property.branchAssignments.map((assignment) => assignment.branchId),
        ),
      ]),
    ];
    if (!branchIds.length) this.authorization.assertCompanyPermission(principal, permission);
    else this.authorization.assertPermissionAcrossBranches(principal, permission, branchIds);
    return branchIds;
  }

  async listProperties(principal: AuthenticatedPrincipal, query: ListPropertiesQueryDto) {
    const at = await this.businessDate.today(principal.companyId);
    const authorizedBranchIds = this.authorization.authorizedBranchIds(
      principal,
      'portfolio.property.read',
    );
    const branchIds =
      authorizedBranchIds === null
        ? query.branchId
          ? [query.branchId]
          : null
        : [...authorizedBranchIds].filter(
            (branchId) => !query.branchId || branchId === query.branchId,
          );
    const orderBy: Prisma.PropertyOrderByWithRelationInput[] =
      query.sort === 'NAME'
        ? [{ name: 'asc' }, { id: 'asc' }]
        : query.sort === 'CODE'
          ? [{ propertyCode: 'asc' }, { id: 'asc' }]
          : [{ createdAt: 'desc' }, { id: 'desc' }];
    const rows = await this.database.property.findMany({
      where: {
        companyId: principal.companyId,
        ...(query.propertyType ? { propertyType: query.propertyType } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                { propertyCode: { contains: query.search, mode: 'insensitive' } },
                { name: { contains: query.search, mode: 'insensitive' } },
                { addressLine1: { contains: query.search, mode: 'insensitive' } },
                { city: { contains: query.search, mode: 'insensitive' } },
                { district: { contains: query.search, mode: 'insensitive' } },
                { neighborhood: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(query.ownerPartyId
          ? {
              ownerships: {
                some: {
                  ownerPartyId: query.ownerPartyId,
                  effectiveFrom: { lte: at },
                  OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
                },
              },
            }
          : {}),
        ...(branchIds === null
          ? {}
          : {
              branchAssignments: {
                some: {
                  branchId: { in: branchIds },
                  effectiveFrom: { lte: at },
                  OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
                },
              },
            }),
      },
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1,
      include: {
        branchAssignments: {
          include: { branch: { select: { id: true, code: true, name: true } } },
          orderBy: { effectiveFrom: 'desc' },
        },
        _count: { select: { spaces: true, buildings: true } },
      },
      orderBy,
    });
    return cursorPage(rows, query.limit, (property) => property.id);
  }
  async getProperty(principal: AuthenticatedPrincipal, propertyId: string) {
    await this.assertPropertyPermission(principal, propertyId, 'portfolio.property.read');
    return this.database.property.findFirstOrThrow({
      where: { id: propertyId, companyId: principal.companyId },
      include: {
        branchAssignments: { include: { branch: true }, orderBy: { effectiveFrom: 'desc' } },
        ownerships: {
          include: {
            owner: { include: { owner: true, person: true, organization: true } },
            entitlements: true,
          },
          orderBy: { effectiveFrom: 'desc' },
        },
        buildings: true,
        amenities: { include: { amenity: true } },
        spaces: {
          include: {
            type: true,
            building: true,
            childRelations: {
              include: {
                parent: { select: { id: true, name: true, spaceCode: true } },
              },
            },
            parentRelations: {
              where: { effectiveTo: null },
              include: {
                child: {
                  select: {
                    id: true,
                    name: true,
                    spaceCode: true,
                    status: true,
                    versions: { orderBy: { effectiveFrom: 'desc' }, take: 1 },
                  },
                },
              },
            },
            versions: { orderBy: { effectiveFrom: 'desc' } },
            leases: {
              where: { status: { in: [LeaseStatus.SIGNED, LeaseStatus.ACTIVE] } },
              select: { id: true, status: true, rentAmount: true, currency: true },
              take: 5,
            },
            rentalListings: {
              where: {
                status: {
                  in: [
                    ListingStatus.DRAFT,
                    ListingStatus.PUBLISHED,
                    ListingStatus.PAUSED,
                    ListingStatus.PENDING_REVIEW,
                  ],
                },
              },
              select: { askingRent: true, currency: true, status: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            landProfile: true,
            residentialProfile: true,
            commercialProfile: true,
          },
        },
      },
    });
  }

  async createProperty(
    principal: AuthenticatedPrincipal,
    input: CreatePropertyDto,
    correlationId?: string,
    checkpoint?: CommandCheckpoint,
  ) {
    this.authorization.assertBranchPermission(
      principal,
      'portfolio.property.create',
      input.branchId,
    );
    if ((input.plotArea === undefined) !== (input.plotAreaUnit === undefined))
      throw new BadRequestException('Plot area and area unit must be supplied together.');
    const effectiveFrom = await this.effectiveDating.scheduledDate(
      principal.companyId,
      input.effectiveFrom,
    );
    return this.database.$transaction(async (transaction) => {
      const branch = await transaction.branch.findFirstOrThrow({
        where: { id: input.branchId, companyId: principal.companyId, active: true },
      });
      const property = await transaction.property.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          propertyCode:
            input.propertyCode?.trim().toUpperCase() ??
            (await nextRecordNumber(transaction, 'PROPERTY')),
          name: input.name,
          propertyType: input.propertyType,
          status: PropertyStatus.DRAFT,
          description: input.description ?? null,
          addressLine1: input.addressLine1 ?? null,
          city: input.city,
          district: input.district ?? null,
          neighborhood: input.neighborhood ?? null,
          landmark: input.landmark ?? null,
          latitude: decimal(input.latitude),
          longitude: decimal(input.longitude),
          plotArea: decimal(input.plotArea),
          plotAreaUnit: input.plotAreaUnit ?? null,
          propertyLifecycleHistories: {
            create: {
              id: uuidv7(),
              status: PropertyStatus.DRAFT,
              effectiveFrom,
              reason: 'Property draft created',
              actorUserId: principal.userId,
            },
          },
          branchAssignments: {
            create: {
              id: uuidv7(),
              branchId: branch.id,
              effectiveFrom,
            },
          },
        },
        include: { branchAssignments: true },
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'portfolio.property.created',
        entityType: 'Property',
        entityId: property.id,
        branchId: branch.id,
        correlationId,
        after: {
          propertyCode: property.propertyCode,
          propertyType: property.propertyType,
          status: property.status,
        },
      });
      await checkpoint?.(transaction, property.id);
      return property;
    });
  }

  async updateProperty(
    principal: AuthenticatedPrincipal,
    propertyId: string,
    input: UpdatePropertyDto,
    correlationId?: string,
  ) {
    const branchId = await this.assertPropertyPermission(
      principal,
      propertyId,
      'portfolio.property.update',
    );
    return this.database.$transaction(async (transaction) => {
      const before = await transaction.property.findFirstOrThrow({
        where: { id: propertyId, companyId: principal.companyId },
      });
      const after = await transaction.property.update({ where: { id: propertyId }, data: input });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'portfolio.property.updated',
        entityType: 'Property',
        entityId: propertyId,
        branchId,
        correlationId,
        before: { name: before.name, status: before.status },
        after: { name: after.name, status: after.status },
      });
      return after;
    });
  }

  async transitionProperty(
    principal: AuthenticatedPrincipal,
    propertyId: string,
    target: PropertyStatus,
    input: PropertyLifecycleTransitionDto,
    correlationId?: string,
    checkpoint?: CommandCheckpoint,
  ) {
    const branchId = await this.assertPropertyPermission(
      principal,
      propertyId,
      'portfolio.property.update',
    );
    const effectiveDate = await this.effectiveDating.lifecycleDate(
      principal.companyId,
      input.effectiveDate,
    );
    const allowed: Record<PropertyStatus, readonly PropertyStatus[]> = {
      DRAFT: [PropertyStatus.ACTIVE],
      ACTIVE: [PropertyStatus.INACTIVE],
      INACTIVE: [PropertyStatus.ACTIVE, PropertyStatus.RETIRED],
      RETIRED: [],
      SOLD: [],
    };
    return this.database.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT id FROM properties WHERE id = ${propertyId}::uuid FOR UPDATE`,
      );
      const before = await transaction.property.findFirstOrThrow({
        where: { id: propertyId, companyId: principal.companyId },
      });
      if (!allowed[before.status].includes(target))
        throw new BadRequestException(
          `Property transition ${before.status} -> ${target} is not allowed.`,
        );
      const current = await transaction.propertyLifecycleHistory.findFirst({
        where: { propertyId, effectiveTo: null },
        orderBy: { effectiveFrom: 'desc' },
      });
      if (!current) throw new BadRequestException('Property lifecycle history is missing.');
      if (current.effectiveFrom > effectiveDate)
        throw new BadRequestException('A later Property lifecycle change is already scheduled.');
      if (target === PropertyStatus.ACTIVE) {
        await this.assertActivePropertyConfiguration(transaction, propertyId, effectiveDate);
      }
      if (current.effectiveFrom.getTime() === effectiveDate.getTime()) {
        await transaction.propertyLifecycleHistory.update({
          where: { id: current.id },
          data: { status: target, reason: input.reason, actorUserId: principal.userId },
        });
      } else {
        await transaction.propertyLifecycleHistory.update({
          where: { id: current.id },
          data: { effectiveTo: effectiveDate },
        });
        await transaction.propertyLifecycleHistory.create({
          data: {
            id: uuidv7(),
            propertyId,
            status: target,
            effectiveFrom: effectiveDate,
            reason: input.reason,
            actorUserId: principal.userId,
          },
        });
      }
      const after = await transaction.property.update({
        where: { id: propertyId },
        data: { status: target },
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: `portfolio.property.${target.toLowerCase()}`,
        entityType: 'Property',
        entityId: propertyId,
        branchId,
        correlationId,
        reason: input.reason,
        before: { status: before.status },
        after: { status: target, effectiveDate: effectiveDate.toISOString().slice(0, 10) },
      });
      await checkpoint?.(transaction, after.id);
      return after;
    });
  }
  async discardPropertyDraft(
    principal: AuthenticatedPrincipal,
    propertyId: string,
    input: DiscardPropertyDraftDto,
    correlationId?: string,
  ) {
    const branchId = await this.assertPropertyPermission(
      principal,
      propertyId,
      'portfolio.property.update',
    );
    return this.database.$transaction(async (transaction) => {
      const property = await transaction.property.findFirst({
        where: { id: propertyId, companyId: principal.companyId },
        include: {
          _count: {
            select: {
              ownerships: true,
              buildings: true,
              spaces: true,
              amenities: true,
            },
          },
        },
      });
      if (!property) throw new NotFoundException('Property not found.');
      if (property.status !== PropertyStatus.DRAFT)
        throw new BadRequestException('Only a draft Property can be discarded.');
      const dependentCount = Object.values(property._count).reduce((sum, count) => sum + count, 0);
      if (dependentCount > 0)
        throw new BadRequestException(
          'This draft already has related business records. Archive it by changing its status instead.',
        );
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'portfolio.property.draft-discarded',
        entityType: 'Property',
        entityId: propertyId,
        branchId,
        correlationId,
        reason: input.reason,
        before: {
          propertyCode: property.propertyCode,
          name: property.name,
          status: property.status,
        },
      });
      await transaction.propertyBranchAssignment.deleteMany({ where: { propertyId } });
      await transaction.property.delete({ where: { id: propertyId } });
      return { id: propertyId, discarded: true };
    });
  }

  async transferBranch(
    principal: AuthenticatedPrincipal,
    propertyId: string,
    input: TransferPropertyBranchDto,
    correlationId?: string,
  ) {
    const oldBranchId = await this.assertPropertyPermission(
      principal,
      propertyId,
      'portfolio.property.update',
    );
    this.authorization.assertBranchPermission(
      principal,
      'portfolio.property.update',
      input.branchId,
    );
    const effectiveFrom = await this.effectiveDating.scheduledDate(
      principal.companyId,
      input.effectiveFrom,
    );
    return this.database.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT id FROM properties WHERE id = ${propertyId}::uuid FOR UPDATE`,
      );
      await transaction.branch.findFirstOrThrow({
        where: { id: input.branchId, companyId: principal.companyId, active: true },
      });
      const scheduledAssignments = await transaction.propertyBranchAssignment.findMany({
        where: { propertyId, effectiveFrom: { gte: effectiveFrom } },
        select: { effectiveFrom: true },
      });
      this.effectiveDating.assertNoLaterScheduledChange(effectiveFrom, scheduledAssignments);
      const current = await transaction.propertyBranchAssignment.findFirst({
        where: {
          propertyId,
          effectiveFrom: { lt: effectiveFrom },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
        },
      });
      if (current)
        await transaction.propertyBranchAssignment.update({
          where: { id: current.id },
          data: { effectiveTo: effectiveFrom },
        });
      const assignment = await transaction.propertyBranchAssignment.create({
        data: { id: uuidv7(), propertyId, branchId: input.branchId, effectiveFrom },
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'portfolio.property.branch-transferred',
        entityType: 'Property',
        entityId: propertyId,
        branchId: input.branchId,
        correlationId,
        reason: input.reason,
        before: { branchId: oldBranchId },
        after: { branchId: input.branchId, effectiveFrom: input.effectiveFrom },
      });
      return assignment;
    });
  }

  async replaceOwnership(
    principal: AuthenticatedPrincipal,
    propertyId: string,
    input: ReplaceOwnershipDto,
    correlationId?: string,
    checkpoint?: CommandCheckpoint,
  ) {
    const branchId = await this.assertPropertyPermission(
      principal,
      propertyId,
      'portfolio.ownership.manage',
    );
    const ownershipTotal = input.shares.reduce(
      (sum, share) => sum.plus(share.ownershipPercent),
      new Prisma.Decimal(0),
    );
    const payoutTotal = input.shares.reduce(
      (sum, share) => sum.plus(share.payoutPercent),
      new Prisma.Decimal(0),
    );
    if (!ownershipTotal.equals(100))
      throw new BadRequestException('Ownership percentages must total exactly 100.');
    if (!payoutTotal.equals(100))
      throw new BadRequestException('Payout entitlement percentages must total exactly 100.');
    if (new Set(input.shares.map((share) => share.ownerPartyId)).size !== input.shares.length)
      throw new BadRequestException(
        'Each owner may appear only once in an ownership configuration.',
      );
    const effectiveFrom = await this.effectiveDating.scheduledDate(
      principal.companyId,
      input.effectiveFrom,
    );
    return this.database.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT id FROM properties WHERE id = ${propertyId}::uuid FOR UPDATE`,
      );
      const scheduledOwnership = await transaction.propertyOwnership.findMany({
        where: { propertyId, effectiveFrom: { gte: effectiveFrom } },
        select: { effectiveFrom: true },
      });
      this.effectiveDating.assertNoLaterScheduledChange(effectiveFrom, scheduledOwnership);
      const companyWideOwnership = this.authorization.canPerformCompanyWide(
        principal,
        'portfolio.ownership.manage',
      );
      const owners = await transaction.ownerProfile.findMany({
        where: {
          partyId: { in: input.shares.map((share) => share.ownerPartyId) },
          party: {
            companyId: principal.companyId,
            employee: { is: null },
            ...(companyWideOwnership
              ? {}
              : {
                  OR: [
                    {
                      branchAssignments: {
                        some: {
                          branchId,
                          effectiveFrom: { lte: effectiveFrom },
                          OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
                        },
                      },
                    },
                    {
                      propertyOwnerships: {
                        some: {
                          effectiveFrom: { lte: effectiveFrom },
                          OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
                          property: {
                            branchAssignments: {
                              some: {
                                branchId,
                                effectiveFrom: { lte: effectiveFrom },
                                OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
                              },
                            },
                          },
                        },
                      },
                    },
                  ],
                }),
          },
        },
      });
      if (owners.length !== input.shares.length)
        throw new BadRequestException(
          'Every owner must have an active Owner profile available to this property branch.',
        );
      const open = await transaction.propertyOwnership.findMany({
        where: {
          propertyId,
          effectiveFrom: { lt: effectiveFrom },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
        },
      });
      for (const prior of open) {
        await transaction.propertyOwnerEntitlement.updateMany({
          where: {
            ownershipId: prior.id,
            effectiveFrom: { lt: effectiveFrom },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
          },
          data: { effectiveTo: effectiveFrom },
        });
        await transaction.propertyOwnership.update({
          where: { id: prior.id },
          data: { effectiveTo: effectiveFrom },
        });
      }
      const created = [];
      for (const share of input.shares) {
        created.push(
          await transaction.propertyOwnership.create({
            data: {
              id: uuidv7(),
              propertyId,
              ownerPartyId: share.ownerPartyId,
              ownershipPercent: new Prisma.Decimal(share.ownershipPercent),
              effectiveFrom,
              entitlements: {
                create: {
                  id: uuidv7(),
                  payoutPercent: new Prisma.Decimal(share.payoutPercent),
                  effectiveFrom,
                },
              },
            },
            include: { entitlements: true },
          }),
        );
      }
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'portfolio.ownership.replaced',
        entityType: 'Property',
        entityId: propertyId,
        branchId,
        correlationId,
        reason: input.reason,
        after: {
          effectiveFrom: input.effectiveFrom,
          shares: input.shares.map((share) => ({
            ownerPartyId: share.ownerPartyId,
            ownershipPercent: share.ownershipPercent,
            payoutPercent: share.payoutPercent,
          })),
        },
      });
      if (created[0]) await checkpoint?.(transaction, created[0].id);
      return created;
    });
  }

  getOwnership(principal: AuthenticatedPrincipal, propertyId: string) {
    return this.assertPropertyPermission(principal, propertyId, 'portfolio.ownership.read').then(
      () =>
        this.database.propertyOwnership.findMany({
          where: { propertyId },
          include: {
            owner: { include: { owner: true, person: true, organization: true } },
            entitlements: true,
          },
          orderBy: { effectiveFrom: 'desc' },
        }),
    );
  }

  async createBuilding(
    principal: AuthenticatedPrincipal,
    propertyId: string,
    input: CreateBuildingDto,
    correlationId?: string,
    checkpoint?: CommandCheckpoint,
  ) {
    const branchId = await this.assertPropertyPermission(
      principal,
      propertyId,
      'portfolio.building.manage',
    );
    return this.database.$transaction(async (transaction) => {
      const building = await transaction.building.create({
        data: {
          id: uuidv7(),
          propertyId,
          buildingCode:
            input.buildingCode?.trim().toUpperCase() ??
            (await nextRecordNumber(transaction, 'BUILDING')),
          name: input.name,
          numberOfFloors: input.numberOfFloors ?? null,
          attributes: input.attributes
            ? (input.attributes as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          status: input.status ?? BuildingStatus.ACTIVE,
        },
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'portfolio.building.created',
        entityType: 'Building',
        entityId: building.id,
        branchId,
        correlationId,
        after: { propertyId, buildingCode: building.buildingCode },
      });
      await checkpoint?.(transaction, building.id);
      return building;
    });
  }

  async listPropertyBranchHistory(
    principal: AuthenticatedPrincipal,
    query: ListPropertyBranchHistoryQueryDto,
  ) {
    if (query.propertyId)
      await this.assertPropertyPermission(principal, query.propertyId, 'portfolio.property.read');

    const at = await this.businessDate.today(principal.companyId);
    const authorizedBranchIds = this.authorization.authorizedBranchIds(
      principal,
      'portfolio.property.read',
    );
    const branchIds =
      authorizedBranchIds === null
        ? query.branchId
          ? [query.branchId]
          : null
        : [...authorizedBranchIds].filter(
            (branchId) => !query.branchId || branchId === query.branchId,
          );
    const period =
      query.period === 'CURRENT'
        ? { effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] }
        : query.period === 'SCHEDULED'
          ? { effectiveFrom: { gt: at } }
          : query.period === 'HISTORICAL'
            ? { effectiveTo: { lte: at } }
            : {};

    const propertySearch = query.propertySearch ?? query.search;
    const rows = await this.database.propertyBranchAssignment.findMany({
      where: {
        ...(query.propertyId ? { propertyId: query.propertyId } : {}),
        ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
        ...period,
        property: {
          companyId: principal.companyId,
          ...(propertySearch
            ? {
                OR: [
                  {
                    propertyCode: {
                      contains: propertySearch,
                      mode: 'insensitive',
                    },
                  },
                  { name: { contains: propertySearch, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        ...(query.branchSearch
          ? {
              branch: {
                OR: [
                  { code: { contains: query.branchSearch, mode: 'insensitive' } },
                  { name: { contains: query.branchSearch, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
      },
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1,
      include: {
        property: { select: { id: true, propertyCode: true, name: true, status: true } },
        branch: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ effectiveFrom: 'desc' }, { id: 'asc' }],
    });
    return cursorPage(rows, query.limit, (row) => row.id);
  }

  async listPropertyActivity(
    principal: AuthenticatedPrincipal,
    query: ListPropertyActivityQueryDto,
  ) {
    if (query.propertyId) {
      await this.assertPropertyPermission(principal, query.propertyId, 'portfolio.property.read');
    }

    const at = await this.businessDate.today(principal.companyId);
    const authorizedBranchIds = this.authorization.authorizedBranchIds(
      principal,
      'portfolio.property.read',
    );
    const branchIds =
      authorizedBranchIds === null
        ? query.branchId
          ? [query.branchId]
          : null
        : [...authorizedBranchIds].filter(
            (branchId) => !query.branchId || branchId === query.branchId,
          );
    const properties = await this.database.property.findMany({
      where: {
        companyId: principal.companyId,
        ...(query.propertyId ? { id: query.propertyId } : {}),
        ...(query.propertySearch
          ? {
              OR: [
                { propertyCode: { contains: query.propertySearch, mode: 'insensitive' } },
                { name: { contains: query.propertySearch, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(branchIds !== null || query.branchSearch
          ? {
              branchAssignments: {
                some: {
                  ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
                  effectiveFrom: { lte: at },
                  OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
                  ...(query.branchSearch
                    ? {
                        branch: {
                          OR: [
                            { code: { contains: query.branchSearch, mode: 'insensitive' } },
                            { name: { contains: query.branchSearch, mode: 'insensitive' } },
                          ],
                        },
                      }
                    : {}),
                },
              },
            }
          : {}),
      },
      select: { id: true, propertyCode: true, name: true },
    });
    if (!properties.length) return cursorPage([], query.limit, () => '');

    const propertyById = new Map(properties.map((property) => [property.id, property]));
    const rows = await this.database.auditLog.findMany({
      where: {
        entityType: 'Property',
        entityId: { in: properties.map((property) => property.id) },
        ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
        ...(query.branchSearch
          ? {
              branches: {
                is: {
                  OR: [
                    { code: { contains: query.branchSearch, mode: 'insensitive' } },
                    { name: { contains: query.branchSearch, mode: 'insensitive' } },
                  ],
                },
              },
            }
          : {}),
        ...(query.action ? { action: { contains: query.action, mode: 'insensitive' } } : {}),
        ...(query.search
          ? {
              OR: [
                { action: { contains: query.search, mode: 'insensitive' } },
                { reason: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1,
      select: {
        id: true,
        entityId: true,
        action: true,
        reason: true,
        occurredAt: true,
        branchId: true,
        branches: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'asc' }],
    });
    return cursorPage(
      rows.map((row) => ({
        ...row,
        property: row.entityId ? (propertyById.get(row.entityId) ?? null) : null,
        branch: row.branches,
        label: row.action.replace(/^portfolio\.property\./, 'Property ').replaceAll('.', ' '),
      })),
      query.limit,
      (row) => row.id,
    );
  }

  async listPropertyOwnerships(
    principal: AuthenticatedPrincipal,
    query: ListPropertyOwnershipsQueryDto,
  ) {
    if (query.propertyId)
      await this.assertPropertyPermission(principal, query.propertyId, 'portfolio.ownership.read');

    const at = await this.businessDate.today(principal.companyId);
    const authorizedBranchIds = this.authorization.authorizedBranchIds(
      principal,
      'portfolio.ownership.read',
    );
    const branchIds =
      authorizedBranchIds === null
        ? query.branchId
          ? [query.branchId]
          : null
        : [...authorizedBranchIds].filter(
            (branchId) => !query.branchId || branchId === query.branchId,
          );
    const period =
      query.period === 'CURRENT'
        ? { effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] }
        : query.period === 'SCHEDULED'
          ? { effectiveFrom: { gt: at } }
          : query.period === 'HISTORICAL'
            ? { effectiveTo: { lte: at } }
            : {};

    const rows = await this.database.propertyOwnership.findMany({
      where: {
        ...(query.propertyId ? { propertyId: query.propertyId } : {}),
        ...(query.ownerPartyId ? { ownerPartyId: query.ownerPartyId } : {}),
        ...period,
        property: {
          companyId: principal.companyId,
          ...(query.propertySearch
            ? {
                OR: [
                  { propertyCode: { contains: query.propertySearch, mode: 'insensitive' } },
                  { name: { contains: query.propertySearch, mode: 'insensitive' } },
                ],
              }
            : {}),
          ...(branchIds !== null || query.branchSearch
            ? {
                branchAssignments: {
                  some: {
                    ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
                    effectiveFrom: { lte: at },
                    OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
                    ...(query.branchSearch
                      ? {
                          branch: {
                            OR: [
                              { code: { contains: query.branchSearch, mode: 'insensitive' } },
                              { name: { contains: query.branchSearch, mode: 'insensitive' } },
                            ],
                          },
                        }
                      : {}),
                  },
                },
              }
            : {}),
        },
        owner: {
          companyId: principal.companyId,
          ...(query.ownerSearch
            ? {
                OR: [
                  { displayName: { contains: query.ownerSearch, mode: 'insensitive' } },
                  {
                    owner: {
                      is: { ownerNumber: { contains: query.ownerSearch, mode: 'insensitive' } },
                    },
                  },
                ],
              }
            : {}),
        },
        ...(query.search
          ? {
              OR: [
                {
                  property: {
                    OR: [
                      { propertyCode: { contains: query.search, mode: 'insensitive' } },
                      { name: { contains: query.search, mode: 'insensitive' } },
                    ],
                  },
                },
                {
                  owner: {
                    OR: [
                      { displayName: { contains: query.search, mode: 'insensitive' } },
                      {
                        owner: {
                          is: { ownerNumber: { contains: query.search, mode: 'insensitive' } },
                        },
                      },
                    ],
                  },
                },
              ],
            }
          : {}),
      },
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1,
      include: {
        property: {
          select: {
            id: true,
            propertyCode: true,
            name: true,
            status: true,
            branchAssignments: {
              where: {
                effectiveFrom: { lte: at },
                OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
              },
              include: { branch: { select: { id: true, code: true, name: true } } },
            },
          },
        },
        owner: {
          select: { id: true, displayName: true, owner: { select: { ownerNumber: true } } },
        },
        entitlements: {
          where: {
            effectiveFrom: { lte: at },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
          },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ effectiveFrom: 'desc' }, { id: 'asc' }],
    });
    return cursorPage(
      rows.map((ownership) => ({
        ...ownership,
        period:
          ownership.effectiveFrom > at
            ? 'SCHEDULED'
            : ownership.effectiveTo && ownership.effectiveTo <= at
              ? 'HISTORICAL'
              : 'CURRENT',
      })),
      query.limit,
      (ownership) => ownership.id,
    );
  }
  async listPropertyAmenities(
    principal: AuthenticatedPrincipal,
    query: ListPropertyAmenitiesQueryDto,
  ) {
    if (query.propertyId)
      await this.assertPropertyPermission(principal, query.propertyId, 'portfolio.amenity.read');
    const at = await this.businessDate.today(principal.companyId);
    const authorizedBranchIds = this.authorization.authorizedBranchIds(
      principal,
      'portfolio.amenity.read',
    );
    const branchIds =
      authorizedBranchIds === null
        ? query.branchId
          ? [query.branchId]
          : null
        : [...authorizedBranchIds].filter(
            (branchId) => !query.branchId || branchId === query.branchId,
          );
    const [cursorPropertyId, cursorAmenityId] = query.cursor?.split(':') ?? [];
    const amenityConditions: Prisma.PropertyAmenityWhereInput[] = [];
    if (cursorPropertyId && cursorAmenityId) {
      amenityConditions.push({
        OR: [
          { propertyId: { gt: cursorPropertyId } },
          { propertyId: cursorPropertyId, amenityId: { gt: cursorAmenityId } },
        ],
      });
    }
    if (query.search) {
      amenityConditions.push({
        OR: [
          {
            property: {
              OR: [
                { propertyCode: { contains: query.search, mode: 'insensitive' } },
                { name: { contains: query.search, mode: 'insensitive' } },
              ],
            },
          },
          {
            amenity: {
              OR: [
                { code: { contains: query.search, mode: 'insensitive' } },
                { name: { contains: query.search, mode: 'insensitive' } },
              ],
            },
          },
        ],
      });
    }
    const rows = await this.database.propertyAmenity.findMany({
      where: {
        ...(query.propertyId ? { propertyId: query.propertyId } : {}),
        ...(query.amenityId ? { amenityId: query.amenityId } : {}),
        AND: amenityConditions,
        property: {
          companyId: principal.companyId,
          ...(query.propertySearch
            ? {
                OR: [
                  { propertyCode: { contains: query.propertySearch, mode: 'insensitive' } },
                  { name: { contains: query.propertySearch, mode: 'insensitive' } },
                ],
              }
            : {}),
          ...(branchIds !== null || query.branchSearch
            ? {
                branchAssignments: {
                  some: {
                    ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
                    effectiveFrom: { lte: at },
                    OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
                    ...(query.branchSearch
                      ? {
                          branch: {
                            OR: [
                              { code: { contains: query.branchSearch, mode: 'insensitive' } },
                              { name: { contains: query.branchSearch, mode: 'insensitive' } },
                            ],
                          },
                        }
                      : {}),
                  },
                },
              }
            : {}),
        },
        amenity: {
          ...(query.amenitySearch
            ? {
                OR: [
                  { code: { contains: query.amenitySearch, mode: 'insensitive' } },
                  { name: { contains: query.amenitySearch, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
      },
      take: query.limit + 1,
      include: {
        property: {
          select: {
            id: true,
            propertyCode: true,
            name: true,
            status: true,
            branchAssignments: {
              where: {
                effectiveFrom: { lte: at },
                OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
              },
              include: { branch: { select: { id: true, code: true, name: true } } },
            },
          },
        },
        amenity: { select: { id: true, code: true, name: true, active: true } },
      },
      orderBy: [{ propertyId: 'asc' }, { amenityId: 'asc' }],
    });
    return cursorPage(rows, query.limit, (row) => row.propertyId + ':' + row.amenityId);
  }
  async listBuildings(principal: AuthenticatedPrincipal, propertyId: string) {
    await this.assertPropertyPermission(principal, propertyId, 'portfolio.building.read');
    return this.database.building.findMany({
      where: { propertyId, property: { companyId: principal.companyId } },
      include: {
        property: { select: { id: true, propertyCode: true, name: true } },
        _count: { select: { spaces: true } },
      },
      orderBy: [{ buildingCode: 'asc' }, { id: 'asc' }],
    });
  }

  async listBuildingWorkspace(principal: AuthenticatedPrincipal, query: ListBuildingsQueryDto) {
    if (query.propertyId)
      await this.assertPropertyPermission(principal, query.propertyId, 'portfolio.building.read');

    const at = await this.businessDate.today(principal.companyId);
    const authorizedBranchIds = this.authorization.authorizedBranchIds(
      principal,
      'portfolio.building.read',
    );
    const branchIds =
      authorizedBranchIds === null
        ? query.branchId
          ? [query.branchId]
          : null
        : [...authorizedBranchIds].filter(
            (branchId) => !query.branchId || branchId === query.branchId,
          );
    const rows = await this.database.building.findMany({
      where: {
        ...(query.propertyId ? { propertyId: query.propertyId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                { buildingCode: { contains: query.search, mode: 'insensitive' } },
                { name: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        property: {
          companyId: principal.companyId,
          ...(query.propertySearch
            ? {
                OR: [
                  { propertyCode: { contains: query.propertySearch, mode: 'insensitive' } },
                  { name: { contains: query.propertySearch, mode: 'insensitive' } },
                ],
              }
            : {}),
          ...(branchIds !== null || query.branchSearch
            ? {
                branchAssignments: {
                  some: {
                    ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
                    effectiveFrom: { lte: at },
                    OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
                    ...(query.branchSearch
                      ? {
                          branch: {
                            OR: [
                              { code: { contains: query.branchSearch, mode: 'insensitive' } },
                              { name: { contains: query.branchSearch, mode: 'insensitive' } },
                            ],
                          },
                        }
                      : {}),
                  },
                },
              }
            : {}),
        },
      },
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1,
      include: {
        property: { select: { id: true, propertyCode: true, name: true } },
        _count: { select: { spaces: true } },
      },
      orderBy: { id: 'asc' },
    });
    return cursorPage(rows, query.limit, (building) => building.id);
  }
  async getBuilding(principal: AuthenticatedPrincipal, buildingId: string) {
    const building = await this.database.building.findFirstOrThrow({
      where: { id: buildingId, property: { companyId: principal.companyId } },
      select: { propertyId: true },
    });
    await this.assertPropertyPermission(principal, building.propertyId, 'portfolio.building.read');
    return this.database.building.findUniqueOrThrow({
      where: { id: buildingId },
      include: {
        property: {
          select: {
            id: true,
            propertyCode: true,
            name: true,
            branchAssignments: {
              select: { branchId: true, effectiveFrom: true, effectiveTo: true },
              orderBy: [{ effectiveFrom: 'desc' }, { id: 'asc' }],
            },
          },
        },
        spaces: {
          include: { type: true, versions: { orderBy: { effectiveFrom: 'desc' }, take: 1 } },
          orderBy: [{ spaceCode: 'asc' }, { id: 'asc' }],
        },
        _count: { select: { spaces: true } },
      },
    });
  }

  async listBuildingActivity(
    principal: AuthenticatedPrincipal,
    buildingId: string,
    query: ListBuildingActivityQueryDto,
  ) {
    const building = await this.database.building.findFirstOrThrow({
      where: { id: buildingId, property: { companyId: principal.companyId } },
      select: { propertyId: true },
    });
    await this.assertPropertyPermission(principal, building.propertyId, 'portfolio.building.read');
    const rows = await this.database.auditLog.findMany({
      where: {
        entityType: 'Building',
        entityId: buildingId,
        ...(query.search
          ? {
              OR: [
                { action: { contains: query.search, mode: 'insensitive' } },
                { reason: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1,
      select: { id: true, action: true, reason: true, occurredAt: true },
      orderBy: [{ occurredAt: 'desc' }, { id: 'asc' }],
    });
    return cursorPage(rows, query.limit, (row) => row.id);
  }
  async updateBuilding(
    principal: AuthenticatedPrincipal,
    buildingId: string,
    input: UpdateBuildingDto,
    correlationId?: string,
  ) {
    const existing = await this.database.building.findFirstOrThrow({
      where: { id: buildingId, property: { companyId: principal.companyId } },
    });
    const branchId = await this.assertPropertyPermission(
      principal,
      existing.propertyId,
      'portfolio.building.manage',
    );
    return this.database.$transaction(async (transaction) => {
      const after = await transaction.building.update({
        where: { id: buildingId },
        data: {
          ...(input.name === undefined ? {} : { name: input.name.trim() }),
          ...(input.numberOfFloors === undefined ? {} : { numberOfFloors: input.numberOfFloors }),
          ...(input.attributes === undefined
            ? {}
            : { attributes: input.attributes as Prisma.InputJsonValue }),
        },
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'portfolio.building.updated',
        entityType: 'Building',
        entityId: buildingId,
        branchId,
        correlationId,
        before: { name: existing.name, numberOfFloors: existing.numberOfFloors },
        after: { name: after.name, numberOfFloors: after.numberOfFloors },
      });
      return after;
    });
  }

  async transitionBuilding(
    principal: AuthenticatedPrincipal,
    buildingId: string,
    input: BuildingLifecycleDto,
    correlationId?: string,
  ) {
    const existing = await this.database.building.findFirstOrThrow({
      where: { id: buildingId, property: { companyId: principal.companyId } },
    });
    const branchId = await this.assertPropertyPermission(
      principal,
      existing.propertyId,
      'portfolio.building.manage',
    );
    const allowed: Record<BuildingStatus, readonly BuildingStatus[]> = {
      ACTIVE: [BuildingStatus.INACTIVE],
      INACTIVE: [BuildingStatus.ACTIVE, BuildingStatus.RETIRED],
      RETIRED: [],
    };
    if (!allowed[existing.status].includes(input.status)) {
      throw new BadRequestException(
        `Building transition ${existing.status} -> ${input.status} is not allowed.`,
      );
    }
    if (input.status === BuildingStatus.RETIRED) {
      const activeSpaces = await this.database.rentableSpace.count({
        where: { buildingId, status: { not: RentableSpaceStatus.RETIRED } },
      });
      if (activeSpaces) {
        throw new BadRequestException(
          'Retire associated RentableSpaces before retiring the Building.',
        );
      }
    }
    return this.database.$transaction(async (transaction) => {
      const after = await transaction.building.update({
        where: { id: buildingId },
        data: { status: input.status },
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: `portfolio.building.${input.status.toLowerCase()}`,
        entityType: 'Building',
        entityId: buildingId,
        branchId,
        correlationId,
        reason: input.reason,
        before: { status: existing.status },
        after: { status: after.status },
      });
      return after;
    });
  }
  listSpaceTypes() {
    return this.database.rentableSpaceType.findMany({
      where: { active: true },
      orderBy: { code: 'asc' },
    });
  }

  async listSpaceMeasurements(
    principal: AuthenticatedPrincipal,
    query: ListSpaceMeasurementsQueryDto,
  ) {
    if (query.propertyId)
      await this.assertPropertyPermission(principal, query.propertyId, 'portfolio.space.read');
    const at = await this.businessDate.today(principal.companyId);
    const authorizedBranchIds = this.authorization.authorizedBranchIds(
      principal,
      'portfolio.space.read',
    );
    const period =
      query.period === 'CURRENT'
        ? { effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] }
        : query.period === 'HISTORICAL'
          ? { effectiveTo: { lte: at } }
          : {};
    const rows = await this.database.rentableSpaceVersion.findMany({
      where: {
        ...period,
        space: {
          ...(query.propertyId ? { propertyId: query.propertyId } : {}),
          ...(query.search
            ? {
                OR: [
                  { spaceCode: { contains: query.search, mode: 'insensitive' } },
                  { name: { contains: query.search, mode: 'insensitive' } },
                ],
              }
            : {}),
          ...(query.buildingSearch
            ? {
                building: {
                  OR: [
                    { buildingCode: { contains: query.buildingSearch, mode: 'insensitive' } },
                    { name: { contains: query.buildingSearch, mode: 'insensitive' } },
                  ],
                },
              }
            : {}),
          property: {
            companyId: principal.companyId,
            ...(query.propertySearch
              ? {
                  OR: [
                    { propertyCode: { contains: query.propertySearch, mode: 'insensitive' } },
                    { name: { contains: query.propertySearch, mode: 'insensitive' } },
                  ],
                }
              : {}),
            ...(authorizedBranchIds === null
              ? {}
              : {
                  branchAssignments: {
                    some: {
                      branchId: { in: [...authorizedBranchIds] },
                      effectiveFrom: { lte: at },
                      OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
                    },
                  },
                }),
          },
        },
      },
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1,
      include: {
        space: {
          include: {
            property: { select: { id: true, propertyCode: true, name: true } },
            building: { select: { id: true, buildingCode: true, name: true } },
            type: { select: { code: true, name: true } },
          },
        },
      },
      orderBy: [{ effectiveFrom: 'desc' }, { id: 'asc' }],
    });
    return cursorPage(
      rows.map((version) => ({
        ...version,
        period: version.effectiveTo && version.effectiveTo <= at ? 'HISTORICAL' : 'CURRENT',
      })),
      query.limit,
      (version) => version.id,
    );
  }
  async listSpaces(principal: AuthenticatedPrincipal, query: ListSpacesQueryDto) {
    const { propertyId, buildingId, typeCode, status, propertySearch, buildingSearch, typeSearch } =
      query;
    if (propertyId)
      await this.assertPropertyPermission(principal, propertyId, 'portfolio.space.read');
    const at = await this.businessDate.today(principal.companyId);
    const authorizedBranchIds = this.authorization.authorizedBranchIds(
      principal,
      'portfolio.space.read',
    );
    const branchIds =
      authorizedBranchIds === null
        ? query.branchId
          ? [query.branchId]
          : null
        : [...authorizedBranchIds].filter(
            (branchId) => !query.branchId || branchId === query.branchId,
          );
    const rows = await this.database.rentableSpace.findMany({
      where: {
        ...(propertyId ? { propertyId } : {}),
        ...(buildingId ? { buildingId } : {}),
        ...(status ? { status } : {}),
        ...(query.search
          ? {
              OR: [
                { spaceCode: { contains: query.search, mode: 'insensitive' } },
                { name: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(buildingSearch
          ? {
              building: {
                OR: [
                  { buildingCode: { contains: buildingSearch, mode: 'insensitive' } },
                  { name: { contains: buildingSearch, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
        ...(typeCode || typeSearch
          ? {
              type: {
                ...(typeCode ? { code: typeCode } : {}),
                ...(typeSearch
                  ? {
                      OR: [
                        { code: { contains: typeSearch, mode: 'insensitive' } },
                        { name: { contains: typeSearch, mode: 'insensitive' } },
                      ],
                    }
                  : {}),
              },
            }
          : {}),
        property: {
          companyId: principal.companyId,
          ...(propertySearch
            ? {
                OR: [
                  { propertyCode: { contains: propertySearch, mode: 'insensitive' } },
                  { name: { contains: propertySearch, mode: 'insensitive' } },
                ],
              }
            : {}),
          ...(branchIds !== null || query.branchSearch
            ? {
                branchAssignments: {
                  some: {
                    ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
                    effectiveFrom: { lte: at },
                    OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
                    ...(query.branchSearch
                      ? {
                          branch: {
                            OR: [
                              { code: { contains: query.branchSearch, mode: 'insensitive' } },
                              { name: { contains: query.branchSearch, mode: 'insensitive' } },
                            ],
                          },
                        }
                      : {}),
                  },
                },
              }
            : {}),
        },
      },
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1,
      include: {
        property: {
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
            },
          },
        },
        type: true,
        building: true,
        versions: { orderBy: { effectiveFrom: 'desc' } },
        childRelations: {
          include: { parent: { select: { id: true, name: true, spaceCode: true } } },
        },
        parentRelations: true,
        landProfile: true,
        residentialProfile: true,
        commercialProfile: true,
        amenities: { include: { amenity: true } },
      },
      orderBy: { id: 'asc' },
    });
    return cursorPage(rows, query.limit, (space) => space.id);
  }
  async getSpace(principal: AuthenticatedPrincipal, spaceId: string) {
    const space = await this.database.rentableSpace.findUniqueOrThrow({ where: { id: spaceId } });
    await this.assertPropertyPermission(principal, space.propertyId, 'portfolio.space.read');
    return this.database.rentableSpace.findUniqueOrThrow({
      where: { id: spaceId },
      include: {
        property: true,
        building: true,
        type: true,
        versions: { orderBy: { effectiveFrom: 'desc' } },
        childRelations: {
          include: {
            child: { include: { type: true, versions: true } },
            parent: { select: { id: true, name: true, spaceCode: true } },
          },
        },
        parentRelations: {
          include: {
            child: { select: { id: true, name: true, spaceCode: true, type: true } },
          },
        },
        landProfile: true,
        residentialProfile: true,
        commercialProfile: true,
        amenities: { include: { amenity: true } },
      },
    });
  }

  private validateSpaceProfiles(input: CreateSpaceDto) {
    if (
      (input.usableArea === undefined && input.totalArea === undefined) !==
      (input.areaUnit === undefined)
    )
      throw new BadRequestException('Area unit is required whenever an area is supplied.');
    if (input.typeCode === 'LAND') {
      if (!input.land) throw new BadRequestException('LAND requires land-specific data.');
      if (input.residential || input.commercial)
        throw new BadRequestException(
          'LAND cannot contain residential or commercial profile data.',
        );
    } else if (input.land)
      throw new BadRequestException('Land-specific data is valid only for LAND.');
  }

  async createSpace(
    principal: AuthenticatedPrincipal,
    input: CreateSpaceDto,
    correlationId?: string,
    checkpoint?: CommandCheckpoint,
  ) {
    this.validateSpaceProfiles(input);
    const branchId = await this.assertPropertyPermission(
      principal,
      input.propertyId,
      'portfolio.space.create',
    );
    const effectiveFrom = await this.effectiveDating.scheduledDate(
      principal.companyId,
      input.effectiveFrom,
    );
    return this.database.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT id FROM properties WHERE id = ${input.propertyId}::uuid FOR UPDATE`,
      );
      const type = await transaction.rentableSpaceType.findFirstOrThrow({
        where: { code: input.typeCode, active: true },
      });
      if (input.buildingId)
        await transaction.building.findFirstOrThrow({
          where: { id: input.buildingId, propertyId: input.propertyId },
        });
      if (input.parentSpaceId) {
        await transaction.$queryRaw(
          Prisma.sql`SELECT id FROM rentable_spaces WHERE id = ${input.parentSpaceId}::uuid FOR UPDATE`,
        );
        const parent = await transaction.rentableSpace.findFirstOrThrow({
          where: {
            id: input.parentSpaceId,
            propertyId: input.propertyId,
            status: { not: RentableSpaceStatus.RETIRED },
          },
          include: { versions: true },
        });
        const parentVersion = parent.versions.find(
          (version) =>
            version.effectiveFrom <= effectiveFrom &&
            (!version.effectiveTo || effectiveFrom < version.effectiveTo),
        );
        if (!parentVersion?.usableArea || !parentVersion.areaUnit)
          throw new BadRequestException(
            'Parent requires an effective usable area before adding a child.',
          );
        if (input.usableArea === undefined || input.areaUnit !== parentVersion.areaUnit)
          throw new BadRequestException(
            'Child usable area and matching parent area unit are required.',
          );
        const [allocated] = await transaction.$queryRaw<Array<{ value: string }>>(Prisma.sql`
          SELECT COALESCE(SUM(v."usableArea"), 0)::text value
          FROM "rentable_space_parent_history" h
          JOIN "rentable_space_versions" v ON v."rentableSpaceId" = h."childSpaceId"
          WHERE h."parentSpaceId" = ${input.parentSpaceId}::uuid
            AND h."effectiveFrom" <= ${effectiveFrom}::date
            AND (h."effectiveTo" IS NULL OR h."effectiveTo" > ${effectiveFrom}::date)
            AND v."effectiveFrom" <= ${effectiveFrom}::date
            AND (v."effectiveTo" IS NULL OR v."effectiveTo" > ${effectiveFrom}::date)
        `);
        const remaining = new Prisma.Decimal(parentVersion.usableArea).minus(
          allocated?.value ?? '0',
        );
        if (new Prisma.Decimal(input.usableArea).greaterThan(remaining))
          throw new BadRequestException(
            `Child usable area exceeds the ${remaining.toString()} ${parentVersion.areaUnit} remaining in the parent.`,
          );
      }
      const space = await transaction.rentableSpace.create({
        data: {
          id: uuidv7(),
          propertyId: input.propertyId,
          buildingId: input.buildingId ?? null,
          typeId: type.id,
          spaceCode:
            input.spaceCode?.trim().toUpperCase() ?? (await nextRecordNumber(transaction, 'SPACE')),
          name: input.name,
          status: input.status ?? RentableSpaceStatus.ACTIVE,
          versions: {
            create: {
              id: uuidv7(),
              versionNo: 1,
              effectiveFrom,
              label: input.name,
              usableArea: decimal(input.usableArea),
              totalArea: decimal(input.totalArea),
              areaUnit: input.areaUnit ?? null,
              floorNumber: input.floorNumber ?? null,
              capacity: input.capacity ?? null,
            },
          },
          ...(input.parentSpaceId
            ? {
                childRelations: {
                  create: {
                    id: uuidv7(),
                    parentSpaceId: input.parentSpaceId,
                    effectiveFrom,
                  },
                },
              }
            : {}),
          ...(input.land ? { landProfile: { create: { ...input.land } } } : {}),
          ...(input.residential
            ? {
                residentialProfile: {
                  create: {
                    ...input.residential,
                    bathrooms: decimal(input.residential.bathrooms),
                  },
                },
              }
            : {}),
          ...(input.commercial
            ? {
                commercialProfile: {
                  create: {
                    ...input.commercial,
                    frontageMeters: decimal(input.commercial.frontageMeters),
                  },
                },
              }
            : {}),
        },
        include: {
          type: true,
          versions: true,
          parentRelations: true,
          landProfile: true,
          residentialProfile: true,
          commercialProfile: true,
        },
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'portfolio.space.created',
        entityType: 'RentableSpace',
        entityId: space.id,
        branchId,
        correlationId,
        after: {
          propertyId: input.propertyId,
          spaceCode: space.spaceCode,
          typeCode: type.code,
          parentSpaceId: input.parentSpaceId ?? null,
        },
      });
      await checkpoint?.(transaction, space.id);
      return space;
    });
  }

  async partition(
    principal: AuthenticatedPrincipal,
    parentSpaceId: string,
    input: PartitionSpaceDto,
    correlationId?: string,
  ) {
    const parent = await this.database.rentableSpace.findUniqueOrThrow({
      where: { id: parentSpaceId },
      include: { versions: { orderBy: { effectiveFrom: 'desc' } } },
    });
    const branchId = await this.assertPropertyPermission(
      principal,
      parent.propertyId,
      'portfolio.space.partition',
    );
    const effectiveFrom = await this.effectiveDating.scheduledDate(
      principal.companyId,
      input.effectiveFrom,
    );
    const parentVersion = parent.versions.find(
      (version) =>
        version.effectiveFrom <= effectiveFrom &&
        (!version.effectiveTo || effectiveFrom < version.effectiveTo),
    );
    if (!parentVersion?.usableArea)
      throw new BadRequestException(
        'Parent requires an effective usable area before partitioning.',
      );
    if (parentVersion.areaUnit !== input.areaUnit)
      throw new BadRequestException('Partition area unit must match the parent.');
    const childTotal = input.children.reduce(
      (sum, child) => sum.plus(child.usableArea),
      new Prisma.Decimal(0),
    );
    if (childTotal.gt(parentVersion.usableArea))
      throw new BadRequestException('Child usable-area total cannot exceed parent usable area.');
    return this.database.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT id FROM rentable_spaces WHERE id = ${parentSpaceId}::uuid FOR UPDATE`,
      );
      const created = [];
      for (const child of input.children) {
        const type = await transaction.rentableSpaceType.findFirstOrThrow({
          where: { code: child.typeCode, active: true },
        });
        created.push(
          await transaction.rentableSpace.create({
            data: {
              id: uuidv7(),
              propertyId: parent.propertyId,
              buildingId: parent.buildingId,
              typeId: type.id,
              spaceCode:
                child.spaceCode?.trim().toUpperCase() ??
                (await nextRecordNumber(transaction, 'SPACE')),
              name: child.name,
              status: RentableSpaceStatus.ACTIVE,
              versions: {
                create: {
                  id: uuidv7(),
                  versionNo: 1,
                  effectiveFrom,
                  label: child.name,
                  usableArea: new Prisma.Decimal(child.usableArea),
                  totalArea: decimal(child.totalArea),
                  areaUnit: input.areaUnit ?? null,
                },
              },
              childRelations: { create: { id: uuidv7(), parentSpaceId, effectiveFrom } },
              ...(child.commercial
                ? {
                    commercialProfile: {
                      create: {
                        ...child.commercial,
                        frontageMeters: decimal(child.commercial.frontageMeters),
                      },
                    },
                  }
                : {}),
            },
            include: { versions: true, type: true },
          }),
        );
      }
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'portfolio.space.partitioned',
        entityType: 'RentableSpace',
        entityId: parentSpaceId,
        branchId,
        correlationId,
        reason: input.reason,
        after: {
          effectiveFrom: input.effectiveFrom,
          childIds: created.map((space) => space.id),
          childTotal: childTotal.toString(),
          areaUnit: input.areaUnit ?? null,
        },
      });
      return created;
    });
  }

  async updateSpace(
    principal: AuthenticatedPrincipal,
    spaceId: string,
    input: UpdateSpaceDto,
    correlationId?: string,
  ) {
    if (input.name === undefined && input.typeCode === undefined && input.buildingId === undefined) {
      throw new BadRequestException('Provide at least one field to update.');
    }
    const space = await this.database.rentableSpace.findUniqueOrThrow({
      where: { id: spaceId },
      include: { type: true },
    });
    if (space.status === RentableSpaceStatus.RETIRED) {
      throw new BadRequestException('Retired units cannot be edited.');
    }
    const branchId = await this.assertPropertyPermission(
      principal,
      space.propertyId,
      'portfolio.space.update',
    );
    return this.database.$transaction(async (transaction) => {
      let typeId = space.typeId;
      if (input.typeCode !== undefined) {
        const type = await transaction.rentableSpaceType.findFirstOrThrow({
          where: { code: input.typeCode, active: true },
        });
        typeId = type.id;
      }
      if (input.buildingId !== undefined) {
        await transaction.building.findFirstOrThrow({
          where: { id: input.buildingId, propertyId: space.propertyId },
        });
      }
      const after = await transaction.rentableSpace.update({
        where: { id: spaceId },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.typeCode !== undefined ? { typeId } : {}),
          ...(input.buildingId !== undefined ? { buildingId: input.buildingId } : {}),
        },
        include: { type: true },
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'portfolio.space.updated',
        entityType: 'RentableSpace',
        entityId: spaceId,
        branchId,
        correlationId,
        before: {
          name: space.name,
          typeCode: space.type.code,
          buildingId: space.buildingId,
        },
        after: {
          name: after.name,
          typeCode: after.type.code,
          buildingId: after.buildingId,
        },
      });
      return after;
    });
  }

  async correctMeasurement(
    principal: AuthenticatedPrincipal,
    spaceId: string,
    input: CorrectMeasurementDto,
    correlationId?: string,
  ) {
    const space = await this.database.rentableSpace.findUniqueOrThrow({ where: { id: spaceId } });
    const branchId = await this.assertPropertyPermission(
      principal,
      space.propertyId,
      'portfolio.space.update',
    );
    const effectiveFrom = await this.effectiveDating.scheduledDate(
      principal.companyId,
      input.effectiveFrom,
    );
    return this.database.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT id FROM rentable_spaces WHERE id = ${spaceId}::uuid FOR UPDATE`,
      );
      const scheduledVersions = await transaction.rentableSpaceVersion.findMany({
        where: { rentableSpaceId: spaceId, effectiveFrom: { gte: effectiveFrom } },
        select: { effectiveFrom: true },
      });
      this.effectiveDating.assertNoLaterScheduledChange(effectiveFrom, scheduledVersions);
      const prior = await transaction.rentableSpaceVersion.findFirst({
        where: {
          rentableSpaceId: spaceId,
          effectiveFrom: { lt: effectiveFrom },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
        },
        orderBy: { versionNo: 'desc' },
      });
      if (!prior) throw new BadRequestException('No prior effective measurement exists.');
      await transaction.rentableSpaceVersion.update({
        where: { id: prior.id },
        data: { effectiveTo: effectiveFrom },
      });
      const version = await transaction.rentableSpaceVersion.create({
        data: {
          id: uuidv7(),
          rentableSpaceId: spaceId,
          versionNo: prior.versionNo + 1,
          effectiveFrom,
          label: prior.label,
          usableArea: new Prisma.Decimal(input.usableArea),
          totalArea: decimal(input.totalArea),
          areaUnit: input.areaUnit ?? null,
          floorNumber: prior.floorNumber,
          capacity: prior.capacity,
          attributes: prior.attributes ?? Prisma.JsonNull,
        },
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'portfolio.space.measurement-corrected',
        entityType: 'RentableSpace',
        entityId: spaceId,
        branchId,
        correlationId,
        reason: input.reason,
        before: {
          versionId: prior.id,
          usableArea: prior.usableArea?.toString(),
          areaUnit: prior.areaUnit,
        },
        after: {
          versionId: version.id,
          usableArea: version.usableArea?.toString(),
          areaUnit: version.areaUnit,
          effectiveFrom: input.effectiveFrom,
        },
      });
      return version;
    });
  }

  async reparent(
    principal: AuthenticatedPrincipal,
    spaceId: string,
    input: ReparentSpaceDto,
    correlationId?: string,
  ) {
    const child = await this.database.rentableSpace.findUniqueOrThrow({ where: { id: spaceId } });
    const branchId = await this.assertPropertyPermission(
      principal,
      child.propertyId,
      'portfolio.space.update',
    );
    if (spaceId === input.parentSpaceId)
      throw new BadRequestException('A space cannot be its own parent.');
    const parent = await this.database.rentableSpace.findUniqueOrThrow({
      where: { id: input.parentSpaceId },
    });
    if (parent.propertyId !== child.propertyId)
      throw new BadRequestException('Parent and child must belong to the same Property.');
    const effectiveFrom = await this.effectiveDating.scheduledDate(
      principal.companyId,
      input.effectiveFrom,
    );
    return this.database.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT id FROM rentable_spaces WHERE "propertyId" = ${child.propertyId}::uuid FOR UPDATE`,
      );
      const scheduledParents = await transaction.rentableSpaceParentHistory.findMany({
        where: { childSpaceId: spaceId, effectiveFrom: { gte: effectiveFrom } },
        select: { effectiveFrom: true },
      });
      this.effectiveDating.assertNoLaterScheduledChange(effectiveFrom, scheduledParents);
      const cycle = await transaction.$queryRaw<Array<{ cycle: boolean }>>(Prisma.sql`
        WITH RECURSIVE descendants(id) AS (
          SELECT h."childSpaceId"
          FROM rentable_space_parent_history h
          WHERE h."parentSpaceId" = ${spaceId}::uuid
            AND h."effectiveFrom" <= ${effectiveFrom}::date
            AND (h."effectiveTo" IS NULL OR h."effectiveTo" > ${effectiveFrom}::date)
          UNION
          SELECT h."childSpaceId"
          FROM rentable_space_parent_history h
          JOIN descendants d ON d.id = h."parentSpaceId"
          WHERE h."effectiveFrom" <= ${effectiveFrom}::date
            AND (h."effectiveTo" IS NULL OR h."effectiveTo" > ${effectiveFrom}::date)
        )
        SELECT EXISTS(SELECT 1 FROM descendants WHERE id = ${input.parentSpaceId}::uuid) AS cycle
      `);
      if (cycle[0]?.cycle)
        throw new BadRequestException('The requested parent would create a hierarchy cycle.');
      const current = await transaction.rentableSpaceParentHistory.findFirst({
        where: {
          childSpaceId: spaceId,
          effectiveFrom: { lt: effectiveFrom },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
        },
      });
      if (current)
        await transaction.rentableSpaceParentHistory.update({
          where: { id: current.id },
          data: { effectiveTo: effectiveFrom },
        });
      const relation = await transaction.rentableSpaceParentHistory.create({
        data: {
          id: uuidv7(),
          childSpaceId: spaceId,
          parentSpaceId: input.parentSpaceId,
          effectiveFrom,
        },
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'portfolio.space.reparented',
        entityType: 'RentableSpace',
        entityId: spaceId,
        branchId,
        correlationId,
        reason: input.reason,
        before: { parentSpaceId: current?.parentSpaceId ?? null },
        after: { parentSpaceId: input.parentSpaceId, effectiveFrom: input.effectiveFrom },
      });
      return relation;
    });
  }

  async retire(
    principal: AuthenticatedPrincipal,
    spaceId: string,
    input: RetireSpaceDto,
    correlationId?: string,
  ) {
    const space = await this.database.rentableSpace.findUniqueOrThrow({ where: { id: spaceId } });
    const branchId = await this.assertPropertyPermission(
      principal,
      space.propertyId,
      'portfolio.space.update',
    );
    const effectiveDate = await this.effectiveDating.scheduledDate(
      principal.companyId,
      input.effectiveDate,
    );
    return this.database.$transaction(async (transaction) => {
      const scheduledVersions = await transaction.rentableSpaceVersion.findMany({
        where: { rentableSpaceId: spaceId, effectiveFrom: { gte: effectiveDate } },
        select: { effectiveFrom: true },
      });
      const scheduledParents = await transaction.rentableSpaceParentHistory.findMany({
        where: { childSpaceId: spaceId, effectiveFrom: { gte: effectiveDate } },
        select: { effectiveFrom: true },
      });
      this.effectiveDating.assertNoLaterScheduledChange(effectiveDate, [
        ...scheduledVersions,
        ...scheduledParents,
      ]);
      const activeChildren = await transaction.rentableSpaceParentHistory.count({
        where: {
          parentSpaceId: spaceId,
          effectiveFrom: { lte: effectiveDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveDate } }],
          child: { status: RentableSpaceStatus.ACTIVE },
        },
      });
      if (activeChildren)
        throw new BadRequestException('Retire active child spaces before retiring their parent.');
      const openLeases = await transaction.lease.count({
        where: {
          rentableSpaceId: spaceId,
          status: {
            notIn: [LeaseStatus.ENDED, LeaseStatus.TERMINATED, LeaseStatus.ARCHIVED],
          },
        },
      });
      if (openLeases) {
        throw new BadRequestException(
          'End or terminate open leases on this unit before retiring it.',
        );
      }
      if (space.status === RentableSpaceStatus.RETIRED) {
        throw new BadRequestException('This unit is already retired.');
      }
      await transaction.rentableSpaceVersion.updateMany({
        where: {
          rentableSpaceId: spaceId,
          effectiveFrom: { lt: effectiveDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveDate } }],
        },
        data: { effectiveTo: effectiveDate },
      });
      await transaction.rentableSpaceParentHistory.updateMany({
        where: {
          childSpaceId: spaceId,
          effectiveFrom: { lt: effectiveDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveDate } }],
        },
        data: { effectiveTo: effectiveDate },
      });
      const retired = await transaction.rentableSpace.update({
        where: { id: spaceId },
        data: { status: RentableSpaceStatus.RETIRED },
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'portfolio.space.retired',
        entityType: 'RentableSpace',
        entityId: spaceId,
        branchId,
        correlationId,
        reason: input.reason,
        after: { status: retired.status, effectiveDate: input.effectiveDate },
      });
      return retired;
    });
  }

  listAmenities() {
    return this.database.amenity.findMany({
      include: { _count: { select: { propertyAssignments: true, spaceAssignments: true } } },
      orderBy: { code: 'asc' },
    });
  }

  createAmenity(
    principal: AuthenticatedPrincipal,
    input: CreateAmenityDto,
    correlationId?: string,
  ) {
    this.authorization.assertCompanyPermission(principal, 'portfolio.amenity.manage');
    return this.database.$transaction(async (transaction) => {
      const amenity = await transaction.amenity.create({
        data: {
          id: uuidv7(),
          code: input.code.trim().toUpperCase().replaceAll(' ', '_'),
          name: input.name.trim(),
          active: true,
        },
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'portfolio.amenity.created',
        entityType: 'Amenity',
        entityId: amenity.id,
        correlationId,
        after: { code: amenity.code, name: amenity.name, active: amenity.active },
      });
      return amenity;
    });
  }

  updateAmenity(
    principal: AuthenticatedPrincipal,
    amenityId: string,
    input: UpdateAmenityDto,
    correlationId?: string,
  ) {
    this.authorization.assertCompanyPermission(principal, 'portfolio.amenity.manage');
    return this.database.$transaction(async (transaction) => {
      const before = await transaction.amenity.findUniqueOrThrow({ where: { id: amenityId } });
      const after = await transaction.amenity.update({
        where: { id: amenityId },
        data: {
          ...(input.name === undefined ? {} : { name: input.name.trim() }),
          ...(input.active === undefined ? {} : { active: input.active }),
        },
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'portfolio.amenity.updated',
        entityType: 'Amenity',
        entityId: amenityId,
        correlationId,
        before: { name: before.name, active: before.active },
        after: { name: after.name, active: after.active },
      });
      return after;
    });
  }

  async assignPropertyAmenity(
    principal: AuthenticatedPrincipal,
    propertyId: string,
    input: AmenityAssignmentDto,
    correlationId?: string,
  ) {
    const branchId = await this.assertPropertyPermission(
      principal,
      propertyId,
      'portfolio.amenity.manage',
    );
    return this.database.$transaction(async (transaction) => {
      const assignment = await transaction.propertyAmenity.upsert({
        where: { propertyId_amenityId: { propertyId, amenityId: input.amenityId } },
        update: {},
        create: { propertyId, amenityId: input.amenityId },
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'portfolio.property.amenity-assigned',
        entityType: 'Property',
        entityId: propertyId,
        branchId,
        correlationId,
        after: { amenityId: input.amenityId },
      });
      return assignment;
    });
  }

  async assignSpaceAmenity(
    principal: AuthenticatedPrincipal,
    spaceId: string,
    input: AmenityAssignmentDto,
    correlationId?: string,
  ) {
    const space = await this.database.rentableSpace.findUniqueOrThrow({ where: { id: spaceId } });
    const branchId = await this.assertPropertyPermission(
      principal,
      space.propertyId,
      'portfolio.amenity.manage',
    );
    return this.database.$transaction(async (transaction) => {
      const assignment = await transaction.spaceAmenity.upsert({
        where: {
          rentableSpaceId_amenityId: { rentableSpaceId: spaceId, amenityId: input.amenityId },
        },
        update: {},
        create: { rentableSpaceId: spaceId, amenityId: input.amenityId },
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'portfolio.space.amenity-assigned',
        entityType: 'RentableSpace',
        entityId: spaceId,
        branchId,
        correlationId,
        after: { amenityId: input.amenityId },
      });
      return assignment;
    });
  }

  async removePropertyAmenity(
    principal: AuthenticatedPrincipal,
    propertyId: string,
    amenityId: string,
    correlationId?: string,
  ) {
    const branchId = await this.assertPropertyPermission(
      principal,
      propertyId,
      'portfolio.amenity.manage',
    );
    return this.database.$transaction(async (transaction) => {
      const removed = await transaction.propertyAmenity.deleteMany({
        where: { propertyId, amenityId },
      });
      if (!removed.count) throw new NotFoundException('Amenity assignment was not found.');
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'portfolio.property.amenity-unassigned',
        entityType: 'Property',
        entityId: propertyId,
        branchId,
        correlationId,
        before: { amenityId },
      });
      return { propertyId, amenityId, removed: true };
    });
  }

  async removeSpaceAmenity(
    principal: AuthenticatedPrincipal,
    spaceId: string,
    amenityId: string,
    correlationId?: string,
  ) {
    const space = await this.database.rentableSpace.findFirstOrThrow({
      where: { id: spaceId, property: { companyId: principal.companyId } },
    });
    const branchId = await this.assertPropertyPermission(
      principal,
      space.propertyId,
      'portfolio.amenity.manage',
    );
    return this.database.$transaction(async (transaction) => {
      const removed = await transaction.spaceAmenity.deleteMany({
        where: { rentableSpaceId: spaceId, amenityId },
      });
      if (!removed.count) throw new NotFoundException('Amenity assignment was not found.');
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'portfolio.space.amenity-unassigned',
        entityType: 'RentableSpace',
        entityId: spaceId,
        branchId,
        correlationId,
        before: { amenityId },
      });
      return { spaceId, amenityId, removed: true };
    });
  }

  private async assertDocumentEntityPermission(
    principal: AuthenticatedPrincipal,
    entityType: DocumentEntityType,
    entityId: string,
    permission: string,
  ): Promise<string | undefined> {
    if (entityType === 'Property') {
      return this.assertPropertyPermission(principal, entityId, permission);
    }
    if (entityType === 'RentableSpace') {
      const space = await this.database.rentableSpace.findFirstOrThrow({
        where: { id: entityId, property: { companyId: principal.companyId } },
      });
      return this.assertPropertyPermission(principal, space.propertyId, permission);
    }
    if (entityType === 'MaintenanceRequest') {
      const row = await this.database.maintenanceRequest.findFirstOrThrow({
        where: { id: entityId, companyId: principal.companyId },
      });
      this.authorization.assertBranchPermission(principal, 'maintenance.read', row.branchId);
      return row.branchId;
    }
    if (entityType === 'WorkOrder') {
      const row = await this.database.workOrder.findFirstOrThrow({
        where: { id: entityId, companyId: principal.companyId },
      });
      this.authorization.assertBranchPermission(principal, 'work-order.read', row.branchId);
      return row.branchId;
    }
    if (entityType === 'Inspection') {
      const row = await this.database.inspection.findFirstOrThrow({
        where: { id: entityId, companyId: principal.companyId },
      });
      this.authorization.assertBranchPermission(principal, 'inspection.read', row.branchId);
      return row.branchId;
    }
    if (entityType === 'DefectIssue') {
      const row = await this.database.defectIssue.findFirstOrThrow({
        where: { id: entityId, companyId: principal.companyId },
      });
      this.authorization.assertBranchPermission(principal, 'defect.read', row.branchId);
      return row.branchId;
    }
    if (entityType === 'Vendor') {
      const row = await this.database.vendorProfile.findFirstOrThrow({
        where: { partyId: entityId, party: { companyId: principal.companyId } },
        include: { branches: true },
      });
      const branchId = row.branches[0]?.branchId;
      if (branchId) this.authorization.assertBranchPermission(principal, 'vendor.read', branchId);
      return branchId;
    }
    const ownerBranchIds = await this.assertOwnerPermission(principal, entityId, permission);
    return ownerBranchIds.length === 1 ? ownerBranchIds[0] : undefined;
  }

  private serializeDocument<
    T extends { versions: Array<{ sizeBytes: bigint; storageKey: string }> },
  >(document: T) {
    return {
      ...document,
      versions: document.versions.map((storedVersion) => {
        const { storageKey, ...version } = storedVersion;
        void storageKey;
        return { ...version, sizeBytes: version.sizeBytes.toString() };
      }),
    };
  }

  private validateDocumentFile(file: Express.Multer.File): string {
    if (!file?.buffer?.length) throw new BadRequestException('Choose a non-empty document file.');
    if (file.size > this.objectStorage.maximumUploadBytes()) {
      throw new BadRequestException('The document file exceeds the configured upload limit.');
    }
    const allowedMimeTypes = new Set([
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]);
    if (!allowedMimeTypes.has(file.mimetype)) {
      throw new BadRequestException('This document file type is not supported.');
    }
    const matchesSignature =
      (file.mimetype === 'application/pdf' && file.buffer.subarray(0, 5).toString() === '%PDF-') ||
      (file.mimetype === 'image/jpeg' &&
        file.buffer[0] === 0xff &&
        file.buffer[1] === 0xd8 &&
        file.buffer[2] === 0xff) ||
      (file.mimetype === 'image/png' &&
        file.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
      (file.mimetype === 'image/webp' &&
        file.buffer.subarray(0, 4).toString() === 'RIFF' &&
        file.buffer.subarray(8, 12).toString() === 'WEBP') ||
      (file.mimetype === 'text/plain' && !file.buffer.subarray(0, 1024).includes(0)) ||
      ([
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ].includes(file.mimetype) &&
        (file.buffer.subarray(0, 2).toString() === 'PK' ||
          file.buffer.subarray(0, 4).toString('hex') === 'd0cf11e0'));
    if (!matchesSignature) {
      throw new BadRequestException('The file content does not match its declared type.');
    }
    const originalFilename = file.originalname
      .normalize('NFKC')
      .replace(/[\\/]/g, '-')
      .split('')
      .filter((character) => {
        const code = character.charCodeAt(0);
        return code >= 32 && code !== 127;
      })
      .join('')
      .trim();
    if (!originalFilename || originalFilename.length > 255) {
      throw new BadRequestException('The original filename is invalid.');
    }
    return originalFilename;
  }

  private async documentEntityIds(
    principal: AuthenticatedPrincipal,
    entityType: DocumentEntityType,
    entitySearch?: string,
  ): Promise<string[] | null> {
    const permission = 'portfolio.document.read';
    const authorizedBranchIds = this.authorization.authorizedBranchIds(principal, permission);
    if (authorizedBranchIds === null && !entitySearch) return null;

    const at = await this.businessDate.today(principal.companyId);
    const branchIds = authorizedBranchIds === null ? null : [...authorizedBranchIds];
    const currentBranchScope =
      branchIds === null
        ? {}
        : {
            branchAssignments: {
              some: {
                branchId: { in: branchIds },
                effectiveFrom: { lte: at },
                OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
              },
            },
          };

    if (entityType === 'Property') {
      const properties = await this.database.property.findMany({
        where: {
          companyId: principal.companyId,
          ...currentBranchScope,
          ...(entitySearch
            ? {
                OR: [
                  { propertyCode: { contains: entitySearch, mode: 'insensitive' } },
                  { name: { contains: entitySearch, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        select: { id: true },
      });
      return properties.map((property) => property.id);
    }

    if (entityType === 'RentableSpace') {
      const spaces = await this.database.rentableSpace.findMany({
        where: {
          property: { companyId: principal.companyId, ...currentBranchScope },
          ...(entitySearch
            ? {
                OR: [
                  { spaceCode: { contains: entitySearch, mode: 'insensitive' } },
                  { name: { contains: entitySearch, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        select: { id: true },
      });
      return spaces.map((space) => space.id);
    }

    const scoped = branchIds === null ? {} : { branchId: { in: branchIds } };
    if (entityType === 'MaintenanceRequest') {
      const rows = await this.database.maintenanceRequest.findMany({
        where: { companyId: principal.companyId, ...scoped },
        select: { id: true },
      });
      return rows.map((row) => row.id);
    }
    if (entityType === 'WorkOrder') {
      const rows = await this.database.workOrder.findMany({
        where: { companyId: principal.companyId, ...scoped },
        select: { id: true },
      });
      return rows.map((row) => row.id);
    }
    if (entityType === 'Inspection') {
      const rows = await this.database.inspection.findMany({
        where: { companyId: principal.companyId, ...scoped },
        select: { id: true },
      });
      return rows.map((row) => row.id);
    }
    if (entityType === 'DefectIssue') {
      const rows = await this.database.defectIssue.findMany({
        where: { companyId: principal.companyId, ...scoped },
        select: { id: true },
      });
      return rows.map((row) => row.id);
    }
    if (entityType === 'Vendor') {
      const rows = await this.database.vendorProfile.findMany({
        where: {
          party: { companyId: principal.companyId },
          ...(branchIds === null ? {} : { branches: { some: { branchId: { in: branchIds } } } }),
        },
        select: { partyId: true },
      });
      return rows.map((row) => row.partyId);
    }

    const active = {
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
    };
    const ownerSearchFilters: Prisma.OwnerProfileWhereInput[] = entitySearch
      ? [
          {
            OR: [
              { ownerNumber: { contains: entitySearch, mode: 'insensitive' } },
              {
                party: {
                  OR: [
                    { displayName: { contains: entitySearch, mode: 'insensitive' } },
                    { partyNumber: { contains: entitySearch, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          },
        ]
      : [];
    const owners = await this.database.ownerProfile.findMany({
      where: {
        AND: [
          {
            party: {
              companyId: principal.companyId,
              employee: { is: null },
              ...(branchIds === null
                ? {}
                : {
                    OR: [
                      { branchAssignments: { some: { branchId: { in: branchIds }, ...active } } },
                      {
                        propertyOwnerships: {
                          some: {
                            ...active,
                            property: {
                              branchAssignments: {
                                some: { branchId: { in: branchIds }, ...active },
                              },
                            },
                          },
                        },
                      },
                    ],
                  }),
            },
          },
          ...ownerSearchFilters,
        ],
      },
      select: { partyId: true },
    });
    return owners.map((owner) => owner.partyId);
  }

  async listDocuments(principal: AuthenticatedPrincipal, query: ListDocumentsQueryDto) {
    if (!query.entityType && query.entityId) {
      throw new BadRequestException('A document entity type is required when filtering by record.');
    }
    if (!query.entityType && query.entitySearch) {
      throw new BadRequestException(
        'A document entity type is required when searching related records.',
      );
    }

    let entityScopeIds: string[] | null = null;
    if (query.entityType && query.entityId) {
      await this.assertDocumentEntityPermission(
        principal,
        query.entityType,
        query.entityId,
        'portfolio.document.read',
      );
      entityScopeIds = [query.entityId];
    } else if (query.entityType) {
      entityScopeIds = await this.documentEntityIds(
        principal,
        query.entityType,
        query.entitySearch,
      );
      if (entityScopeIds !== null && !entityScopeIds.length) {
        return cursorPage([], query.limit, () => '');
      }
    } else {
      this.authorization.assertCompanyPermission(principal, 'portfolio.document.read');
    }

    const linkFilter = query.entityType
      ? {
          entityType: query.entityType,
          ...(entityScopeIds === null ? {} : { entityId: { in: entityScopeIds } }),
        }
      : undefined;
    const documents = await this.database.document.findMany({
      where: {
        companyId: principal.companyId,
        ...(query.search
          ? {
              OR: [
                { displayName: { contains: query.search, mode: 'insensitive' } },
                { categoryCode: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(linkFilter ? { links: { some: linkFilter } } : {}),
        ...(query.categoryCode
          ? { categoryCode: { equals: query.categoryCode, mode: 'insensitive' } }
          : {}),
        ...(query.accessClass ? { accessClass: query.accessClass } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1,
      include: {
        versions: { orderBy: { sequence: 'desc' } },
        links: linkFilter ? { where: linkFilter } : true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const links = documents.flatMap((document) => document.links);
    const propertyIds = links
      .filter((link) => link.entityType === 'Property')
      .map((link) => link.entityId);
    const ownerIds = links
      .filter((link) => link.entityType === 'Owner')
      .map((link) => link.entityId);
    const spaceIds = links
      .filter((link) => link.entityType === 'RentableSpace')
      .map((link) => link.entityId);
    const [properties, owners, spaces] = await Promise.all([
      propertyIds.length
        ? this.database.property.findMany({
            where: { id: { in: propertyIds }, companyId: principal.companyId },
            select: { id: true, propertyCode: true, name: true, status: true },
          })
        : [],
      ownerIds.length
        ? this.database.ownerProfile.findMany({
            where: { partyId: { in: ownerIds }, party: { companyId: principal.companyId } },
            select: { partyId: true, ownerNumber: true, party: { select: { displayName: true } } },
          })
        : [],
      spaceIds.length
        ? this.database.rentableSpace.findMany({
            where: { id: { in: spaceIds }, property: { companyId: principal.companyId } },
            select: {
              id: true,
              spaceCode: true,
              name: true,
              status: true,
              property: { select: { id: true, propertyCode: true, name: true } },
            },
          })
        : [],
    ]);
    const propertyById = new Map(properties.map((property) => [property.id, property]));
    const ownerById = new Map(
      owners.map((owner) => [
        owner.partyId,
        { id: owner.partyId, ownerNumber: owner.ownerNumber, displayName: owner.party.displayName },
      ]),
    );
    const spaceById = new Map(spaces.map((space) => [space.id, space]));
    return cursorPage(
      documents.map((document) => {
        const link = document.links[0];
        return {
          ...this.serializeDocument(document),
          property:
            link?.entityType === 'Property' ? (propertyById.get(link.entityId) ?? null) : null,
          owner: link?.entityType === 'Owner' ? (ownerById.get(link.entityId) ?? null) : null,
          space:
            link?.entityType === 'RentableSpace' ? (spaceById.get(link.entityId) ?? null) : null,
        };
      }),
      query.limit,
      (document) => document.id,
    );
  }

  async getDocument(principal: AuthenticatedPrincipal, documentId: string) {
    const document = await this.database.document.findFirstOrThrow({
      where: { id: documentId, companyId: principal.companyId },
      include: { versions: { orderBy: { sequence: 'desc' } }, links: true },
    });
    const link = document.links[0];
    if (!link || !['Property', 'RentableSpace', 'Owner'].includes(link.entityType)) {
      throw new NotFoundException('Document relation was not found.');
    }
    await this.assertDocumentEntityPermission(
      principal,
      link.entityType as DocumentEntityType,
      link.entityId,
      'portfolio.document.read',
    );
    return this.serializeDocument(document);
  }

  async updateDocument(
    principal: AuthenticatedPrincipal,
    documentId: string,
    input: UpdateDocumentMetadataDto,
    correlationId?: string,
  ) {
    const document = await this.database.document.findFirstOrThrow({
      where: { id: documentId, companyId: principal.companyId },
      include: { links: true },
    });
    const link = document.links[0];
    if (!link || !['Property', 'RentableSpace', 'Owner'].includes(link.entityType)) {
      throw new NotFoundException('Document relation was not found.');
    }
    const branchId = await this.assertDocumentEntityPermission(
      principal,
      link.entityType as DocumentEntityType,
      link.entityId,
      'portfolio.document.manage',
    );
    return this.database.$transaction(async (transaction) => {
      const after = await transaction.document.update({
        where: { id: documentId },
        data: {
          ...(input.displayName === undefined ? {} : { displayName: input.displayName.trim() }),
          ...(input.categoryCode === undefined ? {} : { categoryCode: input.categoryCode.trim() }),
          ...(input.accessClass === undefined ? {} : { accessClass: input.accessClass }),
          ...(input.status === undefined ? {} : { status: input.status }),
          ...(input.notes === undefined ? {} : { notes: input.notes.trim() || null }),
        },
        include: { versions: { orderBy: { sequence: 'desc' } }, links: true },
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'portfolio.document.metadata-updated',
        entityType: link.entityType,
        entityId: link.entityId,
        branchId,
        correlationId,
        before: {
          displayName: document.displayName,
          categoryCode: document.categoryCode,
          accessClass: document.accessClass,
          status: document.status,
        },
        after: {
          displayName: after.displayName,
          categoryCode: after.categoryCode,
          accessClass: after.accessClass,
          status: after.status,
        },
      });
      return this.serializeDocument(after);
    });
  }
  async getDocumentContent(
    principal: AuthenticatedPrincipal,
    documentId: string,
    versionId: string,
    disposition: 'inline' | 'attachment',
    correlationId?: string,
  ) {
    const document = await this.database.document.findFirstOrThrow({
      where: { id: documentId, companyId: principal.companyId },
      include: {
        links: true,
        versions: { where: { id: versionId } },
      },
    });
    const link = document.links[0];
    const version = document.versions[0];
    if (!link || !version || !['Property', 'RentableSpace', 'Owner'].includes(link.entityType)) {
      throw new NotFoundException('Document version was not found.');
    }
    const branchId = await this.assertDocumentEntityPermission(
      principal,
      link.entityType as DocumentEntityType,
      link.entityId,
      'portfolio.document.read',
    );
    const stored = await this.objectStorage.get(version.storageKey);
    await this.database.$transaction((transaction) =>
      this.audit.write(transaction, {
        actorUserId: principal.userId,
        action:
          disposition === 'attachment'
            ? 'portfolio.document.downloaded'
            : 'portfolio.document.viewed',
        entityType: link.entityType,
        entityId: link.entityId,
        branchId,
        correlationId,
        after: { documentId, versionId, sequence: version.sequence },
      }),
    );
    return {
      body: stored.body,
      filename: version.originalFilename,
      mimeType: version.mimeType,
      sizeBytes: Number(version.sizeBytes),
    };
  }

  async uploadDocumentVersion(
    principal: AuthenticatedPrincipal,
    documentId: string,
    file: Express.Multer.File,
    correlationId?: string,
  ) {
    const document = await this.database.document.findFirstOrThrow({
      where: { id: documentId, companyId: principal.companyId },
      include: { links: true },
    });
    const link = document.links[0];
    if (!link || !['Property', 'RentableSpace', 'Owner'].includes(link.entityType)) {
      throw new NotFoundException('Document relation was not found.');
    }
    const branchId = await this.assertDocumentEntityPermission(
      principal,
      link.entityType as DocumentEntityType,
      link.entityId,
      'portfolio.document.manage',
    );
    const originalFilename = this.validateDocumentFile(file);
    const versionId = uuidv7();
    const storageKey = `${principal.companyId}/documents/${documentId}/${versionId}`;
    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    await this.objectStorage.put({
      storageKey,
      body: file.buffer,
      mimeType: file.mimetype,
      checksum,
    });
    try {
      return await this.database.$transaction(async (transaction) => {
        await transaction.$queryRaw(
          Prisma.sql`SELECT id FROM documents WHERE id = ${documentId}::uuid FOR UPDATE`,
        );
        const latest = await transaction.documentVersion.findFirst({
          where: { documentId },
          orderBy: { sequence: 'desc' },
          select: { sequence: true },
        });
        const sequence = (latest?.sequence ?? 0) + 1;
        await transaction.documentVersion.create({
          data: {
            id: versionId,
            documentId,
            sequence,
            storageKey,
            originalFilename,
            checksum,
            mimeType: file.mimetype,
            sizeBytes: BigInt(file.size),
            uploadedByUserId: principal.userId,
          },
        });
        const updated = await transaction.document.findUniqueOrThrow({
          where: { id: documentId },
          include: { versions: { orderBy: { sequence: 'desc' } }, links: true },
        });
        await this.audit.write(transaction, {
          actorUserId: principal.userId,
          action: 'portfolio.document.version-uploaded',
          entityType: link.entityType,
          entityId: link.entityId,
          branchId,
          correlationId,
          after: {
            documentId,
            versionId,
            sequence,
            mimeType: file.mimetype,
            sizeBytes: file.size,
          },
        });
        return this.serializeDocument(updated);
      });
    } catch (cause) {
      await this.objectStorage.remove(storageKey).catch(() => undefined);
      throw cause;
    }
  }

  async uploadDocument(
    principal: AuthenticatedPrincipal,
    input: UploadDocumentDto,
    file: Express.Multer.File,
    correlationId?: string,
  ) {
    const branchId = await this.assertDocumentEntityPermission(
      principal,
      input.entityType,
      input.entityId,
      'portfolio.document.manage',
    );
    const originalFilename = this.validateDocumentFile(file);
    const documentId = uuidv7();
    const versionId = uuidv7();
    const storageKey = `${principal.companyId}/documents/${documentId}/${versionId}`;
    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    await this.objectStorage.put({
      storageKey,
      body: file.buffer,
      mimeType: file.mimetype,
      checksum,
    });
    try {
      return await this.database.$transaction(async (transaction) => {
        const document = await transaction.document.create({
          data: {
            id: documentId,
            companyId: principal.companyId,
            displayName: input.title.trim(),
            categoryCode: input.categoryCode.trim().toUpperCase(),
            accessClass: input.accessClass,
            status: 'ACTIVE',
            notes: input.notes?.trim() || null,
            versions: {
              create: {
                id: versionId,
                sequence: 1,
                storageKey,
                originalFilename,
                checksum,
                mimeType: file.mimetype,
                sizeBytes: BigInt(file.size),
                uploadedByUserId: principal.userId,
              },
            },
            links: {
              create: {
                id: uuidv7(),
                entityType: input.entityType,
                entityId: input.entityId,
                purpose: input.purpose,
              },
            },
          },
          include: { versions: { orderBy: { sequence: 'desc' } }, links: true },
        });
        await this.audit.write(transaction, {
          actorUserId: principal.userId,
          action: 'portfolio.document.uploaded',
          entityType: input.entityType,
          entityId: input.entityId,
          branchId,
          correlationId,
          after: {
            documentId,
            categoryCode: document.categoryCode,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            sequence: 1,
          },
        });
        return this.serializeDocument(document);
      });
    } catch (cause) {
      await this.objectStorage.remove(storageKey).catch(() => undefined);
      throw cause;
    }
  }

  async createDocument(
    principal: AuthenticatedPrincipal,
    input: CreateDocumentMetadataDto,
    correlationId?: string,
  ) {
    const branchId = await this.assertDocumentEntityPermission(
      principal,
      input.entityType,
      input.entityId,
      'portfolio.document.manage',
    );
    return this.database.$transaction(async (transaction) => {
      const document = await transaction.document.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          displayName:
            input.displayName?.trim() ??
            input.storageKey.split(/[\\/]/).pop() ??
            input.categoryCode.trim(),
          categoryCode: input.categoryCode.trim(),
          accessClass: input.accessClass,
          status: input.status,
          versions: {
            create: {
              id: uuidv7(),
              sequence: 1,
              storageKey: input.storageKey,
              originalFilename:
                input.storageKey.split(/[\\/]/).pop() ?? input.displayName ?? 'legacy-file',
              checksum: input.checksum,
              mimeType: input.mimeType,
              sizeBytes: BigInt(input.sizeBytes),
              uploadedByUserId: principal.userId,
            },
          },
          links: {
            create: {
              id: uuidv7(),
              entityType: input.entityType,
              entityId: input.entityId,
              purpose: input.purpose,
            },
          },
        },
        include: { versions: true, links: true },
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'portfolio.document.metadata-created',
        entityType: input.entityType,
        entityId: input.entityId,
        branchId,
        correlationId,
        after: {
          documentId: document.id,
          categoryCode: document.categoryCode,
          purpose: input.purpose,
        },
      });
      return this.serializeDocument(document);
    });
  }
}
