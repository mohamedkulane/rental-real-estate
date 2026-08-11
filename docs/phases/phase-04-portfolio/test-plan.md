# Test Plan

## Unit

- Authenticated encryption round-trip, tamper rejection, and normalized contact hashing.
- Area/unit pairing and land-profile validation.
- Aggregate partition area rejection before persistence.
- Existing authorization, authentication, governance, audit, health, and password regressions.

## PostgreSQL integration

- Draft-to-active completeness gate.
- Non-overlapping operating-branch history.
- Native parent-area enforcement.
- Native cycle and cross-property hierarchy enforcement.
- Immutable document versions.
- Existing Phase 3 persistence and readiness integration tests.

## End-to-end

- Person Party, encrypted contact, Owner, organization Owner, joint ownership with distinct payout, activation, and owner portfolio.
- Standalone RentableSpace and commercial partition hierarchy.
- Excess area and cycle rejection.
- Land specialization without residential data.
- Branch-scoped object denial and filtered list behavior.
- Portfolio audit evidence with sensitive-value exclusion.
- Existing Phase 2/3 foundation, identity, governance, session, and authorization regressions.

## Gate commands

`pnpm prisma:format`, `pnpm prisma:validate`, `pnpm prisma:generate`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, and `pnpm build`.

Database rehearsals run all migrations and idempotent seed data against an empty database and apply Phase 4 to a completed Phase 3 database.
