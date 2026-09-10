import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  PropertyStatus,
  ServiceEngagementStatus,
  WorkflowStatus,
  type Prisma,
} from '@prisma/client';
import { uuidv7 } from '@rerms/shared';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../governance/audit.service';
import { PartyService } from '../portfolio/party.service';
import { PortfolioService } from '../portfolio/portfolio.service';
import { ServiceEngagementService } from '../commercial/service-engagement.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import { WorkflowService } from './workflow.service';
import { WorkflowPayloadCipher } from './workflow-payload-cipher';
import type { WorkflowCommandDto, WorkflowDraftPayloadDto } from './workflow.dto';

@Injectable()
export class WorkflowCommandService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auth: AuthorizationService,
    private readonly workflows: WorkflowService,
    private readonly parties: PartyService,
    private readonly portfolio: PortfolioService,
    private readonly cipher: WorkflowPayloadCipher,
    private readonly audit: AuditService,
    private readonly engagements: ServiceEngagementService,
  ) {}

  async execute(
    principal: AuthenticatedPrincipal,
    workflowId: string,
    input: WorkflowCommandDto,
    correlationId?: string,
  ) {
    const draft = await this.workflows.get(principal, workflowId);
    this.auth.assertBranchPermission(principal, 'workflow.draft.update', draft.branchId);
    const commandPermissions = {
      PARTY: 'party.create',
      OWNER: 'owner.create',
      PROPERTY: 'portfolio.property.create',
      OWNERSHIP: 'portfolio.ownership.manage',
      BUILDING: 'portfolio.building.manage',
      SPACE: 'portfolio.space.create',
      ENGAGEMENT: 'service-engagement.create',
      ACTIVATE_PROPERTY: 'portfolio.property.update',
      ACTIVATE_SERVICE: 'service-engagement.activate',
    };
    this.auth.assertBranchPermission(principal, commandPermissions[input.command], draft.branchId);
    const { expectedVersion, idempotencyKey, ...commandInput } = input;
    const requestHash = createHash('sha256').update(JSON.stringify(commandInput)).digest('hex');
    const prior = await this.db.workflowCommand.findUnique({
      where: {
        workflowId_callerUserId_idempotencyKey: {
          workflowId,
          callerUserId: principal.userId,
          idempotencyKey,
        },
      },
    });
    if (prior) {
      if (prior.requestHash !== requestHash)
        throw new ConflictException(
          'This retry key belongs to different form values. Reload the saved draft.',
        );
      return draft;
    }
    if (
      ![
        WorkflowStatus.DRAFT,
        WorkflowStatus.IN_PROGRESS,
        WorkflowStatus.READY_TO_COMPLETE,
        WorkflowStatus.FAILED,
      ].includes(draft.status as 'DRAFT')
    ) {
      throw new ConflictException('This workflow is no longer editable.');
    }
    if (draft.version !== expectedVersion)
      throw new ConflictException('This draft changed. Reload before creating another record.');
    const payload: WorkflowDraftPayloadDto = { ...draft.payload };
    const allowedSteps: Record<string, Partial<Record<WorkflowCommandDto['command'], number[]>>> = {
      PROPERTY_ONBOARDING: {
        PARTY: [1],
        OWNER: [1],
        PROPERTY: [3],
        OWNERSHIP: [3],
        BUILDING: [4],
        SPACE: [5],
        ENGAGEMENT: [6],
        ACTIVATE_PROPERTY: [8],
        ACTIVATE_SERVICE: [8],
      },
      RENTAL_BROKERAGE: { ENGAGEMENT: [4], ACTIVATE_SERVICE: [8] },
      FULL_MANAGEMENT: { ENGAGEMENT: [5], ACTIVATE_SERVICE: [8] },
      PROPERTY_SALE: { ENGAGEMENT: [4], ACTIVATE_SERVICE: [8] },
    };
    if (!allowedSteps[draft.type]?.[input.command]?.includes(draft.currentStep)) {
      throw new ConflictException('This action is not available at the current workflow step.');
    }
    const checkpoint = async (tx: Prisma.TransactionClient, entityId: string) => {
      if (input.command === 'PARTY') payload.partyId = entityId;
      if (input.command === 'OWNER') {
        payload.partyId = entityId;
        payload.ownerPartyId = entityId;
      }
      if (input.command === 'PROPERTY') payload.propertyId = entityId;
      if (input.command === 'OWNERSHIP') payload.ownershipId = entityId;
      if (input.command === 'ENGAGEMENT') payload.serviceEngagementId = entityId;
      if (input.command === 'BUILDING')
        payload.buildingIds = [...new Set([...(payload.buildingIds ?? []), entityId])];
      if (input.command === 'SPACE')
        payload.rentableSpaceIds = [...new Set([...(payload.rentableSpaceIds ?? []), entityId])];
      const updated = await tx.workflowDraft.updateMany({
        where: {
          id: workflowId,
          companyId: principal.companyId,
          branchId: draft.branchId,
          version: expectedVersion,
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
          payloadCiphertext: this.cipher.encrypt({ ...payload }),
          status:
            draft.currentStep === 8 ? WorkflowStatus.READY_TO_COMPLETE : WorkflowStatus.IN_PROGRESS,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException('The draft changed. No duplicate record was created.');
      await tx.workflowCommand.create({
        data: {
          id: uuidv7(),
          workflowId,
          callerUserId: principal.userId,
          command: input.command,
          idempotencyKey,
          requestHash,
          entityId,
        },
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'workflow.command.completed',
        entityType: 'WorkflowDraft',
        entityId: workflowId,
        branchId: draft.branchId,
        correlationId,
        after: { command: input.command, entityId },
      });
    };
    switch (input.command) {
      case 'ENGAGEMENT':
        if (!input.engagement || !payload.propertyId || payload.serviceEngagementId)
          throw new BadRequestException(
            'Save the property first. A service may already be selected.',
          );
        if (
          (draft.type === 'RENTAL_BROKERAGE' &&
            input.engagement.serviceModel !== 'RENTAL_BROKERAGE') ||
          (draft.type === 'FULL_MANAGEMENT' &&
            input.engagement.serviceModel !== 'FULL_MANAGEMENT') ||
          (draft.type === 'PROPERTY_SALE' &&
            !['SALE_BROKERAGE', 'COMPANY_OWNED'].includes(input.engagement.serviceModel))
        )
          throw new BadRequestException('Choose the Company Service that matches this workflow.');
        if (
          input.engagement.rentableSpaceId &&
          !payload.rentableSpaceIds?.includes(input.engagement.rentableSpaceId)
        )
          throw new BadRequestException(
            'Choose a Rentable Space already selected in this workflow.',
          );
        await this.engagements.create(
          principal,
          { ...input.engagement, propertyId: payload.propertyId },
          correlationId,
          checkpoint,
        );
        break;
      case 'ACTIVATE_PROPERTY': {
        if (!payload.propertyId || !payload.ownershipId)
          throw new BadRequestException('Complete property ownership before activation.');
        const property = await this.db.property.findFirstOrThrow({
          where: { id: payload.propertyId, companyId: principal.companyId },
        });
        if (property.status === PropertyStatus.ACTIVE)
          await this.db.$transaction((tx) => checkpoint(tx, property.id));
        else
          await this.portfolio.transitionProperty(
            principal,
            property.id,
            PropertyStatus.ACTIVE,
            { reason: 'Property onboarding completed' },
            correlationId,
            checkpoint,
          );
        break;
      }
      case 'ACTIVATE_SERVICE': {
        if (!payload.serviceEngagementId)
          throw new BadRequestException('Choose a Company Service before activation.');
        const service = await this.db.serviceEngagement.findFirstOrThrow({
          where: { id: payload.serviceEngagementId, companyId: principal.companyId },
        });
        if (service.status === ServiceEngagementStatus.ACTIVE)
          await this.db.$transaction((tx) => checkpoint(tx, service.id));
        else
          await this.engagements.transition(
            principal,
            service.id,
            ServiceEngagementStatus.ACTIVE,
            { version: service.version, reason: 'Property onboarding completed' },
            correlationId,
            checkpoint,
          );
        break;
      }
      case 'PARTY':
        if (!input.party || payload.partyId || payload.ownerPartyId)
          throw new BadRequestException(
            'Select the saved person or organization, or start with an empty Owner step.',
          );
        await this.parties.create(
          principal,
          { ...input.party, branchId: draft.branchId },
          correlationId,
          checkpoint,
        );
        break;
      case 'OWNER':
        if (!input.owner || payload.ownerPartyId)
          throw new BadRequestException(
            'An Owner is already saved or the person selection is missing.',
          );
        await this.parties.createOwner(principal, input.owner, correlationId, checkpoint);
        break;
      case 'PROPERTY':
        if (
          !input.property ||
          payload.propertyId ||
          !payload.ownerPartyId ||
          !payload.ownershipPlan
        )
          throw new BadRequestException(
            'Complete Owner and Ownership before creating the Property.',
          );
        await this.portfolio.createProperty(
          principal,
          { ...input.property, branchId: draft.branchId },
          correlationId,
          checkpoint,
        );
        break;
      case 'OWNERSHIP':
        if (!payload.propertyId || !payload.ownershipPlan || payload.ownershipId)
          throw new BadRequestException(
            'Save the Property first. Its ownership may already be recorded.',
          );
        await this.portfolio.replaceOwnership(
          principal,
          payload.propertyId,
          payload.ownershipPlan,
          correlationId,
          checkpoint,
        );
        break;
      case 'BUILDING':
        if (!input.building || !payload.propertyId)
          throw new BadRequestException('Save a Property before adding a Building.');
        await this.portfolio.createBuilding(
          principal,
          payload.propertyId,
          input.building,
          correlationId,
          checkpoint,
        );
        break;
      case 'SPACE':
        if (!input.space || !payload.propertyId)
          throw new BadRequestException('Save a Property before adding a Rentable Space.');
        await this.portfolio.createSpace(
          principal,
          { ...input.space, propertyId: payload.propertyId },
          correlationId,
          checkpoint,
        );
        break;
    }
    return this.workflows.get(principal, workflowId);
  }
}
