import { Module } from '@nestjs/common';
import { Phase3Module } from './phase3.module';
import { Phase5Module } from './phase5.module';
import { AccountingService } from './finance/accounting.service';
import { BillingService } from './finance/billing.service';
import { BrokerageDealService } from './finance/brokerage-deal.service';
import { ExpenseService } from './finance/expense.service';
import { FinancePolicyService } from './finance/finance.policy';
import {
  BillingScheduleController,
  BrokerageDealController,
  ChargeController,
  ExpenseController,
  FinanceOverviewController,
  InvoiceController,
  JournalController,
  OwnerPayoutController,
  OwnerStatementController,
  PaymentController,
  SaleOfferController,
  SaleSettlementController,
} from './finance/finance.controller';
import { OwnerPayoutService } from './finance/owner-payout.service';
import { PaymentService } from './finance/payment.service';
import { SaleOfferService } from './finance/sale-offer.service';
import { SaleSettlementService } from './finance/sale-settlement.service';
import { FinanceOverviewService } from './finance/finance-overview.service';

@Module({
  imports: [Phase3Module, Phase5Module],
  controllers: [
    BillingScheduleController,
    ChargeController,
    InvoiceController,
    PaymentController,
    ExpenseController,
    OwnerPayoutController,
    JournalController,
    FinanceOverviewController,
    OwnerStatementController,
    BrokerageDealController,
    SaleOfferController,
    SaleSettlementController,
  ],
  providers: [
    FinancePolicyService,
    BillingService,
    PaymentService,
    ExpenseService,
    OwnerPayoutService,
    AccountingService,
    BrokerageDealService,
    SaleOfferService,
    SaleSettlementService,
    FinanceOverviewService,
  ],
  exports: [
    FinancePolicyService,
    BillingService,
    PaymentService,
    ExpenseService,
    OwnerPayoutService,
    AccountingService,
    BrokerageDealService,
    SaleOfferService,
    SaleSettlementService,
    FinanceOverviewService,
  ],
})
export class Phase6Module {}
