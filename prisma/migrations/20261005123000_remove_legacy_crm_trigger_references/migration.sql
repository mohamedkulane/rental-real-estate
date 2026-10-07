-- The original CRM migration installed trigger functions that still queried
-- the retired construction preference table. Replace those functions so the
-- active CRM aggregate is independent of the removed domain.

CREATE OR REPLACE FUNCTION validate_lead_aggregate_at_commit()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  lead_id UUID;
  lead_row "leads"%ROWTYPE;
  open_branch RECORD;
  open_assignment RECORD;
  variant_count INTEGER;
  variant_intent "LeadIntent";
BEGIN
  IF TG_TABLE_NAME = 'leads' THEN lead_id := NEW."id"; ELSE lead_id := NEW."leadId"; END IF;
  SELECT * INTO lead_row FROM "leads" WHERE "id" = lead_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT count(*), max("intent"::text)::"LeadIntent"
    INTO variant_count, variant_intent
    FROM "lead_preference_versions"
   WHERE "leadId" = lead_id AND "effectiveTo" IS NULL;
  IF variant_count <> 1 OR variant_intent <> lead_row."intent" THEN
    RAISE EXCEPTION 'Lead requires exactly one current preference matching its intent.';
  END IF;

  SELECT "branchId" INTO open_branch
    FROM "lead_branch_history"
   WHERE "leadId" = lead_id AND "assignedTo" IS NULL;
  IF NOT FOUND OR open_branch."branchId" <> lead_row."responsibleBranchId" THEN
    RAISE EXCEPTION 'Lead current Branch snapshot must match exactly one open Branch history interval.';
  END IF;

  SELECT "employeeId", "branchId" INTO open_assignment
    FROM "lead_assignments"
   WHERE "leadId" = lead_id AND "assignedTo" IS NULL;
  IF lead_row."currentAssigneeEmployeeId" IS NULL THEN
    IF FOUND THEN RAISE EXCEPTION 'Unassigned Lead cannot have an open assignment interval.'; END IF;
  ELSIF NOT FOUND
     OR open_assignment."employeeId" <> lead_row."currentAssigneeEmployeeId"
     OR open_assignment."branchId" <> lead_row."responsibleBranchId" THEN
    RAISE EXCEPTION 'Lead current assignee must match exactly one open assignment interval in its Branch.';
  END IF;

  IF lead_row."stage" IN ('CONVERTED', 'LOST')
     AND EXISTS (SELECT 1 FROM "lead_follow_ups" f WHERE f."leadId" = lead_id AND f."state" = 'OPEN') THEN
    RAISE EXCEPTION 'Terminal Leads cannot retain open Follow-ups.';
  END IF;
  IF lead_row."stage" = 'NURTURING'
     AND NOT EXISTS (SELECT 1 FROM "lead_follow_ups" f WHERE f."leadId" = lead_id AND f."state" = 'OPEN') THEN
    RAISE EXCEPTION 'NURTURING requires a next open Follow-up.';
  END IF;

  IF lead_row."stage" IN ('QUALIFIED', 'MATCHING', 'NURTURING', 'CONVERTED') AND NOT (
    (lead_row."intent" = 'RENT' AND EXISTS (
      SELECT 1 FROM "lead_preference_versions" version
      JOIN "rent_lead_preferences" preference ON preference."preferenceVersionId" = version."id"
      WHERE version."leadId" = lead_id AND version."effectiveTo" IS NULL
        AND (cardinality(version."preferredAreaText") > 0 OR preference."rentableSpaceId" IS NOT NULL)
        AND preference."maxRent" IS NOT NULL AND preference."currency" IS NOT NULL
        AND preference."rentPeriod" IS NOT NULL AND preference."moveInDate" IS NOT NULL
    ))
    OR (lead_row."intent" = 'BUY' AND EXISTS (
      SELECT 1 FROM "lead_preference_versions" version
      JOIN "buy_lead_preferences" preference ON preference."preferenceVersionId" = version."id"
      WHERE version."leadId" = lead_id AND version."effectiveTo" IS NULL
        AND (cardinality(version."preferredAreaText") > 0 OR preference."propertyId" IS NOT NULL)
        AND preference."maxBudget" IS NOT NULL AND preference."currency" IS NOT NULL
        AND preference."targetPurchaseDate" IS NOT NULL
    ))
    OR (lead_row."intent" = 'SELL' AND EXISTS (
      SELECT 1 FROM "lead_preference_versions" version
      JOIN "sell_lead_preferences" preference ON preference."preferenceVersionId" = version."id"
      WHERE version."leadId" = lead_id AND version."effectiveTo" IS NULL
        AND (preference."propertyId" IS NOT NULL OR (preference."subjectDescription" IS NOT NULL AND preference."subjectLocation" IS NOT NULL))
        AND preference."askingPrice" IS NOT NULL AND preference."currency" IS NOT NULL
        AND preference."desiredSaleDate" IS NOT NULL AND preference."sellerRelationship" IS NOT NULL
    ))
  ) THEN
    RAISE EXCEPTION 'Lead does not satisfy its typed intent qualification gate.';
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION validate_preference_variant_at_commit()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE preference_id UUID; expected "LeadIntent"; variants INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'lead_preference_versions' THEN preference_id := NEW."id"; ELSE preference_id := NEW."preferenceVersionId"; END IF;
  SELECT "intent" INTO expected FROM "lead_preference_versions" WHERE "id" = preference_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT (EXISTS(SELECT 1 FROM "rent_lead_preferences" WHERE "preferenceVersionId" = preference_id)::int
        + EXISTS(SELECT 1 FROM "buy_lead_preferences" WHERE "preferenceVersionId" = preference_id)::int
        + EXISTS(SELECT 1 FROM "sell_lead_preferences" WHERE "preferenceVersionId" = preference_id)::int)
    INTO variants;
  IF variants <> 1
     OR (expected = 'RENT' AND NOT EXISTS(SELECT 1 FROM "rent_lead_preferences" WHERE "preferenceVersionId" = preference_id))
     OR (expected = 'BUY' AND NOT EXISTS(SELECT 1 FROM "buy_lead_preferences" WHERE "preferenceVersionId" = preference_id))
     OR (expected = 'SELL' AND NOT EXISTS(SELECT 1 FROM "sell_lead_preferences" WHERE "preferenceVersionId" = preference_id)) THEN
    RAISE EXCEPTION 'Preference version requires exactly one typed variant matching its intent.';
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION validate_preference_reference()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE lead_company UUID; asset_company UUID;
BEGIN
  SELECT lead."companyId" INTO lead_company
    FROM "lead_preference_versions" version
    JOIN "leads" lead ON lead."id" = version."leadId"
   WHERE version."id" = NEW."preferenceVersionId";
  IF TG_TABLE_NAME = 'rent_lead_preferences' AND NEW."rentableSpaceId" IS NOT NULL THEN
    SELECT property."companyId" INTO asset_company
      FROM "rentable_spaces" space
      JOIN "properties" property ON property."id" = space."propertyId"
     WHERE space."id" = NEW."rentableSpaceId";
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
