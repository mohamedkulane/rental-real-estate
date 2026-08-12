import { uuidv7 } from '@rerms/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BuildingStatus, Prisma, PropertyStatus, RentableSpaceStatus } from '@prisma/client';
import { BusinessDateService } from '../common/business-date.service';
import { EffectiveDatingService } from '../common/effective-dating.service';
import { nextRecordNumber } from '../common/record-number';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../governance/audit.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import type {
  AmenityAssignmentDto,
  CorrectMeasurementDto,
  CreateAmenityDto,
  CreateBuildingDto,
  CreateDocumentMetadataDto,
  CreatePropertyDto,
  CreateSpaceDto,
  DiscardPropertyDraftDto,
  PartitionSpaceDto,
  PropertyLifecycleTransitionDto,
  ReplaceOwnershipDto,
  ReparentSpaceDto,
  RetireSpaceDto,
  TransferPropertyBranchDto,
  UpdateAmenityDto,
  UpdatePropertyDto,
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
  ) {}

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

  async listProperties(principal: AuthenticatedPrincipal) {
    const at = await this.businessDate.today(principal.companyId);
    const branchIds = this.authorization.authorizedBranchIds(principal, 'portfolio.property.read');
    return this.database.property.findMany({
      where: {
        companyId: principal.companyId,
        ...(branchIds === null
          ? {}
          : {
              branchAssignments: {
                some: {
                  branchId: { in: [...branchIds] },
                  effectiveFrom: { lte: at },
                  OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
                },
              },
            }),
      },
      include: {
        branchAssignments: {
          include: { branch: { select: { id: true, code: true, name: true } } },
          orderBy: { effectiveFrom: 'desc' },
        },
        _count: { select: { spaces: true, buildings: true } },
      },
      orderBy: { propertyCode: 'asc' },
    });
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
            versions: { orderBy: { effectiveFrom: 'desc' } },
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
          buildingCode: input.buildingCode.trim().toUpperCase(),
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
      return building;
    });
  }

  listSpaceTypes() {
    return this.database.rentableSpaceType.findMany({
      where: { active: true },
      orderBy: { code: 'asc' },
    });
  }

  async listSpaces(principal: AuthenticatedPrincipal, propertyId?: string) {
    if (propertyId)
      await this.assertPropertyPermission(principal, propertyId, 'portfolio.space.read');
    const at = await this.businessDate.today(principal.companyId);
    const branchIds = this.authorization.authorizedBranchIds(principal, 'portfolio.space.read');
    return this.database.rentableSpace.findMany({
      where: {
        ...(propertyId ? { propertyId } : {}),
        property: {
          companyId: principal.companyId,
          ...(branchIds === null
            ? {}
            : {
                branchAssignments: {
                  some: {
                    branchId: { in: [...branchIds] },
                    effectiveFrom: { lte: at },
                    OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
                  },
                },
              }),
        },
      },
      include: {
        property: {
          select: {
            id: true,
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
        childRelations: true,
        parentRelations: true,
        landProfile: true,
        residentialProfile: true,
        commercialProfile: true,
        amenities: { include: { amenity: true } },
      },
      orderBy: { spaceCode: 'asc' },
    });
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
        childRelations: { include: { child: { include: { type: true, versions: true } } } },
        parentRelations: true,
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
          where: { id: input.parentSpaceId, propertyId: input.propertyId },
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

  async createDocument(
    principal: AuthenticatedPrincipal,
    input: CreateDocumentMetadataDto,
    correlationId?: string,
  ) {
    let branchId: string | undefined;
    if (input.entityType === 'Property')
      branchId = await this.assertPropertyPermission(
        principal,
        input.entityId,
        'portfolio.document.manage',
      );
    else if (input.entityType === 'RentableSpace') {
      const space = await this.database.rentableSpace.findUniqueOrThrow({
        where: { id: input.entityId },
      });
      branchId = await this.assertPropertyPermission(
        principal,
        space.propertyId,
        'portfolio.document.manage',
      );
    } else {
      const ownerBranchIds = await this.assertOwnerPermission(
        principal,
        input.entityId,
        'portfolio.document.manage',
      );
      branchId = ownerBranchIds.length === 1 ? ownerBranchIds[0] : undefined;
    }
    return this.database.$transaction(async (transaction) => {
      const document = await transaction.document.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          categoryCode: input.categoryCode,
          accessClass: input.accessClass,
          status: input.status,
          versions: {
            create: {
              id: uuidv7(),
              sequence: 1,
              storageKey: input.storageKey,
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
      return {
        ...document,
        versions: document.versions.map((version) => ({
          ...version,
          sizeBytes: version.sizeBytes.toString(),
        })),
      };
    });
  }
}
