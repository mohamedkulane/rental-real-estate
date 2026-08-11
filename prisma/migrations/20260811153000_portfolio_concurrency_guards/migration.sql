-- Serialize hierarchy, measurement, and active-space changes per Property so
-- deferred area/cycle checks observe a stable committed predecessor state.
CREATE OR REPLACE FUNCTION lock_rentable_space_parent_property()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  property_id UUID;
BEGIN
  SELECT "propertyId"
  INTO property_id
  FROM "rentable_spaces"
  WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD."childSpaceId" ELSE NEW."childSpaceId" END;

  IF property_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('portfolio-space:' || property_id::text, 0));
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION lock_rentable_space_version_property()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  property_id UUID;
BEGIN
  SELECT "propertyId"
  INTO property_id
  FROM "rentable_spaces"
  WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD."rentableSpaceId" ELSE NEW."rentableSpaceId" END;

  IF property_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('portfolio-space:' || property_id::text, 0));
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION lock_rentable_space_status_property()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('portfolio-space:' || NEW."propertyId"::text, 0));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lock_space_parent_property
  BEFORE INSERT OR UPDATE OR DELETE ON "rentable_space_parent_history"
  FOR EACH ROW EXECUTE FUNCTION lock_rentable_space_parent_property();

CREATE TRIGGER trg_lock_space_version_property
  BEFORE INSERT OR UPDATE OR DELETE ON "rentable_space_versions"
  FOR EACH ROW EXECUTE FUNCTION lock_rentable_space_version_property();

CREATE TRIGGER trg_lock_space_status_property
  BEFORE UPDATE OF "status" ON "rentable_spaces"
  FOR EACH ROW EXECUTE FUNCTION lock_rentable_space_status_property();
