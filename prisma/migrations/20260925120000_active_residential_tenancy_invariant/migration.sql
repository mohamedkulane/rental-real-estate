-- A residential tenant normally has at most one ACTIVE lease. The registry is
-- derived state used to make that cross-table invariant atomic under races.
CREATE OR REPLACE FUNCTION is_residential_rentable_space(space_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    p."propertyType" IN ('HOUSE', 'VILLA', 'APARTMENT_BUILDING', 'COMPOUND')
    OR (
      p."propertyType" = 'MIXED_USE'
      AND rst.code IN ('APARTMENT', 'ROOM')
      AND csp."rentableSpaceId" IS NULL
    ),
    FALSE
  )
  FROM "rentable_spaces" rs
  JOIN "properties" p ON p.id = rs."propertyId"
  JOIN "rentable_space_types" rst ON rst.id = rs."typeId"
  LEFT JOIN "commercial_space_profiles" csp ON csp."rentableSpaceId" = rs.id
  WHERE rs.id = space_id;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT lp."partyId"
    FROM "lease_parties" lp
    JOIN "leases" l ON l.id = lp."leaseId"
    WHERE lp.role = 'TENANT'
      AND l.status = 'ACTIVE'
      AND is_residential_rentable_space(l."rentableSpaceId")
    GROUP BY lp."partyId"
    HAVING COUNT(DISTINCT l.id) > 1
  ) THEN
    RAISE EXCEPTION 'Existing data contains a tenant with multiple active residential leases.'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE TABLE "active_residential_tenancies" (
  "partyId" UUID PRIMARY KEY REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  "leaseId" UUID NOT NULL REFERENCES "leases"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  "companyId" UUID NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "active_residential_tenancies_lease_idx"
  ON "active_residential_tenancies"("leaseId");

INSERT INTO "active_residential_tenancies" ("partyId", "leaseId", "companyId")
SELECT lp."partyId", l.id, l."companyId"
FROM "lease_parties" lp
JOIN "leases" l ON l.id = lp."leaseId"
WHERE lp.role = 'TENANT'
  AND l.status = 'ACTIVE'
  AND is_residential_rentable_space(l."rentableSpaceId");

CREATE OR REPLACE FUNCTION sync_active_residential_tenancy_from_lease()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'ACTIVE'
     OR TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'ACTIVE' THEN
    INSERT INTO "active_residential_tenancies" ("partyId", "leaseId", "companyId")
    SELECT lp."partyId", NEW.id, NEW."companyId"
    FROM "lease_parties" lp
    WHERE lp."leaseId" = NEW.id
      AND lp.role = 'TENANT'
      AND is_residential_rentable_space(NEW."rentableSpaceId");
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'ACTIVE' AND NEW.status <> 'ACTIVE' THEN
    DELETE FROM "active_residential_tenancies" WHERE "leaseId" = OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_sync_active_residential_tenancy_lease"
AFTER INSERT OR UPDATE OF "status" ON "leases"
FOR EACH ROW EXECUTE FUNCTION sync_active_residential_tenancy_from_lease();

CREATE OR REPLACE FUNCTION sync_active_residential_tenancy_from_party()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  lease_row "leases"%ROWTYPE;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.role = 'TENANT' THEN
    DELETE FROM "active_residential_tenancies"
    WHERE "partyId" = OLD."partyId" AND "leaseId" = OLD."leaseId";
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.role = 'TENANT' THEN
    SELECT * INTO lease_row FROM "leases" WHERE id = NEW."leaseId";
    IF lease_row.status = 'ACTIVE'
       AND is_residential_rentable_space(lease_row."rentableSpaceId") THEN
      INSERT INTO "active_residential_tenancies" ("partyId", "leaseId", "companyId")
      VALUES (NEW."partyId", NEW."leaseId", lease_row."companyId");
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_sync_active_residential_tenancy_party"
AFTER INSERT OR UPDATE OR DELETE ON "lease_parties"
FOR EACH ROW EXECUTE FUNCTION sync_active_residential_tenancy_from_party();
