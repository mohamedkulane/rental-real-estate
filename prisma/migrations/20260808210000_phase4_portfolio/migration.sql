CREATE TYPE "OwnerStatus" AS ENUM ('PROSPECTIVE', 'ACTIVE', 'SUSPENDED', 'INACTIVE');
CREATE TYPE "PropertyType" AS ENUM ('HOUSE', 'VILLA', 'APARTMENT_BUILDING', 'COMMERCIAL_BUILDING', 'COMPOUND', 'WAREHOUSE_PROPERTY', 'LAND', 'MIXED_USE', 'OTHER');
CREATE TYPE "PropertyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'RETIRED');
CREATE TYPE "BuildingStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'RETIRED');
CREATE TYPE "RentableSpaceStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');
CREATE TYPE "AreaUnit" AS ENUM ('SQM', 'SQFT', 'HECTARE', 'ACRE');

ALTER TABLE "parties"
  ADD COLUMN "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "person_profiles" (
  "partyId" UUID PRIMARY KEY REFERENCES "parties"("id") ON DELETE RESTRICT,
  "givenName" VARCHAR(120) NOT NULL,
  "familyName" VARCHAR(120) NOT NULL,
  "preferredName" VARCHAR(120),
  "birthDate" DATE,
  "nationalityCode" CHAR(2),
  "identificationMetadata" JSONB
);

CREATE TABLE "organization_profiles" (
  "partyId" UUID PRIMARY KEY REFERENCES "parties"("id") ON DELETE RESTRICT,
  "legalName" VARCHAR(240) NOT NULL,
  "tradingName" VARCHAR(240),
  "registrationNumber" VARCHAR(100),
  "contactPersonName" VARCHAR(200)
);

CREATE TABLE "owner_profiles" (
  "partyId" UUID PRIMARY KEY REFERENCES "parties"("id") ON DELETE RESTRICT,
  "ownerNumber" VARCHAR(40) NOT NULL UNIQUE,
  "status" "OwnerStatus" NOT NULL DEFAULT 'PROSPECTIVE',
  "communicationPreference" VARCHAR(30),
  "notes" TEXT,
  "verifiedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "contact_points" (
  "id" UUID PRIMARY KEY,
  "partyId" UUID NOT NULL REFERENCES "parties"("id") ON DELETE RESTRICT,
  "type" VARCHAR(30) NOT NULL,
  "valueEncrypted" TEXT NOT NULL,
  "normalizedHash" VARCHAR(128),
  "primary" BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX "contact_points_normalizedHash_idx" ON "contact_points"("normalizedHash");

CREATE TABLE "addresses" (
  "id" UUID PRIMARY KEY,
  "partyId" UUID NOT NULL REFERENCES "parties"("id") ON DELETE RESTRICT,
  "type" VARCHAR(30) NOT NULL,
  "line1" VARCHAR(200) NOT NULL,
  "city" VARCHAR(100),
  "countryCode" CHAR(2) NOT NULL
);

CREATE TABLE "party_relationships" (
  "id" UUID PRIMARY KEY,
  "sourcePartyId" UUID NOT NULL REFERENCES "parties"("id") ON DELETE RESTRICT,
  "targetPartyId" UUID NOT NULL REFERENCES "parties"("id") ON DELETE RESTRICT,
  "type" VARCHAR(50) NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  CONSTRAINT "ck_party_relationship_interval" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom"),
  CONSTRAINT "ck_party_relationship_distinct" CHECK ("sourcePartyId" <> "targetPartyId")
);
CREATE INDEX "party_relationships_sourcePartyId_type_idx" ON "party_relationships"("sourcePartyId", "type");

CREATE TABLE "properties" (
  "id" UUID PRIMARY KEY,
  "companyId" UUID NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT,
  "propertyCode" VARCHAR(40) NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "propertyType" "PropertyType" NOT NULL,
  "status" "PropertyStatus" NOT NULL DEFAULT 'DRAFT',
  "description" TEXT,
  "addressLine1" VARCHAR(200),
  "city" VARCHAR(100) NOT NULL,
  "district" VARCHAR(100),
  "neighborhood" VARCHAR(100),
  "landmark" VARCHAR(200),
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "plotArea" DECIMAL(20,6),
  "plotAreaUnit" "AreaUnit",
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "uq_properties_company_code" UNIQUE ("companyId", "propertyCode"),
  CONSTRAINT "ck_property_plot_area" CHECK ("plotArea" IS NULL OR "plotArea" > 0),
  CONSTRAINT "ck_property_latitude" CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90),
  CONSTRAINT "ck_property_longitude" CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180),
  CONSTRAINT "ck_property_plot_unit" CHECK (("plotArea" IS NULL) = ("plotAreaUnit" IS NULL))
);
CREATE INDEX "properties_company_status_type_idx" ON "properties"("companyId", "status", "propertyType");

CREATE TABLE "buildings" (
  "id" UUID PRIMARY KEY,
  "propertyId" UUID NOT NULL REFERENCES "properties"("id") ON DELETE RESTRICT,
  "buildingCode" VARCHAR(40) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "numberOfFloors" INTEGER,
  "attributes" JSONB,
  "status" "BuildingStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "uq_buildings_property_code" UNIQUE ("propertyId", "buildingCode"),
  CONSTRAINT "ck_building_floors" CHECK ("numberOfFloors" IS NULL OR "numberOfFloors" >= 0)
);

CREATE TABLE "property_branch_assignments" (
  "id" UUID PRIMARY KEY,
  "propertyId" UUID NOT NULL REFERENCES "properties"("id") ON DELETE RESTRICT,
  "branchId" UUID NOT NULL REFERENCES "branches"("id") ON DELETE RESTRICT,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  CONSTRAINT "uq_property_branch_effective" UNIQUE ("propertyId", "effectiveFrom"),
  CONSTRAINT "ck_property_branch_interval" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
);
CREATE INDEX "property_branch_property_date_idx" ON "property_branch_assignments"("propertyId", "effectiveFrom");
CREATE INDEX "property_branch_branch_date_idx" ON "property_branch_assignments"("branchId", "effectiveFrom");
ALTER TABLE "property_branch_assignments" ADD CONSTRAINT "ex_property_branch_no_overlap"
  EXCLUDE USING gist ("propertyId" WITH =, daterange("effectiveFrom", "effectiveTo", '[)') WITH &&);

CREATE TABLE "property_ownerships" (
  "id" UUID PRIMARY KEY,
  "propertyId" UUID NOT NULL REFERENCES "properties"("id") ON DELETE RESTRICT,
  "ownerPartyId" UUID NOT NULL REFERENCES "parties"("id") ON DELETE RESTRICT,
  "ownershipPercent" DECIMAL(9,6) NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  CONSTRAINT "uq_property_owner_effective" UNIQUE ("propertyId", "ownerPartyId", "effectiveFrom"),
  CONSTRAINT "ck_property_ownership_percent" CHECK ("ownershipPercent" > 0 AND "ownershipPercent" <= 100),
  CONSTRAINT "ck_property_ownership_interval" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
);
CREATE INDEX "property_ownership_property_date_idx" ON "property_ownerships"("propertyId", "effectiveFrom");
ALTER TABLE "property_ownerships" ADD CONSTRAINT "ex_property_owner_no_overlap"
  EXCLUDE USING gist ("propertyId" WITH =, "ownerPartyId" WITH =, daterange("effectiveFrom", "effectiveTo", '[)') WITH &&);

CREATE TABLE "property_owner_entitlements" (
  "id" UUID PRIMARY KEY,
  "ownershipId" UUID NOT NULL REFERENCES "property_ownerships"("id") ON DELETE RESTRICT,
  "payoutPercent" DECIMAL(9,6) NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  CONSTRAINT "uq_owner_entitlement_effective" UNIQUE ("ownershipId", "effectiveFrom"),
  CONSTRAINT "ck_owner_entitlement_percent" CHECK ("payoutPercent" >= 0 AND "payoutPercent" <= 100),
  CONSTRAINT "ck_owner_entitlement_interval" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
);
CREATE INDEX "owner_entitlement_ownership_date_idx" ON "property_owner_entitlements"("ownershipId", "effectiveFrom");
ALTER TABLE "property_owner_entitlements" ADD CONSTRAINT "ex_owner_entitlement_no_overlap"
  EXCLUDE USING gist ("ownershipId" WITH =, daterange("effectiveFrom", "effectiveTo", '[)') WITH &&);

CREATE TABLE "rentable_space_types" (
  "id" UUID PRIMARY KEY,
  "code" VARCHAR(50) NOT NULL UNIQUE,
  "name" VARCHAR(100) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE "rentable_spaces" (
  "id" UUID PRIMARY KEY,
  "propertyId" UUID NOT NULL REFERENCES "properties"("id") ON DELETE RESTRICT,
  "buildingId" UUID REFERENCES "buildings"("id") ON DELETE RESTRICT,
  "typeId" UUID NOT NULL REFERENCES "rentable_space_types"("id") ON DELETE RESTRICT,
  "spaceCode" VARCHAR(50) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "status" "RentableSpaceStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "uq_rentable_space_property_code" UNIQUE ("propertyId", "spaceCode")
);
CREATE INDEX "rentable_space_property_status_type_idx" ON "rentable_spaces"("propertyId", "status", "typeId");

CREATE TABLE "rentable_space_versions" (
  "id" UUID PRIMARY KEY,
  "rentableSpaceId" UUID NOT NULL REFERENCES "rentable_spaces"("id") ON DELETE RESTRICT,
  "versionNo" INTEGER NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "label" VARCHAR(160),
  "usableArea" DECIMAL(20,6),
  "totalArea" DECIMAL(20,6),
  "areaUnit" "AreaUnit",
  "floorNumber" INTEGER,
  "capacity" INTEGER,
  "attributes" JSONB,
  CONSTRAINT "uq_space_version_number" UNIQUE ("rentableSpaceId", "versionNo"),
  CONSTRAINT "uq_space_version_effective" UNIQUE ("rentableSpaceId", "effectiveFrom"),
  CONSTRAINT "ck_space_version_interval" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom"),
  CONSTRAINT "ck_space_usable_area" CHECK ("usableArea" IS NULL OR "usableArea" > 0),
  CONSTRAINT "ck_space_total_area" CHECK ("totalArea" IS NULL OR "totalArea" > 0),
  CONSTRAINT "ck_space_area_order" CHECK ("usableArea" IS NULL OR "totalArea" IS NULL OR "usableArea" <= "totalArea"),
  CONSTRAINT "ck_space_area_unit" CHECK (("usableArea" IS NULL AND "totalArea" IS NULL) OR "areaUnit" IS NOT NULL),
  CONSTRAINT "ck_space_capacity" CHECK ("capacity" IS NULL OR "capacity" >= 0)
);
CREATE INDEX "space_version_space_date_idx" ON "rentable_space_versions"("rentableSpaceId", "effectiveFrom");
ALTER TABLE "rentable_space_versions" ADD CONSTRAINT "ex_space_version_no_overlap"
  EXCLUDE USING gist ("rentableSpaceId" WITH =, daterange("effectiveFrom", "effectiveTo", '[)') WITH &&);

CREATE TABLE "rentable_space_parent_history" (
  "id" UUID PRIMARY KEY,
  "childSpaceId" UUID NOT NULL REFERENCES "rentable_spaces"("id") ON DELETE RESTRICT,
  "parentSpaceId" UUID NOT NULL REFERENCES "rentable_spaces"("id") ON DELETE RESTRICT,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  CONSTRAINT "uq_space_parent_effective" UNIQUE ("childSpaceId", "effectiveFrom"),
  CONSTRAINT "ck_space_parent_distinct" CHECK ("childSpaceId" <> "parentSpaceId"),
  CONSTRAINT "ck_space_parent_interval" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
);
CREATE INDEX "space_parent_child_date_idx" ON "rentable_space_parent_history"("childSpaceId", "effectiveFrom");
CREATE INDEX "space_parent_parent_date_idx" ON "rentable_space_parent_history"("parentSpaceId", "effectiveFrom");
ALTER TABLE "rentable_space_parent_history" ADD CONSTRAINT "ex_space_parent_no_overlap"
  EXCLUDE USING gist ("childSpaceId" WITH =, daterange("effectiveFrom", "effectiveTo", '[)') WITH &&);

CREATE TABLE "space_successors" (
  "predecessorSpaceId" UUID NOT NULL REFERENCES "rentable_spaces"("id") ON DELETE RESTRICT,
  "successorSpaceId" UUID NOT NULL REFERENCES "rentable_spaces"("id") ON DELETE RESTRICT,
  "relationType" VARCHAR(20) NOT NULL,
  "effectiveDate" DATE NOT NULL,
  PRIMARY KEY ("predecessorSpaceId", "successorSpaceId"),
  CONSTRAINT "ck_space_successor_distinct" CHECK ("predecessorSpaceId" <> "successorSpaceId")
);

CREATE TABLE "land_space_profiles" (
  "rentableSpaceId" UUID PRIMARY KEY REFERENCES "rentable_spaces"("id") ON DELETE RESTRICT,
  "dimensions" VARCHAR(160),
  "permittedUse" VARCHAR(200) NOT NULL,
  "currentUse" VARCHAR(200),
  "boundaryDescription" TEXT,
  "roadAccess" VARCHAR(200),
  "fenced" BOOLEAN
);

CREATE TABLE "residential_space_profiles" (
  "rentableSpaceId" UUID PRIMARY KEY REFERENCES "rentable_spaces"("id") ON DELETE RESTRICT,
  "bedrooms" INTEGER,
  "bathrooms" DECIMAL(4,1),
  "kitchens" INTEGER,
  "livingRooms" INTEGER,
  "balconies" INTEGER,
  "furnishedStatus" VARCHAR(30),
  CONSTRAINT "ck_residential_counts" CHECK (
    ("bedrooms" IS NULL OR "bedrooms" >= 0) AND
    ("bathrooms" IS NULL OR "bathrooms" >= 0) AND
    ("kitchens" IS NULL OR "kitchens" >= 0) AND
    ("livingRooms" IS NULL OR "livingRooms" >= 0) AND
    ("balconies" IS NULL OR "balconies" >= 0)
  )
);

CREATE TABLE "commercial_space_profiles" (
  "rentableSpaceId" UUID PRIMARY KEY REFERENCES "rentable_spaces"("id") ON DELETE RESTRICT,
  "frontageMeters" DECIMAL(12,4),
  "classification" VARCHAR(60),
  CONSTRAINT "ck_commercial_frontage" CHECK ("frontageMeters" IS NULL OR "frontageMeters" > 0)
);

CREATE TABLE "amenities" (
  "id" UUID PRIMARY KEY,
  "code" VARCHAR(50) NOT NULL UNIQUE,
  "name" VARCHAR(100) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE "property_amenities" (
  "propertyId" UUID NOT NULL REFERENCES "properties"("id") ON DELETE RESTRICT,
  "amenityId" UUID NOT NULL REFERENCES "amenities"("id") ON DELETE RESTRICT,
  PRIMARY KEY ("propertyId", "amenityId")
);
CREATE TABLE "space_amenities" (
  "rentableSpaceId" UUID NOT NULL REFERENCES "rentable_spaces"("id") ON DELETE RESTRICT,
  "amenityId" UUID NOT NULL REFERENCES "amenities"("id") ON DELETE RESTRICT,
  PRIMARY KEY ("rentableSpaceId", "amenityId")
);

CREATE TABLE "documents" (
  "id" UUID PRIMARY KEY,
  "companyId" UUID NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT,
  "categoryCode" VARCHAR(50) NOT NULL,
  "accessClass" VARCHAR(30) NOT NULL,
  "status" VARCHAR(30) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "document_versions" (
  "id" UUID PRIMARY KEY,
  "documentId" UUID NOT NULL REFERENCES "documents"("id") ON DELETE RESTRICT,
  "sequence" INTEGER NOT NULL,
  "storageKey" VARCHAR(512) NOT NULL UNIQUE,
  "checksum" VARCHAR(128) NOT NULL,
  "mimeType" VARCHAR(160) NOT NULL,
  "sizeBytes" BIGINT NOT NULL,
  "uploadedByUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "effectiveFrom" DATE,
  "expiresOn" DATE,
  "signedAt" TIMESTAMPTZ(6),
  CONSTRAINT "uq_document_version_sequence" UNIQUE ("documentId", "sequence"),
  CONSTRAINT "ck_document_size" CHECK ("sizeBytes" > 0),
  CONSTRAINT "ck_document_dates" CHECK ("expiresOn" IS NULL OR "effectiveFrom" IS NULL OR "expiresOn" >= "effectiveFrom")
);
CREATE TABLE "document_links" (
  "id" UUID PRIMARY KEY,
  "documentId" UUID NOT NULL REFERENCES "documents"("id") ON DELETE RESTRICT,
  "entityType" VARCHAR(60) NOT NULL,
  "entityId" UUID NOT NULL,
  "purpose" VARCHAR(50) NOT NULL,
  CONSTRAINT "uq_document_link" UNIQUE ("documentId", "entityType", "entityId", "purpose")
);

CREATE OR REPLACE FUNCTION validate_space_building_property() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE building_property UUID;
BEGIN
  IF NEW."buildingId" IS NOT NULL THEN
    SELECT "propertyId" INTO building_property FROM "buildings" WHERE id = NEW."buildingId";
    IF building_property IS DISTINCT FROM NEW."propertyId" THEN
      RAISE EXCEPTION 'RentableSpace building must belong to the same Property';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_space_building_property BEFORE INSERT OR UPDATE ON "rentable_spaces"
  FOR EACH ROW EXECUTE FUNCTION validate_space_building_property();

CREATE OR REPLACE FUNCTION validate_space_parent_relation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE child_property UUID; parent_property UUID; cycle_found BOOLEAN;
BEGIN
  SELECT "propertyId" INTO child_property FROM "rentable_spaces" WHERE id = NEW."childSpaceId";
  SELECT "propertyId" INTO parent_property FROM "rentable_spaces" WHERE id = NEW."parentSpaceId";
  IF child_property IS DISTINCT FROM parent_property THEN
    RAISE EXCEPTION 'Parent and child RentableSpaces must belong to the same Property';
  END IF;
  WITH RECURSIVE ancestry(space_id, valid_range) AS (
    SELECT NEW."parentSpaceId", daterange(NEW."effectiveFrom", NEW."effectiveTo", '[)')
    UNION ALL
    SELECT h."parentSpaceId", a.valid_range * daterange(h."effectiveFrom", h."effectiveTo", '[)')
    FROM ancestry a JOIN "rentable_space_parent_history" h ON h."childSpaceId" = a.space_id
    WHERE a.valid_range && daterange(h."effectiveFrom", h."effectiveTo", '[)')
      AND (TG_OP <> 'UPDATE' OR h.id <> NEW.id)
  ) SELECT EXISTS (SELECT 1 FROM ancestry WHERE space_id = NEW."childSpaceId") INTO cycle_found;
  IF cycle_found THEN RAISE EXCEPTION 'RentableSpace hierarchy cycle is not allowed'; END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER trg_space_parent_relation
  AFTER INSERT OR UPDATE ON "rentable_space_parent_history"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_space_parent_relation();

CREATE OR REPLACE FUNCTION validate_all_space_areas() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE check_row RECORD; parent_area NUMERIC; parent_unit "AreaUnit"; child_total NUMERIC; mismatched_units INTEGER;
BEGIN
  FOR check_row IN
    SELECT DISTINCT h."parentSpaceId" AS parent_id, boundary_date
    FROM "rentable_space_parent_history" h
    CROSS JOIN LATERAL (
      SELECT h."effectiveFrom" AS boundary_date UNION SELECT h."effectiveTo"
      UNION SELECT v."effectiveFrom" FROM "rentable_space_versions" v WHERE v."rentableSpaceId" IN (h."parentSpaceId", h."childSpaceId")
      UNION SELECT v."effectiveTo" FROM "rentable_space_versions" v WHERE v."rentableSpaceId" IN (h."parentSpaceId", h."childSpaceId")
    ) boundaries
    WHERE boundary_date IS NOT NULL
  LOOP
    SELECT v."usableArea", v."areaUnit" INTO parent_area, parent_unit
    FROM "rentable_space_versions" v
    WHERE v."rentableSpaceId" = check_row.parent_id
      AND v."effectiveFrom" <= check_row.boundary_date
      AND (v."effectiveTo" IS NULL OR check_row.boundary_date < v."effectiveTo");
    IF parent_area IS NULL THEN CONTINUE; END IF;
    SELECT COALESCE(SUM(cv."usableArea"), 0),
      COUNT(*) FILTER (WHERE cv."usableArea" IS NOT NULL AND cv."areaUnit" IS DISTINCT FROM parent_unit)
    INTO child_total, mismatched_units
    FROM "rentable_space_parent_history" h
    JOIN "rentable_spaces" child ON child.id = h."childSpaceId" AND child.status = 'ACTIVE'
    JOIN "rentable_space_versions" cv ON cv."rentableSpaceId" = child.id
    WHERE h."parentSpaceId" = check_row.parent_id
      AND h."effectiveFrom" <= check_row.boundary_date AND (h."effectiveTo" IS NULL OR check_row.boundary_date < h."effectiveTo")
      AND cv."effectiveFrom" <= check_row.boundary_date AND (cv."effectiveTo" IS NULL OR check_row.boundary_date < cv."effectiveTo");
    IF mismatched_units > 0 THEN RAISE EXCEPTION 'Child and parent area units must match'; END IF;
    IF child_total > parent_area THEN RAISE EXCEPTION 'Active child usable area total (%) exceeds parent usable area (%)', child_total, parent_area; END IF;
  END LOOP;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER trg_validate_space_areas_version AFTER INSERT OR UPDATE OR DELETE ON "rentable_space_versions"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_all_space_areas();
CREATE CONSTRAINT TRIGGER trg_validate_space_areas_parent AFTER INSERT OR UPDATE OR DELETE ON "rentable_space_parent_history"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_all_space_areas();
CREATE CONSTRAINT TRIGGER trg_validate_space_areas_status AFTER INSERT OR UPDATE OF "status" ON "rentable_spaces"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_all_space_areas();

CREATE OR REPLACE FUNCTION validate_active_property_configuration() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE property_row RECORD; boundary DATE; ownership_total NUMERIC; payout_total NUMERIC; branch_count INTEGER; missing_owner INTEGER;
BEGIN
  FOR property_row IN SELECT id FROM "properties" WHERE status = 'ACTIVE' LOOP
    SELECT COUNT(*) INTO missing_owner FROM "property_ownerships" o
      LEFT JOIN "owner_profiles" p ON p."partyId" = o."ownerPartyId"
      WHERE o."propertyId" = property_row.id AND p."partyId" IS NULL;
    IF missing_owner > 0 THEN RAISE EXCEPTION 'Property ownership requires an Owner profile'; END IF;
    FOR boundary IN
      SELECT DISTINCT d FROM (
        SELECT "effectiveFrom" d FROM "property_ownerships" WHERE "propertyId" = property_row.id
        UNION SELECT "effectiveTo" FROM "property_ownerships" WHERE "propertyId" = property_row.id
        UNION SELECT e."effectiveFrom" FROM "property_owner_entitlements" e JOIN "property_ownerships" o ON o.id=e."ownershipId" WHERE o."propertyId"=property_row.id
        UNION SELECT e."effectiveTo" FROM "property_owner_entitlements" e JOIN "property_ownerships" o ON o.id=e."ownershipId" WHERE o."propertyId"=property_row.id
        UNION SELECT "effectiveFrom" FROM "property_branch_assignments" WHERE "propertyId"=property_row.id
        UNION SELECT "effectiveTo" FROM "property_branch_assignments" WHERE "propertyId"=property_row.id
      ) dates WHERE d IS NOT NULL
    LOOP
      SELECT COALESCE(SUM("ownershipPercent"),0) INTO ownership_total FROM "property_ownerships"
        WHERE "propertyId"=property_row.id AND "effectiveFrom"<=boundary AND ("effectiveTo" IS NULL OR boundary<"effectiveTo");
      SELECT COALESCE(SUM(e."payoutPercent"),0) INTO payout_total FROM "property_owner_entitlements" e
        JOIN "property_ownerships" o ON o.id=e."ownershipId"
        WHERE o."propertyId"=property_row.id
          AND o."effectiveFrom"<=boundary AND (o."effectiveTo" IS NULL OR boundary<o."effectiveTo")
          AND e."effectiveFrom"<=boundary AND (e."effectiveTo" IS NULL OR boundary<e."effectiveTo");
      SELECT COUNT(*) INTO branch_count FROM "property_branch_assignments"
        WHERE "propertyId"=property_row.id AND "effectiveFrom"<=boundary AND ("effectiveTo" IS NULL OR boundary<"effectiveTo");
      IF ownership_total <> 100 THEN RAISE EXCEPTION 'Active Property ownership must total 100%%, got %', ownership_total; END IF;
      IF payout_total <> 100 THEN RAISE EXCEPTION 'Active Property payout entitlement must total 100%%, got %', payout_total; END IF;
      IF branch_count <> 1 THEN RAISE EXCEPTION 'Active Property requires exactly one operating branch'; END IF;
    END LOOP;
  END LOOP;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER trg_validate_property_config_property AFTER INSERT OR UPDATE ON "properties"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_active_property_configuration();
CREATE CONSTRAINT TRIGGER trg_validate_property_config_ownership AFTER INSERT OR UPDATE OR DELETE ON "property_ownerships"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_active_property_configuration();
CREATE CONSTRAINT TRIGGER trg_validate_property_config_entitlement AFTER INSERT OR UPDATE OR DELETE ON "property_owner_entitlements"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_active_property_configuration();
CREATE CONSTRAINT TRIGGER trg_validate_property_config_branch AFTER INSERT OR UPDATE OR DELETE ON "property_branch_assignments"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_active_property_configuration();

CREATE OR REPLACE FUNCTION prevent_document_version_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Document versions are immutable; append a new version'; END $$;
CREATE TRIGGER trg_document_version_immutable BEFORE UPDATE OR DELETE ON "document_versions"
  FOR EACH ROW EXECUTE FUNCTION prevent_document_version_mutation();
