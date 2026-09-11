-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CAPTURED', 'VERIFYING', 'VERIFIED', 'POSTED', 'PARTIALLY_ALLOCATED', 'FULLY_ALLOCATED', 'REJECTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "JournalStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('OPEN', 'SOFT_CLOSED', 'CLOSED', 'LOCKED');

-- CreateEnum
CREATE TYPE "FundClass" AS ENUM ('COMPANY_FUNDS', 'OWNER_FUNDS', 'SECURITY_DEPOSIT_FUNDS', 'TENANT_CREDIT_FUNDS');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "NormalBalance" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "ChargeStatus" AS ENUM ('OPEN', 'PARTIALLY_PAID', 'PAID', 'WRITTEN_OFF', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'VOID');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REVIEW', 'APPROVED', 'POSTED', 'PAID', 'RECONCILED', 'REJECTED', 'CANCELLED', 'REVERSED');

-- CreateEnum
CREATE TYPE "ExpenseResponsibility" AS ENUM ('COMPANY', 'OWNER', 'TENANT', 'SHARED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'QUEUED', 'PROCESSING', 'PAID', 'RECONCILED', 'HELD', 'REJECTED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TenantCreditStatus" AS ENUM ('OPEN', 'PARTIALLY_APPLIED', 'FULLY_APPLIED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('ISSUED', 'VOIDED');

-- CreateEnum
CREATE TYPE "CommissionMethod" AS ENUM ('PERCENT_OF_RENT', 'PERCENT_OF_SALE', 'PERCENT_OF_COLLECTION', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "BillingScheduleStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "FiscalYearStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "OwnerStatementStatus" AS ENUM ('DRAFT', 'ISSUED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "BrokerageDealStatus" AS ENUM ('DRAFT', 'NEGOTIATING', 'CONFIRMED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SaleOfferStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'COUNTERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SaleOfferEventType" AS ENUM ('SUBMITTED', 'COUNTER', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED', 'NOTE');

-- CreateEnum
CREATE TYPE "SaleSettlementStatus" AS ENUM ('DRAFT', 'APPROVED', 'SETTLED', 'CANCELLED');

-- CreateTable
CREATE TABLE "service_engagement_commercial_terms" (
    "id" UUID NOT NULL,
    "serviceEngagementId" UUID NOT NULL,
    "managementFeePercent" DECIMAL(9,6),
    "commissionPercent" DECIMAL(9,6),
    "commissionMethod" "CommissionMethod",
    "billingDayOfMonth" INTEGER,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_engagement_commercial_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_schedules" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "serviceEngagementId" UUID NOT NULL,
    "leaseId" UUID,
    "chargeTypeId" UUID NOT NULL,
    "frequency" VARCHAR(20) NOT NULL,
    "billingDayOfMonth" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "amount" DECIMAL(20,4),
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "nextRunOn" DATE,
    "idempotencyKey" VARCHAR(160) NOT NULL,
    "status" "BillingScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastRunAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "billing_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charge_types" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "charge_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charges" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "chargeNumber" VARCHAR(50) NOT NULL,
    "debtorPartyId" UUID NOT NULL,
    "leaseId" UUID,
    "propertyId" UUID,
    "rentableSpaceId" UUID,
    "serviceEngagementId" UUID,
    "chargeTypeId" UUID NOT NULL,
    "billingScheduleId" UUID,
    "businessDate" DATE NOT NULL,
    "periodStart" DATE,
    "periodEnd" DATE,
    "dueDate" DATE NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "originalAmount" DECIMAL(20,4) NOT NULL,
    "outstandingAmount" DECIMAL(20,4) NOT NULL,
    "status" "ChargeStatus" NOT NULL DEFAULT 'OPEN',
    "idempotencyKey" VARCHAR(160),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "invoiceNumber" VARCHAR(50) NOT NULL,
    "debtorPartyId" UUID NOT NULL,
    "issueDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "chargeId" UUID NOT NULL,
    "displayAmount" DECIMAL(20,4) NOT NULL,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charge_adjustments" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "chargeId" UUID NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "reason" TEXT NOT NULL,
    "journalEntryId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "charge_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "paymentNumber" VARCHAR(50) NOT NULL,
    "payerPartyId" UUID NOT NULL,
    "methodId" UUID NOT NULL,
    "receivingAccountId" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "verifiedAmount" DECIMAL(20,4),
    "status" "PaymentStatus" NOT NULL DEFAULT 'CAPTURED',
    "externalRef" VARCHAR(160),
    "externalRefScope" VARCHAR(100),
    "idempotencyKey" VARCHAR(160),
    "receivedAt" TIMESTAMPTZ(6) NOT NULL,
    "postedAt" TIMESTAMPTZ(6),
    "notes" VARCHAR(1000),
    "receivedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "chargeId" UUID NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "allocatedAt" TIMESTAMPTZ(6) NOT NULL,
    "reversedAt" TIMESTAMPTZ(6),

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "receiptNumber" VARCHAR(50) NOT NULL,
    "paymentId" UUID NOT NULL,
    "payerPartyId" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "issuedAt" TIMESTAMPTZ(6) NOT NULL,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'ISSUED',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_credits" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "tenantPartyId" UUID NOT NULL,
    "leaseId" UUID,
    "currency" CHAR(3) NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "status" "TenantCreditStatus" NOT NULL DEFAULT 'OPEN',
    "sourcePaymentId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenant_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "expenseNumber" VARCHAR(50) NOT NULL,
    "vendorPartyId" UUID,
    "propertyId" UUID,
    "rentableSpaceId" UUID,
    "ownerPartyId" UUID,
    "leaseId" UUID,
    "serviceEngagementId" UUID,
    "categoryCode" VARCHAR(50) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "responsibility" "ExpenseResponsibility" NOT NULL,
    "businessDate" DATE NOT NULL,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'DRAFT',
    "approvalRequestId" UUID,
    "journalEntryId" UUID,
    "description" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_statements" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "statementNumber" VARCHAR(50) NOT NULL,
    "ownerPartyId" UUID NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "OwnerStatementStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedAt" TIMESTAMPTZ(6),
    "calculationHash" VARCHAR(128) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "owner_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_statement_lines" (
    "id" UUID NOT NULL,
    "statementId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "journalLineId" UUID,
    "description" VARCHAR(240) NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,

    CONSTRAINT "owner_statement_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_payouts" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "payoutNumber" VARCHAR(50) NOT NULL,
    "ownerPartyId" UUID NOT NULL,
    "propertyId" UUID,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "collectedIncome" DECIMAL(20,4) NOT NULL,
    "expenseDeductions" DECIMAL(20,4) NOT NULL,
    "managementFee" DECIMAL(20,4) NOT NULL,
    "otherDeductions" DECIMAL(20,4) NOT NULL,
    "netPayable" DECIMAL(20,4) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'DRAFT',
    "approvalRequestId" UUID,
    "journalEntryId" UUID,
    "destinationSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "owner_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_payout_lines" (
    "id" UUID NOT NULL,
    "ownerPayoutId" UUID NOT NULL,
    "ownerPartyId" UUID NOT NULL,
    "propertyId" UUID,
    "sharePercent" DECIMAL(9,6) NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,

    CONSTRAINT "owner_payout_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_years" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" VARCHAR(30) NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "status" "FiscalYearStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "fiscal_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_periods" (
    "id" UUID NOT NULL,
    "fiscalYearId" UUID NOT NULL,
    "periodNo" INTEGER NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "accounting_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "accountType" "AccountType" NOT NULL,
    "normalBalance" "NormalBalance" NOT NULL,
    "fundClass" "FundClass",
    "currency" CHAR(3),
    "systemReserved" BOOLEAN NOT NULL DEFAULT false,
    "postingAllowed" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "branchId" UUID,
    "journalNumber" VARCHAR(50) NOT NULL,
    "periodId" UUID NOT NULL,
    "businessDate" DATE NOT NULL,
    "postedAt" TIMESTAMPTZ(6),
    "status" "JournalStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" CHAR(3) NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "reversalOfId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "id" UUID NOT NULL,
    "journalEntryId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "accountId" UUID NOT NULL,
    "signedAmount" DECIMAL(20,4) NOT NULL,
    "reportingAmount" DECIMAL(20,4),
    "exchangeRate" DECIMAL(20,10),
    "branchId" UUID,
    "propertyId" UUID,
    "rentableSpaceId" UUID,
    "ownerPartyId" UUID,
    "tenantPartyId" UUID,
    "leaseId" UUID,
    "vendorPartyId" UUID,
    "serviceEngagementId" UUID,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_source_links" (
    "id" UUID NOT NULL,
    "journalEntryId" UUID NOT NULL,
    "paymentId" UUID,
    "ownerPayoutId" UUID,
    "expenseId" UUID,
    "chargeAdjustmentId" UUID,
    "brokerageDealId" UUID,
    "saleSettlementId" UUID,

    CONSTRAINT "journal_source_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brokerage_deals" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "serviceEngagementId" UUID NOT NULL,
    "leaseId" UUID,
    "rentableSpaceId" UUID NOT NULL,
    "leadId" UUID,
    "viewingId" UUID,
    "rentalApplicationId" UUID,
    "dealNumber" VARCHAR(50) NOT NULL,
    "status" "BrokerageDealStatus" NOT NULL DEFAULT 'DRAFT',
    "rentBasis" DECIMAL(20,4),
    "grossCommission" DECIMAL(20,4) NOT NULL,
    "agentCommission" DECIMAL(20,4),
    "currency" CHAR(3) NOT NULL,
    "closedAt" TIMESTAMPTZ(6),
    "idempotencyKey" VARCHAR(160),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "brokerage_deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_offers" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "serviceEngagementId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "saleListingId" UUID,
    "leadId" UUID,
    "buyerPartyId" UUID,
    "offerNumber" VARCHAR(50) NOT NULL,
    "status" "SaleOfferStatus" NOT NULL DEFAULT 'DRAFT',
    "offerAmount" DECIMAL(20,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "offerDate" DATE NOT NULL,
    "expiresAt" TIMESTAMPTZ(6),
    "termsNotes" VARCHAR(2000),
    "counterOfOfferId" UUID,
    "acceptedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sale_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_offer_events" (
    "id" UUID NOT NULL,
    "saleOfferId" UUID NOT NULL,
    "eventType" "SaleOfferEventType" NOT NULL,
    "fromAmount" DECIMAL(20,4),
    "toAmount" DECIMAL(20,4),
    "actorUserId" UUID,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" VARCHAR(1000),

    CONSTRAINT "sale_offer_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_settlements" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "saleOfferId" UUID NOT NULL,
    "serviceEngagementId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "settlementNumber" VARCHAR(50) NOT NULL,
    "salePrice" DECIMAL(20,4) NOT NULL,
    "grossCommission" DECIMAL(20,4) NOT NULL,
    "sellerProceeds" DECIMAL(20,4) NOT NULL,
    "companyProceeds" DECIMAL(20,4) NOT NULL,
    "approvedDeductions" DECIMAL(20,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "SaleSettlementStatus" NOT NULL DEFAULT 'DRAFT',
    "closingDate" DATE,
    "settledAt" TIMESTAMPTZ(6),
    "idempotencyKey" VARCHAR(160),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sale_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_engagement_commercial_terms_serviceEngagementId_key" ON "service_engagement_commercial_terms"("serviceEngagementId");

-- CreateIndex
CREATE INDEX "commercial_terms_engagement_period_idx" ON "service_engagement_commercial_terms"("serviceEngagementId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "billing_schedules_idempotencyKey_key" ON "billing_schedules"("idempotencyKey");

-- CreateIndex
CREATE INDEX "billing_schedule_run_idx" ON "billing_schedules"("companyId", "branchId", "status", "nextRunOn");

-- CreateIndex
CREATE INDEX "billing_schedule_engagement_period_idx" ON "billing_schedules"("serviceEngagementId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "uq_charge_type_company_code" ON "charge_types"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "charges_idempotencyKey_key" ON "charges"("idempotencyKey");

-- CreateIndex
CREATE INDEX "charge_register_idx" ON "charges"("companyId", "branchId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "charge_debtor_status_due_idx" ON "charges"("debtorPartyId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "charge_lease_status_date_idx" ON "charges"("leaseId", "status", "businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "uq_charge_company_number" ON "charges"("companyId", "chargeNumber");

-- CreateIndex
CREATE INDEX "invoice_register_idx" ON "invoices"("companyId", "branchId", "status", "issueDate");

-- CreateIndex
CREATE INDEX "invoice_debtor_date_idx" ON "invoices"("debtorPartyId", "issueDate");

-- CreateIndex
CREATE UNIQUE INDEX "uq_invoice_company_number" ON "invoices"("companyId", "invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "uq_invoice_line_charge" ON "invoice_lines"("invoiceId", "chargeId");

-- CreateIndex
CREATE INDEX "charge_adjustment_timeline_idx" ON "charge_adjustments"("chargeId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_payment_method_company_code" ON "payment_methods"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payment_register_idx" ON "payments"("companyId", "branchId", "status", "receivedAt");

-- CreateIndex
CREATE INDEX "payment_payer_status_received_idx" ON "payments"("payerPartyId", "status", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "uq_payment_company_number" ON "payments"("companyId", "paymentNumber");

-- CreateIndex
CREATE INDEX "payment_allocation_payment_idx" ON "payment_allocations"("paymentId", "allocatedAt");

-- CreateIndex
CREATE INDEX "payment_allocation_charge_idx" ON "payment_allocations"("chargeId", "allocatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_paymentId_key" ON "receipts"("paymentId");

-- CreateIndex
CREATE INDEX "receipt_register_idx" ON "receipts"("companyId", "branchId", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "uq_receipt_company_number" ON "receipts"("companyId", "receiptNumber");

-- CreateIndex
CREATE INDEX "tenant_credit_register_idx" ON "tenant_credits"("companyId", "branchId", "status");

-- CreateIndex
CREATE INDEX "tenant_credit_party_lease_idx" ON "tenant_credits"("tenantPartyId", "leaseId", "status");

-- CreateIndex
CREATE INDEX "expense_register_idx" ON "expenses"("companyId", "branchId", "status", "businessDate");

-- CreateIndex
CREATE INDEX "expense_property_owner_date_idx" ON "expenses"("propertyId", "ownerPartyId", "businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "uq_expense_company_number" ON "expenses"("companyId", "expenseNumber");

-- CreateIndex
CREATE INDEX "owner_statement_register_idx" ON "owner_statements"("companyId", "branchId", "ownerPartyId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "uq_owner_statement_company_number" ON "owner_statements"("companyId", "statementNumber");

-- CreateIndex
CREATE UNIQUE INDEX "uq_owner_statement_line_no" ON "owner_statement_lines"("statementId", "lineNo");

-- CreateIndex
CREATE INDEX "owner_payout_register_idx" ON "owner_payouts"("companyId", "branchId", "ownerPartyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_owner_payout_company_number" ON "owner_payouts"("companyId", "payoutNumber");

-- CreateIndex
CREATE INDEX "owner_payout_line_payout_idx" ON "owner_payout_lines"("ownerPayoutId");

-- CreateIndex
CREATE UNIQUE INDEX "uq_fiscal_year_company_name" ON "fiscal_years"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "uq_accounting_period_year_no" ON "accounting_periods"("fiscalYearId", "periodNo");

-- CreateIndex
CREATE UNIQUE INDEX "uq_account_company_code" ON "accounts"("companyId", "code");

-- CreateIndex
CREATE INDEX "journal_entry_period_status_date_idx" ON "journal_entries"("companyId", "periodId", "status", "businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "uq_journal_entry_company_number" ON "journal_entries"("companyId", "journalNumber");

-- CreateIndex
CREATE INDEX "journal_line_owner_property_idx" ON "journal_lines"("ownerPartyId", "propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "uq_journal_line_entry_no" ON "journal_lines"("journalEntryId", "lineNo");

-- CreateIndex
CREATE UNIQUE INDEX "journal_source_links_journalEntryId_key" ON "journal_source_links"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "journal_source_links_paymentId_key" ON "journal_source_links"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "journal_source_links_ownerPayoutId_key" ON "journal_source_links"("ownerPayoutId");

-- CreateIndex
CREATE UNIQUE INDEX "journal_source_links_expenseId_key" ON "journal_source_links"("expenseId");

-- CreateIndex
CREATE UNIQUE INDEX "journal_source_links_chargeAdjustmentId_key" ON "journal_source_links"("chargeAdjustmentId");

-- CreateIndex
CREATE UNIQUE INDEX "journal_source_links_brokerageDealId_key" ON "journal_source_links"("brokerageDealId");

-- CreateIndex
CREATE UNIQUE INDEX "journal_source_links_saleSettlementId_key" ON "journal_source_links"("saleSettlementId");

-- CreateIndex
CREATE UNIQUE INDEX "brokerage_deals_idempotencyKey_key" ON "brokerage_deals"("idempotencyKey");

-- CreateIndex
CREATE INDEX "brokerage_deal_register_idx" ON "brokerage_deals"("companyId", "branchId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "brokerage_deal_space_status_idx" ON "brokerage_deals"("rentableSpaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_brokerage_deal_company_number" ON "brokerage_deals"("companyId", "dealNumber");

-- CreateIndex
CREATE INDEX "sale_offer_register_idx" ON "sale_offers"("companyId", "branchId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "sale_offer_property_status_idx" ON "sale_offers"("propertyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_sale_offer_company_number" ON "sale_offers"("companyId", "offerNumber");

-- CreateIndex
CREATE INDEX "sale_offer_event_timeline_idx" ON "sale_offer_events"("saleOfferId", "occurredAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "sale_settlements_saleOfferId_key" ON "sale_settlements"("saleOfferId");

-- CreateIndex
CREATE UNIQUE INDEX "sale_settlements_idempotencyKey_key" ON "sale_settlements"("idempotencyKey");

-- CreateIndex
CREATE INDEX "sale_settlement_register_idx" ON "sale_settlements"("companyId", "branchId", "status", "settledAt");

-- CreateIndex
CREATE UNIQUE INDEX "uq_sale_settlement_company_number" ON "sale_settlements"("companyId", "settlementNumber");

-- AddForeignKey
ALTER TABLE "service_engagement_commercial_terms" ADD CONSTRAINT "service_engagement_commercial_terms_serviceEngagementId_fkey" FOREIGN KEY ("serviceEngagementId") REFERENCES "service_engagements"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "billing_schedules" ADD CONSTRAINT "billing_schedules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "billing_schedules" ADD CONSTRAINT "billing_schedules_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "billing_schedules" ADD CONSTRAINT "billing_schedules_serviceEngagementId_fkey" FOREIGN KEY ("serviceEngagementId") REFERENCES "service_engagements"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "billing_schedules" ADD CONSTRAINT "billing_schedules_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "leases"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "billing_schedules" ADD CONSTRAINT "billing_schedules_chargeTypeId_fkey" FOREIGN KEY ("chargeTypeId") REFERENCES "charge_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "charge_types" ADD CONSTRAINT "charge_types_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_debtorPartyId_fkey" FOREIGN KEY ("debtorPartyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "leases"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_rentableSpaceId_fkey" FOREIGN KEY ("rentableSpaceId") REFERENCES "rentable_spaces"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_serviceEngagementId_fkey" FOREIGN KEY ("serviceEngagementId") REFERENCES "service_engagements"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_chargeTypeId_fkey" FOREIGN KEY ("chargeTypeId") REFERENCES "charge_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_billingScheduleId_fkey" FOREIGN KEY ("billingScheduleId") REFERENCES "billing_schedules"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_debtorPartyId_fkey" FOREIGN KEY ("debtorPartyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "charges"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "charge_adjustments" ADD CONSTRAINT "charge_adjustments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "charge_adjustments" ADD CONSTRAINT "charge_adjustments_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "charge_adjustments" ADD CONSTRAINT "charge_adjustments_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "charges"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "charge_adjustments" ADD CONSTRAINT "charge_adjustments_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_payerPartyId_fkey" FOREIGN KEY ("payerPartyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_receivingAccountId_fkey" FOREIGN KEY ("receivingAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_receivedByUserId_fkey" FOREIGN KEY ("receivedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "charges"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_payerPartyId_fkey" FOREIGN KEY ("payerPartyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tenant_credits" ADD CONSTRAINT "tenant_credits_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tenant_credits" ADD CONSTRAINT "tenant_credits_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tenant_credits" ADD CONSTRAINT "tenant_credits_tenantPartyId_fkey" FOREIGN KEY ("tenantPartyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tenant_credits" ADD CONSTRAINT "tenant_credits_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "leases"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tenant_credits" ADD CONSTRAINT "tenant_credits_sourcePaymentId_fkey" FOREIGN KEY ("sourcePaymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_vendorPartyId_fkey" FOREIGN KEY ("vendorPartyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_rentableSpaceId_fkey" FOREIGN KEY ("rentableSpaceId") REFERENCES "rentable_spaces"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_ownerPartyId_fkey" FOREIGN KEY ("ownerPartyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "leases"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_serviceEngagementId_fkey" FOREIGN KEY ("serviceEngagementId") REFERENCES "service_engagements"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "owner_statements" ADD CONSTRAINT "owner_statements_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "owner_statements" ADD CONSTRAINT "owner_statements_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "owner_statements" ADD CONSTRAINT "owner_statements_ownerPartyId_fkey" FOREIGN KEY ("ownerPartyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "owner_statement_lines" ADD CONSTRAINT "owner_statement_lines_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "owner_statements"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "owner_statement_lines" ADD CONSTRAINT "owner_statement_lines_journalLineId_fkey" FOREIGN KEY ("journalLineId") REFERENCES "journal_lines"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "owner_payouts" ADD CONSTRAINT "owner_payouts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "owner_payouts" ADD CONSTRAINT "owner_payouts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "owner_payouts" ADD CONSTRAINT "owner_payouts_ownerPartyId_fkey" FOREIGN KEY ("ownerPartyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "owner_payouts" ADD CONSTRAINT "owner_payouts_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "owner_payouts" ADD CONSTRAINT "owner_payouts_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "owner_payout_lines" ADD CONSTRAINT "owner_payout_lines_ownerPayoutId_fkey" FOREIGN KEY ("ownerPayoutId") REFERENCES "owner_payouts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "owner_payout_lines" ADD CONSTRAINT "owner_payout_lines_ownerPartyId_fkey" FOREIGN KEY ("ownerPartyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "owner_payout_lines" ADD CONSTRAINT "owner_payout_lines_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "fiscal_years" ADD CONSTRAINT "fiscal_years_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "fiscal_years"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "accounting_periods"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_rentableSpaceId_fkey" FOREIGN KEY ("rentableSpaceId") REFERENCES "rentable_spaces"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_ownerPartyId_fkey" FOREIGN KEY ("ownerPartyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_tenantPartyId_fkey" FOREIGN KEY ("tenantPartyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "leases"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_vendorPartyId_fkey" FOREIGN KEY ("vendorPartyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_serviceEngagementId_fkey" FOREIGN KEY ("serviceEngagementId") REFERENCES "service_engagements"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "journal_source_links" ADD CONSTRAINT "journal_source_links_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "journal_source_links" ADD CONSTRAINT "journal_source_links_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "journal_source_links" ADD CONSTRAINT "journal_source_links_ownerPayoutId_fkey" FOREIGN KEY ("ownerPayoutId") REFERENCES "owner_payouts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "journal_source_links" ADD CONSTRAINT "journal_source_links_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "journal_source_links" ADD CONSTRAINT "journal_source_links_chargeAdjustmentId_fkey" FOREIGN KEY ("chargeAdjustmentId") REFERENCES "charge_adjustments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "journal_source_links" ADD CONSTRAINT "journal_source_links_brokerageDealId_fkey" FOREIGN KEY ("brokerageDealId") REFERENCES "brokerage_deals"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "journal_source_links" ADD CONSTRAINT "journal_source_links_saleSettlementId_fkey" FOREIGN KEY ("saleSettlementId") REFERENCES "sale_settlements"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "brokerage_deals" ADD CONSTRAINT "brokerage_deals_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "brokerage_deals" ADD CONSTRAINT "brokerage_deals_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "brokerage_deals" ADD CONSTRAINT "brokerage_deals_serviceEngagementId_fkey" FOREIGN KEY ("serviceEngagementId") REFERENCES "service_engagements"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "brokerage_deals" ADD CONSTRAINT "brokerage_deals_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "leases"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "brokerage_deals" ADD CONSTRAINT "brokerage_deals_rentableSpaceId_fkey" FOREIGN KEY ("rentableSpaceId") REFERENCES "rentable_spaces"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "brokerage_deals" ADD CONSTRAINT "brokerage_deals_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "brokerage_deals" ADD CONSTRAINT "brokerage_deals_viewingId_fkey" FOREIGN KEY ("viewingId") REFERENCES "viewings"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "brokerage_deals" ADD CONSTRAINT "brokerage_deals_rentalApplicationId_fkey" FOREIGN KEY ("rentalApplicationId") REFERENCES "rental_applications"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sale_offers" ADD CONSTRAINT "sale_offers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sale_offers" ADD CONSTRAINT "sale_offers_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sale_offers" ADD CONSTRAINT "sale_offers_serviceEngagementId_fkey" FOREIGN KEY ("serviceEngagementId") REFERENCES "service_engagements"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sale_offers" ADD CONSTRAINT "sale_offers_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sale_offers" ADD CONSTRAINT "sale_offers_saleListingId_fkey" FOREIGN KEY ("saleListingId") REFERENCES "sale_listings"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sale_offers" ADD CONSTRAINT "sale_offers_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sale_offers" ADD CONSTRAINT "sale_offers_buyerPartyId_fkey" FOREIGN KEY ("buyerPartyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sale_offers" ADD CONSTRAINT "sale_offers_counterOfOfferId_fkey" FOREIGN KEY ("counterOfOfferId") REFERENCES "sale_offers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sale_offer_events" ADD CONSTRAINT "sale_offer_events_saleOfferId_fkey" FOREIGN KEY ("saleOfferId") REFERENCES "sale_offers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sale_offer_events" ADD CONSTRAINT "sale_offer_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sale_settlements" ADD CONSTRAINT "sale_settlements_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sale_settlements" ADD CONSTRAINT "sale_settlements_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sale_settlements" ADD CONSTRAINT "sale_settlements_saleOfferId_fkey" FOREIGN KEY ("saleOfferId") REFERENCES "sale_offers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sale_settlements" ADD CONSTRAINT "sale_settlements_serviceEngagementId_fkey" FOREIGN KEY ("serviceEngagementId") REFERENCES "service_engagements"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sale_settlements" ADD CONSTRAINT "sale_settlements_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- RenameIndex
ALTER INDEX "property_lifecycle_property_status_date_idx" RENAME TO "property_lifecycle_history_propertyId_status_effectiveFrom_idx";

-- RenameIndex
ALTER INDEX "uq_property_lifecycle_effective" RENAME TO "property_lifecycle_history_propertyId_effectiveFrom_key";

-- Finance record number sequences
CREATE SEQUENCE IF NOT EXISTS charge_record_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS invoice_record_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS payment_record_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS receipt_record_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS expense_record_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS payout_record_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS journal_record_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS brokerage_deal_record_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS sale_offer_record_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS sale_settlement_record_number_seq START WITH 1 INCREMENT BY 1;

ALTER TABLE "journal_source_links" ADD CONSTRAINT "journal_source_links_exactly_one_source"
CHECK (
  (
    CASE WHEN "paymentId" IS NOT NULL THEN 1 ELSE 0 END +
    CASE WHEN "ownerPayoutId" IS NOT NULL THEN 1 ELSE 0 END +
    CASE WHEN "expenseId" IS NOT NULL THEN 1 ELSE 0 END +
    CASE WHEN "chargeAdjustmentId" IS NOT NULL THEN 1 ELSE 0 END +
    CASE WHEN "brokerageDealId" IS NOT NULL THEN 1 ELSE 0 END +
    CASE WHEN "saleSettlementId" IS NOT NULL THEN 1 ELSE 0 END
  ) = 1
);
