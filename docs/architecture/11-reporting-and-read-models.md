# Reporting and Read Models

## Source-of-truth rule

Transactional PostgreSQL module data and posted ledgers are authoritative. Reporting projections are optimized, rebuildable read models and must never accept commands that change business truth.

## Projection architecture

Transactional outbox events update denormalized PostgreSQL projection tables for availability, rent roll, receivables aging, owner balances, payout queue, brokerage performance, master-lease margin, maintenance SLA, and dashboards. Small authoritative reports may query module-owned read interfaces directly; high-volume/cross-context reports use projections.

## Financial reporting

Trial balance and financial statements derive from journals under the approved accrual policy. Owner statements and material period reports record calculation cut-off, policy/version references, source posting set or reproducible criteria, generated version, approval, and issue/lock status. Later corrections produce supplementary/restated versions without deleting issued history.

## Consistency and access

- Projection lag is measured and displayed where material.
- Consumers are idempotent and can rebuild from source/outbox history or controlled backfill.
- Every query applies permission + branch + object scope; pre-aggregated data includes safe authorization dimensions.
- Exports run as queued jobs, use the requester's authorization snapshot plus revalidation at download, expire, and are audited.
- Sensitive columns are excluded by report contract, not merely hidden in UI.

## Scaling

Index read models by branch, period, status, property, RentableSpace, owner, and service model as needed. Use pagination and queued generation for large reports. Read replicas or a warehouse are later options only after PostgreSQL projection tuning; they do not change source ownership.
