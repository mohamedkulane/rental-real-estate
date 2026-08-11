# Proposed PostgreSQL Indexes

```sql
CREATE INDEX ix_properties__branch_status ON properties (company_id, status);
CREATE INDEX ix_rentable_spaces__property_status_type ON rentable_spaces (property_id, status, type_id);
CREATE INDEX ix_leases__space_status_end ON leases (rentable_space_id, status, lease_end_date);
CREATE INDEX ix_reservations__active_expiry ON reservations (rentable_space_id, expires_at)
  WHERE status IN ('PENDING','ACTIVE');
CREATE INDEX ix_leads__assignee_status_action ON leads (assigned_employee_id, status, created_at);
CREATE INDEX ix_charges__debtor_status_due ON charges (debtor_party_id, status, due_date);
CREATE INDEX ix_journal_lines__owner_property ON journal_lines (owner_party_id, property_id)
  WHERE owner_party_id IS NOT NULL;
CREATE INDEX ix_journal_lines__lease_account ON journal_lines (lease_id, account_id)
  WHERE lease_id IS NOT NULL;
CREATE INDEX ix_owner_payouts__owner_status ON owner_payouts (owner_party_id, status);
CREATE INDEX ix_maintenance_requests__branch_status_priority ON maintenance_requests (branch_id, status, priority, submitted_at);
CREATE INDEX ix_outbox_events__pending ON outbox_events (available_at, occurred_at)
  WHERE processed_at IS NULL;
CREATE INDEX ix_audit_logs__entity_time ON audit_logs (entity_type, entity_id, occurred_at DESC);
CREATE INDEX ix_audit_logs__actor_time ON audit_logs (actor_user_id, occurred_at DESC);
```

Trigram/full-text indexes for party/property/listing search should be added only after normalized search fields and query plans are approved. Journal/audit time partitioning is deferred until measured volume warrants it.
