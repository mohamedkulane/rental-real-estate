CREATE TABLE "property_lifecycle_history" (
  "id" UUID PRIMARY KEY,
  "propertyId" UUID NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE,
  "status" "PropertyStatus" NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "reason" VARCHAR(500) NOT NULL,
  "actorUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ck_property_lifecycle_interval" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom"),
  CONSTRAINT "uq_property_lifecycle_effective" UNIQUE ("propertyId", "effectiveFrom")
);
CREATE INDEX "property_lifecycle_property_status_date_idx"
  ON "property_lifecycle_history"("propertyId", "status", "effectiveFrom");
ALTER TABLE "property_lifecycle_history" ADD CONSTRAINT "ex_property_lifecycle_no_overlap"
  EXCLUDE USING gist ("propertyId" WITH =, daterange("effectiveFrom", "effectiveTo", '[)') WITH &&);

INSERT INTO "property_lifecycle_history"
  ("id", "propertyId", "status", "effectiveFrom", "effectiveTo", "reason", "actorUserId")
SELECT gen_random_uuid(), p."id", p."status", CURRENT_DATE, NULL,
       'Lifecycle history baseline created by Pre-Phase-5 remediation',
       COALESCE((SELECT u."id" FROM "users" u ORDER BY u."createdAt" LIMIT 1), gen_random_uuid())
FROM "properties" p;

DROP TRIGGER IF EXISTS "trg_validate_property_config_property" ON "properties";
DROP TRIGGER IF EXISTS "trg_validate_property_config_ownership" ON "property_ownerships";
DROP TRIGGER IF EXISTS "trg_validate_property_config_entitlement" ON "property_owner_entitlements";
DROP TRIGGER IF EXISTS "trg_validate_property_config_branch" ON "property_branch_assignments";
DROP FUNCTION IF EXISTS validate_active_property_configuration();

CREATE OR REPLACE FUNCTION validate_active_property_configuration() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE active_period RECORD; boundary DATE; ownership_total NUMERIC; payout_total NUMERIC; branch_count INTEGER; missing_owner INTEGER;
BEGIN
  FOR active_period IN
    SELECT h."propertyId", h."effectiveFrom" active_from, h."effectiveTo" active_to
    FROM "property_lifecycle_history" h WHERE h."status" = 'ACTIVE'
  LOOP
    SELECT COUNT(*) INTO missing_owner FROM "property_ownerships" o
      LEFT JOIN "owner_profiles" p ON p."partyId" = o."ownerPartyId"
      WHERE o."propertyId" = active_period."propertyId"
        AND daterange(o."effectiveFrom", o."effectiveTo", '[)') && daterange(active_period.active_from, active_period.active_to, '[)')
        AND p."partyId" IS NULL;
    IF missing_owner > 0 THEN RAISE EXCEPTION 'Property ownership requires an Owner profile'; END IF;

    FOR boundary IN
      SELECT DISTINCT d FROM (
        SELECT active_period.active_from d
        UNION SELECT "effectiveFrom" FROM "property_ownerships" WHERE "propertyId" = active_period."propertyId"
        UNION SELECT "effectiveTo" FROM "property_ownerships" WHERE "propertyId" = active_period."propertyId"
        UNION SELECT e."effectiveFrom" FROM "property_owner_entitlements" e JOIN "property_ownerships" o ON o.id=e."ownershipId" WHERE o."propertyId"=active_period."propertyId"
        UNION SELECT e."effectiveTo" FROM "property_owner_entitlements" e JOIN "property_ownerships" o ON o.id=e."ownershipId" WHERE o."propertyId"=active_period."propertyId"
        UNION SELECT "effectiveFrom" FROM "property_branch_assignments" WHERE "propertyId"=active_period."propertyId"
        UNION SELECT "effectiveTo" FROM "property_branch_assignments" WHERE "propertyId"=active_period."propertyId"
      ) dates
      WHERE d IS NOT NULL AND d >= active_period.active_from
        AND (active_period.active_to IS NULL OR d < active_period.active_to)
    LOOP
      SELECT COALESCE(SUM("ownershipPercent"),0) INTO ownership_total FROM "property_ownerships"
        WHERE "propertyId"=active_period."propertyId" AND "effectiveFrom"<=boundary AND ("effectiveTo" IS NULL OR boundary<"effectiveTo");
      SELECT COALESCE(SUM(e."payoutPercent"),0) INTO payout_total FROM "property_owner_entitlements" e
        JOIN "property_ownerships" o ON o.id=e."ownershipId"
        WHERE o."propertyId"=active_period."propertyId"
          AND o."effectiveFrom"<=boundary AND (o."effectiveTo" IS NULL OR boundary<o."effectiveTo")
          AND e."effectiveFrom"<=boundary AND (e."effectiveTo" IS NULL OR boundary<e."effectiveTo");
      SELECT COUNT(*) INTO branch_count FROM "property_branch_assignments"
        WHERE "propertyId"=active_period."propertyId" AND "effectiveFrom"<=boundary AND ("effectiveTo" IS NULL OR boundary<"effectiveTo");
      IF ownership_total <> 100 THEN RAISE EXCEPTION 'Active Property ownership must total 100%%, got %', ownership_total; END IF;
      IF payout_total <> 100 THEN RAISE EXCEPTION 'Active Property payout entitlement must total 100%%, got %', payout_total; END IF;
      IF branch_count <> 1 THEN RAISE EXCEPTION 'Active Property requires exactly one operating branch'; END IF;
    END LOOP;
  END LOOP;
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER "trg_validate_property_config_lifecycle" AFTER INSERT OR UPDATE OR DELETE ON "property_lifecycle_history"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_active_property_configuration();
CREATE CONSTRAINT TRIGGER "trg_validate_property_config_ownership" AFTER INSERT OR UPDATE OR DELETE ON "property_ownerships"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_active_property_configuration();
CREATE CONSTRAINT TRIGGER "trg_validate_property_config_entitlement" AFTER INSERT OR UPDATE OR DELETE ON "property_owner_entitlements"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_active_property_configuration();
CREATE CONSTRAINT TRIGGER "trg_validate_property_config_branch" AFTER INSERT OR UPDATE OR DELETE ON "property_branch_assignments"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_active_property_configuration();

INSERT INTO "permissions" ("id", "code", "description")
VALUES (gen_random_uuid(), 'party.contact.read', 'Read full Party phone and email values')
ON CONFLICT ("code") DO UPDATE SET "description" = EXCLUDED."description";
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p
WHERE p."code" = 'party.contact.read'
  AND r."code" IN ('SUPER_ADMIN', 'GENERAL_MANAGER', 'BRANCH_MANAGER', 'PROPERTY_MANAGER', 'LEASING_AGENT')
ON CONFLICT DO NOTHING;