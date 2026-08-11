# Database and temporal review

## Schema parity

The operational Prisma schema contains 46 Phase 1-4 models mapped to 46 migrated tables. The governance script compares every `@@map` table against all migration `CREATE TABLE` statements and rejects future runtime models. The complete future design remains review-only under `docs/database/prisma-design/`.

## Property lifecycle

`property_lifecycle_history` provides non-overlapping effective intervals. DRAFT history may be incomplete. Deferred PostgreSQL validation applies ownership, payout-entitlement, and exactly-one-branch totals only to actual ACTIVE intervals. The API transition matrix is:

- DRAFT -> ACTIVE
- ACTIVE -> INACTIVE
- INACTIVE -> ACTIVE
- INACTIVE -> RETIRED

RETIRED is terminal. Status is not accepted by generic update. Every transition requires a reason and writes lifecycle-specific audit evidence.

## Unified effective dating

Company timezone determines business date. DATE values remain date-only; audit/session instants remain timestamptz. Corrections may go back at most one year, changes may be scheduled at most one year ahead, and lifecycle transitions are today-only. Branch, ownership, measurement, hierarchy, retirement, employee branch, and employee role replacements reject hidden same-day/later scheduled rows until those rows are cancelled. Same-day role removal is an audited cancellation, avoiding an invalid zero-length DATE interval.

## Native integrity

PostgreSQL remains final authority for overlap exclusion, 100% ownership/payout during ACTIVE periods, exactly one ACTIVE branch, hierarchy cycles/cross-property parents, child-area totals, role/branch containment, immutable document versions, and unique business numbers. API prevalidation improves feedback without replacing native constraints.

## Migration proof

- isolated empty DB -> eight migrations: PASS
- isolated Phase 3-only migration -> remaining six migrations: PASS
- seed on the isolated fresh DB twice: PASS
- no Phase 5 tables created: PASS
