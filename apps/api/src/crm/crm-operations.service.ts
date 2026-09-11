import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type LeadSourceStatus } from '@prisma/client';
import { uuidv7 } from '@rerms/shared';
import type { AuthenticatedPrincipal } from '../security/security.types';
import { CrmSupportService, ack, correlation, textValue } from './crm-support.service';
import type {
  CorrectActivityDto,
  CreateActivityDto,
  CreateFollowUpDto,
  CreateSourceDto,
  ReasonDto,
  UpdateFollowUpDto,
  UpdateSourceDto,
  VersionedReasonDto,
} from './crm.dto';

@Injectable()
export class CrmOperationsService {
  constructor(private readonly support: CrmSupportService) {}
  async createActivity(
    principal: AuthenticatedPrincipal,
    leadId: string,
    input: CreateActivityDto,
    correlationId?: string,
  ) {
    return this.support.database.$transaction(async (tx) => {
      const lead = await this.support.lockedLead(tx, principal, leadId, 'crm.activity.create');
      const now = await this.support.instant(tx);
      const occurredAt = new Date(input.occurredAt);
      if (occurredAt > now || !input.summary.trim())
        throw new BadRequestException('CRM_VALIDATION_FAILED');
      const row = await tx.leadActivity.create({
        data: {
          id: uuidv7(),
          leadId,
          branchId: lead.responsibleBranchId,
          type: input.type,
          direction: input.direction,
          summary: input.summary.trim(),
          notes: textValue(input.notes),
          occurredAt,
          recordedAt: now,
          recordedByUserId: principal.userId,
          correlationId: correlation(correlationId),
        },
      });
      return { id: row.id };
    });
  }
  async correctActivity(
    principal: AuthenticatedPrincipal,
    leadId: string,
    id: string,
    kind: 'correction' | 'void',
    input: CorrectActivityDto | ReasonDto,
    correlationId?: string,
  ) {
    return this.support.database.$transaction(async (tx) => {
      const lead = await this.support.lockedLead(tx, principal, leadId, 'crm.activity.correct');
      const original = await tx.leadActivity.findFirst({
        where: { id, leadId, lead: { companyId: principal.companyId } },
        select: { id: true, type: true, direction: true },
      });
      if (!original) throw new NotFoundException('CRM_NOT_FOUND');
      const correction = kind === 'correction' ? (input as CorrectActivityDto) : null;
      const now = await this.support.instant(tx);
      const occurredAt = correction ? new Date(correction.occurredAt) : now;
      if (occurredAt > now || !input.reason.trim() || (correction && !correction.summary.trim()))
        throw new BadRequestException('CRM_VALIDATION_FAILED');
      const row = await tx.leadActivity.create({
        data: {
          id: uuidv7(),
          leadId,
          branchId: lead.responsibleBranchId,
          type: correction?.type ?? original.type,
          direction: correction?.direction ?? original.direction,
          recordKind: kind === 'void' ? 'VOID' : 'CORRECTION',
          summary: correction?.summary.trim() ?? 'Activity voided',
          notes: textValue(correction?.notes),
          occurredAt,
          recordedAt: now,
          recordedByUserId: principal.userId,
          originalActivityId: id,
          correctionReason: input.reason.trim(),
          correlationId: correlation(correlationId),
        },
      });
      await this.support.audit(
        tx,
        principal,
        kind === 'void' ? 'crm.activity.voided' : 'crm.activity.corrected',
        'LeadActivity',
        row.id,
        lead.responsibleBranchId,
        { originalActivityId: id },
        { recordKind: row.recordKind },
        correlationId,
      );
      return { id: row.id };
    });
  }
  async createFollowUp(
    principal: AuthenticatedPrincipal,
    leadId: string,
    input: CreateFollowUpDto,
    correlationId?: string,
  ) {
    return this.support.database.$transaction(async (tx) => {
      const lead = await this.support.lockedLead(tx, principal, leadId, 'crm.followup.create');
      if (lead.stage === 'CONVERTED' || lead.stage === 'LOST')
        throw new BadRequestException('CRM_ILLEGAL_TRANSITION');
      if (!input.subject.trim()) throw new BadRequestException('CRM_VALIDATION_FAILED');
      await this.support.eligible(
        tx,
        principal.companyId,
        input.responsibleEmployeeId,
        lead.responsibleBranchId,
      );
      if (
        input.predecessorFollowUpId &&
        !(await tx.leadFollowUp.findFirst({
          where: {
            id: input.predecessorFollowUpId,
            leadId,
            lead: { companyId: principal.companyId },
          },
          select: { id: true },
        }))
      )
        throw new NotFoundException('CRM_NOT_FOUND');
      const row = await tx.leadFollowUp.create({
        data: {
          id: uuidv7(),
          leadId,
          branchId: lead.responsibleBranchId,
          responsibleEmployeeId: input.responsibleEmployeeId,
          subject: input.subject.trim(),
          notes: textValue(input.notes),
          dueAt: new Date(input.dueAt),
          createdByUserId: principal.userId,
          predecessorFollowUpId: input.predecessorFollowUpId ?? null,
        },
      });
      await this.support.audit(
        tx,
        principal,
        'crm.followup.created',
        'LeadFollowUp',
        row.id,
        lead.responsibleBranchId,
        {},
        { version: row.version, state: row.state },
        correlationId,
      );
      return ack(row);
    });
  }
  async updateFollowUp(
    principal: AuthenticatedPrincipal,
    leadId: string,
    id: string,
    input: UpdateFollowUpDto,
    correlationId?: string,
  ) {
    return this.support.database.$transaction(async (tx) => {
      const lead = await this.support.lockedLead(tx, principal, leadId, 'crm.followup.update');
      const current = await tx.leadFollowUp.findFirst({
        where: { id, leadId, lead: { companyId: principal.companyId } },
      });
      if (!current) throw new NotFoundException('CRM_NOT_FOUND');
      if (current.version !== input.expectedVersion)
        throw new ConflictException('CRM_VERSION_CONFLICT');
      if (current.state !== 'OPEN') throw new BadRequestException('CRM_ILLEGAL_TRANSITION');
      if (input.subject !== undefined && !input.subject.trim())
        throw new BadRequestException('CRM_VALIDATION_FAILED');
      const after = await tx.leadFollowUp.update({
        where: { id, version: input.expectedVersion },
        data: {
          ...(input.subject !== undefined ? { subject: input.subject.trim() } : {}),
          ...(input.notes !== undefined ? { notes: textValue(input.notes) } : {}),
          ...(input.dueAt ? { dueAt: new Date(input.dueAt) } : {}),
          version: { increment: 1 },
        },
      });
      await this.support.audit(
        tx,
        principal,
        'crm.followup.updated',
        'LeadFollowUp',
        id,
        lead.responsibleBranchId,
        { version: current.version },
        { version: after.version },
        correlationId,
      );
      return ack(after);
    });
  }
  async outcome(
    principal: AuthenticatedPrincipal,
    leadId: string,
    id: string,
    target: 'COMPLETED' | 'CANCELLED',
    input: VersionedReasonDto,
    correlationId?: string,
  ) {
    return this.support.database.$transaction(async (tx) => {
      const lead = await this.support.lockedLead(
        tx,
        principal,
        leadId,
        target === 'COMPLETED' ? 'crm.followup.complete' : 'crm.followup.cancel',
      );
      const current = await tx.leadFollowUp.findFirst({
        where: { id, leadId, lead: { companyId: principal.companyId } },
      });
      if (!current) throw new NotFoundException('CRM_NOT_FOUND');
      if (current.version !== input.expectedVersion)
        throw new ConflictException('CRM_VERSION_CONFLICT');
      if (current.state !== 'OPEN') throw new BadRequestException('CRM_ILLEGAL_TRANSITION');
      if (
        lead.stage === 'NURTURING' &&
        !(await tx.leadFollowUp.findFirst({
          where: {
            leadId,
            lead: { companyId: principal.companyId },
            state: 'OPEN',
            id: { not: id },
          },
          select: { id: true },
        }))
      )
        throw new BadRequestException('CRM_QUALIFICATION_REQUIRED');
      const after = await tx.leadFollowUp.update({
        where: { id, version: input.expectedVersion },
        data: {
          state: target,
          outcomeActorUserId: principal.userId,
          outcomeAt: await this.support.instant(tx),
          outcomeReason: input.reason.trim(),
          version: { increment: 1 },
        },
      });
      await tx.leadFollowUpOutcome.create({
        data: {
          id: uuidv7(),
          followUpId: id,
          fromState: 'OPEN',
          toState: target,
          actorUserId: principal.userId,
          reason: input.reason.trim(),
          followUpVersion: after.version,
          correlationId: correlation(correlationId),
        },
      });
      await this.support.audit(
        tx,
        principal,
        `crm.followup.${target.toLowerCase()}`,
        'LeadFollowUp',
        id,
        lead.responsibleBranchId,
        { state: current.state, version: current.version },
        { state: target, version: after.version },
        correlationId,
      );
      return ack(after);
    });
  }
  async createSource(
    principal: AuthenticatedPrincipal,
    input: CreateSourceDto,
    correlationId?: string,
  ) {
    this.support.assertCompany(principal, 'crm.source.manage');
    if (!input.label.trim()) throw new BadRequestException('CRM_VALIDATION_FAILED');
    return this.support.database.$transaction(async (tx) => {
      const row = await tx.leadSource.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          code: input.code.trim().toUpperCase(),
          label: input.label.trim(),
          description: textValue(input.description),
          sortOrder: input.sortOrder ?? 0,
          createdByUserId: principal.userId,
        },
      });
      await this.support.audit(
        tx,
        principal,
        'crm.source.created',
        'LeadSource',
        row.id,
        null,
        {},
        { version: row.version, status: row.status },
        correlationId,
      );
      return ack(row);
    });
  }
  async updateSource(
    principal: AuthenticatedPrincipal,
    id: string,
    input: UpdateSourceDto,
    correlationId?: string,
  ) {
    this.support.assertCompany(principal, 'crm.source.manage');
    return this.support.database.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM lead_sources WHERE id=${id}::uuid AND "companyId"=${principal.companyId}::uuid FOR UPDATE`,
      );
      const current = await tx.leadSource.findFirst({
        where: { id, companyId: principal.companyId },
      });
      if (!current) throw new NotFoundException('CRM_NOT_FOUND');
      if (current.version !== input.expectedVersion)
        throw new ConflictException('CRM_VERSION_CONFLICT');
      if (input.label !== undefined && !input.label.trim())
        throw new BadRequestException('CRM_VALIDATION_FAILED');
      const after = await tx.leadSource.update({
        where: { id, companyId: principal.companyId, version: input.expectedVersion },
        data: {
          ...(input.label !== undefined ? { label: input.label.trim() } : {}),
          ...(input.description !== undefined ? { description: textValue(input.description) } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          version: { increment: 1 },
        },
      });
      await this.support.audit(
        tx,
        principal,
        'crm.source.updated',
        'LeadSource',
        id,
        null,
        { version: current.version },
        { version: after.version },
        correlationId,
      );
      return ack(after);
    });
  }
  async sourceLifecycle(
    principal: AuthenticatedPrincipal,
    id: string,
    target: LeadSourceStatus,
    input: VersionedReasonDto,
    correlationId?: string,
  ) {
    this.support.assertCompany(principal, 'crm.source.manage');
    return this.support.database.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM lead_sources WHERE id=${id}::uuid AND "companyId"=${principal.companyId}::uuid FOR UPDATE`,
      );
      const current = await tx.leadSource.findFirst({
        where: { id, companyId: principal.companyId },
      });
      if (!current) throw new NotFoundException('CRM_NOT_FOUND');
      if (current.version !== input.expectedVersion)
        throw new ConflictException('CRM_VERSION_CONFLICT');
      if (current.status === target) throw new BadRequestException('CRM_ILLEGAL_TRANSITION');
      const after = await tx.leadSource.update({
        where: { id, companyId: principal.companyId, version: input.expectedVersion },
        data: { status: target, version: { increment: 1 } },
      });
      await this.support.audit(
        tx,
        principal,
        target === 'ACTIVE' ? 'crm.source.reactivated' : 'crm.source.deactivated',
        'LeadSource',
        id,
        null,
        { version: current.version, status: current.status },
        { version: after.version, status: target },
        correlationId,
      );
      return ack(after);
    });
  }
}
