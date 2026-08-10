import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ApprovalStatus, Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import { AuditService } from './audit.service';
import type { CreateApprovalRequestDto, DecideApprovalDto } from './governance.dto';

@Injectable()
export class GovernanceService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
    private readonly authorization: AuthorizationService,
  ) {}

  listAudit(principal: AuthenticatedPrincipal) {
    const branchIds = this.authorization.authorizedBranchIds(principal, 'governance.audit.read');
    const where = branchIds === null ? {} : { branchId: { in: [...branchIds] } };
    return this.database.auditLog.findMany({ where, orderBy: { occurredAt: 'desc' }, take: 200 });
  }

  listApprovals(principal: AuthenticatedPrincipal) {
    const branchIds = this.authorization.authorizedBranchIds(
      principal,
      'governance.approval.read',
    );
    const where = branchIds === null ? {} : { branchId: { in: [...branchIds] } };
    return this.database.approvalRequest.findMany({
      where,
      include: { steps: { include: { decisions: true } }, policy: true },
      orderBy: { id: 'desc' },
      take: 100,
    });
  }

  async createApproval(
    principal: AuthenticatedPrincipal,
    input: CreateApprovalRequestDto,
    correlationId?: string,
  ) {
    if (input.branchId)
      this.authorization.assertBranchPermission(
        principal,
        'governance.approval.request',
        input.branchId,
      );
    else this.authorization.assertCompanyPermission(principal, 'governance.approval.request');
    return this.database.$transaction(async (transaction) => {
      const policy = await transaction.approvalPolicy.findFirstOrThrow({
        where: { id: input.policyId, companyId: principal.companyId, active: true },
        include: {
          rules: { where: { actionType: input.actionType }, orderBy: { sequence: 'asc' } },
        },
      });
      if (!policy.rules.length)
        throw new BadRequestException('No approval rule applies to this action.');
      const request = await transaction.approvalRequest.create({
        data: {
          id: randomUUID(),
          policyId: policy.id,
          makerEmployeeId: principal.employeeId,
          branchId: input.branchId ?? null,
          actionType: input.actionType,
          targetType: input.targetType,
          targetId: input.targetId,
          amount: input.amount ? new Prisma.Decimal(input.amount) : null,
          currency: input.currency?.toUpperCase() ?? null,
          status: ApprovalStatus.PENDING,
          correlationId:
            correlationId && /^[0-9a-f-]{36}$/i.test(correlationId) ? correlationId : null,
          steps: {
            create: policy.rules.map((rule) => ({
              id: randomUUID(),
              sequence: rule.sequence,
              status: 'PENDING',
            })),
          },
        },
        include: { steps: true },
      });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: 'governance.approval.requested',
        entityType: 'ApprovalRequest',
        entityId: request.id,
        branchId: input.branchId ?? null,
        correlationId,
        after: {
          actionType: request.actionType,
          targetType: request.targetType,
          targetId: request.targetId,
        },
      });
      return request;
    });
  }

  async decide(
    principal: AuthenticatedPrincipal,
    stepId: string,
    input: DecideApprovalDto,
    correlationId?: string,
  ) {
    return this.database.$transaction(async (transaction) => {
      const step = await transaction.approvalStep.findUniqueOrThrow({
        where: { id: stepId },
        include: { request: { include: { policy: { include: { rules: true } } } } },
      });
      if (step.request.branchId)
        this.authorization.assertBranchPermission(
          principal,
          'governance.approval.decide',
          step.request.branchId,
        );
      else this.authorization.assertCompanyPermission(principal, 'governance.approval.decide');
      const rule = step.request.policy.rules.find(
        (candidate) =>
          candidate.actionType === step.request.actionType && candidate.sequence === step.sequence,
      );
      if (rule?.makerChecker && step.request.makerEmployeeId === principal.employeeId)
        throw new BadRequestException('Maker cannot approve their own request.');
      const decision = await transaction.approvalDecision.create({
        data: {
          id: randomUUID(),
          stepId,
          approverEmployeeId: principal.employeeId,
          outcome: input.outcome,
          reason: input.reason ?? null,
        },
      });
      await transaction.approvalStep.update({
        where: { id: stepId },
        data: { status: input.outcome },
      });
      const status =
        input.outcome === 'REJECTED' ? ApprovalStatus.REJECTED : ApprovalStatus.APPROVED;
      await transaction.approvalRequest.update({ where: { id: step.requestId }, data: { status } });
      await this.audit.write(transaction, {
        actorUserId: principal.userId,
        action: `governance.approval.${input.outcome.toLowerCase()}`,
        entityType: 'ApprovalRequest',
        entityId: step.requestId,
        branchId: step.request.branchId,
        correlationId,
        reason: input.reason ?? null,
        after: { decisionId: decision.id, outcome: decision.outcome },
      });
      return decision;
    });
  }
}
