import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, WorkflowStatus } from '@prisma/client';
import { createHash } from 'node:crypto';
import { uuidv7 } from '@rerms/shared';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../governance/audit.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import type { CancelWorkflowDraftDto, CompleteWorkflowDraftDto, CreateWorkflowDraftDto, ListWorkflowDraftsDto, UpdateWorkflowDraftDto } from './workflow.dto';
import { WorkflowPayloadCipher } from './workflow-payload-cipher';

@Injectable()
export class WorkflowService {
  constructor(private readonly db: DatabaseService, private readonly auth: AuthorizationService, private readonly audit: AuditService, private readonly cipher: WorkflowPayloadCipher) {}

  private assert(principal: AuthenticatedPrincipal, permission: string, branchId: string) {
    this.auth.assertBranchPermission(principal, permission, branchId);
  }

  private async draft(principal: AuthenticatedPrincipal, id: string, permission: string) {
    const draft = await this.db.workflowDraft.findFirst({ where: { id, companyId: principal.companyId } });
    if (!draft) throw new NotFoundException('Workflow draft not found.');
    this.assert(principal, permission, draft.branchId);
    return draft;
  }

  private present(draft: { id: string; branchId: string; type: string; status: WorkflowStatus; currentStep: number; version: number; payloadSchemaVersion: number; payloadCiphertext: string; completedAt: Date | null; cancelledAt: Date | null; createdAt: Date; updatedAt: Date }) {
    return { id: draft.id, branchId: draft.branchId, type: draft.type, status: draft.status, currentStep: draft.currentStep, version: draft.version, payloadSchemaVersion: draft.payloadSchemaVersion, payload: this.cipher.decrypt(draft.payloadCiphertext), completedAt: draft.completedAt, cancelledAt: draft.cancelledAt, createdAt: draft.createdAt, updatedAt: draft.updatedAt };
  }

  async create(principal: AuthenticatedPrincipal, input: CreateWorkflowDraftDto, correlationId?: string) {
    this.assert(principal, 'workflow.draft.update', input.branchId);
    const branch = await this.db.branch.findFirst({ where: { id: input.branchId, companyId: principal.companyId, active: true }, select: { id: true } });
    if (!branch) throw new NotFoundException('Authorized active Branch not found.');
    const id = uuidv7();
    const draft = await this.db.$transaction(async (tx) => {
      const created = await tx.workflowDraft.create({ data: { id, companyId: principal.companyId, branchId: input.branchId, creatorUserId: principal.userId, type: input.type, currentStep: input.currentStep, payloadSchemaVersion: input.payloadSchemaVersion, payloadCiphertext: this.cipher.encrypt(input.payload) } });
      await this.audit.write(tx, { actorUserId: principal.userId, action: 'workflow.draft.created', entityType: 'WorkflowDraft', entityId: id, branchId: input.branchId, correlationId, after: { type: input.type, currentStep: input.currentStep, version: 1 } });
      return created;
    });
    return this.present(draft);
  }

  async list(principal: AuthenticatedPrincipal, query: ListWorkflowDraftsDto) {
    const allowed = this.auth.authorizedBranchIds(principal, 'workflow.draft.read');
    const branchIds = allowed === null ? (query.branchId ? [query.branchId] : null) : [...allowed].filter((id) => !query.branchId || id === query.branchId);
    const baseWhere: Prisma.WorkflowDraftWhereInput = { companyId: principal.companyId, ...(query.type ? { type: query.type } : {}), ...(query.status ? { status: query.status } : { status: { in: [WorkflowStatus.DRAFT, WorkflowStatus.IN_PROGRESS, WorkflowStatus.READY_TO_COMPLETE, WorkflowStatus.FAILED] } }), ...(branchIds === null ? {} : { branchId: { in: branchIds } }) };
    const where: Prisma.WorkflowDraftWhereInput = { ...baseWhere, ...(query.cursor ? { id: { lt: query.cursor } } : {}) };
    const [rows, total] = await this.db.$transaction([this.db.workflowDraft.findMany({ where, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: query.limit + 1 }), this.db.workflowDraft.count({ where: baseWhere })]);
    const hasNextPage = rows.length > query.limit;
    const items = rows.slice(0, query.limit).map((row) => this.present(row));
    return { items, total, pageInfo: { hasNextPage, nextCursor: hasNextPage ? items.at(-1)?.id ?? null : null } };
  }

  async get(principal: AuthenticatedPrincipal, id: string) { return this.present(await this.draft(principal, id, 'workflow.draft.read')); }

  async update(principal: AuthenticatedPrincipal, id: string, input: UpdateWorkflowDraftDto, correlationId?: string) {
    const current = await this.draft(principal, id, 'workflow.draft.update');
    const nextStatus = input.currentStep >= 8 ? WorkflowStatus.READY_TO_COMPLETE : WorkflowStatus.IN_PROGRESS;
    const updated = await this.db.$transaction(async (tx) => {
      const result = await tx.workflowDraft.updateMany({ where: { id, companyId: principal.companyId, version: input.expectedVersion, status: { in: [WorkflowStatus.DRAFT, WorkflowStatus.IN_PROGRESS, WorkflowStatus.READY_TO_COMPLETE, WorkflowStatus.FAILED] } }, data: { currentStep: input.currentStep, status: nextStatus, payloadCiphertext: this.cipher.encrypt(input.payload), version: { increment: 1 } } });
      if (result.count !== 1) throw new ConflictException('Workflow draft is stale or no longer editable.');
      const row = await tx.workflowDraft.findUniqueOrThrow({ where: { id } });
      await this.audit.write(tx, { actorUserId: principal.userId, action: 'workflow.draft.updated', entityType: 'WorkflowDraft', entityId: id, branchId: current.branchId, correlationId, before: { version: current.version, currentStep: current.currentStep }, after: { version: row.version, currentStep: row.currentStep, status: row.status } });
      return row;
    });
    return this.present(updated);
  }

  async cancel(principal: AuthenticatedPrincipal, id: string, input: CancelWorkflowDraftDto, correlationId?: string) {
    const current = await this.draft(principal, id, 'workflow.draft.cancel');
    const row = await this.db.$transaction(async (tx) => {
      const result = await tx.workflowDraft.updateMany({ where: { id, version: input.expectedVersion, status: { in: [WorkflowStatus.DRAFT, WorkflowStatus.IN_PROGRESS, WorkflowStatus.FAILED] } }, data: { status: WorkflowStatus.CANCELLED, cancelledAt: new Date(), version: { increment: 1 } } });
      if (result.count !== 1) throw new ConflictException('Workflow draft is stale or cannot be cancelled.');
      const updated = await tx.workflowDraft.findUniqueOrThrow({ where: { id } });
      await this.audit.write(tx, { actorUserId: principal.userId, action: 'workflow.draft.cancelled', entityType: 'WorkflowDraft', entityId: id, branchId: current.branchId, correlationId, reason: input.reason, after: { status: updated.status, version: updated.version } });
      return updated;
    });
    return this.present(row);
  }

  async complete(principal: AuthenticatedPrincipal, id: string, input: CompleteWorkflowDraftDto, correlationId?: string) {
    const current = await this.draft(principal, id, 'workflow.draft.complete');
    if (!/^[a-f0-9]{64}$/iu.test(input.requestHash)) throw new ConflictException('Completion request hash must be SHA-256.');
    const prior = await this.db.workflowCompletion.findUnique({ where: { workflowId_callerUserId_idempotencyKey: { workflowId: id, callerUserId: principal.userId, idempotencyKey: input.idempotencyKey } } });
    if (prior) {
      if (prior.requestHash !== input.requestHash) throw new ConflictException('Idempotency key was used with a different request.');
      this.assert(principal, 'workflow.draft.read', current.branchId);
      return prior.result;
    }
    if (current.currentStep !== 8 || current.status !== WorkflowStatus.READY_TO_COMPLETE) throw new ConflictException('Workflow is not ready to complete.');
    const result = { workflowId: id, type: current.type, referenceDigest: createHash('sha256').update(id).digest('hex') };
    await this.db.$transaction(async (tx) => {
      const changed = await tx.workflowDraft.updateMany({ where: { id, companyId: principal.companyId, version: input.expectedVersion, status: WorkflowStatus.READY_TO_COMPLETE }, data: { status: WorkflowStatus.COMPLETED, completedAt: new Date(), version: { increment: 1 } } });
      if (changed.count !== 1) throw new ConflictException('Workflow draft is stale or already completed.');
      await tx.workflowCompletion.create({ data: { id: uuidv7(), workflowId: id, callerUserId: principal.userId, idempotencyKey: input.idempotencyKey, requestHash: input.requestHash.toLowerCase(), result, expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) } });
      await this.audit.write(tx, { actorUserId: principal.userId, action: 'workflow.completed', entityType: 'WorkflowDraft', entityId: id, branchId: current.branchId, correlationId, after: { status: WorkflowStatus.COMPLETED } });
    });
    return result;
  }
}
