# Phase 1 Database Test Plan

## Purpose

These tests become executable when the repository foundation provides Prisma/PostgreSQL test tooling. They must run against an isolated disposable database; never production.

## Schema tests

1. Run `prisma format --schema prisma/design/schema-candidate.prisma --check` or the version-equivalent parser check.
2. Run `prisma validate` with a test `DATABASE_URL` and no generation/migration.
3. Assert unique model/enum names, all declared relations resolve, all mapped table names are unique, no `Unit` model exists, and RentableSpace is the only lease/reservation target.
4. Static rule: financial/percentage/area/FX fields use Decimal mappings and no `Float`.
5. Static rule: business validity fields use `@db.Date`; instants use `@db.Timestamptz(6)`.

## Native constraint tests

Using a disposable PostgreSQL database with the candidate DDL/native package:

- Insert overlapping active exclusive possessions for one RentableSpace: second transaction rejected.
- Insert adjacent `[end = next start]` possessions: both accepted.
- Insert two active engagements on the same scope/date: rejected.
- Insert approved compatible child override/inherited engagement in adjacent/valid ranges: accepted.
- Insert hierarchy cycle or cross-property parent: rejected.
- Insert children whose effective usable area exceeds parent: commit rejected; valid total accepted.
- Insert overlapping ownership for the same owner/property or total above 100%: rejected; valid effective succession accepted.
- Insert duplicate verified/posted scoped payment reference and duplicate idempotency key: rejected.
- UPDATE/DELETE posted journal or line: rejected.
- UPDATE/DELETE signed LeaseVersion: rejected.
- UPDATE/DELETE AuditLog: rejected.
- Reconsume same outbox event for one consumer: composite PK rejects duplicate.

Run contention variants with two concurrent transactions, not only sequential inserts.

## Financial integrity tests

- Balanced two-or-more-line journal posts and commits.
- Unbalanced or single-line POSTED journal fails at commit despite application bypass.
- DRAFT journal may be incomplete but cannot affect posted balances.
- Reversal posts a new balanced opposite journal; original remains unchanged.
- CLOSED/LOCKED period rejects ordinary posting; authorized correction posts only in eligible period.
- Deposit receipt credits Security Deposits Held and never income.
- Deposit transfer produces paired explicit movements; disputed amount cannot be refunded/deducted until resolution.
- Tenant overpayment credits Tenant Credits liability until allocated/refunded.
- Owner funds do not post to company income except explicit fee entitlement.
- Owner payout calculation uses cleared owner-entitled funds and cannot exceed available payable.
- Master rent posts company expense/liability; sublease rent posts company receivable/income.

## Migration and seed tests for the future production schema

- Apply migrations to an empty database, load deterministic reference/COA seed, and validate checksums/counts.
- Upgrade from the previous released schema with representative data and native constraints.
- Run migration twice only where scripts are intentionally idempotent; verify Prisma migration history.
- Rebuild a disposable database from backup/migrations and reconcile journals/subledgers.
- Test rollback by restoring the pre-migration backup or rolling application forward; destructive down migrations are not assumed.
- Verify native SQL remains present after Prisma operations and drift detection covers it.

## Evidence

Store SQL/Prisma version, migration hash, test output, concurrency traces, reconciliation totals, and reviewer sign-off. Any critical constraint failure fails the phase/release gate.
