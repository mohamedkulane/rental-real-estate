CREATE TYPE "ServiceModel" AS ENUM (
  'RENTAL_BROKERAGE',
  'SALE_BROKERAGE',
  'TENANT_PLACEMENT',
  'FULL_MANAGEMENT',
  'RENT_COLLECTION_ONLY',
  'MASTER_LEASE_SUBLEASE',
  'COMPANY_OWNED'
);

CREATE TYPE "ServiceEngagementStatus" AS ENUM (
  'DRAFT',
  'ACTIVE',
  'INACTIVE',
  'EXPIRED',
  'CANCELLED'
);

ALTER TABLE "companies" ADD COLUMN "legalPartyId" UUID;

WITH company_parties AS (
  INSERT INTO "parties" (
    "id", "companyId", "partyNumber", "kind", "displayName", "active", "createdAt", "updatedAt"
  )
  SELECT
    gen_random_uuid(),
    c."id",
    'PTY-COMP-' || substring(md5(c."id"::text), 1, 12),
    'ORGANIZATION'::"PartyKind",
    COALESCE(c."legalName", c."name"),
    TRUE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  FROM "companies" c
  RETURNING "id", "companyId", "displayName"
)
INSERT INTO "organization_profiles" ("partyId", "legalName")
SELECT "id", "displayName" FROM company_parties;

INSERT INTO "owner_profiles" (
  "partyId", "ownerNumber", "status", "verifiedAt", "createdAt", "updatedAt"
)
SELECT
  p."id",
  'OWN-COMP-' || substring(md5(p."companyId"::text), 1, 12),
  'ACTIVE'::"OwnerStatus",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "parties" p
WHERE p."partyNumber" = 'PTY-COMP-' || substring(md5(p."companyId"::text), 1, 12);

UPDATE "companies" c
SET "legalPartyId" = p."id"
FROM "parties" p
WHERE p."companyId" = c."id"
  AND p."partyNumber" = 'PTY-COMP-' || substring(md5(c."id"::text), 1, 12);

ALTER TABLE "companies"
  ADD CONSTRAINT "companies_legalPartyId_key" UNIQUE ("legalPartyId"),
  ADD CONSTRAINT "companies_legalPartyId_fkey"
    FOREIGN KEY ("legalPartyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE SEQUENCE "service_engagement_record_number_seq" START 1;

CREATE TABLE "service_engagements" (
  "id" UUID PRIMARY KEY,
  "companyId" UUID NOT NULL,
  "engagementNumber" VARCHAR(40) NOT NULL,
  "serviceModel" "ServiceModel" NOT NULL,
  "status" "ServiceEngagementStatus" NOT NULL DEFAULT 'DRAFT',
  "propertyId" UUID NOT NULL,
  "rentableSpaceId" UUID,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "notes" TEXT,
  "createdByUserId" UUID NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ck_service_engagement_period"
    CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom"),
  CONSTRAINT "ck_service_engagement_version" CHECK ("version" > 0),
  CONSTRAINT "service_engagements_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "service_engagements_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "service_engagements_rentableSpaceId_fkey"
    FOREIGN KEY ("rentableSpaceId") REFERENCES "rentable_spaces"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "service_engagements_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "uq_service_engagement_company_number" UNIQUE ("companyId", "engagementNumber")
);

CREATE INDEX "service_engagement_company_status_model_created_idx"
  ON "service_engagements" ("companyId", "status", "serviceModel", "createdAt" DESC, "id" DESC);
CREATE INDEX "service_engagement_property_period_idx"
  ON "service_engagements" ("propertyId", "effectiveFrom", "effectiveTo");
CREATE INDEX "service_engagement_space_period_idx"
  ON "service_engagements" ("rentableSpaceId", "effectiveFrom", "effectiveTo");

CREATE TABLE "service_engagement_history" (
  "id" UUID PRIMARY KEY,
  "serviceEngagementId" UUID NOT NULL,
  "fromStatus" "ServiceEngagementStatus",
  "toStatus" "ServiceEngagementStatus" NOT NULL,
  "action" VARCHAR(40) NOT NULL,
  "reason" VARCHAR(500),
  "actorUserId" UUID NOT NULL,
  "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_engagement_history_serviceEngagementId_fkey"
    FOREIGN KEY ("serviceEngagementId") REFERENCES "service_engagements"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "service_engagement_history_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);

CREATE INDEX "service_engagement_history_timeline_idx"
  ON "service_engagement_history" ("serviceEngagementId", "occurredAt" DESC, "id" DESC);

CREATE OR REPLACE FUNCTION service_engagement_models_compatible(
  left_model "ServiceModel",
  right_model "ServiceModel"
) RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN left_model = right_model THEN FALSE
    WHEN left_model = 'SALE_BROKERAGE' AND right_model IN (
      'RENTAL_BROKERAGE', 'TENANT_PLACEMENT', 'FULL_MANAGEMENT',
      'RENT_COLLECTION_ONLY', 'MASTER_LEASE_SUBLEASE'
    ) THEN TRUE
    WHEN right_model = 'SALE_BROKERAGE' AND left_model IN (
      'RENTAL_BROKERAGE', 'TENANT_PLACEMENT', 'FULL_MANAGEMENT',
      'RENT_COLLECTION_ONLY', 'MASTER_LEASE_SUBLEASE'
    ) THEN TRUE
    ELSE FALSE
  END;
$$;

CREATE OR REPLACE FUNCTION validate_service_engagement()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  property_company_id UUID;
  space_property_id UUID;
  company_party_id UUID;
BEGIN
  SELECT "companyId" INTO property_company_id
  FROM "properties" WHERE "id" = NEW."propertyId";

  IF property_company_id IS NULL OR property_company_id <> NEW."companyId" THEN
    RAISE EXCEPTION 'Service Engagement Property must belong to the same Company.';
  END IF;

  IF NEW."rentableSpaceId" IS NOT NULL THEN
    SELECT "propertyId" INTO space_property_id
    FROM "rentable_spaces" WHERE "id" = NEW."rentableSpaceId";
    IF space_property_id IS NULL OR space_property_id <> NEW."propertyId" THEN
      RAISE EXCEPTION 'Service Engagement Rentable Space must belong to its Property.';
    END IF;
  END IF;

  IF NEW."serviceModel" IN ('SALE_BROKERAGE', 'COMPANY_OWNED')
     AND NEW."rentableSpaceId" IS NOT NULL THEN
    RAISE EXCEPTION 'Sale Brokerage and Company Owned engagements must use Property scope.';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."status" <> 'DRAFT' AND (
    OLD."companyId" <> NEW."companyId"
    OR OLD."propertyId" <> NEW."propertyId"
    OR OLD."rentableSpaceId" IS DISTINCT FROM NEW."rentableSpaceId"
    OR OLD."serviceModel" <> NEW."serviceModel"
    OR OLD."effectiveFrom" <> NEW."effectiveFrom"
  ) THEN
    RAISE EXCEPTION 'Activated Service Engagement scope and commercial policy are immutable.';
  END IF;

  IF NEW."status" = 'ACTIVE' THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended(
        'service-engagement:' || NEW."companyId"::text || ':' || NEW."propertyId"::text || ':' ||
        COALESCE(NEW."rentableSpaceId"::text, 'PROPERTY'),
        0
      )
    );

    IF EXISTS (
      SELECT 1
      FROM "service_engagements" existing
      WHERE existing."id" <> NEW."id"
        AND existing."companyId" = NEW."companyId"
        AND existing."propertyId" = NEW."propertyId"
        AND existing."rentableSpaceId" IS NOT DISTINCT FROM NEW."rentableSpaceId"
        AND existing."status" = 'ACTIVE'
        AND daterange(existing."effectiveFrom", existing."effectiveTo", '[)') &&
            daterange(NEW."effectiveFrom", NEW."effectiveTo", '[)')
        AND NOT service_engagement_models_compatible(existing."serviceModel", NEW."serviceModel")
    ) THEN
      RAISE EXCEPTION 'An incompatible active Service Engagement overlaps this scope and period.';
    END IF;

    IF NEW."serviceModel" = 'COMPANY_OWNED' THEN
      SELECT "legalPartyId" INTO company_party_id
      FROM "companies" WHERE "id" = NEW."companyId";
      IF company_party_id IS NULL OR NOT EXISTS (
        SELECT 1
        FROM "property_ownerships" ownership
        WHERE ownership."propertyId" = NEW."propertyId"
          AND ownership."ownerPartyId" = company_party_id
          AND daterange(ownership."effectiveFrom", ownership."effectiveTo", '[)') @>
              daterange(NEW."effectiveFrom", NEW."effectiveTo", '[)')
      ) THEN
        RAISE EXCEPTION 'Company Owned engagement requires effective Property ownership by the Company Party.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_service_engagement
  BEFORE INSERT OR UPDATE ON "service_engagements"
  FOR EACH ROW EXECUTE FUNCTION validate_service_engagement();

CREATE OR REPLACE FUNCTION preserve_service_engagement_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Service Engagement history is append-only.';
END;
$$;

CREATE TRIGGER trg_preserve_service_engagement_history
  BEFORE UPDATE OR DELETE ON "service_engagement_history"
  FOR EACH ROW EXECUTE FUNCTION preserve_service_engagement_history();

INSERT INTO "permissions" ("id", "code", "description") VALUES
  (gen_random_uuid(), 'service-engagement.read', 'Read Service Engagements'),
  (gen_random_uuid(), 'service-engagement.create', 'Create Service Engagement drafts'),
  (gen_random_uuid(), 'service-engagement.update', 'Update permitted Service Engagement fields'),
  (gen_random_uuid(), 'service-engagement.activate', 'Activate Service Engagements'),
  (gen_random_uuid(), 'service-engagement.deactivate', 'Deactivate Service Engagements'),
  (gen_random_uuid(), 'service-engagement.cancel', 'Cancel Service Engagements'),
  (gen_random_uuid(), 'service-engagement.capability.read', 'Resolve effective commercial capabilities')
ON CONFLICT ("code") DO UPDATE SET "description" = EXCLUDED."description";
