# Contract Lifecycle Decisions

## Status

Contract immutability and version preservation are approved. Jurisdiction-specific contract events, parties, notices, and exception workflows remain open.

## Governing decision

A signed contract is an immutable legal artifact. It must not be regenerated over or silently replaced after signing. Operational records may progress through lifecycle states, but the exact signed content and evidence remain retrievable.

## Approved change mechanisms

Contract changes use an explicit legal/operational record appropriate to the event:

- amendment;
- renewal;
- termination;
- cancellation or voiding where legally valid; or
- replacement/version workflow where legally appropriate.

Every mechanism must identify its source contract, effective date, parties/signatures, reason or authority, and effects on future obligations. It must not rewrite prior posted charges, signed terms, occupancy history, or prior reports.

## Contract and operational record separation

The architecture should distinguish:

- structured operational terms used by workflows;
- generated draft document versions;
- approvals;
- signer identity and signature evidence;
- final signed artifact and integrity hash;
- amendments/renewals/termination records; and
- current operational status.

Correcting contact details or current status must not mutate the signed artifact. If an operational correction changes a legally material term, it requires an approved contract-change mechanism.

## Contracts in scope

The immutability rule applies to management/service agreements, brokerage/placement confirmations where signed, managed leases, master leases, subleases, commercial and land leases, renewals, and other signed agreements.

## RentableSpace and service context

Each contract must preserve the RentableSpace identity/configuration and service engagement context relevant at signing/effectiveness. Later space partitioning or service-model changes cannot reinterpret the original contract.

## State-machine requirement

Detailed design must define commands, guards, side effects, terminal states, and permissible transitions for draft, review, approval, signature, activation, amendment, renewal, notice, termination, expiry, cancellation/voiding, supersession, and archive.

## Related ADR

- [ADR-006](adr/ADR-006-contract-versioning-and-immutability.md)

## Remaining policy dependencies

The business and legal reviewers must still approve required parties/signatures, waiver authority, activation prerequisites, notice rules, renewal/holdover, early termination, eviction/abandonment, replacements/voids, local templates, retention, and signature providers/evidence.
