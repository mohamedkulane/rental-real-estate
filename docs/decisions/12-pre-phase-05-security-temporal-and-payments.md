# ADR 12: Pre-Phase-5 security, temporal, and payment controls

Status: Approved for the Phase 1-4 production baseline
Date: 2026-08-11

## Decisions

1. **Property lifecycle:** Property status changes use explicit activate, deactivate, reactivate, and retire commands. Generic edits cannot change status. Allowed transitions are DRAFT -> ACTIVE, ACTIVE -> INACTIVE, INACTIVE -> ACTIVE, and INACTIVE -> RETIRED. Every transition records a reason and effective lifecycle history. Active-period ownership, payout, and branch integrity is enforced by deferred PostgreSQL triggers without retroactively treating DRAFT periods as ACTIVE.
2. **Business dates and effective changes:** Company timezone determines the business date. Initial history and corrections may be backdated no more than one year; future operational changes may be scheduled no more than one year ahead. Property lifecycle changes are current-business-date only. Existing same-day/later changes must be cancelled before replacement. Mutation reasons and audit evidence distinguish corrections from ordinary changes.
3. **Shared Party writes:** The conservative policy in ADR 10 remains approved: a shared Party identity change requires permission across every currently related branch, or explicit company-wide permission. Directory read permission does not disclose full contacts. Full phone/email detail requires `party.contact.read` within authorized scope.
4. **PII:** Arbitrary person identification metadata is no longer accepted. National ID/passport secrets and document binaries must not be stored in generic JSON or audit payloads. Document binaries belong in approved object storage; PostgreSQL retains safe metadata. Contact values use versioned AES-256-GCM and domain-separated HMAC-SHA-256 search indexes.
5. **Identifiers:** New application IDs use UUIDv7-compatible values. Existing UUIDv4 values remain valid. RentableSpace business numbers use neutral `SPC-####`; generated legacy `UNIT-####` values are migrated when collision-free.
6. **MVP payments:** Tenants pay outside the system by cash, EVC Plus, eDahab, bank transfer, or another approved channel. Authorized staff manually records evidence and verifies/posts the payment. A payment gateway or webhook is not required for MVP. Manual entry still requires reference/proof, audit evidence, immutable posting, reversals instead of deletion, and maker-checker controls.

## Consequences

Phase 5 design must use these controls as constraints and may not weaken them. Automatic payment integration can be proposed later as an optional channel through a separate approved ADR; it cannot replace the manual controlled workflow without approval.
