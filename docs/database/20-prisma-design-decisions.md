# Prisma Design Decisions

## Mapping

Prisma models use PascalCase and singular names; fields/relations use camelCase. `@@map` and `@map` produce snake_case PostgreSQL names. Constraint/index names use `pk_<table>`, `fk_<table>__<column>`, `uq_<table>__<columns>`, `ix_<table>__<columns>`, `ck_<table>__<rule>`, `ex_<table>__<rule>`, and `trg_<table>__<purpose>`.

## IDs and types

IDs are application-generated UUIDv7-compatible values stored as `uuid`; no business meaning in PKs. Decimal mappings: money 20,4; percent 9,6; area/usage 20,6; FX 20,10. Business dates map to `Date @db.Date`; instants to `DateTime @db.Timestamptz(6)`. JSON is limited to snapshots/payloads, never the only financial dimension or core relationship.

## Relational choices

- Party base + typed one-to-one profiles.
- ServiceEngagement has required property FK and optional RentableSpace FK with native same-property/compatibility checks.
- Stable RentableSpace + version + effective parent history.
- LeaseVersion references RentableSpaceVersion and DocumentVersion.
- Charge is authoritative; InvoiceLine references Charge.
- Normal Lease specializes sublease via optional MasterLease FK.
- JournalSourceLink uses explicit nullable source FKs plus exactly-one check.
- Owner ledger remains derived from journals; statements/payables are snapshots.

## Prisma limitations

Prisma cannot natively describe GiST exclusion constraints, range expressions, deferred balance/area triggers, partial/functional indexes, immutable-row triggers, or all check constraints. `schema-proposed.prisma` remains reviewable mapping; companion SQL becomes part of future migrations. Drift checks must treat native SQL as first-class rather than letting Prisma silently remove it.

## Review answers

1. Core entities are catalogued in `01-entity-catalog.md` and proposed schema.
2. Aggregate roots versus support/reference entities are explicitly catalogued.
3. Native-only constraints are listed in the Prisma design package.
4. Immutable classes are defined in `17-soft-delete-and-retention-policy.md`.
5. Effective-dated records are defined in `06-temporal-and-effective-dating.md`.
6. Main transaction boundaries are source + subledger + journal + source link + outbox; lease possession activation; space reconfiguration; payout/deposit/payment operations; approval + protected transition.
7. Main indexing risks are write amplification on journals/audit/temporal GiST indexes and nullable dimension bloat.
8. Remaining choices: approved chart/account codes, detailed legal/config reference data, exact report projections/partition thresholds, and UUIDv7 generation mechanism supported by the chosen PostgreSQL/runtime version.
9. The proposed schema is ready for structured review, not yet direct promotion to production `prisma/schema.prisma` until native SQL and finance/legal mappings are approved and tested.
10. Step 5 is ready after that review gate; no repository scaffold should start before it.
