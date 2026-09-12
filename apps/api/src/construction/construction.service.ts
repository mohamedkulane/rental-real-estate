import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ChargeStatus,
  ConstructionBillingStatus,
  ConstructionContractStatus,
  ConstructionEconomicModel,
  ConstructionMilestoneStatus,
  ConstructionProjectStatus,
  ConstructionWorkPackagePriority,
  ConstructionWorkPackageStatus,
  ExpenseResponsibility,
  ExpenseStatus,
  InvoiceStatus,
  Prisma,
} from '@prisma/client';
import { uuidv7 } from '@rerms/shared';
import { cursorPage } from '../common/cursor-pagination';
import { nextRecordNumber } from '../common/record-number';
import { DatabaseService } from '../database/database.service';
import { replayIdempotentRecord } from '../finance/finance.policy';
import { AuditService } from '../governance/audit.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import type {
  ConstructionContractTransitionDto,
  ConstructionMilestoneTransitionDto,
  ConstructionProjectQueryDto,
  ConstructionProjectTransitionDto,
  ConstructionWorkPackageTransitionDto,
  CreateConstructionBillingDto,
  CreateConstructionContractDto,
  CreateConstructionMilestoneDto,
  CreateConstructionProjectDto,
  CreateConstructionWorkPackageDto,
  LinkConstructionDocumentDto,
  RecordConstructionCostDto,
  RecordConstructionProgressDto,
  UpsertConstructionBudgetLineDto,
} from './construction.dto';
import {
  assertConfigurablePaymentTerms,
  assertConstructionEconomicModel,
  assertInvoiceWithinContractCeiling,
  constructionContractTransitions,
  remainingBillableContractValue,
} from './construction.policy';

const isoDate = (value: string): Date => new Date(`${value.slice(0, 10)}T00:00:00.000Z`);

const projectTransitions: Record<ConstructionProjectStatus, readonly ConstructionProjectStatus[]> = {
  DRAFT: [ConstructionProjectStatus.PLANNING, ConstructionProjectStatus.CANCELLED],
  PLANNING: [ConstructionProjectStatus.ACTIVE, ConstructionProjectStatus.ON_HOLD, ConstructionProjectStatus.CANCELLED],
  ACTIVE: [ConstructionProjectStatus.ON_HOLD, ConstructionProjectStatus.COMPLETED, ConstructionProjectStatus.CANCELLED],
  ON_HOLD: [ConstructionProjectStatus.ACTIVE, ConstructionProjectStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

@Injectable()
export class ConstructionService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auth: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  private branches(principal: AuthenticatedPrincipal, permission: string, branchId?: string) {
    const allowed = this.auth.authorizedBranchIds(principal, permission);
    if (allowed === null) return branchId ? [branchId] : null;
    return [...allowed].filter((id) => !branchId || id === branchId);
  }

  private async loadProject(companyId: string, id: string) {
    const project = await this.db.constructionProject.findFirst({
      where: { id, companyId },
    });
    if (!project) throw new NotFoundException('Construction project not found.');
    return project;
  }

  async overview(principal: AuthenticatedPrincipal) {
    const branchIds = this.branches(principal, 'construction.read');
    const scope = {
      companyId: principal.companyId,
      economicModel: ConstructionEconomicModel.CONSTRUCTION_FOR_CLIENT,
      ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
    };
    const today = new Date(`${principal.businessDate}T00:00:00.000Z`);
    const [activeProjects, delayedProjects, upcomingMilestones, openWorkPackages, outstandingInvoices, budget] =
      await Promise.all([
        this.db.constructionProject.count({
          where: { ...scope, status: ConstructionProjectStatus.ACTIVE },
        }),
        this.db.constructionProject.count({
          where: {
            ...scope,
            status: ConstructionProjectStatus.ACTIVE,
            expectedEndDate: { lt: today },
          },
        }),
        this.db.constructionMilestone.count({
          where: {
            project: scope,
            status: { in: [ConstructionMilestoneStatus.PLANNED, ConstructionMilestoneStatus.IN_PROGRESS] },
            plannedEnd: { gte: today },
          },
        }),
        this.db.constructionWorkPackage.count({
          where: {
            project: scope,
            status: {
              in: [
                ConstructionWorkPackageStatus.PLANNED,
                ConstructionWorkPackageStatus.SCHEDULED,
                ConstructionWorkPackageStatus.IN_PROGRESS,
                ConstructionWorkPackageStatus.BLOCKED,
              ],
            },
          },
        }),
        this.db.charge.aggregate({
          where: {
            companyId: principal.companyId,
            ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
            constructionBilling: { isNot: null },
            status: { in: [ChargeStatus.OPEN, ChargeStatus.PARTIALLY_PAID] },
          },
          _sum: { outstandingAmount: true },
        }),
        this.db.constructionBudgetLine.aggregate({
          where: { project: scope },
          _sum: { budgetAmount: true, actualAmount: true },
        }),
      ]);
    const budgetAmount = Number(budget._sum.budgetAmount ?? 0);
    const actualAmount = Number(budget._sum.actualAmount ?? 0);
    return {
      widgets: {
        activeProjects,
        delayedProjects,
        budgetUtilization: budgetAmount ? Number(((actualAmount / budgetAmount) * 100).toFixed(1)) : 0,
        upcomingMilestones,
        openWorkPackages,
        outstandingClientInvoices: outstandingInvoices._sum.outstandingAmount?.toString() ?? '0',
      },
    };
  }

  async listProjects(principal: AuthenticatedPrincipal, query: ConstructionProjectQueryDto) {
    const branchIds = this.branches(principal, 'construction.read', query.branchId);
    const rows = await this.db.constructionProject.findMany({
      where: {
        companyId: principal.companyId,
        economicModel: query.economicModel ?? ConstructionEconomicModel.CONSTRUCTION_FOR_CLIENT,
        ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                { projectNumber: { contains: query.search, mode: 'insensitive' } },
                { name: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        client: { select: { id: true, displayName: true } },
        property: { select: { id: true, name: true, propertyCode: true } },
      },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
    return cursorPage(rows, query.limit, (row) => row.id);
  }

  async getProject(principal: AuthenticatedPrincipal, id: string) {
    const project = await this.db.constructionProject.findFirst({
      where: { id, companyId: principal.companyId },
      include: {
        client: { select: { id: true, displayName: true } },
        property: { select: { id: true, name: true, propertyCode: true } },
        contracts: { include: { installments: { orderBy: { sequence: 'asc' } } } },
        budgetLines: true,
        milestones: { orderBy: { sequence: 'asc' } },
        workPackages: { orderBy: { createdAt: 'desc' } },
        costs: { orderBy: { businessDate: 'desc' }, take: 25 },
        billingEvents: { orderBy: { createdAt: 'desc' }, take: 25 },
        progressEntries: { orderBy: { recordedAt: 'desc' }, take: 10 },
      },
    });
    if (!project) throw new NotFoundException('Construction project not found.');
    this.auth.assertBranchPermission(principal, 'construction.read', project.branchId);
    return project;
  }

  async createProject(
    principal: AuthenticatedPrincipal,
    input: CreateConstructionProjectDto,
    correlationId?: string,
  ) {
    this.auth.assertBranchPermission(principal, 'construction.manage', input.branchId);
    assertConstructionEconomicModel(input);
    return this.db.$transaction(async (tx) => {
      const project = await tx.constructionProject.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          branchId: input.branchId,
          projectNumber: await nextRecordNumber(tx, 'CONSTRUCTION_PROJECT'),
          name: input.name.trim(),
          economicModel: input.economicModel,
          clientPartyId: input.clientPartyId ?? null,
          propertyId: input.propertyId ?? null,
          leadId: input.leadId ?? null,
          developmentProjectId: input.developmentProjectId ?? null,
          projectManagerEmployeeId: input.projectManagerEmployeeId ?? null,
          startDate: input.startDate ? isoDate(input.startDate) : null,
          expectedEndDate: input.expectedEndDate ? isoDate(input.expectedEndDate) : null,
          scope: input.scope?.trim() || null,
          notes: input.notes?.trim() || null,
          contractValue: input.contractValue ? new Prisma.Decimal(input.contractValue) : null,
          currency: (input.currency ?? 'USD').toUpperCase(),
        },
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'construction.project.created',
        entityType: 'ConstructionProject',
        entityId: project.id,
        branchId: project.branchId,
        correlationId,
        after: { projectNumber: project.projectNumber, economicModel: project.economicModel },
      });
      return project;
    });
  }

  async transitionProject(
    principal: AuthenticatedPrincipal,
    id: string,
    input: ConstructionProjectTransitionDto,
    correlationId?: string,
  ) {
    const current = await this.loadProject(principal.companyId, id);
    this.auth.assertBranchPermission(principal, 'construction.manage', current.branchId);
    if (!projectTransitions[current.status].includes(input.status)) {
      throw new ConflictException(`Project cannot transition from ${current.status} to ${input.status}.`);
    }
    return this.db.$transaction(async (tx) => {
      const row = await tx.constructionProject.update({
        where: { id },
        data: {
          status: input.status,
          actualCompletionDate:
            input.status === ConstructionProjectStatus.COMPLETED
              ? new Date(`${principal.businessDate}T00:00:00.000Z`)
              : current.actualCompletionDate,
          actualPercent: input.status === ConstructionProjectStatus.COMPLETED ? 100 : current.actualPercent,
        },
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action:
          input.status === ConstructionProjectStatus.COMPLETED
            ? 'construction.project.completed'
            : 'construction.project.transitioned',
        entityType: 'ConstructionProject',
        entityId: id,
        branchId: current.branchId,
        correlationId,
        reason: input.reason,
        before: { status: current.status },
        after: { status: row.status },
      });
      return row;
    });
  }

  async createContract(
    principal: AuthenticatedPrincipal,
    input: CreateConstructionContractDto,
    correlationId?: string,
  ) {
    const project = await this.loadProject(principal.companyId, input.constructionProjectId);
    this.auth.assertBranchPermission(principal, 'construction.manage', project.branchId);
    if (project.economicModel !== ConstructionEconomicModel.CONSTRUCTION_FOR_CLIENT || !project.clientPartyId) {
      throw new BadRequestException('Contracts apply only to client construction projects.');
    }
    const value = new Prisma.Decimal(input.contractValue);
    if (value.lte(0)) throw new BadRequestException('Contract value must be positive.');
    assertConfigurablePaymentTerms(input.installments);
    return this.db.$transaction(async (tx) => {
      const contract = await tx.constructionContract.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          branchId: project.branchId,
          contractNumber: await nextRecordNumber(tx, 'CONSTRUCTION_CONTRACT'),
          constructionProjectId: project.id,
          clientPartyId: project.clientPartyId!,
          contractValue: value,
          currency: (input.currency ?? project.currency).toUpperCase(),
          paymentTermsSummary: input.paymentTermsSummary.trim(),
          retentionPercent: input.retentionPercent ? new Prisma.Decimal(input.retentionPercent) : null,
          effectiveDate: isoDate(input.effectiveDate),
          completionTarget: input.completionTarget ? isoDate(input.completionTarget) : null,
          scope: input.scope?.trim() || project.scope,
          installments: {
            create: input.installments.map((term, index) => ({
              id: uuidv7(),
              sequence: term.sequence ?? index + 1,
              label: term.label.trim(),
              percent: term.percent ? new Prisma.Decimal(term.percent) : null,
              amount: term.amount ? new Prisma.Decimal(term.amount) : null,
              dueDate: term.dueDate ? isoDate(term.dueDate) : null,
              notes: term.notes?.trim() || null,
            })),
          },
        },
        include: { installments: { orderBy: { sequence: 'asc' } } },
      });
      await tx.constructionProject.update({
        where: { id: project.id },
        data: { contractValue: value, status: ConstructionProjectStatus.PLANNING },
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'construction.contract.created',
        entityType: 'ConstructionContract',
        entityId: contract.id,
        branchId: project.branchId,
        correlationId,
        after: { contractNumber: contract.contractNumber, contractValue: value.toString() },
      });
      return contract;
    });
  }

  async transitionContract(
    principal: AuthenticatedPrincipal,
    id: string,
    input: ConstructionContractTransitionDto,
    correlationId?: string,
  ) {
    const contract = await this.db.constructionContract.findFirst({
      where: { id, companyId: principal.companyId },
    });
    if (!contract) throw new NotFoundException('Construction contract not found.');
    this.auth.assertBranchPermission(principal, 'construction.manage', contract.branchId);
    if (!constructionContractTransitions[contract.status].includes(input.status)) {
      throw new ConflictException(`Contract cannot transition from ${contract.status} to ${input.status}.`);
    }
    const row = await this.db.constructionContract.update({
      where: { id },
      data: { status: input.status },
    });
    await this.audit.write(this.db, {
      actorUserId: principal.userId,
      action:
        input.status === ConstructionContractStatus.ACTIVE
          ? 'construction.contract.approved'
          : 'construction.contract.transitioned',
      entityType: 'ConstructionContract',
      entityId: id,
      branchId: contract.branchId,
      correlationId,
      before: { status: contract.status },
      after: { status: row.status },
    });
    return row;
  }

  async upsertBudgetLine(principal: AuthenticatedPrincipal, input: UpsertConstructionBudgetLineDto) {
    const project = await this.loadProject(principal.companyId, input.constructionProjectId);
    this.auth.assertBranchPermission(principal, 'construction.manage', project.branchId);
    const amount = new Prisma.Decimal(input.budgetAmount);
    if (amount.lt(0)) throw new BadRequestException('Budget amount cannot be negative.');
    const line = await this.db.constructionBudgetLine.create({
      data: {
        id: uuidv7(),
        constructionProjectId: project.id,
        category: input.category,
        label: input.label.trim(),
        budgetAmount: amount,
        notes: input.notes?.trim() || null,
      },
    });
    await this.audit.write(this.db, {
      actorUserId: principal.userId,
      action: 'construction.budget.changed',
      entityType: 'ConstructionBudgetLine',
      entityId: line.id,
      branchId: project.branchId,
      after: { category: line.category, budgetAmount: amount.toString() },
    });
    return line;
  }

  async createMilestone(principal: AuthenticatedPrincipal, input: CreateConstructionMilestoneDto) {
    const project = await this.loadProject(principal.companyId, input.constructionProjectId);
    this.auth.assertBranchPermission(principal, 'construction.manage', project.branchId);
    const last = await this.db.constructionMilestone.findFirst({
      where: { constructionProjectId: project.id },
      orderBy: { sequence: 'desc' },
    });
    return this.db.constructionMilestone.create({
      data: {
        id: uuidv7(),
        constructionProjectId: project.id,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        sequence: input.sequence ?? (last?.sequence ?? 0) + 1,
        plannedStart: input.plannedStart ? isoDate(input.plannedStart) : null,
        plannedEnd: input.plannedEnd ? isoDate(input.plannedEnd) : null,
        assigneeEmployeeId: input.assigneeEmployeeId ?? null,
      },
    });
  }

  async transitionMilestone(
    principal: AuthenticatedPrincipal,
    id: string,
    input: ConstructionMilestoneTransitionDto,
    correlationId?: string,
  ) {
    const milestone = await this.db.constructionMilestone.findFirst({
      where: { id, project: { companyId: principal.companyId } },
      include: { project: true },
    });
    if (!milestone) throw new NotFoundException('Milestone not found.');
    this.auth.assertBranchPermission(principal, 'construction.manage', milestone.project.branchId);
    const percent = input.percentComplete ? new Prisma.Decimal(input.percentComplete) : milestone.percentComplete;
    const row = await this.db.constructionMilestone.update({
      where: { id },
      data: {
        status: input.status,
        percentComplete: percent,
        actualStart:
          input.status === ConstructionMilestoneStatus.IN_PROGRESS && !milestone.actualStart
            ? new Date(`${principal.businessDate}T00:00:00.000Z`)
            : milestone.actualStart,
        actualEnd:
          input.status === ConstructionMilestoneStatus.COMPLETED
            ? new Date(`${principal.businessDate}T00:00:00.000Z`)
            : milestone.actualEnd,
      },
    });
    if (input.status === ConstructionMilestoneStatus.COMPLETED) {
      await this.audit.write(this.db, {
        actorUserId: principal.userId,
        action: 'construction.milestone.completed',
        entityType: 'ConstructionMilestone',
        entityId: id,
        branchId: milestone.project.branchId,
        correlationId,
        after: { title: milestone.title, status: row.status },
      });
    }
    return row;
  }

  async createWorkPackage(principal: AuthenticatedPrincipal, input: CreateConstructionWorkPackageDto) {
    const project = await this.loadProject(principal.companyId, input.constructionProjectId);
    this.auth.assertBranchPermission(principal, 'construction.manage', project.branchId);
    return this.db.$transaction(async (tx) => {
      const pack = await tx.constructionWorkPackage.create({
        data: {
          id: uuidv7(),
          constructionProjectId: project.id,
          milestoneId: input.milestoneId ?? null,
          title: input.title.trim(),
          description: input.description?.trim() || null,
          assigneeEmployeeId: input.assigneeEmployeeId ?? null,
          vendorPartyId: input.vendorPartyId ?? null,
          priority: input.priority ?? ConstructionWorkPackagePriority.MEDIUM,
          scheduledStart: input.scheduledStart ? isoDate(input.scheduledStart) : null,
          scheduledEnd: input.scheduledEnd ? isoDate(input.scheduledEnd) : null,
          estimatedCost: input.estimatedCost ? new Prisma.Decimal(input.estimatedCost) : null,
          notes: input.notes?.trim() || null,
        },
      });
      if (input.dependsOnId) {
        if (input.dependsOnId === pack.id) throw new BadRequestException('A work package cannot depend on itself.');
        await tx.constructionWorkPackageDependency.create({
          data: { id: uuidv7(), workPackageId: pack.id, dependsOnId: input.dependsOnId },
        });
      }
      return pack;
    });
  }

  async transitionWorkPackage(
    principal: AuthenticatedPrincipal,
    id: string,
    input: ConstructionWorkPackageTransitionDto,
    correlationId?: string,
  ) {
    const pack = await this.db.constructionWorkPackage.findFirst({
      where: { id, project: { companyId: principal.companyId } },
      include: { project: true, blockers: true },
    });
    if (!pack) throw new NotFoundException('Work package not found.');
    this.auth.assertBranchPermission(principal, 'construction.manage', pack.project.branchId);
    if (input.status === ConstructionWorkPackageStatus.IN_PROGRESS && pack.blockers.length) {
      const open = await this.db.constructionWorkPackage.count({
        where: {
          id: { in: pack.blockers.map((row) => row.dependsOnId) },
          status: { not: ConstructionWorkPackageStatus.COMPLETED },
        },
      });
      if (open) throw new ConflictException('Work package is blocked by incomplete dependencies.');
    }
    const row = await this.db.constructionWorkPackage.update({
      where: { id },
      data: {
        status: input.status,
        actualStart:
          input.status === ConstructionWorkPackageStatus.IN_PROGRESS && !pack.actualStart
            ? new Date(`${principal.businessDate}T00:00:00.000Z`)
            : pack.actualStart,
        actualEnd:
          input.status === ConstructionWorkPackageStatus.COMPLETED
            ? new Date(`${principal.businessDate}T00:00:00.000Z`)
            : pack.actualEnd,
      },
    });
    if (input.status === ConstructionWorkPackageStatus.COMPLETED) {
      await this.audit.write(this.db, {
        actorUserId: principal.userId,
        action: 'construction.work-package.completed',
        entityType: 'ConstructionWorkPackage',
        entityId: id,
        branchId: pack.project.branchId,
        correlationId,
        after: { title: pack.title },
      });
    }
    return row;
  }

  async recordCost(
    principal: AuthenticatedPrincipal,
    input: RecordConstructionCostDto,
    correlationId?: string,
  ) {
    const project = await this.loadProject(principal.companyId, input.constructionProjectId);
    this.auth.assertBranchPermission(principal, 'expense.manage', project.branchId);
    const amount = new Prisma.Decimal(input.amount);
    if (amount.lte(0)) throw new BadRequestException('Cost amount must be positive.');
    const idempotencyKey =
      input.idempotencyKey?.trim() ||
      `construction-cost:${project.id}:${input.category}:${input.businessDate}:${amount.toString()}`;
    const existing = await this.db.constructionCost.findUnique({ where: { idempotencyKey } });
    const replay = replayIdempotentRecord(existing, principal.companyId);
    if (replay) return replay;
    return this.db.$transaction(async (tx) => {
      const locked = await tx.constructionCost.findUnique({ where: { idempotencyKey } });
      const again = replayIdempotentRecord(locked, principal.companyId);
      if (again) return again;
      const expense = await tx.expense.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          branchId: project.branchId,
          expenseNumber: await nextRecordNumber(tx, 'EXPENSE'),
          vendorPartyId: input.vendorPartyId ?? null,
          propertyId: project.propertyId,
          categoryCode: input.category,
          currency: project.currency,
          amount,
          responsibility: ExpenseResponsibility.COMPANY,
          businessDate: isoDate(input.businessDate),
          description: input.description?.trim() || `Construction cost ${project.projectNumber}`,
          idempotencyKey,
          status: ExpenseStatus.APPROVED,
        },
      });
      const cost = await tx.constructionCost.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          constructionProjectId: project.id,
          milestoneId: input.milestoneId ?? null,
          workPackageId: input.workPackageId ?? null,
          expenseId: expense.id,
          vendorPartyId: input.vendorPartyId ?? null,
          category: input.category,
          amount,
          currency: project.currency,
          businessDate: isoDate(input.businessDate),
          idempotencyKey,
        },
      });
      await tx.constructionBudgetLine.updateMany({
        where: { constructionProjectId: project.id, category: input.category },
        data: { actualAmount: { increment: amount } },
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'construction.cost.posted',
        entityType: 'ConstructionCost',
        entityId: cost.id,
        branchId: project.branchId,
        correlationId,
        after: { expenseId: expense.id, amount: amount.toString(), category: input.category },
      });
      return cost;
    });
  }

  async createBilling(
    principal: AuthenticatedPrincipal,
    input: CreateConstructionBillingDto,
    correlationId?: string,
  ) {
    const project = await this.loadProject(principal.companyId, input.constructionProjectId);
    this.auth.assertBranchPermission(principal, 'billing.manage', project.branchId);
    if (project.economicModel !== ConstructionEconomicModel.CONSTRUCTION_FOR_CLIENT || !project.clientPartyId) {
      throw new BadRequestException('Client billing is only available for client construction.');
    }
    const contract = await this.db.constructionContract.findFirst({
      where: { id: input.contractId, constructionProjectId: project.id, companyId: principal.companyId },
    });
    if (!contract) throw new NotFoundException('Construction contract not found.');
    if (contract.status !== ConstructionContractStatus.ACTIVE) {
      throw new ConflictException('Only an active construction contract can be billed.');
    }
    const amount = new Prisma.Decimal(input.amount);
    if (amount.lte(0)) throw new BadRequestException('Billing amount must be positive.');
    const idempotencyKey =
      input.idempotencyKey?.trim() ||
      `construction-bill:${project.id}:${input.basis}:${input.milestoneId ?? input.installmentSequence ?? input.dueDate}:${amount.toString()}`;
    const existing = await this.db.constructionBillingEvent.findUnique({ where: { idempotencyKey } });
    const replay = replayIdempotentRecord(existing, principal.companyId);
    if (replay) return replay;
    const chargeType = await this.db.chargeType.findFirst({
      where: { companyId: principal.companyId, code: 'CONSTRUCTION', active: true },
    });
    if (!chargeType) throw new ConflictException('CONSTRUCTION charge type is not configured.');
    return this.db.$transaction(async (tx) => {
      const locked = await tx.constructionBillingEvent.findUnique({ where: { idempotencyKey } });
      const again = replayIdempotentRecord(locked, principal.companyId);
      if (again) return again;
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM construction_contracts WHERE id = ${contract.id}::uuid AND "companyId" = ${principal.companyId}::uuid FOR UPDATE`,
      );
      const invoiced = await tx.constructionBillingEvent.aggregate({
        where: {
          contractId: contract.id,
          companyId: principal.companyId,
          status: { not: ConstructionBillingStatus.CANCELLED },
        },
        _sum: { amount: true },
      });
      const remaining = remainingBillableContractValue({
        contractValue: contract.contractValue,
        invoicedAmount: invoiced._sum.amount ?? 0,
      });
      assertInvoiceWithinContractCeiling({ amount, remaining });
      const charge = await tx.charge.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          branchId: project.branchId,
          chargeNumber: await nextRecordNumber(tx, 'CHARGE'),
          debtorPartyId: project.clientPartyId!,
          propertyId: project.propertyId,
          chargeTypeId: chargeType.id,
          businessDate: isoDate(principal.businessDate),
          dueDate: isoDate(input.dueDate),
          currency: contract.currency,
          originalAmount: amount,
          outstandingAmount: amount,
          status: ChargeStatus.OPEN,
          idempotencyKey,
        },
      });
      const invoice = await tx.invoice.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          branchId: project.branchId,
          invoiceNumber: await nextRecordNumber(tx, 'INVOICE'),
          debtorPartyId: project.clientPartyId!,
          issueDate: isoDate(principal.businessDate),
          dueDate: isoDate(input.dueDate),
          currency: contract.currency,
          status: InvoiceStatus.ISSUED,
          lines: { create: [{ id: uuidv7(), chargeId: charge.id, displayAmount: amount }] },
        },
      });
      const event = await tx.constructionBillingEvent.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          constructionProjectId: project.id,
          contractId: contract.id,
          milestoneId: input.milestoneId ?? null,
          installmentSequence: input.installmentSequence ?? null,
          basis: input.basis,
          status: ConstructionBillingStatus.INVOICED,
          amount,
          currency: contract.currency,
          dueDate: isoDate(input.dueDate),
          chargeId: charge.id,
          invoiceId: invoice.id,
          idempotencyKey,
        },
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'construction.client-invoice.issued',
        entityType: 'ConstructionBillingEvent',
        entityId: event.id,
        branchId: project.branchId,
        correlationId,
        after: { invoiceId: invoice.id, chargeId: charge.id, amount: amount.toString(), basis: input.basis },
      });
      return { ...event, charge, invoice };
    });
  }

  async clientStatement(principal: AuthenticatedPrincipal, projectId: string) {
    const project = await this.getProject(principal, projectId);
    if (project.economicModel !== ConstructionEconomicModel.CONSTRUCTION_FOR_CLIENT) {
      throw new BadRequestException('Client statements apply only to client construction.');
    }
    const events = await this.db.constructionBillingEvent.findMany({
      where: { constructionProjectId: projectId, companyId: principal.companyId },
      include: { charge: true, invoice: true },
      orderBy: { createdAt: 'asc' },
    });
    const billed = events.reduce((sum, event) => sum.add(event.amount), new Prisma.Decimal(0));
    const outstanding = events.reduce(
      (sum, event) => sum.add(event.charge?.outstandingAmount ?? 0),
      new Prisma.Decimal(0),
    );
    return {
      projectId,
      clientPartyId: project.clientPartyId,
      billed: billed.toString(),
      outstanding: outstanding.toString(),
      items: events,
    };
  }

  async recordProgress(principal: AuthenticatedPrincipal, input: RecordConstructionProgressDto) {
    const project = await this.loadProject(principal.companyId, input.constructionProjectId);
    this.auth.assertBranchPermission(principal, 'construction.manage', project.branchId);
    const planned = new Prisma.Decimal(input.plannedPercent);
    const actual = new Prisma.Decimal(input.actualPercent);
    const entry = await this.db.constructionProgressEntry.create({
      data: {
        id: uuidv7(),
        constructionProjectId: project.id,
        plannedPercent: planned,
        actualPercent: actual,
        notes: input.notes?.trim() || null,
      },
    });
    await this.db.constructionProject.update({
      where: { id: project.id },
      data: { plannedPercent: planned, actualPercent: actual },
    });
    return entry;
  }

  async listDocuments(principal: AuthenticatedPrincipal, projectId: string) {
    const project = await this.loadProject(principal.companyId, projectId);
    this.auth.assertBranchPermission(principal, 'construction.read', project.branchId);
    return this.db.documentLink.findMany({
      where: { entityType: 'ConstructionProject', entityId: projectId },
      include: { document: { select: { id: true, displayName: true, categoryCode: true, accessClass: true } } },
    });
  }

  async linkDocument(principal: AuthenticatedPrincipal, projectId: string, input: LinkConstructionDocumentDto) {
    const project = await this.loadProject(principal.companyId, projectId);
    this.auth.assertBranchPermission(principal, 'construction.manage', project.branchId);
    const document = await this.db.document.findFirst({
      where: { id: input.documentId, companyId: principal.companyId },
    });
    if (!document) throw new NotFoundException('Document not found.');
    return this.db.documentLink.create({
      data: {
        id: uuidv7(),
        documentId: document.id,
        entityType: 'ConstructionProject',
        entityId: projectId,
        purpose: input.purpose?.trim() || 'CONSTRUCTION',
      },
    });
  }

  async handover(principal: AuthenticatedPrincipal, projectId: string, correlationId?: string) {
    const project = await this.loadProject(principal.companyId, projectId);
    this.auth.assertBranchPermission(principal, 'construction.manage', project.branchId);
    if (project.status !== ConstructionProjectStatus.ACTIVE) {
      throw new ConflictException('Only an active construction project can be handed over.');
    }
    return this.transitionProject(
      principal,
      projectId,
      { status: ConstructionProjectStatus.COMPLETED, reason: 'Client handover completed' },
      correlationId,
    );
  }
}
