# Database Overview

## Scope and source of truth

PostgreSQL is the transactional source of truth for the modular monolith. Prisma is the primary data-access mapping, but PostgreSQL-native migrations enforce constraints Prisma cannot express. Redis, object storage, and reporting projections are never authoritative for transactional balances or lifecycle state.

## Design choices

- Application-generated UUIDv7-compatible primary keys stored as PostgreSQL `uuid`; business numbers are separate unique fields.
- Prisma models/fields use `PascalCase`/`camelCase`; database tables/columns use `snake_case` via mappings.
- Money `decimal(20,4)`, percentages `decimal(9,6)`, area/utility usage `decimal(20,6)`, exchange rates `decimal(20,10)`; no financial `Float`.
- Currency is ISO 4217 `char(3)` per transaction, with USD as initial default; postings retain transaction and reporting currency/rate.
- Instants use `timestamptz`; business/effective dates use `date`; ranges use half-open `[from,to)` semantics.
- Stable domain identity is separated from effective-dated configuration/history.

## Ownership boundaries

Schemas remain logically module-owned even in one database. No module writes another module's tables. Finance alone writes journals. Reporting tables are rebuildable read models; owner statements and issued financial documents are immutable snapshots.

## Native PostgreSQL features

Use exclusion constraints, partial/functional indexes, check constraints, deferred constraint triggers, and immutable-row triggers for temporal overlap, balanced journals, partition area, signed/posting immutability, and idempotency. These are documented beside the proposed Prisma schema and must ship in reviewed migrations later.

## Chosen modeling patterns

- Party base plus typed profiles for owner, tenant, applicant, vendor, guarantor, and contacts.
- Property + optional Building + canonical RentableSpace.
- Stable RentableSpace with immutable effective RentableSpaceVersion and effective-dated parent relation.
- ServiceEngagement requires Property and optionally targets a RentableSpace; no polymorphic target FK.
- Normal Lease is reused for managed, collection-only, company-owned, and sublease contracts; MasterLease remains specialized.
- Charge is the authoritative receivable; Invoice is a presentation/legal grouping over charges.
- Journals are authoritative accounting; owner payable is a reproducible projection/snapshot, not a duplicate ledger.
- Transactional outbox and idempotency records live in PostgreSQL.
