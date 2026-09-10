import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ServiceModel, WorkflowStatus, WorkflowType } from '@prisma/client';
import { createHash } from 'node:crypto';
import { uuidv7 } from '@rerms/shared';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../governance/audit.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import type {
  CancelWorkflowDraftDto,
  CompleteWorkflowDraftDto,
  CreateWorkflowDraftDto,
  ListWorkflowDraftsDto,
  ListWorkflowBranchesDto,
  UpdateWorkflowDraftDto,
  WorkflowDraftPayloadDto,
} from './workflow.dto';
import { WorkflowPayloadCipher } from './workflow-payload-cipher';
import { validateWorkflowProgress } from './workflow.policy';

type DraftRow = {
  id: string;
  companyId: string;
  branchId: string;
  creatorUserId: string;
  type: WorkflowType;
  status: WorkflowStatus;
  currentStep: number;
  version: number;
  payloadSchemaVersion: number;
  payloadCiphertext: string;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type CanonicalReference = {
  entityType: string;
  entityId: string;
  step: number;
  expectedVersion?: number;
  expectedFingerprint?: string;
  expectedUpdatedAt?: Date;
};

@Injectable()
export class WorkflowService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auth: AuthorizationService,
    private readonly audit: AuditService,
    private readonly cipher: WorkflowPayloadCipher,
  ) {}

  private assert(principal: AuthenticatedPrincipal, permission: string, branchId: string) {
    this.auth.assertBranchPermission(principal, permission, branchId);
  }

  async listBranches(principal: AuthenticatedPrincipal, query: ListWorkflowBranchesDto) {
    const scopes = ['workflow.draft.update', 'portfolio.property.read'].map((permission) =>
      this.auth.authorizedBranchIds(principal, permission),
    );
    const where: Prisma.BranchWhereInput = {
      companyId: principal.companyId,
      active: true,
      AND: scopes.filter((scope) => scope !== null).map((scope) => ({ id: { in: [...scope] } })),
      ...(query.search?.trim()
        ? { name: { contains: query.search.trim(), mode: 'insensitive' as const } }
        : {}),
    };
    // Keyset ordering does not depend on a cursor row remaining active or visible.
    const rows = await this.db.branch.findMany({
      where: { ...where, ...(query.cursor ? { id: { gt: query.cursor } } : {}) },
      orderBy: { id: 'asc' },
      take: query.limit + 1,
      select: { id: true, name: true },
    });
    const hasNextPage = rows.length > query.limit;
    const items = rows.slice(0, query.limit);
    return { items, pageInfo: { hasNextPage, nextCursor: hasNextPage ? items.at(-1)!.id : null } };
  }

  private async draft(principal: AuthenticatedPrincipal, id: string, permission: string) {
    const draft = await this.db.workflowDraft.findFirst({
      where: { id, companyId: principal.companyId },
    });
    if (!draft) throw new NotFoundException('Workflow draft not found.');
    this.assert(principal, permission, draft.branchId);
    return draft;
  }

  private payload(draft: Pick<DraftRow, 'payloadCiphertext'>): WorkflowDraftPayloadDto {
    return this.cipher.decrypt(draft.payloadCiphertext);
  }

  private present(draft: DraftRow) {
    return {
      id: draft.id,
      branchId: draft.branchId,
      type: draft.type,
      status: draft.status,
      currentStep: draft.currentStep,
      version: draft.version,
      payloadSchemaVersion: draft.payloadSchemaVersion,
      payload: this.payload(draft),
      completedAt: draft.completedAt,
      cancelledAt: draft.cancelledAt,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    };
  }

  private assertDomainPermissions(
    principal: AuthenticatedPrincipal,
    branchId: string,
    type: WorkflowType,
    payload: WorkflowDraftPayloadDto,
    completing = false,
  ): void {
    const permissions = new Set<string>(['portfolio.property.read']);
    if (payload.partyId) permissions.add('party.read');
    if (payload.ownershipPlan) permissions.add('portfolio.ownership.read');
    if (payload.ownerPartyId) permissions.add('owner.read');
    if (payload.ownershipId) permissions.add('portfolio.ownership.read');
    if (payload.buildingIds?.length) permissions.add('portfolio.building.read');
    if (payload.rentableSpaceIds?.length) permissions.add('portfolio.space.read');
    if (payload.serviceEngagementId) permissions.add('service-engagement.read');
    if (payload.documentIds?.length) permissions.add('portfolio.document.read');
    if (completing) {
      if (type === WorkflowType.PROPERTY_ONBOARDING) {
        permissions.add('portfolio.property.create');
        permissions.add('portfolio.ownership.manage');
        if (payload.buildingIds?.length) permissions.add('portfolio.building.manage');
        if (payload.rentableSpaceIds?.length) permissions.add('portfolio.space.create');
      }
      if (payload.serviceEngagementId) permissions.add('service-engagement.activate');
      if (payload.documentIds?.length) permissions.add('portfolio.document.manage');
    }
    for (const permission of permissions) this.assert(principal, permission, branchId);
  }

  private assertProgress(
    type: WorkflowType,
    currentStep: number,
    payload: WorkflowDraftPayloadDto,
  ): void {
    validateWorkflowProgress(type, currentStep, payload);
  }

  private async canonicalReferences(
    principal: AuthenticatedPrincipal,
    draft: Pick<DraftRow, 'branchId' | 'type'>,
    payload: WorkflowDraftPayloadDto,
    requireComplete: boolean,
    database: Prisma.TransactionClient = this.db,
  ): Promise<CanonicalReference[]> {
    this.assertDomainPermissions(principal, draft.branchId, draft.type, payload, requireComplete);
    this.assertProgress(draft.type, requireComplete ? 8 : 1, payload);
    const at = new Date(`${principal.businessDate}T00:00:00.000Z`);
    const period = {
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
    };
    const propertyScope: Prisma.PropertyWhereInput = {
      companyId: principal.companyId,
      branchAssignments: { some: { branchId: draft.branchId, ...period } },
    };
    const partyScope = (permission: string): Prisma.PartyWhereInput => ({
      companyId: principal.companyId,
      employee: { is: null },
      ...(this.auth.canPerformCompanyWide(principal, permission)
        ? {}
        : {
            OR: [
              { branchAssignments: { some: { branchId: draft.branchId, ...period } } },
              { propertyOwnerships: { some: { ...period, property: propertyScope } } },
            ],
          }),
    });
    const party = payload.partyId
      ? await database.party.findFirst({
          where: { id: payload.partyId, ...partyScope('party.read') },
          select: { id: true, updatedAt: true },
        })
      : null;
    if (payload.partyId && !party)
      throw new ConflictException(
        'The selected person or organization is unavailable in this Branch.',
      );
    if (payload.ownershipPlan) {
      const shares = payload.ownershipPlan.shares;
      if (
        !shares.length ||
        new Set(shares.map((share) => share.ownerPartyId)).size !== shares.length ||
        shares.some(
          (share) =>
            new Prisma.Decimal(share.ownershipPercent).lte(0) ||
            new Prisma.Decimal(share.payoutPercent).lt(0),
        ) ||
        !shares
          .reduce((sum, share) => sum.plus(share.ownershipPercent), new Prisma.Decimal(0))
          .eq(100) ||
        !shares.reduce((sum, share) => sum.plus(share.payoutPercent), new Prisma.Decimal(0)).eq(100)
      ) {
        throw new ConflictException(
          'Choose distinct owners. Ownership and payout shares must each total 100%.',
        );
      }
      const planOwners = await database.ownerProfile.count({
        where: {
          partyId: { in: shares.map((share) => share.ownerPartyId) },
          party: partyScope('owner.read'),
        },
      });
      if (planOwners !== shares.length)
        throw new ConflictException('An ownership-plan Owner is unavailable in this Branch.');
    }
    const property = payload.propertyId
      ? await database.property.findFirst({
          where: {
            id: payload.propertyId,
            companyId: principal.companyId,
            branchAssignments: {
              some: {
                branchId: draft.branchId,
                effectiveFrom: { lte: at },
                OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
              },
            },
          },
          select: { id: true, updatedAt: true, status: true },
        })
      : null;
    if (payload.propertyId && !property)
      throw new ConflictException('The selected Property is unavailable in this Branch.');

    const owner = payload.ownerPartyId
      ? await database.ownerProfile.findFirst({
          where: { partyId: payload.ownerPartyId, party: partyScope('owner.read') },
          select: { partyId: true, updatedAt: true },
        })
      : null;
    if (payload.ownerPartyId && !owner)
      throw new ConflictException('The selected Owner is unavailable.');

    const selectedOwnership = payload.ownershipId
      ? await database.propertyOwnership.findFirst({
          where: {
            id: payload.ownershipId,
            ...(payload.propertyId ? { propertyId: payload.propertyId } : {}),
            ...(payload.ownerPartyId ? { ownerPartyId: payload.ownerPartyId } : {}),
            property: propertyScope,
            ...period,
          },
          select: {
            id: true,
            ownerPartyId: true,
            ownershipPercent: true,
            effectiveFrom: true,
            effectiveTo: true,
          },
        })
      : null;
    if (payload.ownershipId && !selectedOwnership)
      throw new ConflictException('The selected Ownership record is unavailable or inconsistent.');
    const ownership =
      selectedOwnership ??
      (draft.type === WorkflowType.RENTAL_BROKERAGE && payload.ownerPartyId && payload.propertyId
        ? await database.propertyOwnership.findFirst({
            where: {
              ownerPartyId: payload.ownerPartyId,
              propertyId: payload.propertyId,
              effectiveFrom: { lte: at },
              OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
            },
            select: {
              id: true,
              ownerPartyId: true,
              ownershipPercent: true,
              effectiveFrom: true,
              effectiveTo: true,
            },
          })
        : null);

    const buildingIds = [...new Set(payload.buildingIds ?? [])];
    const buildings = buildingIds.length
      ? await database.building.findMany({
          where: {
            id: { in: buildingIds },
            ...(payload.propertyId ? { propertyId: payload.propertyId } : {}),
            property: propertyScope,
          },
          select: { id: true, updatedAt: true },
        })
      : [];
    if (buildings.length !== buildingIds.length)
      throw new ConflictException('One or more selected Buildings are unavailable.');

    const spaceIds = [...new Set(payload.rentableSpaceIds ?? [])];
    const spaces = spaceIds.length
      ? await database.rentableSpace.findMany({
          where: {
            id: { in: spaceIds },
            ...(payload.propertyId ? { propertyId: payload.propertyId } : {}),
            property: propertyScope,
          },
          select: { id: true, updatedAt: true },
        })
      : [];
    if (spaces.length !== spaceIds.length)
      throw new ConflictException('One or more selected Rentable Spaces are unavailable.');

    const engagement = payload.serviceEngagementId
      ? await database.serviceEngagement.findFirst({
          where: {
            id: payload.serviceEngagementId,
            companyId: principal.companyId,
            property: propertyScope,
            ...(payload.propertyId ? { propertyId: payload.propertyId } : {}),
            ...(requireComplete
              ? {
                  status: 'ACTIVE',
                  effectiveFrom: { lte: at },
                  OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
                }
              : {}),
          },
          select: { id: true, version: true, serviceModel: true, rentableSpaceId: true },
        })
      : null;
    if (payload.serviceEngagementId && !engagement)
      throw new ConflictException('The selected Service Engagement is unavailable.');
    if (engagement?.rentableSpaceId && !spaceIds.includes(engagement.rentableSpaceId))
      throw new ConflictException('The Service Engagement scope is not selected in this workflow.');
    if (
      engagement &&
      draft.type === WorkflowType.RENTAL_BROKERAGE &&
      engagement.serviceModel !== ServiceModel.RENTAL_BROKERAGE
    )
      throw new ConflictException('Rental Brokerage requires a Rental Brokerage engagement.');
    if (
      engagement &&
      draft.type === WorkflowType.FULL_MANAGEMENT &&
      engagement.serviceModel !== ServiceModel.FULL_MANAGEMENT
    )
      throw new ConflictException('Full Management requires a Full Management engagement.');
    if (
      engagement &&
      draft.type === WorkflowType.PROPERTY_SALE &&
      engagement.serviceModel !== ServiceModel.SALE_BROKERAGE &&
      engagement.serviceModel !== ServiceModel.COMPANY_OWNED
    )
      throw new ConflictException(
        'Property Sale requires Sale Brokerage or Company Owned authority.',
      );

    const documentIds = [...new Set(payload.documentIds ?? [])];
    const allowedEntityIds = [
      payload.ownerPartyId,
      payload.propertyId,
      ...buildingIds,
      ...spaceIds,
      payload.serviceEngagementId,
    ].filter((id): id is string => Boolean(id));
    const documents = documentIds.length
      ? await database.document.findMany({
          where: {
            id: { in: documentIds },
            companyId: principal.companyId,
            links: { some: { entityId: { in: allowedEntityIds } } },
          },
          select: { id: true, updatedAt: true },
        })
      : [];
    if (documents.length !== documentIds.length)
      throw new ConflictException('One or more selected Documents are unavailable or unrelated.');

    if (requireComplete) {
      if (!property) throw new ConflictException('Property is required before completion.');
      if (property.status !== 'ACTIVE')
        throw new ConflictException('Activate the Property before completing onboarding.');
      if (
        draft.type === WorkflowType.PROPERTY_ONBOARDING &&
        (!owner || !ownership || (payload.structureRequired && !buildings.length))
      )
        throw new ConflictException('Owner, Ownership, and required Structure must be complete.');
      if (
        (draft.type === WorkflowType.RENTAL_BROKERAGE ||
          draft.type === WorkflowType.FULL_MANAGEMENT) &&
        (!owner || !spaces.length || !engagement)
      )
        throw new ConflictException('Owner, Rentable Space, and Service Engagement are required.');
      if (draft.type === WorkflowType.RENTAL_BROKERAGE && !ownership)
        throw new ConflictException(
          'The selected Owner must have current ownership of the Property.',
        );
      if (draft.type === WorkflowType.PROPERTY_SALE && !engagement)
        throw new ConflictException('Sale authority is required before completion.');
      if (
        draft.type === WorkflowType.PROPERTY_SALE &&
        engagement?.serviceModel === ServiceModel.SALE_BROKERAGE &&
        (!owner || !ownership)
      )
        throw new ConflictException('External Property Sale requires Seller ownership evidence.');
    }

    return [
      ...(party
        ? [{ entityType: 'Party', entityId: party.id, step: 1, expectedUpdatedAt: party.updatedAt }]
        : []),
      ...(owner
        ? [
            {
              entityType: 'Owner',
              entityId: owner.partyId,
              step: 1,
              expectedUpdatedAt: owner.updatedAt,
            },
          ]
        : []),
      ...(ownership
        ? [
            {
              entityType: 'PropertyOwnership',
              entityId: ownership.id,
              step: 2,
              expectedFingerprint: createHash('sha256')
                .update(JSON.stringify(ownership))
                .digest('hex'),
            },
          ]
        : []),
      ...(property
        ? [
            {
              entityType: 'Property',
              entityId: property.id,
              step: 3,
              expectedUpdatedAt: property.updatedAt,
            },
          ]
        : []),
      ...buildings.map((row) => ({
        entityType: 'Building',
        entityId: row.id,
        step: 4,
        expectedUpdatedAt: row.updatedAt,
      })),
      ...spaces.map((row) => ({
        entityType: 'RentableSpace',
        entityId: row.id,
        step: 5,
        expectedUpdatedAt: row.updatedAt,
      })),
      ...(engagement
        ? [
            {
              entityType: 'ServiceEngagement',
              entityId: engagement.id,
              step: 6,
              expectedVersion: engagement.version,
            },
          ]
        : []),
      ...documents.map((row) => ({
        entityType: 'Document',
        entityId: row.id,
        step: 7,
        expectedUpdatedAt: row.updatedAt,
      })),
    ];
  }

  private async syncReferences(
    transaction: Prisma.TransactionClient,
    workflowId: string,
    references: CanonicalReference[],
  ): Promise<void> {
    await transaction.workflowCanonicalReference.deleteMany({ where: { workflowId } });
    if (!references.length) return;
    await transaction.workflowCanonicalReference.createMany({
      data: references.map((reference) => ({
        id: uuidv7(),
        workflowId,
        entityType: reference.entityType,
        entityId: reference.entityId,
        step: reference.step,
        ...(reference.expectedVersion === undefined
          ? {}
          : { expectedVersion: reference.expectedVersion }),
        ...(reference.expectedFingerprint === undefined
          ? {}
          : { expectedFingerprint: reference.expectedFingerprint }),
        ...(reference.expectedUpdatedAt === undefined
          ? {}
          : { expectedUpdatedAt: reference.expectedUpdatedAt }),
      })),
    });
  }

  private async assertReferencesUnchanged(
    workflowId: string,
    current: CanonicalReference[],
    database: Prisma.TransactionClient = this.db,
  ): Promise<void> {
    const saved = await database.workflowCanonicalReference.findMany({
      where: { workflowId },
      select: {
        entityType: true,
        entityId: true,
        step: true,
        expectedVersion: true,
        expectedFingerprint: true,
        expectedUpdatedAt: true,
      },
    });
    const key = (reference: Pick<CanonicalReference, 'entityType' | 'entityId'>) =>
      `${reference.entityType}:${reference.entityId}`;
    const currentByKey = new Map(current.map((reference) => [key(reference), reference]));
    if (saved.length !== current.length) {
      throw new ConflictException(
        'Workflow references changed after the draft was reviewed. Review the affected steps again.',
      );
    }
    for (const reference of saved) {
      const latest = currentByKey.get(key(reference));
      if (
        reference.expectedFingerprint &&
        latest?.expectedFingerprint !== reference.expectedFingerprint
      )
        throw new ConflictException({
          code: 'WORKFLOW_REFERENCE_CHANGED',
          affectedStep: reference.step,
          message: 'Ownership changed after review. Review the ownership step again.',
        });
      if (!latest || latest.step !== reference.step) {
        throw new ConflictException(
          'Workflow references changed after the draft was reviewed. Review the affected steps again.',
        );
      }
      if (
        reference.expectedVersion !== null &&
        latest.expectedVersion !== reference.expectedVersion
      ) {
        throw new ConflictException(
          'A referenced record changed after review. Refresh the workflow before completion.',
        );
      }
      if (
        reference.expectedUpdatedAt &&
        latest.expectedUpdatedAt?.getTime() !== reference.expectedUpdatedAt.getTime()
      ) {
        throw new ConflictException(
          'A referenced record changed after review. Refresh the workflow before completion.',
        );
      }
    }
  }

  async create(
    principal: AuthenticatedPrincipal,
    input: CreateWorkflowDraftDto,
    correlationId?: string,
  ) {
    this.assert(principal, 'workflow.draft.update', input.branchId);
    const branch = await this.db.branch.findFirst({
      where: { id: input.branchId, companyId: principal.companyId, active: true },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Authorized active Branch not found.');
    const payload = { ...input.payload };
    this.assertDomainPermissions(principal, input.branchId, input.type, payload);
    await this.canonicalReferences(
      principal,
      { branchId: input.branchId, type: input.type },
      payload,
      false,
    );
    const id = uuidv7();
    const draft = await this.db.$transaction(async (tx) => {
      const created = await tx.workflowDraft.create({
        data: {
          id,
          companyId: principal.companyId,
          branchId: input.branchId,
          creatorUserId: principal.userId,
          type: input.type,
          currentStep: 1,
          payloadSchemaVersion: input.payloadSchemaVersion,
          payloadCiphertext: this.cipher.encrypt(payload),
        },
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'workflow.draft.created',
        entityType: 'WorkflowDraft',
        entityId: id,
        branchId: input.branchId,
        correlationId,
        after: { type: input.type, currentStep: 1, version: 1 },
      });
      return created;
    });
    return this.present(draft);
  }

  async list(principal: AuthenticatedPrincipal, query: ListWorkflowDraftsDto) {
    const allowed = this.auth.authorizedBranchIds(principal, 'workflow.draft.read');
    const branchIds =
      allowed === null
        ? query.branchId
          ? [query.branchId]
          : null
        : [...allowed].filter((id) => !query.branchId || id === query.branchId);
    const baseWhere: Prisma.WorkflowDraftWhereInput = {
      companyId: principal.companyId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.status
        ? { status: query.status }
        : {
            status: {
              in: [
                WorkflowStatus.DRAFT,
                WorkflowStatus.IN_PROGRESS,
                WorkflowStatus.READY_TO_COMPLETE,
                WorkflowStatus.FAILED,
              ],
            },
          }),
      ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
    };
    const where: Prisma.WorkflowDraftWhereInput = {
      ...baseWhere,
      ...(query.cursor ? { id: { lt: query.cursor } } : {}),
    };
    const [rows, total] = await this.db.$transaction([
      this.db.workflowDraft.findMany({
        where,
        orderBy: { id: 'desc' },
        take: query.limit + 1,
        include: { branch: { select: { name: true, code: true } } },
      }),
      this.db.workflowDraft.count({ where: baseWhere }),
    ]);
    const hasNextPage = rows.length > query.limit;
    // The register is not a second route to encrypted draft content.
    const items = rows.slice(0, query.limit).map((row) => ({
      id: row.id,
      branchId: row.branchId,
      branch: row.branch,
      type: row.type,
      status: row.status,
      currentStep: row.currentStep,
      version: row.version,
      updatedAt: row.updatedAt,
    }));
    return {
      items,
      total,
      pageInfo: { hasNextPage, nextCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null },
    };
  }

  async get(principal: AuthenticatedPrincipal, id: string) {
    const row = await this.draft(principal, id, 'workflow.draft.read');
    await this.canonicalReferences(principal, row, this.payload(row), false);
    await this.db.$transaction(async (tx) =>
      this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'workflow.draft.resumed',
        entityType: 'WorkflowDraft',
        entityId: id,
        branchId: row.branchId,
      }),
    );
    return this.present(row);
  }

  async update(
    principal: AuthenticatedPrincipal,
    id: string,
    input: UpdateWorkflowDraftDto,
    correlationId?: string,
  ) {
    const current = await this.draft(principal, id, 'workflow.draft.update');
    if (input.currentStep > current.currentStep + 1)
      throw new ConflictException('Complete the current step before moving ahead.');
    const payload = { ...input.payload };
    this.assertProgress(current.type, input.currentStep, payload);
    const references = await this.canonicalReferences(principal, current, payload, false);
    const nextStatus =
      input.currentStep >= 8 ? WorkflowStatus.READY_TO_COMPLETE : WorkflowStatus.IN_PROGRESS;
    const updated = await this.db.$transaction(async (tx) => {
      const result = await tx.workflowDraft.updateMany({
        where: {
          id,
          companyId: principal.companyId,
          version: input.expectedVersion,
          status: {
            in: [
              WorkflowStatus.DRAFT,
              WorkflowStatus.IN_PROGRESS,
              WorkflowStatus.READY_TO_COMPLETE,
              WorkflowStatus.FAILED,
            ],
          },
        },
        data: {
          currentStep: input.currentStep,
          status: nextStatus,
          payloadCiphertext: this.cipher.encrypt(payload),
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) {
        const latest = await tx.workflowDraft.findUnique({
          where: { id },
          select: { version: true },
        });
        throw new ConflictException({
          message: 'Workflow draft is stale or no longer editable.',
          code: 'WORKFLOW_STALE_VERSION',
          latestVersion: latest?.version,
          affectedStep: input.currentStep,
        });
      }
      await this.syncReferences(tx, id, references);
      const row = await tx.workflowDraft.findUniqueOrThrow({ where: { id } });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'workflow.draft.updated',
        entityType: 'WorkflowDraft',
        entityId: id,
        branchId: current.branchId,
        correlationId,
        before: { version: current.version, currentStep: current.currentStep },
        after: { version: row.version, currentStep: row.currentStep, status: row.status },
      });
      return row;
    });
    return this.present(updated);
  }

  async cancel(
    principal: AuthenticatedPrincipal,
    id: string,
    input: CancelWorkflowDraftDto,
    correlationId?: string,
  ) {
    const current = await this.draft(principal, id, 'workflow.draft.cancel');
    await this.canonicalReferences(principal, current, this.payload(current), false);
    const row = await this.db.$transaction(async (tx) => {
      const result = await tx.workflowDraft.updateMany({
        where: {
          id,
          version: input.expectedVersion,
          status: { in: [WorkflowStatus.DRAFT, WorkflowStatus.IN_PROGRESS, WorkflowStatus.FAILED] },
        },
        data: {
          status: WorkflowStatus.CANCELLED,
          cancelledAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (result.count !== 1)
        throw new ConflictException('Workflow draft is stale or cannot be cancelled.');
      const updated = await tx.workflowDraft.findUniqueOrThrow({ where: { id } });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'workflow.draft.cancelled',
        entityType: 'WorkflowDraft',
        entityId: id,
        branchId: current.branchId,
        correlationId,
        reason: input.reason,
        after: { status: updated.status, version: updated.version },
      });
      return updated;
    });
    return this.present(row);
  }

  async complete(
    principal: AuthenticatedPrincipal,
    id: string,
    input: CompleteWorkflowDraftDto,
    correlationId?: string,
  ) {
    const current = await this.draft(principal, id, 'workflow.draft.complete');
    const payload = this.payload(current);
    await this.canonicalReferences(principal, current, payload, false);
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ workflowId: id, version: input.expectedVersion, payload }))
      .digest('hex');
    const prior = await this.db.workflowCompletion.findUnique({
      where: {
        workflowId_callerUserId_idempotencyKey: {
          workflowId: id,
          callerUserId: principal.userId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (prior) {
      this.assertDomainPermissions(principal, current.branchId, current.type, payload, true);
      if (prior.expiresAt <= new Date())
        throw new ConflictException(
          'This completion idempotency key has expired and cannot be reused.',
        );
      if (prior.requestHash !== requestHash)
        throw new ConflictException('Idempotency key was used with a different request.');
      return prior.result;
    }
    if (current.status === WorkflowStatus.COMPLETED) {
      const completed = await this.db.workflowCompletion.findFirst({
        where: { workflowId: id },
        orderBy: { createdAt: 'desc' },
      });
      if (completed) {
        this.assertDomainPermissions(principal, current.branchId, current.type, payload, true);
        return completed.result;
      }
    }
    if (current.currentStep !== 8 || current.status !== WorkflowStatus.READY_TO_COMPLETE)
      throw new ConflictException('Workflow is not ready to complete.');

    // Canonical commands commit at their own step checkpoints. Finalizing the
    // workflow has no external side effect and needs no durable in-flight state:
    // interruption rolls this entire short transaction back to READY_TO_COMPLETE.
    return this.db.$transaction(
      async (tx) => {
        const changed = await tx.workflowDraft.updateMany({
          where: {
            id,
            companyId: principal.companyId,
            version: input.expectedVersion,
            status: WorkflowStatus.READY_TO_COMPLETE,
          },
          data: { status: WorkflowStatus.COMPLETING },
        });
        if (changed.count !== 1)
          throw new ConflictException(
            'Workflow completion is already running or the draft is stale.',
          );
        const references = await this.canonicalReferences(principal, current, payload, true, tx);
        await this.assertReferencesUnchanged(id, references, tx);
        const result = {
          workflowId: id,
          type: current.type,
          canonicalReferences: references.map(({ entityType, entityId }) => ({
            entityType,
            entityId,
          })),
        };
        await this.audit.write(tx, {
          actorUserId: principal.userId,
          action: 'workflow.completion.requested',
          entityType: 'WorkflowDraft',
          entityId: id,
          branchId: current.branchId,
          correlationId,
          after: { requestHash },
        });
        await this.syncReferences(tx, id, references);
        await tx.workflowDraft.update({
          where: { id },
          data: {
            status: WorkflowStatus.COMPLETED,
            completedAt: new Date(),
            version: { increment: 1 },
          },
        });
        await tx.workflowCompletion.create({
          data: {
            id: uuidv7(),
            workflowId: id,
            callerUserId: principal.userId,
            idempotencyKey: input.idempotencyKey,
            requestHash,
            result,
            expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          },
        });
        await this.audit.write(tx, {
          actorUserId: principal.userId,
          action: 'workflow.completed',
          entityType: 'WorkflowDraft',
          entityId: id,
          branchId: current.branchId,
          correlationId,
          after: { status: WorkflowStatus.COMPLETED, canonicalReferenceCount: references.length },
        });
        return result;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
