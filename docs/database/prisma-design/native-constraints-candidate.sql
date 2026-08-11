-- PHASE 1 REVIEW CANDIDATE ONLY. DO NOT EXECUTE AS A PRODUCTION MIGRATION.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Leasing; DEFERRABLE permits atomic replacement. Half-open periods allow adjacency.
ALTER TABLE lease_possessions ADD CONSTRAINT ex_lease_possessions__exclusive_period
EXCLUDE USING gist (rentable_space_id WITH =,
  tstzrange(possession_from,COALESCE(possession_to,'infinity'::timestamptz),'[)') WITH &&)
WHERE (status IN ('SCHEDULED','ACTIVE','HOLDOVER')) DEFERRABLE INITIALLY IMMEDIATE;

-- Portfolio; effective versions and hierarchy are mutually exclusive per governed identity.
ALTER TABLE rentable_space_versions ADD CONSTRAINT ex_space_versions__effective_period
EXCLUDE USING gist (rentable_space_id WITH =,
  daterange(effective_from,COALESCE(effective_to,'infinity'::date),'[)') WITH &&)
DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE rentable_space_parent_history ADD CONSTRAINT ex_space_parent__one_parent
EXCLUDE USING gist (child_space_id WITH =,
  daterange(effective_from,COALESCE(effective_to,'infinity'::date),'[)') WITH &&)
DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE rentable_space_parent_history ADD CONSTRAINT ck_space_parent__not_self
CHECK (child_space_id <> parent_space_id);

-- Service Engagement; exact-scope overlap is declarative. Cross-level compatibility is data-driven.
CREATE TABLE service_model_compatibility (
  inherited_model text NOT NULL,
  override_model text NOT NULL,
  compatible boolean NOT NULL,
  PRIMARY KEY (inherited_model,override_model)
);
ALTER TABLE service_engagements ADD CONSTRAINT ex_engagements__property_scope
EXCLUDE USING gist (property_id WITH =,
  daterange(effective_from,COALESCE(effective_to,'infinity'::date),'[)') WITH &&)
WHERE (rentable_space_id IS NULL AND status = 'ACTIVE') DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE service_engagements ADD CONSTRAINT ex_engagements__space_scope
EXCLUDE USING gist (rentable_space_id WITH =,
  daterange(effective_from,COALESCE(effective_to,'infinity'::date),'[)') WITH &&)
WHERE (rentable_space_id IS NOT NULL AND status = 'ACTIVE') DEFERRABLE INITIALLY IMMEDIATE;

CREATE FUNCTION validate_engagement_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.effective_to IS NOT NULL AND NEW.effective_to <= NEW.effective_from THEN
    RAISE EXCEPTION 'invalid engagement effective range';
  END IF;
  IF NEW.rentable_space_id IS NOT NULL AND NOT EXISTS
    (SELECT 1 FROM rentable_spaces s WHERE s.id=NEW.rentable_space_id AND s.property_id=NEW.property_id)
  THEN RAISE EXCEPTION 'engagement target is outside property'; END IF;
  IF NEW.inherited_from_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM service_engagements p
    JOIN service_model_compatibility c ON c.inherited_model=p.model::text
      AND c.override_model=NEW.model::text AND c.compatible
    WHERE p.id=NEW.inherited_from_id AND p.property_id=NEW.property_id)
  THEN RAISE EXCEPTION 'incompatible inherited service engagement'; END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER trg_engagements__scope_compatibility
AFTER INSERT OR UPDATE ON service_engagements DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_engagement_scope();

-- Portfolio; same property, acyclic hierarchy, and child usable-area limit.
CREATE FUNCTION validate_space_hierarchy() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p_id uuid; c_id uuid; from_d date; parent_area numeric(20,6); child_area numeric(20,6);
BEGIN
  p_id:=COALESCE(NEW.parent_space_id,OLD.parent_space_id);
  c_id:=COALESCE(NEW.child_space_id,OLD.child_space_id);
  from_d:=COALESCE(NEW.effective_from,OLD.effective_from);
  IF EXISTS (SELECT 1 FROM rentable_spaces c JOIN rentable_spaces p ON p.id=p_id
             WHERE c.id=c_id AND c.property_id<>p.property_id)
  THEN RAISE EXCEPTION 'space hierarchy crosses property'; END IF;
  IF EXISTS (WITH RECURSIVE a(id) AS (
      SELECT p_id UNION ALL SELECT h.parent_space_id FROM rentable_space_parent_history h JOIN a ON h.child_space_id=a.id)
      SELECT 1 FROM a WHERE id=c_id)
  THEN RAISE EXCEPTION 'space hierarchy cycle'; END IF;
  SELECT usable_area INTO parent_area FROM rentable_space_versions
    WHERE rentable_space_id=p_id AND effective_from<=from_d AND (effective_to IS NULL OR from_d<effective_to);
  SELECT COALESCE(SUM(v.usable_area),0) INTO child_area
    FROM rentable_space_parent_history h JOIN rentable_space_versions v ON v.rentable_space_id=h.child_space_id
    WHERE h.parent_space_id=p_id AND h.effective_from<=from_d AND (h.effective_to IS NULL OR from_d<h.effective_to)
      AND v.effective_from<=from_d AND (v.effective_to IS NULL OR from_d<v.effective_to);
  IF parent_area IS NULL OR child_area>parent_area THEN RAISE EXCEPTION 'child usable area exceeds parent'; END IF;
  RETURN COALESCE(NEW,OLD);
END $$;
CREATE CONSTRAINT TRIGGER trg_space_parent__hierarchy_area
AFTER INSERT OR UPDATE OR DELETE ON rentable_space_parent_history DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_space_hierarchy();

-- Owner Accounting; numeric safety, duplicate range exclusion, and deferred aggregate total.
ALTER TABLE property_ownerships ADD CONSTRAINT ck_ownership__percent CHECK (ownership_percent>0 AND ownership_percent<=100);
ALTER TABLE property_owner_entitlements ADD CONSTRAINT ck_entitlement__percent CHECK (payout_percent>=0 AND payout_percent<=100);
ALTER TABLE property_ownerships ADD CONSTRAINT ex_ownership__owner_period
EXCLUDE USING gist (property_id WITH =,owner_party_id WITH =,
  daterange(effective_from,COALESCE(effective_to,'infinity'::date),'[)') WITH &&)
DEFERRABLE INITIALLY IMMEDIATE;
CREATE FUNCTION validate_ownership_total() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pid uuid; d date; total numeric(12,6);
BEGIN
  pid:=COALESCE(NEW.property_id,OLD.property_id); d:=COALESCE(NEW.effective_from,OLD.effective_from);
  SELECT COALESCE(SUM(ownership_percent),0) INTO total FROM property_ownerships
   WHERE property_id=pid AND effective_from<=d AND (effective_to IS NULL OR d<effective_to);
  IF total>100 THEN RAISE EXCEPTION 'effective ownership exceeds 100 percent'; END IF;
  RETURN COALESCE(NEW,OLD);
END $$;
CREATE CONSTRAINT TRIGGER trg_ownership__effective_total
AFTER INSERT OR UPDATE OR DELETE ON property_ownerships DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_ownership_total();

-- Payments; provider/account scope and financial command idempotency.
CREATE UNIQUE INDEX uq_payments__scoped_external_ref ON payments(external_ref_scope,lower(external_ref))
WHERE external_ref IS NOT NULL AND status IN ('VERIFIED','POSTED','PARTIALLY_ALLOCATED','FULLY_ALLOCATED');
CREATE UNIQUE INDEX uq_payments__idempotency_key ON payments(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Finance; one typed source and deferred balance/period validation.
ALTER TABLE journal_source_links ADD CONSTRAINT ck_journal_sources__exactly_one CHECK
(num_nonnulls(payment_id,refund_id,owner_payout_id,expense_id,deposit_transaction_id,
 brokerage_deal_id,master_lease_charge_id,utility_allocation_id,charge_adjustment_id)=1);
CREATE FUNCTION validate_posted_journal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE total numeric(20,4); n integer; ps text;
BEGIN
  IF NEW.status='POSTED' THEN
    SELECT COALESCE(SUM(signed_amount),0),COUNT(*) INTO total,n FROM journal_lines WHERE journal_entry_id=NEW.id;
    SELECT status::text INTO ps FROM accounting_periods WHERE id=NEW.period_id;
    IF n<2 OR total<>0 THEN RAISE EXCEPTION 'posted journal is unbalanced'; END IF;
    IF ps NOT IN ('OPEN','SOFT_CLOSED') THEN RAISE EXCEPTION 'period does not permit posting'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER trg_journals__balanced_posting
AFTER INSERT OR UPDATE OF status ON journal_entries DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_posted_journal();

-- Finance; application role cannot mutate posted journal or its lines. Reversal appends new rows.
CREATE FUNCTION protect_posted_journal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF OLD.status='POSTED' THEN RAISE EXCEPTION 'posted journal is immutable'; END IF; RETURN COALESCE(NEW,OLD); END $$;
CREATE TRIGGER trg_journal_entries__immutable BEFORE UPDATE OR DELETE ON journal_entries
FOR EACH ROW EXECUTE FUNCTION protect_posted_journal();
CREATE FUNCTION protect_posted_journal_line() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF EXISTS(SELECT 1 FROM journal_entries WHERE id=OLD.journal_entry_id AND status='POSTED')
THEN RAISE EXCEPTION 'posted journal line is immutable'; END IF; RETURN COALESCE(NEW,OLD); END $$;
CREATE TRIGGER trg_journal_lines__immutable BEFORE UPDATE OR DELETE ON journal_lines
FOR EACH ROW EXECUTE FUNCTION protect_posted_journal_line();

-- Leasing/Documents; signed version immutability.
CREATE FUNCTION protect_signed_lease_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF OLD.signed_at IS NOT NULL THEN RAISE EXCEPTION 'signed lease version is immutable'; END IF; RETURN COALESCE(NEW,OLD); END $$;
CREATE TRIGGER trg_lease_versions__signed_immutable BEFORE UPDATE OR DELETE ON lease_versions
FOR EACH ROW EXECUTE FUNCTION protect_signed_lease_version();

-- Audit; append only. Outbox PK and inbox composite PK provide event/consumer idempotency.
CREATE FUNCTION reject_update_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION '% is append-only',TG_TABLE_NAME; END $$;
CREATE TRIGGER trg_audit_logs__append_only BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION reject_update_delete();
ALTER TABLE outbox_events ADD CONSTRAINT ck_outbox__retry_nonnegative CHECK(retry_count>=0);
CREATE INDEX ix_outbox__pending ON outbox_events(available_at,occurred_at) WHERE processed_at IS NULL;
