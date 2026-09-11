import { Injectable } from '@nestjs/common';
import {
  ChargeStatus,
  ExpenseStatus,
  InvoiceStatus,
  JournalStatus,
  PaymentStatus,
  PayoutStatus,
} from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { AuthorizationService } from '../security/authorization.service';
import type { AuthenticatedPrincipal } from '../security/security.types';

@Injectable()
export class FinanceOverviewService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auth: AuthorizationService,
  ) {}

  private branchFilter(principal: AuthenticatedPrincipal, permission: string) {
    const branchIds = this.auth.authorizedBranchIds(principal, permission);
    return branchIds === null ? {} : { branchId: { in: [...branchIds] } };
  }

  private branches(principal: AuthenticatedPrincipal, permission: string, branchId?: string) {
    const allowed = this.auth.authorizedBranchIds(principal, permission);
    if (allowed === null) return branchId ? [branchId] : null;
    return [...allowed].filter((id) => !branchId || id === branchId);
  }

  async overview(principal: AuthenticatedPrincipal) {
    const companyId = principal.companyId;
    const [openInvoices, unallocatedPayments, pendingOwnerPayouts, openExpenses, draftJournals, recentInvoices, recentPayments] =
      await Promise.all([
        this.db.invoice.count({
          where: {
            companyId,
            status: InvoiceStatus.ISSUED,
            ...this.branchFilter(principal, 'invoice.read'),
          },
        }),
        this.db.payment.count({
          where: {
            companyId,
            status: { in: [PaymentStatus.CAPTURED, PaymentStatus.VERIFIED, PaymentStatus.POSTED, PaymentStatus.PARTIALLY_ALLOCATED] },
            ...this.branchFilter(principal, 'payment.read'),
          },
        }),
        this.db.ownerPayout.count({
          where: {
            companyId,
            status: { in: [PayoutStatus.DRAFT, PayoutStatus.REVIEW, PayoutStatus.APPROVED, PayoutStatus.QUEUED] },
            ...this.branchFilter(principal, 'payout.read'),
          },
        }),
        this.db.expense.count({
          where: {
            companyId,
            status: { in: [ExpenseStatus.DRAFT, ExpenseStatus.SUBMITTED, ExpenseStatus.REVIEW, ExpenseStatus.APPROVED] },
            ...this.branchFilter(principal, 'expense.read'),
          },
        }),
        this.db.journalEntry.count({
          where: {
            companyId,
            status: JournalStatus.DRAFT,
            ...this.branchFilter(principal, 'journal.read'),
          },
        }),
        this.db.invoice.findMany({
          where: { companyId, ...this.branchFilter(principal, 'invoice.read') },
          orderBy: [{ issueDate: 'desc' }, { id: 'desc' }],
          take: 5,
          select: { id: true, invoiceNumber: true, issueDate: true, status: true, currency: true },
        }),
        this.db.payment.findMany({
          where: { companyId, ...this.branchFilter(principal, 'payment.read') },
          orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
          take: 5,
          select: { id: true, paymentNumber: true, receivedAt: true, status: true, currency: true, amount: true },
        }),
      ]);

    return {
      summary: {
        openInvoices,
        unallocatedPayments,
        pendingOwnerPayouts,
        openExpenses,
        draftJournals,
        openCharges: await this.db.charge.count({
          where: {
            companyId,
            status: { in: [ChargeStatus.OPEN, ChargeStatus.PARTIALLY_PAID] },
            ...this.branchFilter(principal, 'billing.read'),
          },
        }),
      },
      recentInvoices,
      recentPayments,
    };
  }

  async listOwnerStatements(principal: AuthenticatedPrincipal, query: { branchId?: string; cursor?: string; limit: number }) {
    const branchIds = this.branches(principal, 'owner-statement.read', query.branchId);
    const where = {
      companyId: principal.companyId,
      ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
    };
    const rows = await this.db.ownerStatement.findMany({
      where,
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ periodStart: 'desc' }, { id: 'desc' }],
      include: { owner: { select: { displayName: true } } },
    });
    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
    };
  }
}
