import { Injectable } from '@nestjs/common';
import {
  BrokerageDealStatus,
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
        receivablesTotal: await this.sumOutstandingCharges(companyId, principal),
        paymentsReceivedTotal: await this.sumRecentPayments(companyId, principal),
        managementFeesTotal: await this.sumPostedExpensesByCategory(
          companyId,
          principal,
          'MANAGEMENT',
        ),
        brokerageCommissionsTotal: await this.sumBrokerageCommissions(companyId, principal),
      },
      charts: await this.charts(principal),
      recentInvoices,
      recentPayments,
    };
  }

  private async sumOutstandingCharges(companyId: string, principal: AuthenticatedPrincipal) {
    const result = await this.db.charge.aggregate({
      where: {
        companyId,
        status: { in: [ChargeStatus.OPEN, ChargeStatus.PARTIALLY_PAID] },
        ...this.branchFilter(principal, 'billing.read'),
      },
      _sum: { outstandingAmount: true },
    });
    return result._sum.outstandingAmount?.toString() ?? '0';
  }

  private async sumRecentPayments(companyId: string, principal: AuthenticatedPrincipal) {
    const since = new Date();
    since.setUTCMonth(since.getUTCMonth() - 6);
    const result = await this.db.payment.aggregate({
      where: {
        companyId,
        receivedAt: { gte: since },
        status: { not: PaymentStatus.REVERSED },
        ...this.branchFilter(principal, 'payment.read'),
      },
      _sum: { amount: true },
    });
    return result._sum.amount?.toString() ?? '0';
  }

  private async sumPostedExpensesByCategory(
    companyId: string,
    principal: AuthenticatedPrincipal,
    categoryCode: string,
  ) {
    const result = await this.db.expense.aggregate({
      where: {
        companyId,
        categoryCode,
        status: { in: [ExpenseStatus.POSTED, ExpenseStatus.PAID, ExpenseStatus.RECONCILED] },
        ...this.branchFilter(principal, 'expense.read'),
      },
      _sum: { amount: true },
    });
    return result._sum.amount?.toString() ?? '0';
  }

  private async sumBrokerageCommissions(companyId: string, principal: AuthenticatedPrincipal) {
    const result = await this.db.brokerageDeal.aggregate({
      where: {
        companyId,
        status: { in: [BrokerageDealStatus.CONFIRMED, BrokerageDealStatus.CLOSED] },
        ...this.branchFilter(principal, 'brokerage-deal.read'),
      },
      _sum: { grossCommission: true },
    });
    return result._sum.grossCommission?.toString() ?? '0';
  }

  private async charts(principal: AuthenticatedPrincipal) {
    const companyId = principal.companyId;
    const months: Array<{ key: string; label: string; start: Date; end: Date }> = [];
    const now = new Date();
    for (let index = 5; index >= 0; index -= 1) {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index + 1, 0));
      months.push({
        key: `${start.getUTCFullYear()}-${start.getUTCMonth() + 1}`,
        label: start.toLocaleString('en-US', { month: 'short' }),
        start,
        end,
      });
    }

    const [collections, billed, expenses] = await Promise.all([
      Promise.all(
        months.map(async (month) => {
          const result = await this.db.payment.aggregate({
            where: {
              companyId,
              receivedAt: { gte: month.start, lte: month.end },
              status: { not: PaymentStatus.REVERSED },
              ...this.branchFilter(principal, 'payment.read'),
            },
            _sum: { amount: true },
          });
          return {
            label: month.label,
            value: Number(result._sum.amount ?? 0),
          };
        }),
      ),
      Promise.all(
        months.map(async (month) => {
          const lines = await this.db.invoiceLine.aggregate({
            where: {
              invoice: {
                companyId,
                issueDate: { gte: month.start, lte: month.end },
                status: { not: InvoiceStatus.VOID },
                ...this.branchFilter(principal, 'invoice.read'),
              },
            },
            _sum: { displayAmount: true },
          });
          return Number(lines._sum.displayAmount ?? 0);
        }),
      ),
      this.db.expense.groupBy({
        by: ['categoryCode'],
        where: {
          companyId,
          status: { in: [ExpenseStatus.POSTED, ExpenseStatus.PAID, ExpenseStatus.RECONCILED] },
          ...this.branchFilter(principal, 'expense.read'),
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      monthlyCollections: collections,
      billedVsCollected: months.map((month, index) => ({
        label: month.label,
        billed: billed[index] ?? 0,
        collected: collections[index]?.value ?? 0,
      })),
      expenseBreakdown: expenses.map((row) => ({
        label: row.categoryCode,
        value: Number(row._sum.amount ?? 0),
      })),
      revenueBySource: [
        {
          label: 'Collections',
          value: collections.reduce((sum, row) => sum + row.value, 0),
        },
        {
          label: 'Brokerage',
          value: Number(await this.sumBrokerageCommissions(companyId, principal)),
        },
      ],
    };
  }
}
