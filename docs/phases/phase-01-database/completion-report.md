# Phase 1 — Database & Data Architecture

Status: Complete — design gate passed on 8 August 2026.

## Deliverables

- Consolidated review candidate: `prisma/design/schema-candidate.prisma`.
- Consolidated native PostgreSQL review package: `prisma/design/native-constraints-candidate.sql`.
- UUID strategy, minimum Chart of Accounts, journal-balancing strategy, effective-dating review, and retention matrix in `docs/database/21-25`.
- Phase test plan and acceptance criteria under `docs/phases/phase-01-database/`.
- Existing Step 4 database catalog, ERDs, Prisma review material, index/native-constraint notes, migration strategy, and reference-data design retained as supporting evidence.

## Validation performed

- Static candidate scan found 130 unique models and 15 unique enums.
- No duplicate model names, enum names, or PostgreSQL `@@map` table names.
- All declared relation target types exist in the candidate; no unresolved relation target names were found.
- Required core models are present and no `Unit` model exists.
- Candidate delimiter/brace balance is valid.
- No Prisma `Float` fields; 128 Decimal declarations cover monetary/percentage/measurement values.
- Required native controls were found for lease overlap, engagement scope, hierarchy/area, ownership, payment idempotency, journal balance/immutability, signed contracts, audit append-only behavior, and outbox processing.
- `prisma/schema.prisma` does not exist; no production schema promotion, migration, generation, package installation, or application implementation occurred.

An official Prisma parser was not available in the workspace and was not installed because this phase prohibits package installation. Official `prisma format/validate` and executable PostgreSQL concurrency tests are the first mandatory foundation checks in the approved test plan. This is a tooling deferral, not a known model contradiction.

## Remaining issues

No critical database-design contradiction remains. Before production promotion:

- consolidate the approved Chart of Accounts seed into implementation data;
- choose the vetted runtime UUIDv7 library;
- validate the candidate with the exact Prisma/PostgreSQL versions selected for Phase 2;
- complete executable trigger functions/tests against disposable PostgreSQL; and
- approve the seeded ServiceModel compatibility matrix and jurisdiction-specific configuration values.

## Risks

- Native exclusions and deferred triggers add write/concurrency cost and require contention testing.
- Prisma schema operations can drift from native SQL unless migration CI treats companion SQL as first-class.
- Journal/audit growth and nullable dimension indexes can cause storage/write amplification.
- Retroactive effective-dated corrections can affect reports and therefore require approval/snapshot discipline.
- Generic document/audit/approval entity locators require service-layer authorization and target-side FKs where sensitive workflows reference approvals.

## Deferred items

- Production `prisma/schema.prisma` and migrations.
- Prisma Client generation and repository code.
- Application services, APIs, authentication, UI, jobs, Docker, and infrastructure.
- Jurisdiction-specific tax/statutory accounts and legal configuration values.
- Shared occupancy, advanced reporting partitions, and measured-volume partitioning.

## Gate result

PHASE GATE: PASS

Phase 2 has not been started. PASS authorizes only an explicitly requested next phase; it does not itself authorize implementation.
