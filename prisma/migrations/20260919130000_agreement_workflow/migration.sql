ALTER TYPE "PropertyStatus" ADD VALUE IF NOT EXISTS 'SOLD';

CREATE TYPE "AgreementStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');
CREATE TYPE "AgreementCommissionMethod" AS ENUM ('FIXED', 'PERCENT');

CREATE SEQUENCE IF NOT EXISTS public.rental_agreement_record_number_seq;
CREATE SEQUENCE IF NOT EXISTS public.sale_agreement_record_number_seq;

CREATE TABLE "rental_agreements" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "agreementNumber" VARCHAR(50) NOT NULL,
  "status" "AgreementStatus" NOT NULL DEFAULT 'DRAFT',
  "leadId" UUID NOT NULL,
  "viewingId" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "rentableSpaceId" UUID NOT NULL,
  "serviceEngagementId" UUID NOT NULL,
  "ownerPartyId" UUID NOT NULL,
  "customerPartyId" UUID NOT NULL,
  "originalAskingRent" DECIMAL(20,4) NOT NULL,
  "finalRent" DECIMAL(20,4) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "leaseStartDate" DATE NOT NULL,
  "leaseEndDate" DATE NOT NULL,
  "depositAmount" DECIMAL(20,4),
  "ownerCommissionMethod" "AgreementCommissionMethod",
  "ownerCommissionValue" DECIMAL(20,4),
  "tenantCommissionMethod" "AgreementCommissionMethod",
  "tenantCommissionValue" DECIMAL(20,4),
  "notes" VARCHAR(2000),
  "confirmedAt" TIMESTAMPTZ(6),
  "cancelledAt" TIMESTAMPTZ(6),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rental_agreements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sale_agreements" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "agreementNumber" VARCHAR(50) NOT NULL,
  "status" "AgreementStatus" NOT NULL DEFAULT 'DRAFT',
  "leadId" UUID NOT NULL,
  "viewingId" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "serviceEngagementId" UUID NOT NULL,
  "sellerPartyId" UUID NOT NULL,
  "buyerPartyId" UUID NOT NULL,
  "originalAskingPrice" DECIMAL(20,4) NOT NULL,
  "finalSalePrice" DECIMAL(20,4) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "companyOwned" BOOLEAN NOT NULL DEFAULT false,
  "sellerCommissionMethod" "AgreementCommissionMethod",
  "sellerCommissionValue" DECIMAL(20,4),
  "buyerCommissionMethod" "AgreementCommissionMethod",
  "buyerCommissionValue" DECIMAL(20,4),
  "notes" VARCHAR(2000),
  "confirmedAt" TIMESTAMPTZ(6),
  "cancelledAt" TIMESTAMPTZ(6),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sale_agreements_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "leases" ADD COLUMN "rentalAgreementId" UUID;
ALTER TABLE "brokerage_deals" ADD COLUMN "rentalAgreementId" UUID;
ALTER TABLE "sale_offers" ADD COLUMN "saleAgreementId" UUID;

CREATE UNIQUE INDEX "uq_rental_agreement_company_number" ON "rental_agreements"("companyId", "agreementNumber");
CREATE UNIQUE INDEX "rental_agreements_viewingId_key" ON "rental_agreements"("viewingId");
CREATE INDEX "rental_agreement_register_idx" ON "rental_agreements"("companyId", "branchId", "status", "createdAt" DESC);
CREATE INDEX "rental_agreement_space_status_idx" ON "rental_agreements"("rentableSpaceId", "status");
CREATE UNIQUE INDEX "uq_sale_agreement_company_number" ON "sale_agreements"("companyId", "agreementNumber");
CREATE UNIQUE INDEX "sale_agreements_viewingId_key" ON "sale_agreements"("viewingId");
CREATE INDEX "sale_agreement_register_idx" ON "sale_agreements"("companyId", "branchId", "status", "createdAt" DESC);
CREATE INDEX "sale_agreement_property_status_idx" ON "sale_agreements"("propertyId", "status");
CREATE UNIQUE INDEX "leases_rentalAgreementId_key" ON "leases"("rentalAgreementId");
CREATE UNIQUE INDEX "brokerage_deals_rentalAgreementId_key" ON "brokerage_deals"("rentalAgreementId");
CREATE UNIQUE INDEX "sale_offers_saleAgreementId_key" ON "sale_offers"("saleAgreementId");

ALTER TABLE "rental_agreements" ADD CONSTRAINT "rental_agreements_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "rental_agreements" ADD CONSTRAINT "rental_agreements_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "rental_agreements" ADD CONSTRAINT "rental_agreements_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "rental_agreements" ADD CONSTRAINT "rental_agreements_viewingId_fkey" FOREIGN KEY ("viewingId") REFERENCES "viewings"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "rental_agreements" ADD CONSTRAINT "rental_agreements_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "rental_agreements" ADD CONSTRAINT "rental_agreements_rentableSpaceId_fkey" FOREIGN KEY ("rentableSpaceId") REFERENCES "rentable_spaces"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "rental_agreements" ADD CONSTRAINT "rental_agreements_serviceEngagementId_fkey" FOREIGN KEY ("serviceEngagementId") REFERENCES "service_engagements"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "rental_agreements" ADD CONSTRAINT "rental_agreements_ownerPartyId_fkey" FOREIGN KEY ("ownerPartyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "rental_agreements" ADD CONSTRAINT "rental_agreements_customerPartyId_fkey" FOREIGN KEY ("customerPartyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "rental_agreements" ADD CONSTRAINT "rental_agreements_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "sale_agreements" ADD CONSTRAINT "sale_agreements_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "sale_agreements" ADD CONSTRAINT "sale_agreements_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "sale_agreements" ADD CONSTRAINT "sale_agreements_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "sale_agreements" ADD CONSTRAINT "sale_agreements_viewingId_fkey" FOREIGN KEY ("viewingId") REFERENCES "viewings"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "sale_agreements" ADD CONSTRAINT "sale_agreements_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "sale_agreements" ADD CONSTRAINT "sale_agreements_serviceEngagementId_fkey" FOREIGN KEY ("serviceEngagementId") REFERENCES "service_engagements"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "sale_agreements" ADD CONSTRAINT "sale_agreements_sellerPartyId_fkey" FOREIGN KEY ("sellerPartyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "sale_agreements" ADD CONSTRAINT "sale_agreements_buyerPartyId_fkey" FOREIGN KEY ("buyerPartyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "sale_agreements" ADD CONSTRAINT "sale_agreements_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "leases" ADD CONSTRAINT "leases_rentalAgreementId_fkey" FOREIGN KEY ("rentalAgreementId") REFERENCES "rental_agreements"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "brokerage_deals" ADD CONSTRAINT "brokerage_deals_rentalAgreementId_fkey" FOREIGN KEY ("rentalAgreementId") REFERENCES "rental_agreements"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "sale_offers" ADD CONSTRAINT "sale_offers_saleAgreementId_fkey" FOREIGN KEY ("saleAgreementId") REFERENCES "sale_agreements"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
