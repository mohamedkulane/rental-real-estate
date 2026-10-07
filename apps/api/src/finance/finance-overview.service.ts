import { Injectable } from '@nestjs/common';
import {
  ChargeStatus,
  ExpenseStatus,
  InvoiceStatus,
  JournalStatus,
  PaymentStatus,
  PayoutStatus,
  Prisma,
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
    const [
      openInvoices,
      unallocatedPayments,
      pendingOwnerPayouts,
      openExpenses,
      draftJournals,
      recentInvoices,
      recentPayments,
    ] = await Promise.all([
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
          status: {
            in: [
              PaymentStatus.CAPTURED,
              PaymentStatus.VERIFIED,
              PaymentStatus.POSTED,
              PaymentStatus.PARTIALLY_ALLOCATED,
            ],
          },
          ...this.branchFilter(principal, 'payment.read'),
        },
      }),
      this.db.ownerPayout.count({
        where: {
          companyId,
          status: {
            in: [
              PayoutStatus.DRAFT,
              PayoutStatus.REVIEW,
              PayoutStatus.APPROVED,
              PayoutStatus.QUEUED,
            ],
          },
          ...this.branchFilter(principal, 'payout.read'),
        },
      }),
      this.db.expense.count({
        where: {
          companyId,
          status: {
            in: [
              ExpenseStatus.DRAFT,
              ExpenseStatus.SUBMITTED,
              ExpenseStatus.REVIEW,
              ExpenseStatus.APPROVED,
            ],
          },
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
        select: {
          id: true,
          paymentNumber: true,
          receivedAt: true,
          status: true,
          currency: true,
          amount: true,
        },
      }),
    ]);

    const [
      brokerage,
      rentCollected,
      managementFees,
      ownerPayouts,
      ownerPayoutsDue,
      expensesTotal,
      activeManagedLeases,
    ] = await Promise.all([
      this.brokerageSummary(companyId, principal),
      this.sumAllocatedByChargeTypes(companyId, principal, ['RENT']),
      this.sumManagementFees(companyId, principal),
      this.sumOwnerPayouts(companyId, principal),
      this.sumOwnerPayoutsDue(companyId, principal),
      this.sumExpensesThisMonth(companyId, principal),
      this.db.lease.count({
        where: {
          companyId,
          status: 'ACTIVE',
          serviceEngagement: { serviceModel: 'FULL_MANAGEMENT', status: 'ACTIVE' },
          ...this.branchFilter(principal, 'lease.read'),
        },
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
        rentCollected,
        brokerageCommissionEarned: brokerage.earned,
        brokerageCashReceived: brokerage.received,
        brokerageOutstanding: brokerage.outstanding,
        managementFeesTotal: managementFees,
        ownerPayoutsTotal: ownerPayouts,
        ownerPayoutsDue,
        expensesTotal,
        activeManagedLeases,
        brokerageCommissionsTotal: brokerage.earned,
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
    since.setUTCDate(1);
    since.setUTCHours(0, 0, 0, 0);
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

  private async sumAllocatedByChargeTypes(
    companyId: string,
    principal: AuthenticatedPrincipal,
    chargeTypeCodes: string[],
  ) {
    const result = await this.db.paymentAllocation.aggregate({
      where: {
        reversedAt: null,
        charge: {
          companyId,
          chargeType: { code: { in: chargeTypeCodes } },
          ...this.branchFilter(principal, 'billing.read'),
        },
      },
      _sum: { amount: true },
    });
    return result._sum.amount?.toString() ?? '0';
  }

  private async brokerageSummary(companyId: string, principal: AuthenticatedPrincipal) {
    const where: Prisma.ChargeWhereInput = {
      companyId,
      commissionSide: { not: null },
      status: { notIn: [ChargeStatus.CANCELLED, ChargeStatus.WRITTEN_OFF] },
      ...this.branchFilter(principal, 'billing.read'),
    };
    const [totals, received] = await Promise.all([
      this.db.charge.aggregate({
        where,
        _sum: { originalAmount: true, outstandingAmount: true },
      }),
      this.sumAllocatedByChargeTypes(companyId, principal, [
        'OWNER_COMMISSION',
        'TENANT_COMMISSION',
      ]),
    ]);
    return {
      earned: totals._sum.originalAmount?.toString() ?? '0',
      received,
      outstanding: totals._sum.outstandingAmount?.toString() ?? '0',
    };
  }

  private async sumManagementFees(companyId: string, principal: AuthenticatedPrincipal) {
    const result = await this.db.ownerPayout.aggregate({
      where: {
        companyId,
        status: { notIn: [PayoutStatus.CANCELLED, PayoutStatus.REJECTED, PayoutStatus.FAILED] },
        ...this.branchFilter(principal, 'payout.read'),
      },
      _sum: { managementFee: true },
    });
    return result._sum.managementFee?.toString() ?? '0';
  }

  private async sumOwnerPayouts(companyId: string, principal: AuthenticatedPrincipal) {
    const result = await this.db.ownerPayout.aggregate({
      where: {
        companyId,
        status: { in: [PayoutStatus.PAID, PayoutStatus.RECONCILED] },
        ...this.branchFilter(principal, 'payout.read'),
      },
      _sum: { netPayable: true },
    });
    return result._sum.netPayable?.toString() ?? '0';
  }

  private async sumOwnerPayoutsDue(companyId: string, principal: AuthenticatedPrincipal) {
    const result = await this.db.ownerPayout.aggregate({
      where: {
        companyId,
        status: {
          in: [PayoutStatus.DRAFT, PayoutStatus.REVIEW, PayoutStatus.APPROVED, PayoutStatus.QUEUED],
        },
        ...this.branchFilter(principal, 'payout.read'),
      },
      _sum: { netPayable: true },
    });
    return result._sum.netPayable?.toString() ?? '0';
  }

  private async sumExpensesThisMonth(companyId: string, principal: AuthenticatedPrincipal) {
    const since = new Date();
    since.setUTCDate(1);
    since.setUTCHours(0, 0, 0, 0);
    const result = await this.db.expense.aggregate({
      where: {
        companyId,
        businessDate: { gte: since },
        status: {
          in: [
            ExpenseStatus.APPROVED,
            ExpenseStatus.POSTED,
            ExpenseStatus.PAID,
            ExpenseStatus.RECONCILED,
          ],
        },
        ...this.branchFilter(principal, 'expense.read'),
      },
      _sum: { amount: true },
    });
    return result._sum.amount?.toString() ?? '0';
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

    const [collections, billed, expenses, paymentMethods, sourceAmounts] = await Promise.all([
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
      this.db.payment.groupBy({
        by: ['methodId'],
        where: {
          companyId,
          status: { not: PaymentStatus.REVERSED },
          ...this.branchFilter(principal, 'payment.read'),
        },
        _sum: { amount: true },
      }),
      Promise.all([
        this.sumAllocatedByChargeTypes(companyId, principal, ['RENT']),
        this.sumAllocatedByChargeTypes(companyId, principal, ['OWNER_COMMISSION']),
        this.sumAllocatedByChargeTypes(companyId, principal, ['TENANT_COMMISSION']),
      ]),
    ]);

    const methodRows = await this.db.paymentMethod.findMany({
      where: { id: { in: paymentMethods.map((row) => row.methodId) }, companyId },
      select: { id: true, name: true },
    });
    const methodName = new Map(methodRows.map((row) => [row.id, row.name]));

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
        { label: 'Rent', value: Number(sourceAmounts[0]) },
        { label: 'Owner commission', value: Number(sourceAmounts[1]) },
        { label: 'Tenant commission', value: Number(sourceAmounts[2]) },
      ],
      receivedByMethod: paymentMethods.map((row) => ({
        label: methodName.get(row.methodId) ?? 'Payment method',
        value: Number(row._sum.amount ?? 0),
      })),
    };
  }
}
