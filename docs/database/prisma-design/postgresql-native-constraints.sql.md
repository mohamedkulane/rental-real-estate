# PostgreSQL-Native Constraints

Review SQL; exact table/state names must be reconciled with the final Prisma schema before migration.

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE lease_possessions
  ADD CONSTRAINT ex_lease_possessions__exclusive_period
  EXCLUDE USING gist (
    rentable_space_id WITH =,
    tstzrange(possession_from, COALESCE(possession_to, 'infinity'), '[)') WITH &&
  ) WHERE (status IN ('SCHEDULED','ACTIVE','HOLDOVER'))
  DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE rentable_space_versions
  ADD CONSTRAINT ex_rentable_space_versions__effective_period
  EXCLUDE USING gist (
    rentable_space_id WITH =,
    daterange(effective_from, COALESCE(effective_to, 'infinity'), '[)') WITH &&
  );

ALTER TABLE rentable_space_parent_history
  ADD CONSTRAINT ex_space_parent_history__one_parent
  EXCLUDE USING gist (
    child_space_id WITH =,
    daterange(effective_from, COALESCE(effective_to, 'infinity'), '[)') WITH &&
  );

CREATE UNIQUE INDEX uq_payments__scoped_external_ref
  ON payments (external_ref_scope, lower(external_ref))
  WHERE external_ref IS NOT NULL AND status IN ('VERIFIED','POSTED','PARTIALLY_ALLOCATED','FULLY_ALLOCATED');

ALTER TABLE journal_source_links ADD CONSTRAINT ck_journal_source_links__exactly_one
CHECK (num_nonnulls(payment_id, refund_id, owner_payout_id, expense_id,
  deposit_transaction_id, brokerage_deal_id, master_lease_charge_id,
  utility_allocation_id, charge_adjustment_id) = 1);

ALTER TABLE property_ownerships ADD CONSTRAINT ck_property_ownerships__percent
  CHECK (ownership_percent > 0 AND ownership_percent <= 100);
ALTER TABLE property_owner_entitlements ADD CONSTRAINT ck_owner_entitlements__percent
  CHECK (payout_percent >= 0 AND payout_percent <= 100);

-- Deferred constraint triggers required (functions omitted until final column/state review):
-- trg_journal_entries__balanced_posting
-- trg_rentable_spaces__child_area_limit_and_no_cycle
-- trg_service_engagements__compatible_effective_scope
-- trg_property_ownerships__effective_percentage_totals
-- trg_financial_records__posted_immutability
-- trg_lease_versions__signed_immutability
```

The final migration must include pgTAP/integration tests proving each constraint under concurrent transactions.
