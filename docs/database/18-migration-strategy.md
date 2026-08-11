# Migration Strategy

## Future migration discipline

This package creates no migration. Step 5/implementation must establish reviewed, forward-only Prisma migrations plus companion native SQL for constraints, triggers, indexes, and extensions. Every migration is tested on production-like volume and backup restore.

## Sequence

1. Extensions and foundational enums/reference tables.
2. Organization, Parties, IAM, and branch history.
3. Portfolio/RentableSpace versions/hierarchy and ServiceEngagement.
4. Accounting foundation, idempotency, audit, outbox.
5. Pipeline/leasing and native temporal constraints.
6. Billing/payments/deposits/owner accounting.
7. Operations, utilities, master/sublease, reporting projections.

## Existing data import

Stage source data in isolated import tables; normalize parties, map legacy units to RentableSpaces, preserve business numbers/source IDs, validate ownership totals/space areas/lease overlaps, and reconcile opening receivables, deposits, owner payable, bank balances, and journals before activation. Opening balances require approved balanced entries and source evidence.

Use dry runs, exception reports, record counts/checksums, financial reconciliation, and signed business acceptance. Never silently coerce invalid financial or occupancy history.
