CREATE TYPE "LeadIntent" AS ENUM ('RENT', 'BUY', 'SELL', 'CONSTRUCTION_SERVICE');
CREATE TYPE "LeadStage" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'MATCHING', 'NURTURING', 'CONVERTED', 'LOST');
CREATE TYPE "LeadSourceStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "LeadLostReason" AS ENUM ('DUPLICATE', 'UNREACHABLE', 'NOT_QUALIFIED', 'NO_LONGER_INTERESTED', 'WRONG_INTENT', 'OUT_OF_SCOPE', 'OTHER');
CREATE TYPE "LeadRentPeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');
CREATE TYPE "FurnishedPreference" AS ENUM ('REQUIRED', 'PREFERRED', 'NOT_REQUIRED', 'NO_PREFERENCE');
CREATE TYPE "FinancingReadiness" AS ENUM ('CASH_READY', 'FINANCE_PREAPPROVED', 'FINANCE_NEEDED', 'UNDECIDED');
CREATE TYPE "SellerRelationship" AS ENUM ('OWNER', 'AUTHORIZED_REPRESENTATIVE', 'OTHER_UNVERIFIED');
CREATE TYPE "ConstructionCategory" AS ENUM ('NEW_BUILD', 'EXTENSION', 'RENOVATION', 'OTHER');
CREATE TYPE "SiteControl" AS ENUM ('OWNS_SITE', 'AUTHORIZED_TO_BUILD', 'SEEKING_SITE', 'UNKNOWN');
CREATE TYPE "LeadActivityType" AS ENUM ('CALL', 'EMAIL', 'MESSAGE', 'MEETING', 'NOTE', 'OTHER');
CREATE TYPE "LeadActivityDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'INTERNAL');
CREATE TYPE "LeadActivityRecordKind" AS ENUM ('ORIGINAL', 'CORRECTION', 'VOID');
CREATE TYPE "LeadFollowUpState" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');

CREATE SEQUENCE "lead_record_number_seq" START 1;

CREATE TABLE "lead_sources" (
  "id" UUID PRIMARY KEY,
  "companyId" UUID NOT NULL,
  "code" VARCHAR(50) NOT NULL,
  "label" VARCHAR(120) NOT NULL,
  "description" VARCHAR(500),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "status" "LeadSourceStatus" NOT NULL DEFAULT 'ACTIVE',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ck_lead_source_code" CHECK ("code" ~ '^[A-Z][A-Z0-9_]{0,49}$'),
  CONSTRAINT "ck_lead_source_label" CHECK (btrim("label") <> ''),
  CONSTRAINT "ck_lead_source_version" CHECK ("version" > 0),
  CONSTRAINT "lead_sources_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "lead_sources_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "uq_lead_source_company_code" UNIQUE ("companyId", "code")
);
CREATE UNIQUE INDEX "uq_lead_source_company_code_ci" ON "lead_sources" ("companyId", lower("code"));
CREATE INDEX "lead_source_company_status_sort_idx" ON "lead_sources" ("companyId", "status", "sortOrder", "label", "id");

CREATE TABLE "leads" (
  "id" UUID PRIMARY KEY,
  "companyId" UUID NOT NULL,
  "leadNumber" VARCHAR(40) NOT NULL,
  "intent" "LeadIntent" NOT NULL,
  "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
  "sourceId" UUID NOT NULL,
  "responsibleBranchId" UUID NOT NULL,
  "currentAssigneeEmployeeId" UUID,
  "partyId" UUID,
  "displayName" VARCHAR(240) NOT NULL,
  "phoneEncrypted" TEXT,
  "emailEncrypted" TEXT,
  "phoneSearchToken" CHAR(64),
  "emailSearchToken" CHAR(64),
  "lostReason" "LeadLostReason",
  "lostNotes" VARCHAR(500),
  "outcomeSummary" VARCHAR(1000),
  "externalReference" VARCHAR(160),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ck_lead_number" CHECK ("leadNumber" ~ '^LEAD-[0-9]+$'),
  CONSTRAINT "ck_lead_display_name" CHECK (btrim("displayName") <> ''),
  CONSTRAINT "ck_lead_contactability" CHECK ("partyId" IS NOT NULL OR "phoneEncrypted" IS NOT NULL OR "emailEncrypted" IS NOT NULL),
  CONSTRAINT "ck_lead_phone_token" CHECK ("phoneSearchToken" IS NULL OR "phoneSearchToken" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "ck_lead_email_token" CHECK ("emailSearchToken" IS NULL OR "emailSearchToken" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "ck_lead_version" CHECK ("version" > 0),
  CONSTRAINT "ck_lead_terminal_metadata" CHECK (
    ("stage" = 'LOST' AND "lostReason" IS NOT NULL AND "outcomeSummary" IS NULL)
    OR ("stage" = 'CONVERTED' AND "outcomeSummary" IS NOT NULL AND btrim("outcomeSummary") <> '' AND "lostReason" IS NULL AND "lostNotes" IS NULL)
    OR ("stage" NOT IN ('LOST', 'CONVERTED') AND "lostReason" IS NULL AND "lostNotes" IS NULL AND "outcomeSummary" IS NULL AND "externalReference" IS NULL)
  ),
  CONSTRAINT "ck_lead_other_lost_notes" CHECK ("lostReason" IS DISTINCT FROM 'OTHER' OR ("lostNotes" IS NOT NULL AND btrim("lostNotes") <> '')),
  CONSTRAINT "leads_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "leads_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "lead_sources"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "leads_responsibleBranchId_fkey" FOREIGN KEY ("responsibleBranchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "leads_currentAssigneeEmployeeId_fkey" FOREIGN KEY ("currentAssigneeEmployeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "leads_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "leads_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "uq_lead_company_number" UNIQUE ("companyId", "leadNumber")
);
CREATE INDEX "lead_register_order_idx" ON "leads" ("companyId", "createdAt" DESC, "id" DESC);
CREATE INDEX "lead_branch_stage_register_idx" ON "leads" ("companyId", "responsibleBranchId", "stage", "createdAt" DESC, "id" DESC);
CREATE INDEX "lead_pipeline_order_idx" ON "leads" ("companyId", "stage", "updatedAt" DESC, "id" DESC);
CREATE INDEX "lead_intent_stage_idx" ON "leads" ("companyId", "intent", "stage", "createdAt" DESC, "id" DESC);
CREATE INDEX "lead_source_filter_idx" ON "leads" ("companyId", "sourceId", "createdAt" DESC, "id" DESC);
CREATE INDEX "lead_assignee_pipeline_idx" ON "leads" ("companyId", "currentAssigneeEmployeeId", "stage", "updatedAt" DESC, "id" DESC);
CREATE INDEX "lead_phone_search_idx" ON "leads" ("companyId", "phoneSearchToken");
CREATE INDEX "lead_email_search_idx" ON "leads" ("companyId", "emailSearchToken");

CREATE TABLE "lead_preference_versions" (
  "id" UUID PRIMARY KEY,
  "leadId" UUID NOT NULL,
  "intent" "LeadIntent" NOT NULL,
  "versionNo" INTEGER NOT NULL,
  "preferredAreaText" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "notes" VARCHAR(1000),
  "desiredByDate" DATE,
  "effectiveFrom" TIMESTAMPTZ(6) NOT NULL,
  "effectiveTo" TIMESTAMPTZ(6),
  "actorUserId" UUID NOT NULL,
  "reason" VARCHAR(500),
  "correlationId" UUID,
  CONSTRAINT "ck_lead_preference_version" CHECK ("versionNo" > 0),
  CONSTRAINT "ck_lead_preference_period" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom"),
  CONSTRAINT "ck_lead_preferred_areas" CHECK (cardinality("preferredAreaText") <= 20 AND array_position("preferredAreaText", NULL) IS NULL),
  CONSTRAINT "lead_preference_versions_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "lead_preference_versions_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "uq_lead_preference_version" UNIQUE ("leadId", "versionNo")
);
CREATE UNIQUE INDEX "uq_lead_preference_current" ON "lead_preference_versions" ("leadId") WHERE "effectiveTo" IS NULL;
ALTER TABLE "lead_preference_versions" ADD CONSTRAINT "lead_preference_versions_no_overlap" EXCLUDE USING gist ("leadId" WITH =, tstzrange("effectiveFrom", "effectiveTo", '[)') WITH &&);
CREATE INDEX "lead_preference_timeline_idx" ON "lead_preference_versions" ("leadId", "effectiveFrom" DESC, "id" DESC);

CREATE TABLE "rent_lead_preferences" (
  "preferenceVersionId" UUID PRIMARY KEY,
  "propertyTypeCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "rentableSpaceTypeCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "minRent" DECIMAL(20,4), "maxRent" DECIMAL(20,4), "currency" CHAR(3), "rentPeriod" "LeadRentPeriod",
  "minBedrooms" INTEGER, "maxBedrooms" INTEGER, "minBathrooms" DECIMAL(4,1), "maxBathrooms" DECIMAL(4,1),
  "minArea" DECIMAL(20,6), "maxArea" DECIMAL(20,6), "areaUnit" "AreaUnit", "moveInDate" DATE,
  "furnishedPreference" "FurnishedPreference", "parkingRequired" BOOLEAN, "rentableSpaceId" UUID,
  CONSTRAINT "ck_rent_pref_money" CHECK (("minRent" IS NULL OR "minRent" >= 0) AND ("maxRent" IS NULL OR "maxRent" >= 0) AND ("minRent" IS NULL OR "maxRent" IS NULL OR "minRent" <= "maxRent")),
  CONSTRAINT "ck_rent_pref_money_currency" CHECK (("minRent" IS NULL AND "maxRent" IS NULL) OR "currency" IS NOT NULL),
  CONSTRAINT "ck_rent_pref_bedrooms" CHECK (("minBedrooms" IS NULL OR "minBedrooms" >= 0) AND ("maxBedrooms" IS NULL OR "maxBedrooms" >= 0) AND ("minBedrooms" IS NULL OR "maxBedrooms" IS NULL OR "minBedrooms" <= "maxBedrooms")),
  CONSTRAINT "ck_rent_pref_bathrooms" CHECK (("minBathrooms" IS NULL OR "minBathrooms" >= 0) AND ("maxBathrooms" IS NULL OR "maxBathrooms" >= 0) AND ("minBathrooms" IS NULL OR "maxBathrooms" IS NULL OR "minBathrooms" <= "maxBathrooms")),
  CONSTRAINT "ck_rent_pref_area" CHECK (("minArea" IS NULL OR "minArea" > 0) AND ("maxArea" IS NULL OR "maxArea" > 0) AND ("minArea" IS NULL OR "maxArea" IS NULL OR "minArea" <= "maxArea") AND (("minArea" IS NULL AND "maxArea" IS NULL) OR "areaUnit" IS NOT NULL)),
  CONSTRAINT "rent_lead_preferences_preferenceVersionId_fkey" FOREIGN KEY ("preferenceVersionId") REFERENCES "lead_preference_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "rent_lead_preferences_rentableSpaceId_fkey" FOREIGN KEY ("rentableSpaceId") REFERENCES "rentable_spaces"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE INDEX "rent_lead_preferences_rentableSpaceId_idx" ON "rent_lead_preferences" ("rentableSpaceId");

CREATE TABLE "buy_lead_preferences" (
  "preferenceVersionId" UUID PRIMARY KEY, "propertyTypeCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "minBudget" DECIMAL(20,4), "maxBudget" DECIMAL(20,4), "currency" CHAR(3), "minBedrooms" INTEGER, "maxBedrooms" INTEGER,
  "minBathrooms" DECIMAL(4,1), "maxBathrooms" DECIMAL(4,1), "minArea" DECIMAL(20,6), "maxArea" DECIMAL(20,6),
  "areaUnit" "AreaUnit", "targetPurchaseDate" DATE, "financingReadiness" "FinancingReadiness", "propertyId" UUID,
  CONSTRAINT "ck_buy_pref_money" CHECK (("minBudget" IS NULL OR "minBudget" >= 0) AND ("maxBudget" IS NULL OR "maxBudget" >= 0) AND ("minBudget" IS NULL OR "maxBudget" IS NULL OR "minBudget" <= "maxBudget")),
  CONSTRAINT "ck_buy_pref_money_currency" CHECK (("minBudget" IS NULL AND "maxBudget" IS NULL) OR "currency" IS NOT NULL),
  CONSTRAINT "ck_buy_pref_bedrooms" CHECK (("minBedrooms" IS NULL OR "minBedrooms" >= 0) AND ("maxBedrooms" IS NULL OR "maxBedrooms" >= 0) AND ("minBedrooms" IS NULL OR "maxBedrooms" IS NULL OR "minBedrooms" <= "maxBedrooms")),
  CONSTRAINT "ck_buy_pref_bathrooms" CHECK (("minBathrooms" IS NULL OR "minBathrooms" >= 0) AND ("maxBathrooms" IS NULL OR "maxBathrooms" >= 0) AND ("minBathrooms" IS NULL OR "maxBathrooms" IS NULL OR "minBathrooms" <= "maxBathrooms")),
  CONSTRAINT "ck_buy_pref_area" CHECK (("minArea" IS NULL OR "minArea" > 0) AND ("maxArea" IS NULL OR "maxArea" > 0) AND ("minArea" IS NULL OR "maxArea" IS NULL OR "minArea" <= "maxArea") AND (("minArea" IS NULL AND "maxArea" IS NULL) OR "areaUnit" IS NOT NULL)),
  CONSTRAINT "buy_lead_preferences_preferenceVersionId_fkey" FOREIGN KEY ("preferenceVersionId") REFERENCES "lead_preference_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "buy_lead_preferences_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE INDEX "buy_lead_preferences_propertyId_idx" ON "buy_lead_preferences" ("propertyId");

CREATE TABLE "sell_lead_preferences" (
  "preferenceVersionId" UUID PRIMARY KEY, "propertyId" UUID, "subjectDescription" VARCHAR(500), "subjectLocation" VARCHAR(300),
  "expectedMinPrice" DECIMAL(20,4), "askingPrice" DECIMAL(20,4), "currency" CHAR(3), "desiredSaleDate" DATE,
  "sellerRelationship" "SellerRelationship",
  CONSTRAINT "ck_sell_pref_subject" CHECK ("propertyId" IS NOT NULL OR ("subjectDescription" IS NOT NULL AND btrim("subjectDescription") <> '' AND "subjectLocation" IS NOT NULL AND btrim("subjectLocation") <> '')),
  CONSTRAINT "ck_sell_pref_money" CHECK (("expectedMinPrice" IS NULL OR "expectedMinPrice" >= 0) AND ("askingPrice" IS NULL OR "askingPrice" >= 0) AND ("expectedMinPrice" IS NULL OR "askingPrice" IS NULL OR "expectedMinPrice" <= "askingPrice")),
  CONSTRAINT "ck_sell_pref_money_currency" CHECK (("expectedMinPrice" IS NULL AND "askingPrice" IS NULL) OR "currency" IS NOT NULL),
  CONSTRAINT "sell_lead_preferences_preferenceVersionId_fkey" FOREIGN KEY ("preferenceVersionId") REFERENCES "lead_preference_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "sell_lead_preferences_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE INDEX "sell_lead_preferences_propertyId_idx" ON "sell_lead_preferences" ("propertyId");

CREATE TABLE "construction_service_lead_preferences" (
  "preferenceVersionId" UUID PRIMARY KEY, "projectBrief" VARCHAR(2000) NOT NULL, "propertyId" UUID, "siteLocation" VARCHAR(300),
  "category" "ConstructionCategory" NOT NULL, "estimatedMinBudget" DECIMAL(20,4), "estimatedMaxBudget" DECIMAL(20,4), "currency" CHAR(3),
  "targetStartDate" DATE, "targetCompletionDate" DATE, "plotArea" DECIMAL(20,6), "floorArea" DECIMAL(20,6), "areaUnit" "AreaUnit",
  "bedrooms" INTEGER, "floors" INTEGER, "siteControl" "SiteControl",
  CONSTRAINT "ck_construction_pref_brief" CHECK (btrim("projectBrief") <> ''),
  CONSTRAINT "ck_construction_pref_site" CHECK ("propertyId" IS NOT NULL OR ("siteLocation" IS NOT NULL AND btrim("siteLocation") <> '')),
  CONSTRAINT "ck_construction_pref_money" CHECK (("estimatedMinBudget" IS NULL OR "estimatedMinBudget" >= 0) AND ("estimatedMaxBudget" IS NULL OR "estimatedMaxBudget" >= 0) AND ("estimatedMinBudget" IS NULL OR "estimatedMaxBudget" IS NULL OR "estimatedMinBudget" <= "estimatedMaxBudget")),
  CONSTRAINT "ck_construction_pref_money_currency" CHECK (("estimatedMinBudget" IS NULL AND "estimatedMaxBudget" IS NULL) OR "currency" IS NOT NULL),
  CONSTRAINT "ck_construction_pref_dates" CHECK ("targetStartDate" IS NULL OR "targetCompletionDate" IS NULL OR "targetStartDate" <= "targetCompletionDate"),
  CONSTRAINT "ck_construction_pref_area" CHECK (("plotArea" IS NULL OR "plotArea" > 0) AND ("floorArea" IS NULL OR "floorArea" > 0) AND (("plotArea" IS NULL AND "floorArea" IS NULL) OR "areaUnit" IS NOT NULL)),
  CONSTRAINT "ck_construction_pref_counts" CHECK (("bedrooms" IS NULL OR "bedrooms" >= 0) AND ("floors" IS NULL OR "floors" > 0)),
  CONSTRAINT "construction_service_lead_preferences_preferenceVersionId_fkey" FOREIGN KEY ("preferenceVersionId") REFERENCES "lead_preference_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "construction_service_lead_preferences_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE INDEX "construction_service_lead_preferences_propertyId_idx" ON "construction_service_lead_preferences" ("propertyId");

CREATE TABLE "lead_stage_history" (
  "id" UUID PRIMARY KEY, "leadId" UUID NOT NULL, "fromStage" "LeadStage", "toStage" "LeadStage" NOT NULL, "reason" VARCHAR(500),
  "actorUserId" UUID NOT NULL, "leadVersion" INTEGER NOT NULL, "correlationId" UUID, "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ck_lead_stage_history_version" CHECK ("leadVersion" > 0),
  CONSTRAINT "lead_stage_history_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "lead_stage_history_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "uq_lead_stage_version" UNIQUE ("leadId", "leadVersion")
);
CREATE INDEX "lead_stage_timeline_idx" ON "lead_stage_history" ("leadId", "occurredAt" DESC, "id" DESC);

CREATE TABLE "lead_intent_history" (
  "id" UUID PRIMARY KEY, "leadId" UUID NOT NULL, "fromIntent" "LeadIntent", "toIntent" "LeadIntent" NOT NULL, "reason" VARCHAR(500) NOT NULL,
  "actorUserId" UUID NOT NULL, "leadVersion" INTEGER NOT NULL, "correlationId" UUID, "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ck_lead_intent_history_version" CHECK ("leadVersion" > 0),
  CONSTRAINT "ck_lead_intent_history_reason" CHECK (btrim("reason") <> ''),
  CONSTRAINT "lead_intent_history_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "lead_intent_history_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "uq_lead_intent_version" UNIQUE ("leadId", "leadVersion")
);
CREATE INDEX "lead_intent_timeline_idx" ON "lead_intent_history" ("leadId", "occurredAt" DESC, "id" DESC);

CREATE TABLE "lead_assignments" (
  "id" UUID PRIMARY KEY, "leadId" UUID NOT NULL, "employeeId" UUID NOT NULL, "branchId" UUID NOT NULL,
  "assignedFrom" TIMESTAMPTZ(6) NOT NULL, "assignedTo" TIMESTAMPTZ(6), "actorUserId" UUID NOT NULL,
  "reason" VARCHAR(500) NOT NULL, "correlationId" UUID,
  CONSTRAINT "ck_lead_assignment_period" CHECK ("assignedTo" IS NULL OR "assignedTo" > "assignedFrom"),
  CONSTRAINT "ck_lead_assignment_reason" CHECK (btrim("reason") <> ''),
  CONSTRAINT "lead_assignments_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "lead_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "lead_assignments_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "lead_assignments_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "uq_lead_assignment_start" UNIQUE ("leadId", "assignedFrom")
);
CREATE UNIQUE INDEX "uq_lead_assignment_current" ON "lead_assignments" ("leadId") WHERE "assignedTo" IS NULL;
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_no_overlap" EXCLUDE USING gist ("leadId" WITH =, tstzrange("assignedFrom", "assignedTo", '[)') WITH &&);
CREATE INDEX "lead_assignment_timeline_idx" ON "lead_assignments" ("leadId", "assignedFrom" DESC, "id" DESC);
CREATE INDEX "lead_assignment_employee_idx" ON "lead_assignments" ("employeeId", "assignedTo", "assignedFrom");

CREATE TABLE "lead_branch_history" (
  "id" UUID PRIMARY KEY, "leadId" UUID NOT NULL, "branchId" UUID NOT NULL, "assignedFrom" TIMESTAMPTZ(6) NOT NULL,
  "assignedTo" TIMESTAMPTZ(6), "actorUserId" UUID NOT NULL, "reason" VARCHAR(500) NOT NULL, "correlationId" UUID,
  CONSTRAINT "ck_lead_branch_period" CHECK ("assignedTo" IS NULL OR "assignedTo" > "assignedFrom"),
  CONSTRAINT "ck_lead_branch_reason" CHECK (btrim("reason") <> ''),
  CONSTRAINT "lead_branch_history_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "lead_branch_history_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "lead_branch_history_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "uq_lead_branch_start" UNIQUE ("leadId", "assignedFrom")
);
CREATE UNIQUE INDEX "uq_lead_branch_current" ON "lead_branch_history" ("leadId") WHERE "assignedTo" IS NULL;
ALTER TABLE "lead_branch_history" ADD CONSTRAINT "lead_branch_history_no_overlap" EXCLUDE USING gist ("leadId" WITH =, tstzrange("assignedFrom", "assignedTo", '[)') WITH &&);
CREATE INDEX "lead_branch_timeline_idx" ON "lead_branch_history" ("leadId", "assignedFrom" DESC, "id" DESC);
CREATE INDEX "lead_branch_filter_idx" ON "lead_branch_history" ("branchId", "assignedTo", "assignedFrom");

CREATE TABLE "lead_activities" (
  "id" UUID PRIMARY KEY, "leadId" UUID NOT NULL, "branchId" UUID NOT NULL, "type" "LeadActivityType" NOT NULL,
  "direction" "LeadActivityDirection" NOT NULL, "recordKind" "LeadActivityRecordKind" NOT NULL DEFAULT 'ORIGINAL',
  "summary" VARCHAR(500) NOT NULL, "notes" VARCHAR(2000), "occurredAt" TIMESTAMPTZ(6) NOT NULL,
  "recordedByUserId" UUID NOT NULL, "recordedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "correlationId" UUID, "originalActivityId" UUID, "correctionReason" VARCHAR(500),
  CONSTRAINT "ck_lead_activity_summary" CHECK (btrim("summary") <> ''),
  CONSTRAINT "ck_lead_activity_occurred" CHECK ("occurredAt" <= "recordedAt"),
  CONSTRAINT "ck_lead_activity_correction" CHECK (("recordKind" = 'ORIGINAL' AND "originalActivityId" IS NULL AND "correctionReason" IS NULL) OR ("recordKind" IN ('CORRECTION', 'VOID') AND "originalActivityId" IS NOT NULL AND "correctionReason" IS NOT NULL AND btrim("correctionReason") <> '')),
  CONSTRAINT "ck_lead_activity_not_self" CHECK ("originalActivityId" IS NULL OR "originalActivityId" <> "id"),
  CONSTRAINT "lead_activities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "lead_activities_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "lead_activities_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "lead_activities_originalActivityId_fkey" FOREIGN KEY ("originalActivityId") REFERENCES "lead_activities"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE INDEX "lead_activity_timeline_idx" ON "lead_activities" ("leadId", "occurredAt" DESC, "id" DESC);
CREATE INDEX "lead_activities_originalActivityId_idx" ON "lead_activities" ("originalActivityId");

CREATE TABLE "lead_follow_ups" (
  "id" UUID PRIMARY KEY, "leadId" UUID NOT NULL, "branchId" UUID NOT NULL, "responsibleEmployeeId" UUID NOT NULL,
  "subject" VARCHAR(300) NOT NULL, "notes" VARCHAR(2000), "dueAt" TIMESTAMPTZ(6) NOT NULL,
  "state" "LeadFollowUpState" NOT NULL DEFAULT 'OPEN', "createdByUserId" UUID NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
  "outcomeActorUserId" UUID, "outcomeAt" TIMESTAMPTZ(6), "outcomeReason" VARCHAR(500), "predecessorFollowUpId" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ck_lead_follow_up_subject" CHECK (btrim("subject") <> ''),
  CONSTRAINT "ck_lead_follow_up_version" CHECK ("version" > 0),
  CONSTRAINT "ck_lead_follow_up_outcome" CHECK (("state" = 'OPEN' AND "outcomeActorUserId" IS NULL AND "outcomeAt" IS NULL AND "outcomeReason" IS NULL) OR ("state" IN ('COMPLETED', 'CANCELLED') AND "outcomeActorUserId" IS NOT NULL AND "outcomeAt" IS NOT NULL AND "outcomeReason" IS NOT NULL AND btrim("outcomeReason") <> '')),
  CONSTRAINT "ck_lead_follow_up_not_self" CHECK ("predecessorFollowUpId" IS NULL OR "predecessorFollowUpId" <> "id"),
  CONSTRAINT "lead_follow_ups_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "lead_follow_ups_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "lead_follow_ups_responsibleEmployeeId_fkey" FOREIGN KEY ("responsibleEmployeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "lead_follow_ups_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "lead_follow_ups_outcomeActorUserId_fkey" FOREIGN KEY ("outcomeActorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "lead_follow_ups_predecessorFollowUpId_fkey" FOREIGN KEY ("predecessorFollowUpId") REFERENCES "lead_follow_ups"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE INDEX "lead_follow_up_lead_due_idx" ON "lead_follow_ups" ("leadId", "dueAt", "id");
CREATE INDEX "lead_follow_up_branch_state_due_idx" ON "lead_follow_ups" ("branchId", "state", "dueAt", "id");
CREATE INDEX "lead_follow_up_employee_state_due_idx" ON "lead_follow_ups" ("responsibleEmployeeId", "state", "dueAt", "id");

CREATE TABLE "lead_follow_up_outcomes" (
  "id" UUID PRIMARY KEY, "followUpId" UUID NOT NULL, "fromState" "LeadFollowUpState" NOT NULL, "toState" "LeadFollowUpState" NOT NULL,
  "actorUserId" UUID NOT NULL, "reason" VARCHAR(500) NOT NULL, "followUpVersion" INTEGER NOT NULL,
  "correlationId" UUID, "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ck_lead_follow_up_outcome_transition" CHECK ("fromState" = 'OPEN' AND "toState" IN ('COMPLETED', 'CANCELLED')),
  CONSTRAINT "ck_lead_follow_up_outcome_reason" CHECK (btrim("reason") <> ''),
  CONSTRAINT "ck_lead_follow_up_outcome_version" CHECK ("followUpVersion" > 0),
  CONSTRAINT "lead_follow_up_outcomes_followUpId_fkey" FOREIGN KEY ("followUpId") REFERENCES "lead_follow_ups"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "lead_follow_up_outcomes_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "uq_lead_follow_up_outcome_version" UNIQUE ("followUpId", "followUpVersion")
);
CREATE INDEX "lead_follow_up_outcome_timeline_idx" ON "lead_follow_up_outcomes" ("followUpId", "occurredAt" DESC, "id" DESC);

CREATE OR REPLACE FUNCTION crm_employee_eligible(employee_id UUID, company_id UUID, branch_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM "employees" employee
    WHERE employee."id" = employee_id AND employee."companyId" = company_id AND employee."active"
      AND (
        employee."accessMode" = 'COMPANY_WIDE'
        OR EXISTS (
          SELECT 1 FROM "employee_branch_assignments" assignment
          WHERE assignment."employeeId" = employee_id AND assignment."branchId" = branch_id
            AND assignment."effectiveFrom" <= CURRENT_DATE
            AND (assignment."effectiveTo" IS NULL OR assignment."effectiveTo" > CURRENT_DATE)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION validate_lead_source_write()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Lead Sources cannot be deleted.';
  END IF;
  IF TG_OP = 'UPDATE' AND (OLD."companyId" <> NEW."companyId" OR OLD."code" <> NEW."code" OR OLD."createdByUserId" <> NEW."createdByUserId" OR OLD."createdAt" <> NEW."createdAt") THEN
    RAISE EXCEPTION 'Lead Source identity, Company, code, creator, and creation time are immutable.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_lead_source_write BEFORE UPDATE OR DELETE ON "lead_sources" FOR EACH ROW EXECUTE FUNCTION validate_lead_source_write();

CREATE OR REPLACE FUNCTION validate_lead_write()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source_company UUID; source_status "LeadSourceStatus"; branch_company UUID; party_company UUID; legal_transition BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Leads cannot be deleted; close the Lead as LOST.'; END IF;
  IF TG_OP = 'INSERT' AND NEW."stage" <> 'NEW' THEN RAISE EXCEPTION 'A Lead must start in NEW.'; END IF;
  IF TG_OP = 'UPDATE' AND (OLD."id" <> NEW."id" OR OLD."companyId" <> NEW."companyId" OR OLD."leadNumber" <> NEW."leadNumber" OR OLD."createdByUserId" <> NEW."createdByUserId" OR OLD."createdAt" <> NEW."createdAt") THEN
    RAISE EXCEPTION 'Lead identity, Company, number, creator, and creation time are immutable.';
  END IF;
  SELECT "companyId", "status" INTO source_company, source_status FROM "lead_sources" WHERE "id" = NEW."sourceId";
  IF source_company IS DISTINCT FROM NEW."companyId" THEN RAISE EXCEPTION 'Lead Source must belong to the Lead Company.'; END IF;
  IF (TG_OP = 'INSERT' OR NEW."sourceId" IS DISTINCT FROM OLD."sourceId") AND source_status <> 'ACTIVE' THEN RAISE EXCEPTION 'New Lead attribution requires an active Lead Source.'; END IF;
  SELECT "companyId" INTO branch_company FROM "branches" WHERE "id" = NEW."responsibleBranchId";
  IF branch_company IS DISTINCT FROM NEW."companyId" THEN RAISE EXCEPTION 'Responsible Branch must belong to the Lead Company.'; END IF;
  IF NEW."partyId" IS NOT NULL THEN
    SELECT "companyId" INTO party_company FROM "parties" WHERE "id" = NEW."partyId";
    IF party_company IS DISTINCT FROM NEW."companyId" THEN RAISE EXCEPTION 'Linked Party must belong to the Lead Company.'; END IF;
  END IF;
  IF NEW."currentAssigneeEmployeeId" IS NOT NULL AND NOT crm_employee_eligible(NEW."currentAssigneeEmployeeId", NEW."companyId", NEW."responsibleBranchId") THEN
    RAISE EXCEPTION 'Current assignee must be active, same-Company, and eligible in the responsible Branch.';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."intent" <> NEW."intent" AND OLD."stage" NOT IN ('NEW', 'CONTACTED') THEN RAISE EXCEPTION 'Lead intent can only be corrected in NEW or CONTACTED.'; END IF;
  IF TG_OP = 'UPDATE' AND OLD."stage" <> NEW."stage" THEN
    legal_transition := CASE
      WHEN OLD."stage" = 'NEW' THEN NEW."stage" IN ('CONTACTED', 'LOST')
      WHEN OLD."stage" = 'CONTACTED' THEN NEW."stage" IN ('QUALIFIED', 'LOST')
      WHEN OLD."stage" = 'QUALIFIED' THEN NEW."stage" IN ('MATCHING', 'NURTURING', 'CONVERTED', 'LOST')
      WHEN OLD."stage" = 'MATCHING' THEN NEW."stage" IN ('NURTURING', 'CONVERTED', 'LOST')
      WHEN OLD."stage" = 'NURTURING' THEN NEW."stage" IN ('QUALIFIED', 'MATCHING', 'CONVERTED', 'LOST')
      ELSE FALSE END;
    IF NOT legal_transition THEN RAISE EXCEPTION 'Illegal Lead stage transition from % to %.', OLD."stage", NEW."stage"; END IF;
    IF OLD."stage" = 'NEW' AND NEW."stage" = 'CONTACTED' AND NOT EXISTS (
      SELECT 1 FROM "lead_activities" activity
      WHERE activity."leadId" = NEW."id" AND activity."recordKind" <> 'VOID'
        AND activity."type" IN ('CALL', 'EMAIL', 'MESSAGE', 'MEETING')
    ) THEN RAISE EXCEPTION 'NEW to CONTACTED requires an appended contact Activity.'; END IF;
    IF NEW."stage" = 'MATCHING' AND NEW."intent" NOT IN ('RENT', 'BUY') THEN RAISE EXCEPTION 'Only RENT or BUY Leads may enter MATCHING.'; END IF;
    IF NEW."stage" IN ('QUALIFIED', 'MATCHING', 'NURTURING') AND NEW."currentAssigneeEmployeeId" IS NULL THEN RAISE EXCEPTION 'This Lead stage requires a current assignee.'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_lead_write BEFORE INSERT OR UPDATE OR DELETE ON "leads" FOR EACH ROW EXECUTE FUNCTION validate_lead_write();

CREATE OR REPLACE FUNCTION validate_lead_stage_history_at_commit()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (SELECT 1 FROM "lead_stage_history" h WHERE h."leadId" = NEW."id" AND h."fromStage" IS NULL AND h."toStage" = 'NEW' AND h."leadVersion" = NEW."version") THEN
      RAISE EXCEPTION 'Lead creation requires its append-only NEW stage history.';
    END IF;
  ELSIF OLD."stage" <> NEW."stage" AND NOT EXISTS (
    SELECT 1 FROM "lead_stage_history" h WHERE h."leadId" = NEW."id" AND h."fromStage" = OLD."stage" AND h."toStage" = NEW."stage" AND h."leadVersion" = NEW."version"
  ) THEN RAISE EXCEPTION 'Lead stage transition requires matching append-only history.';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."intent" <> NEW."intent" AND NOT EXISTS (
    SELECT 1 FROM "lead_intent_history" h WHERE h."leadId" = NEW."id" AND h."fromIntent" = OLD."intent" AND h."toIntent" = NEW."intent" AND h."leadVersion" = NEW."version"
  ) THEN RAISE EXCEPTION 'Lead intent correction requires matching append-only history.';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER trg_validate_lead_stage_history AFTER INSERT OR UPDATE ON "leads" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_lead_stage_history_at_commit();

CREATE OR REPLACE FUNCTION validate_lead_aggregate_at_commit()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE lead_id UUID; lead_row "leads"%ROWTYPE; open_branch RECORD; open_assignment RECORD; variant_count INTEGER; variant_intent "LeadIntent";
BEGIN
  IF TG_TABLE_NAME = 'leads' THEN lead_id := NEW."id"; ELSE lead_id := NEW."leadId"; END IF;
  SELECT * INTO lead_row FROM "leads" WHERE "id" = lead_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT count(*), max("intent"::text)::"LeadIntent" INTO variant_count, variant_intent FROM "lead_preference_versions" WHERE "leadId" = lead_id AND "effectiveTo" IS NULL;
  IF variant_count <> 1 OR variant_intent <> lead_row."intent" THEN RAISE EXCEPTION 'Lead requires exactly one current preference matching its intent.'; END IF;
  SELECT "branchId" INTO open_branch FROM "lead_branch_history" WHERE "leadId" = lead_id AND "assignedTo" IS NULL;
  IF NOT FOUND OR open_branch."branchId" <> lead_row."responsibleBranchId" THEN RAISE EXCEPTION 'Lead current Branch snapshot must match exactly one open Branch history interval.'; END IF;
  SELECT "employeeId", "branchId" INTO open_assignment FROM "lead_assignments" WHERE "leadId" = lead_id AND "assignedTo" IS NULL;
  IF lead_row."currentAssigneeEmployeeId" IS NULL THEN
    IF FOUND THEN RAISE EXCEPTION 'Unassigned Lead cannot have an open assignment interval.'; END IF;
  ELSIF NOT FOUND OR open_assignment."employeeId" <> lead_row."currentAssigneeEmployeeId" OR open_assignment."branchId" <> lead_row."responsibleBranchId" THEN
    RAISE EXCEPTION 'Lead current assignee must match exactly one open assignment interval in its Branch.';
  END IF;
  IF lead_row."stage" IN ('CONVERTED', 'LOST') AND EXISTS (SELECT 1 FROM "lead_follow_ups" f WHERE f."leadId" = lead_id AND f."state" = 'OPEN') THEN
    RAISE EXCEPTION 'Terminal Leads cannot retain open Follow-ups.';
  END IF;
  IF lead_row."stage" = 'NURTURING' AND NOT EXISTS (SELECT 1 FROM "lead_follow_ups" f WHERE f."leadId" = lead_id AND f."state" = 'OPEN') THEN
    RAISE EXCEPTION 'NURTURING requires a next open Follow-up.';
  END IF;
  IF lead_row."stage" IN ('QUALIFIED', 'MATCHING', 'NURTURING', 'CONVERTED') AND NOT (
    (lead_row."intent" = 'RENT' AND EXISTS (
      SELECT 1 FROM "lead_preference_versions" version JOIN "rent_lead_preferences" preference ON preference."preferenceVersionId" = version."id"
      WHERE version."leadId" = lead_id AND version."effectiveTo" IS NULL
        AND (cardinality(version."preferredAreaText") > 0 OR preference."rentableSpaceId" IS NOT NULL)
        AND preference."maxRent" IS NOT NULL AND preference."currency" IS NOT NULL
        AND preference."rentPeriod" IS NOT NULL AND preference."moveInDate" IS NOT NULL
    ))
    OR (lead_row."intent" = 'BUY' AND EXISTS (
      SELECT 1 FROM "lead_preference_versions" version JOIN "buy_lead_preferences" preference ON preference."preferenceVersionId" = version."id"
      WHERE version."leadId" = lead_id AND version."effectiveTo" IS NULL
        AND (cardinality(version."preferredAreaText") > 0 OR preference."propertyId" IS NOT NULL)
        AND preference."maxBudget" IS NOT NULL AND preference."currency" IS NOT NULL AND preference."targetPurchaseDate" IS NOT NULL
    ))
    OR (lead_row."intent" = 'SELL' AND EXISTS (
      SELECT 1 FROM "lead_preference_versions" version JOIN "sell_lead_preferences" preference ON preference."preferenceVersionId" = version."id"
      WHERE version."leadId" = lead_id AND version."effectiveTo" IS NULL
        AND (preference."propertyId" IS NOT NULL OR (preference."subjectDescription" IS NOT NULL AND preference."subjectLocation" IS NOT NULL))
        AND preference."askingPrice" IS NOT NULL AND preference."currency" IS NOT NULL
        AND preference."desiredSaleDate" IS NOT NULL AND preference."sellerRelationship" IS NOT NULL
    ))
    OR (lead_row."intent" = 'CONSTRUCTION_SERVICE' AND EXISTS (
      SELECT 1 FROM "lead_preference_versions" version JOIN "construction_service_lead_preferences" preference ON preference."preferenceVersionId" = version."id"
      WHERE version."leadId" = lead_id AND version."effectiveTo" IS NULL
        AND btrim(preference."projectBrief") <> '' AND (preference."propertyId" IS NOT NULL OR preference."siteLocation" IS NOT NULL)
        AND preference."estimatedMaxBudget" IS NOT NULL AND preference."currency" IS NOT NULL AND preference."targetStartDate" IS NOT NULL
    ))
  ) THEN RAISE EXCEPTION 'Lead does not satisfy its typed intent qualification gate.';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER trg_validate_lead_aggregate AFTER INSERT OR UPDATE ON "leads" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_lead_aggregate_at_commit();
CREATE CONSTRAINT TRIGGER trg_validate_lead_branch_aggregate AFTER INSERT OR UPDATE ON "lead_branch_history" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_lead_aggregate_at_commit();
CREATE CONSTRAINT TRIGGER trg_validate_lead_assignment_aggregate AFTER INSERT OR UPDATE ON "lead_assignments" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_lead_aggregate_at_commit();
CREATE CONSTRAINT TRIGGER trg_validate_lead_follow_up_aggregate AFTER INSERT OR UPDATE ON "lead_follow_ups" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_lead_aggregate_at_commit();

CREATE OR REPLACE FUNCTION validate_preference_variant_at_commit()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE preference_id UUID; expected "LeadIntent"; variants INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'lead_preference_versions' THEN preference_id := NEW."id"; ELSE preference_id := NEW."preferenceVersionId"; END IF;
  SELECT "intent" INTO expected FROM "lead_preference_versions" WHERE "id" = preference_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT (EXISTS(SELECT 1 FROM "rent_lead_preferences" WHERE "preferenceVersionId" = preference_id)::int
        + EXISTS(SELECT 1 FROM "buy_lead_preferences" WHERE "preferenceVersionId" = preference_id)::int
        + EXISTS(SELECT 1 FROM "sell_lead_preferences" WHERE "preferenceVersionId" = preference_id)::int
        + EXISTS(SELECT 1 FROM "construction_service_lead_preferences" WHERE "preferenceVersionId" = preference_id)::int) INTO variants;
  IF variants <> 1
     OR (expected = 'RENT' AND NOT EXISTS(SELECT 1 FROM "rent_lead_preferences" WHERE "preferenceVersionId" = preference_id))
     OR (expected = 'BUY' AND NOT EXISTS(SELECT 1 FROM "buy_lead_preferences" WHERE "preferenceVersionId" = preference_id))
     OR (expected = 'SELL' AND NOT EXISTS(SELECT 1 FROM "sell_lead_preferences" WHERE "preferenceVersionId" = preference_id))
     OR (expected = 'CONSTRUCTION_SERVICE' AND NOT EXISTS(SELECT 1 FROM "construction_service_lead_preferences" WHERE "preferenceVersionId" = preference_id))
  THEN RAISE EXCEPTION 'Preference version requires exactly one typed variant matching its intent.'; END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER trg_validate_preference_parent AFTER INSERT OR UPDATE ON "lead_preference_versions" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_preference_variant_at_commit();
CREATE CONSTRAINT TRIGGER trg_validate_rent_preference AFTER INSERT OR UPDATE ON "rent_lead_preferences" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_preference_variant_at_commit();
CREATE CONSTRAINT TRIGGER trg_validate_buy_preference AFTER INSERT OR UPDATE ON "buy_lead_preferences" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_preference_variant_at_commit();
CREATE CONSTRAINT TRIGGER trg_validate_sell_preference AFTER INSERT OR UPDATE ON "sell_lead_preferences" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_preference_variant_at_commit();
CREATE CONSTRAINT TRIGGER trg_validate_construction_preference AFTER INSERT OR UPDATE ON "construction_service_lead_preferences" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_preference_variant_at_commit();

CREATE OR REPLACE FUNCTION validate_preference_reference()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE lead_company UUID; asset_company UUID; space_property UUID;
BEGIN
  SELECT lead."companyId" INTO lead_company
  FROM "lead_preference_versions" version JOIN "leads" lead ON lead."id" = version."leadId"
  WHERE version."id" = NEW."preferenceVersionId";
  IF TG_TABLE_NAME = 'rent_lead_preferences' THEN
    IF NEW."rentableSpaceId" IS NOT NULL THEN
      SELECT property."companyId", space."propertyId" INTO asset_company, space_property
      FROM "rentable_spaces" space JOIN "properties" property ON property."id" = space."propertyId"
      WHERE space."id" = NEW."rentableSpaceId";
    END IF;
  ELSIF TG_TABLE_NAME = 'buy_lead_preferences' THEN
    IF NEW."propertyId" IS NOT NULL THEN SELECT "companyId" INTO asset_company FROM "properties" WHERE "id" = NEW."propertyId"; END IF;
  ELSIF TG_TABLE_NAME = 'sell_lead_preferences' THEN
    IF NEW."propertyId" IS NOT NULL THEN SELECT "companyId" INTO asset_company FROM "properties" WHERE "id" = NEW."propertyId"; END IF;
  ELSIF TG_TABLE_NAME = 'construction_service_lead_preferences' THEN
    IF NEW."propertyId" IS NOT NULL THEN SELECT "companyId" INTO asset_company FROM "properties" WHERE "id" = NEW."propertyId"; END IF;
  END IF;
  IF asset_company IS NOT NULL AND asset_company <> lead_company THEN RAISE EXCEPTION 'Lead preference asset must belong to the Lead Company.'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_rent_preference_reference BEFORE INSERT ON "rent_lead_preferences" FOR EACH ROW EXECUTE FUNCTION validate_preference_reference();
CREATE TRIGGER trg_validate_buy_preference_reference BEFORE INSERT ON "buy_lead_preferences" FOR EACH ROW EXECUTE FUNCTION validate_preference_reference();
CREATE TRIGGER trg_validate_sell_preference_reference BEFORE INSERT ON "sell_lead_preferences" FOR EACH ROW EXECUTE FUNCTION validate_preference_reference();
CREATE TRIGGER trg_validate_construction_preference_reference BEFORE INSERT ON "construction_service_lead_preferences" FOR EACH ROW EXECUTE FUNCTION validate_preference_reference();

CREATE OR REPLACE FUNCTION preserve_crm_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION '% is append-only.', TG_TABLE_NAME; END;
$$;
CREATE TRIGGER trg_preserve_lead_stage_history BEFORE UPDATE OR DELETE ON "lead_stage_history" FOR EACH ROW EXECUTE FUNCTION preserve_crm_append_only();
CREATE TRIGGER trg_preserve_lead_intent_history BEFORE UPDATE OR DELETE ON "lead_intent_history" FOR EACH ROW EXECUTE FUNCTION preserve_crm_append_only();
CREATE TRIGGER trg_preserve_lead_activities BEFORE UPDATE OR DELETE ON "lead_activities" FOR EACH ROW EXECUTE FUNCTION preserve_crm_append_only();
CREATE TRIGGER trg_preserve_rent_preferences BEFORE UPDATE OR DELETE ON "rent_lead_preferences" FOR EACH ROW EXECUTE FUNCTION preserve_crm_append_only();
CREATE TRIGGER trg_preserve_buy_preferences BEFORE UPDATE OR DELETE ON "buy_lead_preferences" FOR EACH ROW EXECUTE FUNCTION preserve_crm_append_only();
CREATE TRIGGER trg_preserve_sell_preferences BEFORE UPDATE OR DELETE ON "sell_lead_preferences" FOR EACH ROW EXECUTE FUNCTION preserve_crm_append_only();
CREATE TRIGGER trg_preserve_construction_preferences BEFORE UPDATE OR DELETE ON "construction_service_lead_preferences" FOR EACH ROW EXECUTE FUNCTION preserve_crm_append_only();
CREATE TRIGGER trg_preserve_lead_follow_up_outcomes BEFORE UPDATE OR DELETE ON "lead_follow_up_outcomes" FOR EACH ROW EXECUTE FUNCTION preserve_crm_append_only();

CREATE OR REPLACE FUNCTION preserve_crm_interval()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION '% is append-only.', TG_TABLE_NAME; END IF;
  IF OLD."effectiveTo" IS NOT NULL OR NEW."effectiveTo" IS NULL OR NEW."effectiveTo" <= OLD."effectiveFrom"
     OR to_jsonb(OLD) - 'effectiveTo' IS DISTINCT FROM to_jsonb(NEW) - 'effectiveTo' THEN
    RAISE EXCEPTION '% intervals may only be closed once.', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_preserve_lead_preference_versions BEFORE UPDATE OR DELETE ON "lead_preference_versions" FOR EACH ROW EXECUTE FUNCTION preserve_crm_interval();

CREATE OR REPLACE FUNCTION preserve_crm_assignment_interval()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION '% is append-only.', TG_TABLE_NAME; END IF;
  IF OLD."assignedTo" IS NOT NULL OR NEW."assignedTo" IS NULL OR NEW."assignedTo" <= OLD."assignedFrom"
     OR to_jsonb(OLD) - 'assignedTo' IS DISTINCT FROM to_jsonb(NEW) - 'assignedTo' THEN
    RAISE EXCEPTION '% intervals may only be closed once.', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_preserve_lead_assignments BEFORE UPDATE OR DELETE ON "lead_assignments" FOR EACH ROW EXECUTE FUNCTION preserve_crm_assignment_interval();
CREATE TRIGGER trg_preserve_lead_branch_history BEFORE UPDATE OR DELETE ON "lead_branch_history" FOR EACH ROW EXECUTE FUNCTION preserve_crm_assignment_interval();

CREATE OR REPLACE FUNCTION validate_lead_history_reference()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE lead_company UUID; branch_company UUID;
BEGIN
  SELECT "companyId" INTO lead_company FROM "leads" WHERE "id" = NEW."leadId";
  IF TG_TABLE_NAME IN ('lead_assignments', 'lead_branch_history') THEN
    SELECT "companyId" INTO branch_company FROM "branches" WHERE "id" = NEW."branchId";
    IF branch_company IS DISTINCT FROM lead_company THEN RAISE EXCEPTION 'Lead history Branch must belong to the Lead Company.'; END IF;
  END IF;
  IF TG_TABLE_NAME = 'lead_assignments' THEN
    IF NOT crm_employee_eligible(NEW."employeeId", lead_company, NEW."branchId") THEN
      RAISE EXCEPTION 'Lead assignee must be active, same-Company, and eligible in the Branch.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_lead_assignment_reference BEFORE INSERT ON "lead_assignments" FOR EACH ROW EXECUTE FUNCTION validate_lead_history_reference();
CREATE TRIGGER trg_validate_lead_branch_reference BEFORE INSERT ON "lead_branch_history" FOR EACH ROW EXECUTE FUNCTION validate_lead_history_reference();

CREATE OR REPLACE FUNCTION validate_lead_activity_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE lead_company UUID; branch_company UUID; original_lead UUID;
BEGIN
  SELECT "companyId" INTO lead_company FROM "leads" WHERE "id" = NEW."leadId";
  SELECT "companyId" INTO branch_company FROM "branches" WHERE "id" = NEW."branchId";
  IF branch_company IS DISTINCT FROM lead_company THEN RAISE EXCEPTION 'Activity Branch must belong to the Lead Company.'; END IF;
  IF NEW."recordKind" <> 'ORIGINAL' THEN
    SELECT "leadId" INTO original_lead FROM "lead_activities" WHERE "id" = NEW."originalActivityId";
    IF original_lead IS DISTINCT FROM NEW."leadId" THEN RAISE EXCEPTION 'Activity correction must reference an Activity on the same Lead.'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_lead_activity_insert BEFORE INSERT ON "lead_activities" FOR EACH ROW EXECUTE FUNCTION validate_lead_activity_insert();

CREATE OR REPLACE FUNCTION validate_lead_follow_up_write()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE lead_company UUID; lead_branch UUID; lead_stage "LeadStage"; predecessor_lead UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Follow-ups cannot be deleted.'; END IF;
  SELECT "companyId", "responsibleBranchId", "stage" INTO lead_company, lead_branch, lead_stage FROM "leads" WHERE "id" = NEW."leadId";
  IF NEW."branchId" <> lead_branch THEN RAISE EXCEPTION 'Follow-up Branch snapshot must match the current responsible Branch.'; END IF;
  IF NOT crm_employee_eligible(NEW."responsibleEmployeeId", lead_company, NEW."branchId") THEN RAISE EXCEPTION 'Follow-up employee must be active, same-Company, and eligible in the Branch.'; END IF;
  IF NEW."predecessorFollowUpId" IS NOT NULL THEN
    SELECT "leadId" INTO predecessor_lead FROM "lead_follow_ups" WHERE "id" = NEW."predecessorFollowUpId";
    IF predecessor_lead IS DISTINCT FROM NEW."leadId" THEN RAISE EXCEPTION 'Follow-up successor must remain on the same Lead.'; END IF;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW."state" <> 'OPEN' THEN RAISE EXCEPTION 'Follow-ups must start OPEN.'; END IF;
    IF lead_stage IN ('CONVERTED', 'LOST') THEN RAISE EXCEPTION 'Terminal Leads cannot receive open Follow-ups.'; END IF;
  ELSE
    IF OLD."leadId" <> NEW."leadId" OR OLD."branchId" <> NEW."branchId" OR OLD."responsibleEmployeeId" <> NEW."responsibleEmployeeId" OR OLD."createdByUserId" <> NEW."createdByUserId" OR OLD."createdAt" <> NEW."createdAt" OR OLD."predecessorFollowUpId" IS DISTINCT FROM NEW."predecessorFollowUpId" THEN
      RAISE EXCEPTION 'Follow-up identity, Lead, Branch, responsibility, creator, and predecessor are immutable.';
    END IF;
    IF OLD."state" <> 'OPEN' THEN RAISE EXCEPTION 'Completed or cancelled Follow-ups cannot be changed or reopened.'; END IF;
    IF NEW."state" NOT IN ('OPEN', 'COMPLETED', 'CANCELLED') THEN RAISE EXCEPTION 'Illegal Follow-up transition.'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_lead_follow_up_write BEFORE INSERT OR UPDATE OR DELETE ON "lead_follow_ups" FOR EACH ROW EXECUTE FUNCTION validate_lead_follow_up_write();

CREATE OR REPLACE FUNCTION validate_follow_up_outcome_at_commit()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."state" = 'OPEN' AND NEW."state" IN ('COMPLETED', 'CANCELLED') AND NOT EXISTS (
    SELECT 1 FROM "lead_follow_up_outcomes" outcome
    WHERE outcome."followUpId" = NEW."id" AND outcome."fromState" = OLD."state"
      AND outcome."toState" = NEW."state" AND outcome."actorUserId" = NEW."outcomeActorUserId"
      AND outcome."reason" = NEW."outcomeReason" AND outcome."followUpVersion" = NEW."version"
  ) THEN RAISE EXCEPTION 'Follow-up completion or cancellation requires matching append-only outcome history.';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER trg_validate_follow_up_outcome AFTER UPDATE ON "lead_follow_ups" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_follow_up_outcome_at_commit();

INSERT INTO "permissions" ("id", "code", "description") VALUES
  (gen_random_uuid(), 'crm.lead.read', 'Read CRM Leads'),
  (gen_random_uuid(), 'crm.lead.create', 'Create CRM Leads'),
  (gen_random_uuid(), 'crm.lead.update', 'Update permitted CRM Lead fields'),
  (gen_random_uuid(), 'crm.lead.stage', 'Perform controlled CRM Lead stage transitions'),
  (gen_random_uuid(), 'crm.activity.read', 'Read CRM Lead Activities'),
  (gen_random_uuid(), 'crm.activity.create', 'Append CRM Lead Activities'),
  (gen_random_uuid(), 'crm.activity.correct', 'Append CRM Activity corrections or voids'),
  (gen_random_uuid(), 'crm.followup.read', 'Read CRM Follow-ups'),
  (gen_random_uuid(), 'crm.followup.create', 'Create CRM Follow-ups'),
  (gen_random_uuid(), 'crm.followup.update', 'Reschedule open CRM Follow-ups'),
  (gen_random_uuid(), 'crm.followup.complete', 'Complete CRM Follow-ups'),
  (gen_random_uuid(), 'crm.followup.cancel', 'Cancel CRM Follow-ups'),
  (gen_random_uuid(), 'crm.assignment.read', 'Read CRM Lead assignment history'),
  (gen_random_uuid(), 'crm.assignment.manage', 'Assign and reassign CRM Leads'),
  (gen_random_uuid(), 'crm.lead.branch.transfer', 'Transfer CRM Lead responsibility between authorized Branches'),
  (gen_random_uuid(), 'crm.source.read', 'Read CRM Lead Sources'),
  (gen_random_uuid(), 'crm.source.manage', 'Manage Company-wide CRM Lead Sources'),
  (gen_random_uuid(), 'crm.lead.contact.read', 'Read sensitive CRM Lead contact fields'),
  (gen_random_uuid(), 'crm.lead.contact.export', 'Export sensitive CRM Lead contact fields')
ON CONFLICT ("code") DO UPDATE SET "description" = EXCLUDED."description";
