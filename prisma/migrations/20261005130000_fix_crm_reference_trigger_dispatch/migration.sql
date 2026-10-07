-- Keep dynamic trigger dispatch branch-local. PostgreSQL records expose only
-- the columns of the table that fired the trigger.
CREATE OR REPLACE FUNCTION validate_preference_reference()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE lead_company UUID; asset_company UUID;
BEGIN
  SELECT lead."companyId" INTO lead_company
    FROM "lead_preference_versions" version
    JOIN "leads" lead ON lead."id" = version."leadId"
   WHERE version."id" = NEW."preferenceVersionId";
  IF TG_TABLE_NAME = 'rent_lead_preferences' THEN
    IF NEW."rentableSpaceId" IS NOT NULL THEN
      SELECT property."companyId" INTO asset_company
        FROM "rentable_spaces" space
        JOIN "properties" property ON property."id" = space."propertyId"
       WHERE space."id" = NEW."rentableSpaceId";
    END IF;
  ELSIF TG_TABLE_NAME = 'buy_lead_preferences' THEN
    IF NEW."propertyId" IS NOT NULL THEN
      SELECT "companyId" INTO asset_company FROM "properties" WHERE "id" = NEW."propertyId";
    END IF;
  ELSIF TG_TABLE_NAME = 'sell_lead_preferences' THEN
    IF NEW."propertyId" IS NOT NULL THEN
      SELECT "companyId" INTO asset_company FROM "properties" WHERE "id" = NEW."propertyId";
    END IF;
  END IF;
  IF asset_company IS NOT NULL AND asset_company <> lead_company THEN
    RAISE EXCEPTION 'Lead preference asset must belong to the Lead Company.';
  END IF;
  RETURN NEW;
END;
$$;
