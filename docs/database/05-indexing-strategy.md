# Indexing Strategy

## Primary workload indexes

- Branch scope: `(operating_branch_id, status, id)` on Property projections and branch/status/date on workflows.
- Portfolio: unique property code; RentableSpace `(property_id, status, type_id)`; parent history `(parent_space_id, effective_from, effective_to)`; active version partial index.
- Availability: partial/indexed projection on available state, branch, type, price, and location; avoid calculating deep hierarchy on every search.
- Leasing: `(rentable_space_id, possession_from, possession_to)`, tenant-party/lease status, lease end/status, reservation space/status/expiry.
- CRM: lead `(assigned_employee_id, status, next_action_at)`, source/created date, trigram/normalized phone/email candidates.
- Finance: charge `(debtor_party_id, status, due_date)`, allocation FKs, payment scoped external reference, journal period/date/account, owner/property dimensions.
- Owner payable/payout: `(owner_party_id, status, period/cutoff)`, property/owner statement uniqueness.
- Operations: maintenance `(operating_branch_id, status, priority, submitted_at)`, work-order vendor/status, inspection due date.
- Outbox: partial `(available_at, occurred_at)` where `processed_at IS NULL`; inbox consumer/event unique.
- Audit: `(entity_type, entity_id, occurred_at)`, actor/time, branch/time; consider time partitioning.

## Risks

JournalLine and AuditLog indexes can dominate storage; choose only report/control paths and evaluate partitioning. Nullable dimension indexes should be partial. Deep OR searches across party fields need normalized search columns or PostgreSQL full-text/trigram indexes, not many B-tree indexes. Effective-dated GiST indexes add write cost and require representative concurrency tests.

Review-ready SQL is in `prisma/design/indexes.sql.md`.
