import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ExpenseResponsibility, ExpenseStatus, Prisma } from '@prisma/client';
import { uuidv7 } from '@rerms/shared';
import { cursorPage } from '../common/cursor-pagination';
import { nextRecordNumber } from '../common/record-number';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../governance/audit.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';
import type { CreateExpenseDto, ExpenseQueryDto, ExpenseTransitionDto } from './finance.dto';

const isoDate = (value: string): Date => new Date(`${value.slice(0, 10)}T00:00:00.000Z`);

const expenseTransitions: Record<ExpenseStatus, readonly ExpenseStatus[]> = {
  DRAFT: [ExpenseStatus.SUBMITTED, ExpenseStatus.CANCELLED],
  SUBMITTED: [ExpenseStatus.REVIEW, ExpenseStatus.CANCELLED],
  REVIEW: [ExpenseStatus.APPROVED, ExpenseStatus.REJECTED, ExpenseStatus.CANCELLED],
  APPROVED: [ExpenseStatus.POSTED, ExpenseStatus.CANCELLED],
  POSTED: [ExpenseStatus.PAID],
  PAID: [ExpenseStatus.RECONCILED],
  RECONCILED: [],
  REJECTED: [],
  CANCELLED: [],
  REVERSED: [],
};

@Injectable()
export class ExpenseService {
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

  async list(principal: AuthenticatedPrincipal, query: ExpenseQueryDto) {
    const branchIds = this.branches(principal, 'expense.read', query.branchId);
    const where: Prisma.ExpenseWhereInput = {
      companyId: principal.companyId,
      ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.propertyId ? { propertyId: query.propertyId } : {}),
      ...(query.search
        ? { expenseNumber: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    };
    const rows = await this.db.expense.findMany({
      where,
      take: query.limit + 1,
      orderBy: [{ businessDate: 'desc' }, { id: 'desc' }],
    });
    return cursorPage(rows, query.limit, (row) => row.id);
  }

  async create(principal: AuthenticatedPrincipal, input: CreateExpenseDto, correlationId?: string) {
    this.auth.assertBranchPermission(principal, 'expense.manage', input.branchId);
    const amount = new Prisma.Decimal(input.amount);
    if (amount.lte(0)) throw new BadRequestException('Expense amount must be positive.');
    if (input.responsibility === ExpenseResponsibility.OWNER && !input.ownerPartyId) {
      throw new BadRequestException('Owner-responsible expenses require an owner party.');
    }
    return this.db.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          branchId: input.branchId,
          expenseNumber: await nextRecordNumber(tx, 'EXPENSE'),
          vendorPartyId: input.vendorPartyId ?? null,
          propertyId: input.propertyId ?? null,
          rentableSpaceId: input.rentableSpaceId ?? null,
          ownerPartyId: input.ownerPartyId ?? null,
          leaseId: input.leaseId ?? null,
          serviceEngagementId: input.serviceEngagementId ?? null,
          categoryCode: input.categoryCode.trim().toUpperCase(),
          currency: input.currency.toUpperCase(),
          amount,
          responsibility: input.responsibility,
          businessDate: isoDate(input.businessDate),
          description: input.description?.trim() || null,
          status: ExpenseStatus.DRAFT,
        },
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'expense.created',
        entityType: 'Expense',
        entityId: expense.id,
        branchId: expense.branchId,
        correlationId,
        after: { expenseNumber: expense.expenseNumber, amount: expense.amount.toString() },
      });
      return expense;
    });
  }

  async transition(
    principal: AuthenticatedPrincipal,
    expenseId: string,
    input: ExpenseTransitionDto,
    correlationId?: string,
  ) {
    const current = await this.db.expense.findFirst({
      where: { id: expenseId, companyId: principal.companyId },
    });
    if (!current) throw new NotFoundException('Expense not found.');
    const permission = input.status === ExpenseStatus.APPROVED ? 'expense.manage' : 'expense.read';
    this.auth.assertBranchPermission(principal, permission, current.branchId);
    if (!expenseTransitions[current.status].includes(input.status)) {
      throw new ConflictException(`Expense cannot transition from ${current.status} to ${input.status}.`);
    }
    return this.db.$transaction(async (tx) => {
      const row = await tx.expense.update({
        where: { id: expenseId },
        data: { status: input.status },
      });
      await this.audit.write(tx, {
        actorUserId: principal.userId,
        action: 'expense.transitioned',
        entityType: 'Expense',
        entityId: expenseId,
        branchId: current.branchId,
        correlationId,
        reason: input.reason,
        before: { status: current.status },
        after: { status: row.status },
      });
      return row;
    });
  }

  async get(principal: AuthenticatedPrincipal, expenseId: string) {
    const expense = await this.db.expense.findFirst({
      where: { id: expenseId, companyId: principal.companyId },
    });
    if (!expense) throw new NotFoundException('Expense not found.');
    this.auth.assertBranchPermission(principal, 'expense.read', expense.branchId);
    return expense;
  }
}
