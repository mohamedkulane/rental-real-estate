# Data Integrity Rules

## Declarative constraints

- UUID PKs; natural/business numbers use separate scoped unique constraints.
- Nonnegative/positive checks for amounts, rates, areas, allocation factors, and ownership percentages as appropriate.
- Currency is three uppercase letters; debit/credit lines use one signed amount convention or mutually exclusive debit/credit columns (proposed schema uses signed amount).
- Effective ranges require `effective_to > effective_from` when bounded.
- Ownership and payout entitlement percentages use Decimal and sum rules are checked by deferred triggers over effective dates.
- Payment allocation totals cannot exceed posted payment available amount or charge open amount.
- Refund/deduction/transfer cannot exceed available liability/credit/payable.

## Temporal/native constraints

- GiST exclusion prevents overlapping active exclusive LeasePossession ranges per RentableSpace.
- GiST exclusions prevent same-scope incompatible active ServiceEngagements; compatibility/inheritance uses a deferred trigger because it spans rows and hierarchy.
- RentableSpaceVersion and parent-history intervals cannot overlap for the same governed identity.
- Parent cycles and temporal containment are rejected; deferred triggers validate active child area totals.

## Immutability

Triggers prohibit UPDATE/DELETE on posted JournalEntry/JournalLine/source links, posted Payment financial fields/allocations except controlled status transitions, DepositTransaction, reconciled/paid OwnerPayout financial snapshots, AuditLog, signed LeaseVersion content, and processed OutboxEvent identity/payload. Corrections append reversal/adjustment records.

## Balance and source integrity

A deferred constraint trigger validates every posted JournalEntry sums JournalLine signed amounts to zero per currency/reporting currency policy. JournalSourceLink has an exactly-one-source check. Source business record, journal, and outbox insert occur in one transaction.

Exact SQL strategies are in `prisma/design/postgresql-native-constraints.sql.md`.
