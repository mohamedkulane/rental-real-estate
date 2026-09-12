CREATE TYPE "ConstructionEconomicModel" AS ENUM ('CONSTRUCTION_FOR_CLIENT', 'COMPANY_DEVELOPMENT');
CREATE TYPE "ConstructionProjectStatus" AS ENUM ('DRAFT', 'PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ConstructionContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ConstructionBudgetCategory" AS ENUM ('MATERIALS', 'LABOR', 'EQUIPMENT', 'SUBCONTRACTORS', 'PERMITS', 'PROFESSIONAL_SERVICES', 'TRANSPORT', 'CONTINGENCY', 'OTHER');
CREATE TYPE "ConstructionMilestoneStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'CANCELLED');
CREATE TYPE "ConstructionWorkPackageStatus" AS ENUM ('PLANNED', 'SCHEDULED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ConstructionWorkPackagePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "ConstructionBillingBasis" AS ENUM ('MILESTONE', 'INSTALLMENT', 'PROGRESS', 'MANUAL');
CREATE TYPE "ConstructionBillingStatus" AS ENUM ('DRAFT', 'APPROVED', 'INVOICED', 'CANCELLED');
CREATE TYPE "DevelopmentProjectStatus" AS ENUM ('PLANNING', 'APPROVED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED');
CREATE TYPE "DevelopmentType" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'MIXED_USE', 'LAND_SUBDIVISION', 'OTHER');
CREATE TYPE "DevelopmentBlockStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "DevelopmentPlotStatus" AS ENUM ('PLANNED', 'AVAILABLE', 'UNDER_CONSTRUCTION', 'COMPLETED', 'SALE_READY', 'RESERVED', 'SOLD', 'CANCELLED');
CREATE TYPE "DevelopmentCostCategory" AS ENUM ('LAND', 'CONSTRUCTION', 'INFRASTRUCTURE', 'PROFESSIONAL_FEES', 'OTHER');

CREATE SEQUENCE IF NOT EXISTS construction_project_record_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS construction_contract_record_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS development_project_record_number_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE "development_projects" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "projectNumber" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "sourcePropertyId" UUID NOT NULL,
    "projectManagerEmployeeId" UUID,
    "status" "DevelopmentProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "developmentType" "DevelopmentType" NOT NULL,
    "plannedStart" DATE,
    "plannedCompletion" DATE,
    "actualCompletion" DATE,
    "totalArea" DECIMAL(20,6),
    "areaUnit" VARCHAR(20),
    "budgetAmount" DECIMAL(20,4),
    "currency" CHAR(3) NOT NULL,
    "notes" VARCHAR(2000),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "development_projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "construction_projects" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "projectNumber" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "economicModel" "ConstructionEconomicModel" NOT NULL,
    "status" "ConstructionProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "clientPartyId" UUID,
    "propertyId" UUID,
    "leadId" UUID,
    "developmentProjectId" UUID,
    "projectManagerEmployeeId" UUID,
    "startDate" DATE,
    "expectedEndDate" DATE,
    "actualCompletionDate" DATE,
    "scope" VARCHAR(4000),
    "notes" VARCHAR(2000),
    "contractValue" DECIMAL(20,4),
    "currency" CHAR(3) NOT NULL,
    "plannedPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "actualPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "construction_projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "construction_contracts" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "contractNumber" VARCHAR(50) NOT NULL,
    "constructionProjectId" UUID NOT NULL,
    "clientPartyId" UUID NOT NULL,
    "status" "ConstructionContractStatus" NOT NULL DEFAULT 'DRAFT',
    "contractValue" DECIMAL(20,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "paymentTermsSummary" VARCHAR(1000) NOT NULL,
    "retentionPercent" DECIMAL(5,2),
    "effectiveDate" DATE NOT NULL,
    "completionTarget" DATE,
    "scope" VARCHAR(4000),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "construction_contracts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "construction_payment_terms" (
    "id" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "label" VARCHAR(160) NOT NULL,
    "percent" DECIMAL(5,2),
    "amount" DECIMAL(20,4),
    "dueDate" DATE,
    "notes" VARCHAR(500),
    CONSTRAINT "construction_payment_terms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "construction_budget_lines" (
    "id" UUID NOT NULL,
    "constructionProjectId" UUID NOT NULL,
    "category" "ConstructionBudgetCategory" NOT NULL,
    "label" VARCHAR(160) NOT NULL,
    "budgetAmount" DECIMAL(20,4) NOT NULL,
    "committedAmount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "actualAmount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "notes" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "construction_budget_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "construction_milestones" (
    "id" UUID NOT NULL,
    "constructionProjectId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(2000),
    "sequence" INTEGER NOT NULL,
    "plannedStart" DATE,
    "plannedEnd" DATE,
    "actualStart" DATE,
    "actualEnd" DATE,
    "percentComplete" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "status" "ConstructionMilestoneStatus" NOT NULL DEFAULT 'PLANNED',
    "assigneeEmployeeId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "construction_milestones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "construction_work_packages" (
    "id" UUID NOT NULL,
    "constructionProjectId" UUID NOT NULL,
    "milestoneId" UUID,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(2000),
    "assigneeEmployeeId" UUID,
    "vendorPartyId" UUID,
    "priority" "ConstructionWorkPackagePriority" NOT NULL DEFAULT 'MEDIUM',
    "scheduledStart" DATE,
    "scheduledEnd" DATE,
    "actualStart" DATE,
    "actualEnd" DATE,
    "status" "ConstructionWorkPackageStatus" NOT NULL DEFAULT 'PLANNED',
    "estimatedCost" DECIMAL(20,4),
    "actualCost" DECIMAL(20,4),
    "notes" VARCHAR(2000),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "construction_work_packages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "construction_work_package_dependencies" (
    "id" UUID NOT NULL,
    "workPackageId" UUID NOT NULL,
    "dependsOnId" UUID NOT NULL,
    CONSTRAINT "construction_work_package_dependencies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "construction_progress_entries" (
    "id" UUID NOT NULL,
    "constructionProjectId" UUID NOT NULL,
    "plannedPercent" DECIMAL(5,2) NOT NULL,
    "actualPercent" DECIMAL(5,2) NOT NULL,
    "notes" VARCHAR(1000),
    "recordedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "construction_progress_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "construction_costs" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "constructionProjectId" UUID NOT NULL,
    "milestoneId" UUID,
    "workPackageId" UUID,
    "expenseId" UUID NOT NULL,
    "vendorPartyId" UUID,
    "category" "ConstructionBudgetCategory" NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "businessDate" DATE NOT NULL,
    "idempotencyKey" VARCHAR(180) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "construction_costs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "construction_billing_events" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "constructionProjectId" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "milestoneId" UUID,
    "installmentSequence" INTEGER,
    "basis" "ConstructionBillingBasis" NOT NULL,
    "status" "ConstructionBillingStatus" NOT NULL DEFAULT 'DRAFT',
    "amount" DECIMAL(20,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "dueDate" DATE NOT NULL,
    "chargeId" UUID,
    "invoiceId" UUID,
    "idempotencyKey" VARCHAR(180) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "construction_billing_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "development_blocks" (
    "id" UUID NOT NULL,
    "developmentProjectId" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "area" DECIMAL(20,6),
    "purpose" VARCHAR(200),
    "status" "DevelopmentBlockStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" VARCHAR(1000),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "development_blocks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "development_plots" (
    "id" UUID NOT NULL,
    "developmentProjectId" UUID NOT NULL,
    "blockId" UUID,
    "plotNumber" VARCHAR(40) NOT NULL,
    "plannedArea" DECIMAL(20,6),
    "useType" VARCHAR(80),
    "status" "DevelopmentPlotStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" VARCHAR(1000),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "development_plots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "development_budget_lines" (
    "id" UUID NOT NULL,
    "developmentProjectId" UUID NOT NULL,
    "category" "DevelopmentCostCategory" NOT NULL,
    "label" VARCHAR(160) NOT NULL,
    "budgetAmount" DECIMAL(20,4) NOT NULL,
    "actualAmount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "notes" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "development_budget_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "development_costs" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "developmentProjectId" UUID NOT NULL,
    "expenseId" UUID NOT NULL,
    "vendorPartyId" UUID,
    "category" "DevelopmentCostCategory" NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "businessDate" DATE NOT NULL,
    "allocationNotes" VARCHAR(500),
    "idempotencyKey" VARCHAR(180) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "development_costs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "development_output_assets" (
    "id" UUID NOT NULL,
    "developmentProjectId" UUID NOT NULL,
    "plotId" UUID,
    "propertyId" UUID NOT NULL,
    "saleListingId" UUID,
    "saleReady" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "development_output_assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_construction_project_company_number" ON "construction_projects"("companyId", "projectNumber");
CREATE INDEX "construction_project_register_idx" ON "construction_projects"("companyId", "branchId", "status");
CREATE INDEX "construction_project_client_idx" ON "construction_projects"("clientPartyId", "status");
CREATE UNIQUE INDEX "construction_projects_developmentProjectId_key" ON "construction_projects"("developmentProjectId");

CREATE UNIQUE INDEX "uq_construction_contract_company_number" ON "construction_contracts"("companyId", "contractNumber");
CREATE INDEX "construction_contract_project_idx" ON "construction_contracts"("constructionProjectId", "status");
CREATE UNIQUE INDEX "uq_construction_payment_term_sequence" ON "construction_payment_terms"("contractId", "sequence");
CREATE INDEX "construction_budget_project_idx" ON "construction_budget_lines"("constructionProjectId", "category");
CREATE INDEX "construction_milestone_project_seq_idx" ON "construction_milestones"("constructionProjectId", "sequence");
CREATE INDEX "construction_work_package_project_idx" ON "construction_work_packages"("constructionProjectId", "status");
CREATE UNIQUE INDEX "uq_construction_work_package_dependency" ON "construction_work_package_dependencies"("workPackageId", "dependsOnId");
CREATE INDEX "construction_progress_project_idx" ON "construction_progress_entries"("constructionProjectId", "recordedAt" DESC);
CREATE UNIQUE INDEX "construction_costs_expenseId_key" ON "construction_costs"("expenseId");
CREATE UNIQUE INDEX "construction_costs_idempotencyKey_key" ON "construction_costs"("idempotencyKey");
CREATE INDEX "construction_cost_project_date_idx" ON "construction_costs"("constructionProjectId", "businessDate");
CREATE UNIQUE INDEX "construction_billing_events_chargeId_key" ON "construction_billing_events"("chargeId");
CREATE UNIQUE INDEX "construction_billing_events_idempotencyKey_key" ON "construction_billing_events"("idempotencyKey");
CREATE INDEX "construction_billing_project_idx" ON "construction_billing_events"("constructionProjectId", "status");

CREATE UNIQUE INDEX "uq_development_project_company_number" ON "development_projects"("companyId", "projectNumber");
CREATE INDEX "development_project_register_idx" ON "development_projects"("companyId", "branchId", "status");
CREATE UNIQUE INDEX "uq_development_block_project_code" ON "development_blocks"("developmentProjectId", "code");
CREATE UNIQUE INDEX "uq_development_plot_project_number" ON "development_plots"("developmentProjectId", "plotNumber");
CREATE INDEX "development_plot_project_status_idx" ON "development_plots"("developmentProjectId", "status");
CREATE INDEX "development_budget_project_idx" ON "development_budget_lines"("developmentProjectId", "category");
CREATE UNIQUE INDEX "development_costs_expenseId_key" ON "development_costs"("expenseId");
CREATE UNIQUE INDEX "development_costs_idempotencyKey_key" ON "development_costs"("idempotencyKey");
CREATE INDEX "development_cost_project_date_idx" ON "development_costs"("developmentProjectId", "businessDate");
CREATE UNIQUE INDEX "development_output_assets_plotId_key" ON "development_output_assets"("plotId");
CREATE UNIQUE INDEX "development_output_assets_propertyId_key" ON "development_output_assets"("propertyId");
CREATE UNIQUE INDEX "development_output_assets_saleListingId_key" ON "development_output_assets"("saleListingId");
CREATE INDEX "development_output_project_idx" ON "development_output_assets"("developmentProjectId", "saleReady");

ALTER TABLE "development_projects" ADD CONSTRAINT "development_projects_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "development_projects" ADD CONSTRAINT "development_projects_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "development_projects" ADD CONSTRAINT "development_projects_sourcePropertyId_fkey" FOREIGN KEY ("sourcePropertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "development_projects" ADD CONSTRAINT "development_projects_projectManagerEmployeeId_fkey" FOREIGN KEY ("projectManagerEmployeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "construction_projects" ADD CONSTRAINT "construction_projects_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "construction_projects" ADD CONSTRAINT "construction_projects_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "construction_projects" ADD CONSTRAINT "construction_projects_clientPartyId_fkey" FOREIGN KEY ("clientPartyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "construction_projects" ADD CONSTRAINT "construction_projects_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "construction_projects" ADD CONSTRAINT "construction_projects_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "construction_projects" ADD CONSTRAINT "construction_projects_developmentProjectId_fkey" FOREIGN KEY ("developmentProjectId") REFERENCES "development_projects"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "construction_projects" ADD CONSTRAINT "construction_projects_projectManagerEmployeeId_fkey" FOREIGN KEY ("projectManagerEmployeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "construction_contracts" ADD CONSTRAINT "construction_contracts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "construction_contracts" ADD CONSTRAINT "construction_contracts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "construction_contracts" ADD CONSTRAINT "construction_contracts_constructionProjectId_fkey" FOREIGN KEY ("constructionProjectId") REFERENCES "construction_projects"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "construction_contracts" ADD CONSTRAINT "construction_contracts_clientPartyId_fkey" FOREIGN KEY ("clientPartyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "construction_payment_terms" ADD CONSTRAINT "construction_payment_terms_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "construction_contracts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "construction_budget_lines" ADD CONSTRAINT "construction_budget_lines_constructionProjectId_fkey" FOREIGN KEY ("constructionProjectId") REFERENCES "construction_projects"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "construction_milestones" ADD CONSTRAINT "construction_milestones_constructionProjectId_fkey" FOREIGN KEY ("constructionProjectId") REFERENCES "construction_projects"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "construction_milestones" ADD CONSTRAINT "construction_milestones_assigneeEmployeeId_fkey" FOREIGN KEY ("assigneeEmployeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "construction_work_packages" ADD CONSTRAINT "construction_work_packages_constructionProjectId_fkey" FOREIGN KEY ("constructionProjectId") REFERENCES "construction_projects"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "construction_work_packages" ADD CONSTRAINT "construction_work_packages_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "construction_milestones"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "construction_work_packages" ADD CONSTRAINT "construction_work_packages_assigneeEmployeeId_fkey" FOREIGN KEY ("assigneeEmployeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "construction_work_packages" ADD CONSTRAINT "construction_work_packages_vendorPartyId_fkey" FOREIGN KEY ("vendorPartyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "construction_work_package_dependencies" ADD CONSTRAINT "construction_work_package_dependencies_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "construction_work_packages"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "construction_work_package_dependencies" ADD CONSTRAINT "construction_work_package_dependencies_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "construction_work_packages"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "construction_progress_entries" ADD CONSTRAINT "construction_progress_entries_constructionProjectId_fkey" FOREIGN KEY ("constructionProjectId") REFERENCES "construction_projects"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "construction_costs" ADD CONSTRAINT "construction_costs_constructionProjectId_fkey" FOREIGN KEY ("constructionProjectId") REFERENCES "construction_projects"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "construction_costs" ADD CONSTRAINT "construction_costs_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "construction_milestones"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "construction_costs" ADD CONSTRAINT "construction_costs_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "construction_work_packages"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "construction_costs" ADD CONSTRAINT "construction_costs_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "construction_costs" ADD CONSTRAINT "construction_costs_vendorPartyId_fkey" FOREIGN KEY ("vendorPartyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "construction_billing_events" ADD CONSTRAINT "construction_billing_events_constructionProjectId_fkey" FOREIGN KEY ("constructionProjectId") REFERENCES "construction_projects"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "construction_billing_events" ADD CONSTRAINT "construction_billing_events_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "construction_contracts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "construction_billing_events" ADD CONSTRAINT "construction_billing_events_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "construction_milestones"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "construction_billing_events" ADD CONSTRAINT "construction_billing_events_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "charges"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "construction_billing_events" ADD CONSTRAINT "construction_billing_events_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "development_blocks" ADD CONSTRAINT "development_blocks_developmentProjectId_fkey" FOREIGN KEY ("developmentProjectId") REFERENCES "development_projects"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "development_plots" ADD CONSTRAINT "development_plots_developmentProjectId_fkey" FOREIGN KEY ("developmentProjectId") REFERENCES "development_projects"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "development_plots" ADD CONSTRAINT "development_plots_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "development_blocks"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "development_budget_lines" ADD CONSTRAINT "development_budget_lines_developmentProjectId_fkey" FOREIGN KEY ("developmentProjectId") REFERENCES "development_projects"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "development_costs" ADD CONSTRAINT "development_costs_developmentProjectId_fkey" FOREIGN KEY ("developmentProjectId") REFERENCES "development_projects"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "development_costs" ADD CONSTRAINT "development_costs_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "development_costs" ADD CONSTRAINT "development_costs_vendorPartyId_fkey" FOREIGN KEY ("vendorPartyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "development_output_assets" ADD CONSTRAINT "development_output_assets_developmentProjectId_fkey" FOREIGN KEY ("developmentProjectId") REFERENCES "development_projects"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "development_output_assets" ADD CONSTRAINT "development_output_assets_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "development_plots"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "development_output_assets" ADD CONSTRAINT "development_output_assets_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "development_output_assets" ADD CONSTRAINT "development_output_assets_saleListingId_fkey" FOREIGN KEY ("saleListingId") REFERENCES "sale_listings"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
