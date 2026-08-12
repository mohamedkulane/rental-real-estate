-- Employee identities retain an internal Party row for shared naming and audit links,
-- but they do not occupy the business Party number namespace.
UPDATE "parties" AS p
SET "partyNumber" = 'STF-' || e."id"::text
FROM "employees" AS e
WHERE e."partyId" = p."id"
  AND p."partyNumber" <> 'STF-' || e."id"::text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "owner_profiles" AS o
    JOIN "employees" AS e ON e."partyId" = o."partyId"
  ) THEN
    RAISE EXCEPTION 'Employee-linked Party rows cannot retain Owner profiles. Resolve the conflicting records before deploying.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION enforce_employee_owner_separation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'owner_profiles' AND EXISTS (
    SELECT 1 FROM "employees" WHERE "partyId" = NEW."partyId"
  ) THEN
    RAISE EXCEPTION 'Employees cannot have Owner profiles.' USING ERRCODE = '23514';
  END IF;

  IF TG_TABLE_NAME = 'employees' AND EXISTS (
    SELECT 1 FROM "owner_profiles" WHERE "partyId" = NEW."partyId"
  ) THEN
    RAISE EXCEPTION 'Owner Parties cannot be converted into employees.' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER owner_profiles_reject_employee_party
BEFORE INSERT OR UPDATE OF "partyId" ON "owner_profiles"
FOR EACH ROW EXECUTE FUNCTION enforce_employee_owner_separation();

CREATE TRIGGER employees_reject_owner_party
BEFORE INSERT OR UPDATE OF "partyId" ON "employees"
FOR EACH ROW EXECUTE FUNCTION enforce_employee_owner_separation();
