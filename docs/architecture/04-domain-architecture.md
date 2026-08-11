# Domain Architecture

## Layering inside each module

- **Interface:** REST controllers and event/job adapters; transport validation only.
- **Application:** commands, queries, authorization, orchestration, idempotency, transaction coordination.
- **Domain:** aggregates, value objects, policies, invariants, state transitions, and domain events.
- **Infrastructure:** Prisma repositories, SQL constraints, outbox, providers, object storage, and BullMQ adapters.

Only public application interfaces cross module boundaries. Domain classes and repositories are private to their module.

## Key aggregate boundaries

- ServiceEngagement controls lifecycle, effective scope/model, compatibility, and capability inheritance.
- RentableSpaceConfiguration controls effective topology/measurement; atomic partition commands span the affected parent configuration and child successors.
- Reservation controls a temporary availability block, not occupancy.
- Lease controls immutable contract-version links and exclusive possession lifecycle.
- Payment controls receipt/posting/reversal state; allocations are Finance-owned.
- DepositAccount/ledger controls contributor-specific liability and disputed/available amounts.
- OwnerPayout controls calculation snapshot, maker-checker approval, execution attempts, failure/retry, and reconciliation.
- JournalEntry is the atomic balanced accounting aggregate.

## Temporal model

Effective-dated facts use non-overlapping validity intervals and immutable history: service engagements, ownership and payout entitlement, property branch assignments, space configurations, charge rules, contract versions, and policy/template versions. Business dates are distinct from system recorded-at timestamps.

## Invariants

- No incompatible active engagement overlap after inheritance resolution.
- Active child usable area never exceeds active parent usable area.
- MVP possession is exclusive; overlapping active possession intervals are prohibited.
- Reservations block availability but do not create occupancy.
- Signed contract versions and posted financial entries are immutable.
- Posting is balanced and allowed only in the period state permitted by policy.
- Payout does not exceed available owner payable based on cleared/verified owner-entitled collections.

## Domain events

Events describe completed facts in past tense and contain stable identifiers, occurrence time, correlation/causation IDs, branch/security context where appropriate, and schema version. Consumers must be idempotent. Events do not expose secrets or full documents.

## Error and concurrency strategy

Commands use optimistic concurrency for ordinary edits and row/advisory locking or PostgreSQL constraints for high-contention invariants. Business conflicts return stable error codes. Retrying a command with the same idempotency key returns the original outcome.
