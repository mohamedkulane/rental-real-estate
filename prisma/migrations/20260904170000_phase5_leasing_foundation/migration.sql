CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'PAUSED', 'UNPUBLISHED', 'CLOSED', 'ARCHIVED');
CREATE TYPE "ViewingStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN');
CREATE TYPE "ScreeningStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'PASSED', 'FAILED', 'WAIVED');
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'CONVERTED');
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "LeaseStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PENDING_SIGNATURE', 'SIGNED', 'ACTIVE', 'ENDED', 'TERMINATED', 'ARCHIVED');
CREATE TYPE "LeasePartyRole" AS ENUM ('TENANT', 'CO_TENANT', 'GUARANTOR', 'LANDLORD');
CREATE TYPE "LeasePossessionStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'ENDED', 'CANCELLED');
CREATE TYPE "RenewalStatus" AS ENUM ('DRAFT', 'PROPOSED', 'APPROVED', 'SIGNED', 'ACTIVATED', 'REJECTED', 'CANCELLED');
CREATE TYPE "MoveInStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

CREATE SEQUENCE "rental_listing_record_number_seq" START 1;
CREATE SEQUENCE "sale_listing_record_number_seq" START 1;
CREATE SEQUENCE "application_record_number_seq" START 1;
CREATE SEQUENCE "reservation_record_number_seq" START 1;
CREATE SEQUENCE "tenant_record_number_seq" START 1;
CREATE SEQUENCE "lease_record_number_seq" START 1;

CREATE TABLE "rental_listings" (
  "id" UUID PRIMARY KEY,
  "companyId" UUID NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT,
  "branchId" UUID NOT NULL REFERENCES "branches"("id") ON DELETE RESTRICT,
  "listingNumber" VARCHAR(40) NOT NULL,
  "rentableSpaceId" UUID NOT NULL REFERENCES "rentable_spaces"("id") ON DELETE RESTRICT,
  "serviceEngagementId" UUID NOT NULL REFERENCES "service_engagements"("id") ON DELETE RESTRICT,
  "title" VARCHAR(200) NOT NULL,
  "description" VARCHAR(2000),
  "askingRent" DECIMAL(20,4),
  "currency" CHAR(3) NOT NULL,
  "availableFrom" DATE,
  "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "publishedAt" TIMESTAMPTZ(6),
  "expiresAt" TIMESTAMPTZ(6),
  "createdByUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rental_listing_positive_rent" CHECK ("askingRent" IS NULL OR "askingRent" >= 0),
  CONSTRAINT "uq_rental_listing_company_number" UNIQUE ("companyId", "listingNumber")
);
CREATE INDEX "rental_listing_register_idx" ON "rental_listings"("companyId", "branchId", "status", "createdAt" DESC, "id" DESC);
CREATE INDEX "rental_listing_space_status_idx" ON "rental_listings"("rentableSpaceId", "status");
CREATE UNIQUE INDEX "uq_rental_listing_open_space" ON "rental_listings"("rentableSpaceId") WHERE "status" IN ('PENDING_REVIEW', 'PUBLISHED', 'PAUSED');

CREATE TABLE "sale_listings" (
  "id" UUID PRIMARY KEY,
  "companyId" UUID NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT,
  "branchId" UUID NOT NULL REFERENCES "branches"("id") ON DELETE RESTRICT,
  "listingNumber" VARCHAR(40) NOT NULL,
  "propertyId" UUID NOT NULL REFERENCES "properties"("id") ON DELETE RESTRICT,
  "serviceEngagementId" UUID NOT NULL REFERENCES "service_engagements"("id") ON DELETE RESTRICT,
  "title" VARCHAR(200) NOT NULL,
  "description" VARCHAR(2000),
  "askingPrice" DECIMAL(20,4),
  "currency" CHAR(3) NOT NULL,
  "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "publishedAt" TIMESTAMPTZ(6),
  "expiresAt" TIMESTAMPTZ(6),
  "createdByUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sale_listing_positive_price" CHECK ("askingPrice" IS NULL OR "askingPrice" >= 0),
  CONSTRAINT "uq_sale_listing_company_number" UNIQUE ("companyId", "listingNumber")
);
CREATE INDEX "sale_listing_register_idx" ON "sale_listings"("companyId", "branchId", "status", "createdAt" DESC, "id" DESC);
CREATE INDEX "sale_listing_property_status_idx" ON "sale_listings"("propertyId", "status");
CREATE UNIQUE INDEX "uq_sale_listing_open_property" ON "sale_listings"("propertyId") WHERE "status" IN ('PENDING_REVIEW', 'PUBLISHED', 'PAUSED');

CREATE TABLE "viewings" (
  "id" UUID PRIMARY KEY,
  "companyId" UUID NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT,
  "branchId" UUID NOT NULL REFERENCES "branches"("id") ON DELETE RESTRICT,
  "leadId" UUID NOT NULL REFERENCES "leads"("id") ON DELETE RESTRICT,
  "rentalListingId" UUID REFERENCES "rental_listings"("id") ON DELETE RESTRICT,
  "saleListingId" UUID REFERENCES "sale_listings"("id") ON DELETE RESTRICT,
  "assignedEmployeeId" UUID NOT NULL REFERENCES "employees"("id") ON DELETE RESTRICT,
  "scheduledAt" TIMESTAMPTZ(6) NOT NULL,
  "status" "ViewingStatus" NOT NULL DEFAULT 'SCHEDULED',
  "notes" VARCHAR(2000),
  "outcome" VARCHAR(1000),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "viewing_exactly_one_listing" CHECK (("rentalListingId" IS NOT NULL)::int + ("saleListingId" IS NOT NULL)::int = 1)
);
CREATE INDEX "viewing_register_idx" ON "viewings"("companyId", "branchId", "status", "scheduledAt", "id");
CREATE INDEX "viewing_lead_timeline_idx" ON "viewings"("leadId", "scheduledAt" DESC, "id" DESC);

CREATE TABLE "rental_applications" (
  "id" UUID PRIMARY KEY,
  "companyId" UUID NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT,
  "branchId" UUID NOT NULL REFERENCES "branches"("id") ON DELETE RESTRICT,
  "applicationNumber" VARCHAR(40) NOT NULL,
  "leadId" UUID NOT NULL REFERENCES "leads"("id") ON DELETE RESTRICT,
  "rentalListingId" UUID NOT NULL REFERENCES "rental_listings"("id") ON DELETE RESTRICT,
  "rentableSpaceId" UUID NOT NULL REFERENCES "rentable_spaces"("id") ON DELETE RESTRICT,
  "applicantPartyId" UUID REFERENCES "parties"("id") ON DELETE RESTRICT,
  "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
  "screeningStatus" "ScreeningStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "screeningSummaryEncrypted" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "submittedAt" TIMESTAMPTZ(6),
  "decidedAt" TIMESTAMPTZ(6),
  "decisionReason" VARCHAR(1000),
  "createdByUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "uq_application_company_number" UNIQUE ("companyId", "applicationNumber"),
  CONSTRAINT "uq_application_lead_listing" UNIQUE ("leadId", "rentalListingId")
);
CREATE INDEX "application_register_idx" ON "rental_applications"("companyId", "branchId", "status", "createdAt" DESC, "id" DESC);

CREATE TABLE "reservations" (
  "id" UUID PRIMARY KEY,
  "companyId" UUID NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT,
  "branchId" UUID NOT NULL REFERENCES "branches"("id") ON DELETE RESTRICT,
  "reservationNumber" VARCHAR(40) NOT NULL,
  "applicationId" UUID NOT NULL REFERENCES "rental_applications"("id") ON DELETE RESTRICT,
  "rentalListingId" UUID NOT NULL REFERENCES "rental_listings"("id") ON DELETE RESTRICT,
  "rentableSpaceId" UUID NOT NULL REFERENCES "rentable_spaces"("id") ON DELETE RESTRICT,
  "startsAt" TIMESTAMPTZ(6) NOT NULL,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
  "version" INTEGER NOT NULL DEFAULT 1,
  "reason" VARCHAR(500),
  "createdByUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reservation_valid_period" CHECK ("expiresAt" > "startsAt"),
  CONSTRAINT "uq_reservation_company_number" UNIQUE ("companyId", "reservationNumber")
);
CREATE INDEX "reservation_register_idx" ON "reservations"("companyId", "branchId", "status", "expiresAt", "id");
CREATE INDEX "reservation_space_period_idx" ON "reservations"("rentableSpaceId", "status", "startsAt", "expiresAt");
ALTER TABLE "reservations" ADD CONSTRAINT "reservation_active_no_overlap" EXCLUDE USING gist ("rentableSpaceId" WITH =, tstzrange("startsAt", "expiresAt", '[)') WITH &&) WHERE ("status" = 'ACTIVE');

CREATE TABLE "tenant_profiles" (
  "partyId" UUID PRIMARY KEY REFERENCES "parties"("id") ON DELETE RESTRICT,
  "companyId" UUID NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT,
  "tenantNumber" VARCHAR(40) NOT NULL,
  "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "uq_tenant_company_number" UNIQUE ("companyId", "tenantNumber")
);
CREATE INDEX "tenant_register_idx" ON "tenant_profiles"("companyId", "status", "createdAt" DESC, "partyId" DESC);

CREATE TABLE "leases" (
  "id" UUID PRIMARY KEY,
  "companyId" UUID NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT,
  "branchId" UUID NOT NULL REFERENCES "branches"("id") ON DELETE RESTRICT,
  "leaseNumber" VARCHAR(40) NOT NULL,
  "rentableSpaceId" UUID NOT NULL REFERENCES "rentable_spaces"("id") ON DELETE RESTRICT,
  "serviceEngagementId" UUID NOT NULL REFERENCES "service_engagements"("id") ON DELETE RESTRICT,
  "status" "LeaseStatus" NOT NULL DEFAULT 'DRAFT',
  "agreementDate" DATE,
  "leaseStartDate" DATE NOT NULL,
  "leaseEndDate" DATE NOT NULL,
  "rentAmount" DECIMAL(20,4) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "predecessorLeaseId" UUID REFERENCES "leases"("id") ON DELETE RESTRICT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lease_valid_period" CHECK ("leaseEndDate" > "leaseStartDate"),
  CONSTRAINT "lease_positive_rent" CHECK ("rentAmount" >= 0),
  CONSTRAINT "uq_lease_company_number" UNIQUE ("companyId", "leaseNumber")
);
CREATE INDEX "lease_register_idx" ON "leases"("companyId", "branchId", "status", "leaseStartDate", "id");
CREATE INDEX "lease_space_period_idx" ON "leases"("rentableSpaceId", "status", "leaseStartDate", "leaseEndDate");

CREATE TABLE "lease_parties" (
  "id" UUID PRIMARY KEY,
  "leaseId" UUID NOT NULL REFERENCES "leases"("id") ON DELETE RESTRICT,
  "partyId" UUID NOT NULL REFERENCES "parties"("id") ON DELETE RESTRICT,
  "role" "LeasePartyRole" NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "uq_lease_party_role" UNIQUE ("leaseId", "partyId", "role")
);
CREATE INDEX "lease_party_lookup_idx" ON "lease_parties"("partyId", "role");

CREATE TABLE "lease_versions" (
  "id" UUID PRIMARY KEY,
  "leaseId" UUID NOT NULL REFERENCES "leases"("id") ON DELETE RESTRICT,
  "sequence" INTEGER NOT NULL,
  "termsSnapshot" JSONB NOT NULL,
  "documentId" UUID REFERENCES "documents"("id") ON DELETE RESTRICT,
  "signatureHash" VARCHAR(128),
  "signedAt" TIMESTAMPTZ(6),
  "createdByUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "uq_lease_version_sequence" UNIQUE ("leaseId", "sequence")
);

CREATE TABLE "lease_possessions" (
  "id" UUID PRIMARY KEY,
  "leaseId" UUID NOT NULL REFERENCES "leases"("id") ON DELETE RESTRICT,
  "rentableSpaceId" UUID NOT NULL REFERENCES "rentable_spaces"("id") ON DELETE RESTRICT,
  "possessionFrom" TIMESTAMPTZ(6) NOT NULL,
  "possessionTo" TIMESTAMPTZ(6),
  "status" "LeasePossessionStatus" NOT NULL DEFAULT 'SCHEDULED',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lease_possession_valid_period" CHECK ("possessionTo" IS NULL OR "possessionTo" > "possessionFrom"),
  CONSTRAINT "uq_lease_possession_start" UNIQUE ("leaseId", "possessionFrom")
);
CREATE INDEX "lease_possession_space_idx" ON "lease_possessions"("rentableSpaceId", "status", "possessionFrom");
ALTER TABLE "lease_possessions" ADD CONSTRAINT "lease_active_possession_no_overlap" EXCLUDE USING gist ("rentableSpaceId" WITH =, tstzrange("possessionFrom", COALESCE("possessionTo", 'infinity'::timestamptz), '[)') WITH &&) WHERE ("status" = 'ACTIVE');

CREATE TABLE "lease_renewals" (
  "id" UUID PRIMARY KEY,
  "originalLeaseId" UUID NOT NULL REFERENCES "leases"("id") ON DELETE RESTRICT,
  "successorLeaseId" UUID REFERENCES "leases"("id") ON DELETE RESTRICT,
  "proposedStartDate" DATE NOT NULL,
  "proposedEndDate" DATE NOT NULL,
  "proposedRent" DECIMAL(20,4) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "status" "RenewalStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "renewal_valid_period" CHECK ("proposedEndDate" > "proposedStartDate"),
  CONSTRAINT "renewal_positive_rent" CHECK ("proposedRent" >= 0)
);
CREATE INDEX "lease_renewal_register_idx" ON "lease_renewals"("originalLeaseId", "status", "createdAt" DESC, "id" DESC);
CREATE UNIQUE INDEX "uq_lease_open_renewal" ON "lease_renewals"("originalLeaseId") WHERE "status" IN ('DRAFT', 'PROPOSED', 'APPROVED', 'SIGNED');

CREATE TABLE "move_ins" (
  "id" UUID PRIMARY KEY,
  "leaseId" UUID NOT NULL UNIQUE REFERENCES "leases"("id") ON DELETE RESTRICT,
  "scheduledDate" DATE NOT NULL,
  "completedDate" DATE,
  "status" "MoveInStatus" NOT NULL DEFAULT 'SCHEDULED',
  "notes" VARCHAR(2000),
  "version" INTEGER NOT NULL DEFAULT 1,
  "recordedByUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "move_in_schedule_idx" ON "move_ins"("status", "scheduledDate", "id");
