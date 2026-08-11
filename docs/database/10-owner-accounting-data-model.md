# Owner Accounting Data Model

## Entitlement

PropertyOwnership and PropertyOwnerEntitlement are separate effective-dated Decimal percentages. Ownership represents legal/economic interest; payout entitlement controls distribution. Deferred validation prevents overlapping duplicate entitlements and validates configured totals for an effective period.

## Ledger strategy

Do not create an independent mutable OwnerLedger duplicating journals. Owner balances and available payable are derived from JournalLine owner/property/fund dimensions, cleared collection status, reserves, holds, expenses, and in-flight payouts.

`OwnerPayableSnapshot` records a reproducible calculation at a cutoff for approval/use. `OwnerStatement` and `OwnerStatementLine` are immutable issued snapshots with journal/source references and presentation data. They do not replace the ledger.

## Reserves, contributions, payouts

`OwnerReserve` defines/records reserve requirement and held balance linkage. `OwnerContributionRequest` tracks requested/received funding. `OwnerPayout` stores number, owner, cutoff, currency, calculated available amount, proposed/approved/paid amount, status, approval, destination snapshot, and journal linkage. Lines explain property/source allocation. Attempts retain provider reference, failure, retry, and reconciliation.

Payout approval/execution locks or revalidates the payable snapshot and must never exceed available owner payable. Joint-owner rounding uses a deterministic final-recipient rule stored in snapshot lines.
