# ADR-006: Contract Versioning and Immutability

## Status

Accepted — 8 August 2026.

## Context

Leases, management agreements, master leases, subleases, and deal confirmations carry legal and financial meaning. Regenerating a document after signature or editing its terms in place would destroy evidence and could retroactively change charges, occupancy, or party obligations.

## Decision

Signed contracts are immutable. Changes use explicit amendments, renewals, termination records, or legally appropriate replacement/version workflows. Every signed version and its signature/integrity evidence remains retrievable and linked to the operational lifecycle.

## Rationale

Explicit contract history protects parties, supports disputes and audits, and ensures later operational changes do not rewrite the agreement relied upon at the time.

## Consequences

- Draft, approval, signature, signed artifact, and operational status are distinct concerns.
- Structured terms used by workflows need version/effective references.
- Amendments and renewals affect future obligations prospectively under approved rules.
- Storage and retention must preserve signed artifacts and evidence.

## Alternatives considered

- Overwrite a generated file while keeping metadata history: rejected because the signed content itself is lost.
- Store only the latest consolidated contract: rejected because original and amendment sequence cannot be proven.
- Treat audit before/after values as contract history: rejected because an audit log is not a signed legal artifact.

## Risks

- Operational fields and signed terms can drift if lifecycle integration is weak.
- Replacement/void rules may differ by jurisdiction.
- Sensitive signed documents require strong access and retention controls.

## Implementation implications

- Signed binaries and hashes are immutable and privately stored.
- Contract versions link to predecessor/amendment/renewal/termination records.
- Activation and future charge rules cite the governing signed version.
- Authorization and audit apply to generation, approval, signature, voiding, and download.
- Local legal state transitions and retention remain prerequisites.
