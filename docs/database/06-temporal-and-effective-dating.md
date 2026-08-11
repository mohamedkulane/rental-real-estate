# Temporal and Effective Dating

## Semantics

Business effective periods use `date` and half-open `[effectiveFrom,effectiveTo)` ranges; `NULL effectiveTo` means open-ended. Operational instants such as submission, posting, possession handover, and event occurrence use timezone-safe `timestamptz` (`DateTime @db.Timestamptz(6)`).

## Effective-dated records

- ServiceEngagement scope/status authorization period.
- PropertyBranchAssignment.
- PropertyOwnership and PropertyOwnerEntitlement.
- RentableSpaceVersion and RentableSpaceParentHistory.
- EmployeeBranchAssignment and time-bound role/approval assignments where used.
- RecurringChargeSchedule and master-rent schedules.
- Legal/policy/template versions.

## History rules

Rows are append-only or end-dated; changing an effective fact creates a successor. Historical LeaseVersion records the relevant RentableSpaceVersion and ServiceEngagement. Retroactive corrections require explicit reason/approval and must not change already posted financial or signed-contract interpretation.

## Concurrency

Effective-range creation occurs under a transaction with exclusion/deferred validation. Application checks provide friendly errors; database constraints remain authoritative. Backdated inserts that cross closed periods or issued statements require domain approval and adjustment workflows.
