import { uuidv7 } from '@rerms/shared';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  PropertyStatus,
  RentableSpaceStatus,
  ServiceEngagementStatus,
  ServiceModel,
} from '@prisma/client';
import { BusinessDateService } from '../common/business-date.service';
import { cursorPage } from '../common/cursor-pagination';
import { EffectiveDatingService } from '../common/effective-dating.service';
import { nextRecordNumber } from '../common/record-number';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../governance/audit.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import {
  EngagementPeriodFilter,
  type CreateServiceEngagementDto,
  type ListServiceEngagementActivityQueryDto,
  type ListServiceEngagementsQueryDto,
  type ResolveCapabilitiesQueryDto,
  type ServiceEngagementTransitionDto,
  type UpdateServiceEngagementDto,
} from './service-engagement.dto';
import {
  assertCompatibleModels,
  assertLifecycleTransition,
  assertServiceModelScope,
  classifyEngagementPeriod,
  displayEngagementStatus,
  resolveCapabilitySet,
} from './service-engagement.policy';

const isoDate = (value: string): Date => new Date(`${value.slice(0, 10)}T00:00:00.000Z`);

@Injectable()
export class ServiceEngagementService {
  constructor(
    private readonly database: DatabaseService,
    private readonly businessDate: BusinessDateService,
    private readonly effectiveDating: EffectiveDatingService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  private async propertyBranchAt(
    companyId: string,
    propertyId: string,
    at: Date,
    database: Prisma.TransactionClient | DatabaseService = this.database,
  ): Promise<string> {
    const property = await database.property.findFirst({
      where: { id: propertyId, companyId },
      select: {
        branchAssignments: {
          where: {
            effectiveFrom: { lte: at },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
          },
          select: { branchId: true },
          take: 1,
        },
      },
    });
    if (!property) throw new NotFoundException('Property was not found.');
    const branchId = property.branchAssignments[0]?.branchId;
    if (!branchId) throw new BadRequestException('Property has no operating branch for this date.');
    return branchId;
  }

  private async assertPropertyPermission(
    principal: AuthenticatedPrincipal,
    propertyId: string,
    permission: string,
    at: Date,
  ): Promise<string> {
    const branchId = await this.propertyBranchAt(principal.companyId, propertyId, at);
    this.authorization.assertBranchPermission(principal, permission, branchId);
    return branchId;
  }

  private periodWhere(
    period: EngagementPeriodFilter | undefined,
    at: Date,
  ): Prisma.ServiceEngagementWhereInput | undefined {
    if (period === EngagementPeriodFilter.CURRENT)
      return {
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
      };
    if (period === EngagementPeriodFilter.SCHEDULED) return { effectiveFrom: { gt: at } };
    if (period === EngagementPeriodFilter.HISTORICAL) return { effectiveTo: { lte: at } };
    return undefined;
  }

  private statusWhere(
    status: ServiceEngagementStatus | undefined,
    at: Date,
  ): Prisma.ServiceEngagementWhereInput | undefined {
    if (status === ServiceEngagementStatus.ACTIVE)
      return {
        status: ServiceEngagementStatus.ACTIVE,
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
      };
    if (status === ServiceEngagementStatus.EXPIRED)
      return {
        OR: [
          { status: ServiceEngagementStatus.EXPIRED },
          { status: ServiceEngagementStatus.ACTIVE, effectiveTo: { lte: at } },
        ],
      };
    return status ? { status } : undefined;
  }

  private present<
    T extends { status: ServiceEngagementStatus; effectiveFrom: Date; effectiveTo: Date | null },
  >(engagement: T, at: Date) {
    return {
      ...engagement,
      status: displayEngagementStatus(engagement.status, engagement.effectiveTo, at),
      period: classifyEngagementPeriod(engagement.effectiveFrom, engagement.effectiveTo, at),
    };
  }

  async list(principal: AuthenticatedPrincipal, query: ListServiceEngagementsQueryDto) {
    const at = await this.businessDate.today(principal.companyId);
    const authorized = this.authorization.authorizedBranchIds(principal, 'service-engagement.read');
    const branchIds =
      authorized === null
        ? query.branchId
          ? [query.branchId]
          : null
        : [...authorized].filter((branchId) => !query.branchId || branchId === query.branchId);
    if (branchIds !== null && branchIds.length === 0) {
      return { items: [], pageInfo: { nextCursor: null, hasNextPage: false }, totalCount: 0 };
    }
    const and: Prisma.ServiceEngagementWhereInput[] = [];
    const periodWhere = this.periodWhere(query.period, at);
    const statusWhere = this.statusWhere(query.status, at);
    if (periodWhere) and.push(periodWhere);
    if (statusWhere) and.push(statusWhere);
    if (query.search) {
      and.push({
        OR: [
          { engagementNumber: { contains: query.search, mode: 'insensitive' } },
          { property: { name: { contains: query.search, mode: 'insensitive' } } },
          { property: { propertyCode: { contains: query.search, mode: 'insensitive' } } },
          { rentableSpace: { name: { contains: query.search, mode: 'insensitive' } } },
          { rentableSpace: { spaceCode: { contains: query.search, mode: 'insensitive' } } },
        ],
      });
    }
    const where: Prisma.ServiceEngagementWhereInput = {
      companyId: principal.companyId,
      ...(query.propertyId ? { propertyId: query.propertyId } : {}),
      ...(query.rentableSpaceId ? { rentableSpaceId: query.rentableSpaceId } : {}),
      ...(query.serviceModel ? { serviceModel: query.serviceModel } : {}),
      ...(branchIds === null
        ? {}
        : {
            property: {
              branchAssignments: {
                some: {
                  branchId: { in: branchIds },
                  effectiveFrom: { lte: at },
                  OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
                },
              },
            },
          }),
      ...(and.length ? { AND: and } : {}),
    };
    const [rows, totalCount] = await this.database.$transaction([
      this.database.serviceEngagement.findMany({
        where,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        take: query.limit + 1,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
                select: { branch: { select: { id: true, code: true, name: true } } },
                take: 1,
              },
            },
          },
          rentableSpace: { select: { id: true, spaceCode: true, name: true } },
        },
      }),
      this.database.serviceEngagement.count({ where }),
    ]);
    const page = cursorPage(rows, query.limit, (row) => row.id);
    return { ...page, items: page.items.map((row) => this.present(row, at)), totalCount };
  }

  async get(principal: AuthenticatedPrincipal, engagementId: string) {
    const at = await this.businessDate.today(principal.companyId);
    const engagement = await this.database.serviceEngagement.findFirstOrThrow({
      where: { id: engagementId, companyId: principal.companyId },
      include: {
        property: { select: { id: true, propertyCode: true, name: true } },
        rentableSpace: { select: { id: true, spaceCode: true, name: true } },
        history: {
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
          include: {
            actor: {
              select: { employee: { select: { party: { select: { displayName: true } } } } },
            },
          },
        },
      },
    });
    await this.assertPropertyPermission(
      principal,
      engagement.propertyId,
      'service-engagement.read',
      at,
    );
    const resolved = await this.resolveCapabilitiesWithPermission(
      principal,
      {
        propertyId: engagement.propertyId,
        ...(engagement.rentableSpaceId ? { rentableSpaceId: engagement.rentableSpaceId } : {}),
      },
      'service-engagement.read',
    );
    return { ...this.present(engagement, at), resolvedCapabilities: resolved.capabilities };
  }

  async create(
    principal: AuthenticatedPrincipal,
    input: CreateServiceEngagementDto,
    correlationId?: string,
  ) {
    assertServiceModelScope(input.serviceModel, input.rentableSpaceId);
    const effectiveFrom = await this.effectiveDating.scheduledDate(
      principal.companyId,
      input.effectiveFrom,
    );
    const effectiveTo = input.effectiveTo
      ? await this.effectiveDating.scheduledDate(principal.companyId, input.effectiveTo)
      : null;
    if (effectiveTo && effectiveTo <= effectiveFrom)
      throw new BadRequestException('Effective To must be after Effective From.');
    const today = await this.businessDate.today(principal.companyId);
    const branchId = await this.assertPropertyPermission(
      principal,
      input.propertyId,
      'service-engagement.create',
      today,
    );
    if (input.rentableSpaceId) {
      const space = await this.database.rentableSpace.findFirst({
        where: {
          id: input.rentableSpaceId,
          propertyId: input.propertyId,
          property: { companyId: principal.companyId },
        },
        select: { id: true },
      });
      if (!space) throw new BadRequestException('Rentable Space must belong to the Property.');
    }
    return this.database.$transaction(async (transaction) => {
      const engagement = await transaction.serviceEngagement.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          engagementNumber: await nextRecordNumber(transaction, 'ENGAGEMENT'),
          serviceModel: input.serviceModel,
          propertyId: input.propertyId,
          rentableSpaceId: input.rentableSpaceId ?? null,
          effectiveFrom,
          effectiveTo,
          notes: input.notes?.trim() || null,
          createdByUserId: principal.userId,
          history: {
            create: {
              id: uuidv7(),
              toStatus: ServiceEngagementStatus.DRAFT,
              action: 'CREATED',
              reason: 'Service Engagement draft created',
              actorUserId: principal.userId,
            },
          },
        },
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'service-engagement.created',
        entityType: 'ServiceEngagement',
        entityId: engagement.id,
        branchId,
        correlationId,
        after: {
          engagementNumber: engagement.engagementNumber,
          serviceModel: engagement.serviceModel,
          propertyId: engagement.propertyId,
          rentableSpaceId: engagement.rentableSpaceId,
          effectiveFrom: engagement.effectiveFrom.toISOString().slice(0, 10),
          effectiveTo: engagement.effectiveTo?.toISOString().slice(0, 10) ?? null,
        },
      });
      return this.present(engagement, today);
    });
  }

  async update(
    principal: AuthenticatedPrincipal,
    engagementId: string,
    input: UpdateServiceEngagementDto,
    correlationId?: string,
  ) {
    const today = await this.businessDate.today(principal.companyId);
    const current = await this.database.serviceEngagement.findFirstOrThrow({
      where: { id: engagementId, companyId: principal.companyId },
    });
    await this.assertPropertyPermission(
      principal,
      current.propertyId,
      'service-engagement.update',
      today,
    );
    const targetPropertyId = input.propertyId ?? current.propertyId;
    const branchId = await this.assertPropertyPermission(
      principal,
      targetPropertyId,
      'service-engagement.update',
      today,
    );
    const policyFieldsChanged =
      input.serviceModel !== undefined ||
      input.propertyId !== undefined ||
      input.rentableSpaceId !== undefined ||
      input.effectiveFrom !== undefined ||
      input.effectiveTo !== undefined;
    if (current.status !== ServiceEngagementStatus.DRAFT && policyFieldsChanged)
      throw new BadRequestException(
        'Only notes may be edited after activation. End-date the engagement and create a successor to change policy.',
      );
    const serviceModel = input.serviceModel ?? current.serviceModel;
    const rentableSpaceId =
      input.rentableSpaceId === undefined ? current.rentableSpaceId : input.rentableSpaceId;
    assertServiceModelScope(serviceModel, rentableSpaceId);
    const effectiveFrom = input.effectiveFrom
      ? await this.effectiveDating.scheduledDate(principal.companyId, input.effectiveFrom)
      : current.effectiveFrom;
    const effectiveTo =
      input.effectiveTo === undefined
        ? current.effectiveTo
        : input.effectiveTo === null
          ? null
          : await this.effectiveDating.scheduledDate(principal.companyId, input.effectiveTo);
    if (effectiveTo && effectiveTo <= effectiveFrom)
      throw new BadRequestException('Effective To must be after Effective From.');
    if (rentableSpaceId) {
      const space = await this.database.rentableSpace.findFirst({
        where: {
          id: rentableSpaceId,
          propertyId: targetPropertyId,
          property: { companyId: principal.companyId },
        },
        select: { id: true },
      });
      if (!space) throw new BadRequestException('Rentable Space must belong to the Property.');
    }
    return this.database.$transaction(async (transaction) => {
      const result = await transaction.serviceEngagement.updateMany({
        where: { id: engagementId, companyId: principal.companyId, version: input.version },
        data: {
          serviceModel,
          propertyId: targetPropertyId,
          rentableSpaceId,
          effectiveFrom,
          effectiveTo,
          ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
          version: { increment: 1 },
        },
      });
      if (result.count !== 1)
        throw new ConflictException('This Engagement changed elsewhere. Refresh and try again.');
      const after = await transaction.serviceEngagement.findUniqueOrThrow({
        where: { id: engagementId },
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'service-engagement.updated',
        entityType: 'ServiceEngagement',
        entityId: engagementId,
        branchId,
        correlationId,
        before: { version: current.version, notes: current.notes },
        after: { version: after.version, notes: after.notes },
      });
      return this.present(after, today);
    });
  }

  private async assertActivationReady(
    transaction: Prisma.TransactionClient,
    engagement: {
      id: string;
      companyId: string;
      propertyId: string;
      rentableSpaceId: string | null;
      serviceModel: ServiceModel;
      effectiveFrom: Date;
      effectiveTo: Date | null;
    },
  ): Promise<void> {
    const property = await transaction.property.findFirstOrThrow({
      where: { id: engagement.propertyId, companyId: engagement.companyId },
      select: { status: true },
    });
    if (property.status !== PropertyStatus.ACTIVE)
      throw new BadRequestException('Property must be Active before an Engagement can activate.');
    if (engagement.rentableSpaceId) {
      const space = await transaction.rentableSpace.findFirstOrThrow({
        where: { id: engagement.rentableSpaceId, propertyId: engagement.propertyId },
        select: { status: true },
      });
      if (space.status !== RentableSpaceStatus.ACTIVE)
        throw new BadRequestException(
          'Rentable Space must be Active before its Engagement can activate.',
        );
    }
    const overlaps = await transaction.serviceEngagement.findMany({
      where: {
        id: { not: engagement.id },
        companyId: engagement.companyId,
        propertyId: engagement.propertyId,
        rentableSpaceId: engagement.rentableSpaceId,
        status: ServiceEngagementStatus.ACTIVE,
        ...(engagement.effectiveTo ? { effectiveFrom: { lt: engagement.effectiveTo } } : {}),
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: engagement.effectiveFrom } }],
      },
      select: { serviceModel: true },
    });
    assertCompatibleModels([engagement.serviceModel, ...overlaps.map((row) => row.serviceModel)]);
  }

  async transition(
    principal: AuthenticatedPrincipal,
    engagementId: string,
    target: ServiceEngagementStatus,
    input: ServiceEngagementTransitionDto,
    correlationId?: string,
  ) {
    const today = await this.businessDate.today(principal.companyId);
    const permission =
      target === ServiceEngagementStatus.ACTIVE
        ? 'service-engagement.activate'
        : target === ServiceEngagementStatus.INACTIVE
          ? 'service-engagement.deactivate'
          : 'service-engagement.cancel';
    const existing = await this.database.serviceEngagement.findFirstOrThrow({
      where: { id: engagementId, companyId: principal.companyId },
    });
    const branchId = await this.assertPropertyPermission(
      principal,
      existing.propertyId,
      permission,
      today,
    );
    return this.database.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT id FROM service_engagements WHERE id = ${engagementId}::uuid FOR UPDATE`,
      );
      const current = await transaction.serviceEngagement.findFirstOrThrow({
        where: { id: engagementId, companyId: principal.companyId },
      });
      if (current.version !== input.version)
        throw new ConflictException('This Engagement changed elsewhere. Refresh and try again.');
      const period = classifyEngagementPeriod(current.effectiveFrom, current.effectiveTo, today);
      assertLifecycleTransition(current.status, target, period);
      if (target === ServiceEngagementStatus.ACTIVE)
        await this.assertActivationReady(transaction, current);
      const effectiveTo = target === ServiceEngagementStatus.INACTIVE ? today : current.effectiveTo;
      const after = await transaction.serviceEngagement.update({
        where: { id: engagementId },
        data: { status: target, effectiveTo, version: { increment: 1 } },
      });
      await transaction.serviceEngagementHistory.create({
        data: {
          id: uuidv7(),
          serviceEngagementId: engagementId,
          fromStatus: current.status,
          toStatus: target,
          action: target,
          reason: input.reason,
          actorUserId: principal.userId,
        },
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: `service-engagement.${target.toLowerCase()}`,
        entityType: 'ServiceEngagement',
        entityId: engagementId,
        branchId,
        correlationId,
        reason: input.reason,
        before: { status: current.status, version: current.version },
        after: {
          status: target,
          version: after.version,
          effectiveTo: after.effectiveTo?.toISOString().slice(0, 10) ?? null,
        },
      });
      return this.present(after, today);
    });
  }

  private async resolveCapabilitiesWithPermission(
    principal: AuthenticatedPrincipal,
    query: ResolveCapabilitiesQueryDto,
    permission: string,
  ) {
    const at = query.businessDate
      ? isoDate(query.businessDate)
      : await this.businessDate.today(principal.companyId);
    if (Number.isNaN(at.getTime())) throw new BadRequestException('Business date is invalid.');
    const branchId = await this.assertPropertyPermission(
      principal,
      query.propertyId,
      permission,
      at,
    );
    if (query.rentableSpaceId) {
      const exists = await this.database.rentableSpace.findFirst({
        where: {
          id: query.rentableSpaceId,
          propertyId: query.propertyId,
          property: { companyId: principal.companyId },
        },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('Rentable Space was not found for this Property.');
    }
    const engagements = await this.database.serviceEngagement.findMany({
      where: {
        companyId: principal.companyId,
        propertyId: query.propertyId,
        status: ServiceEngagementStatus.ACTIVE,
        effectiveFrom: { lte: at },
        AND: [
          { OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] },
          query.rentableSpaceId
            ? { OR: [{ rentableSpaceId: null }, { rentableSpaceId: query.rentableSpaceId }] }
            : { rentableSpaceId: null },
        ],
      },
      select: {
        id: true,
        engagementNumber: true,
        serviceModel: true,
        rentableSpaceId: true,
      },
      orderBy: [{ effectiveFrom: 'desc' }, { id: 'desc' }],
    });
    const propertyEngagements = engagements.filter((row) => row.rentableSpaceId === null);
    const spaceEngagements = engagements.filter(
      (row) => row.rentableSpaceId === query.rentableSpaceId,
    );
    return {
      propertyId: query.propertyId,
      rentableSpaceId: query.rentableSpaceId ?? null,
      businessDate: at.toISOString().slice(0, 10),
      branchId,
      capabilities: resolveCapabilitySet(
        propertyEngagements.map((row) => row.serviceModel),
        spaceEngagements.map((row) => row.serviceModel),
      ),
      sources: {
        property: propertyEngagements,
        space: spaceEngagements,
        rentalPolicySource: spaceEngagements.length ? 'SPACE_OVERRIDE' : 'PROPERTY_INHERITANCE',
      },
    };
  }

  async resolveCapabilities(principal: AuthenticatedPrincipal, query: ResolveCapabilitiesQueryDto) {
    return this.resolveCapabilitiesWithPermission(
      principal,
      query,
      'service-engagement.capability.read',
    );
  }

  async activity(
    principal: AuthenticatedPrincipal,
    engagementId: string,
    query: ListServiceEngagementActivityQueryDto,
  ) {
    const today = await this.businessDate.today(principal.companyId);
    const engagement = await this.database.serviceEngagement.findFirstOrThrow({
      where: { id: engagementId, companyId: principal.companyId },
      select: { propertyId: true },
    });
    await this.assertPropertyPermission(
      principal,
      engagement.propertyId,
      'service-engagement.read',
      today,
    );
    const rows = await this.database.serviceEngagementHistory.findMany({
      where: { serviceEngagementId: engagementId },
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      include: {
        actor: { select: { employee: { select: { party: { select: { displayName: true } } } } } },
      },
    });
    return cursorPage(rows, query.limit, (row) => row.id);
  }
}
