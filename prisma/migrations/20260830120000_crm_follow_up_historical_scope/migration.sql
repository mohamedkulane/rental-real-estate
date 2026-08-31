-- P502-DB-001: eligibility is an intake guard, not a condition for resolving
-- an existing task. Preserve stored Branch/employee snapshots after transfers.
-- Forward-only replacement; the Phase 5.2 foundation migration is unchanged.
CREATE OR REPLACE FUNCTION validate_lead_follow_up_write()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE lead_company UUID; lead_branch UUID; lead_stage "LeadStage"; predecessor_lead UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Follow-ups cannot be deleted.'; END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT "companyId", "responsibleBranchId", "stage"
      INTO lead_company, lead_branch, lead_stage FROM "leads" WHERE "id" = NEW."leadId";
    IF NEW."branchId" IS DISTINCT FROM lead_branch THEN
      RAISE EXCEPTION 'Follow-up Branch snapshot must match the current responsible Branch.';
    END IF;
    IF NOT crm_employee_eligible(NEW."responsibleEmployeeId", lead_company, NEW."branchId") THEN
      RAISE EXCEPTION 'Follow-up employee must be active, same-Company, and eligible in the Branch.';
    END IF;
    IF NEW."predecessorFollowUpId" IS NOT NULL THEN
      SELECT "leadId" INTO predecessor_lead FROM "lead_follow_ups" WHERE "id" = NEW."predecessorFollowUpId";
      IF predecessor_lead IS DISTINCT FROM NEW."leadId" THEN
        RAISE EXCEPTION 'Follow-up successor must remain on the same Lead.';
      END IF;
    END IF;
    IF NEW."state" <> 'OPEN' THEN RAISE EXCEPTION 'Follow-ups must start OPEN.'; END IF;
    IF lead_stage IN ('CONVERTED', 'LOST') THEN RAISE EXCEPTION 'Terminal Leads cannot receive open Follow-ups.'; END IF;
  ELSE
    IF OLD."id" <> NEW."id" OR OLD."leadId" <> NEW."leadId"
       OR OLD."branchId" <> NEW."branchId"
       OR OLD."responsibleEmployeeId" <> NEW."responsibleEmployeeId"
       OR OLD."createdByUserId" <> NEW."createdByUserId"
       OR OLD."createdAt" <> NEW."createdAt"
       OR OLD."predecessorFollowUpId" IS DISTINCT FROM NEW."predecessorFollowUpId" THEN
      RAISE EXCEPTION 'Follow-up identity, Lead, Branch, responsibility, creator, and predecessor are immutable.';
    END IF;
    IF OLD."state" <> 'OPEN' THEN RAISE EXCEPTION 'Completed or cancelled Follow-ups cannot be changed or reopened.'; END IF;
    IF NEW."state" NOT IN ('OPEN', 'COMPLETED', 'CANCELLED') THEN RAISE EXCEPTION 'Illegal Follow-up transition.'; END IF;
    IF NEW."version" <> OLD."version" + 1 THEN
      RAISE EXCEPTION 'Follow-up updates must advance the version by exactly one.';
    END IF;
  END IF;

  -- Existing CHECK constraints and deferred outcome/Lead aggregate triggers still
  -- require complete outcomes, matching append-only history, and atomic terminal
  -- cancellation. Authorization continues to use the current Lead Branch in API.
  RETURN NEW;
END;
$$;
