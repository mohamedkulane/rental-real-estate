# ADR-003: Immutable Posted Financial Records

## Status

Accepted — 8 August 2026.

## Context

Silent edits or deletion of posted payments, charges, deposits, fees, expenses, payouts, and allocations would invalidate receipts, owner statements, reconciliations, audit evidence, and closed-period reports.

## Decision

Posted financial records are immutable and cannot be physically deleted. Corrections use linked reversal or adjustment entries with reason, actor, authorization, source reference, and accounting-period context. Draft/unposted correction rules remain controlled but may be less restrictive.

## Rationale

Append-only financial history makes balances explainable, supports reconciliation, protects issued evidence, and preserves what users and external parties relied upon.

## Consequences

- Corrected records remain visible with their correction chain.
- User interfaces need reversal/adjustment workflows, not edit/delete actions.
- Downstream statements and payouts require impact handling when sources are corrected.
- Retention/privacy processes must preserve legally required finance evidence while minimizing personal data.

## Alternatives considered

- Allow privileged in-place edits with audit before/after: rejected because the authoritative record still changes.
- Soft-delete posted rows: rejected because balances and reports can exclude them inconsistently.
- Rebuild history only from audit logs: rejected because audit logs are evidence, not the accounting ledger.

## Risks

- Reversals can be misused without approval and reason controls.
- Correction chains can become difficult to present.
- Closed-period and already-paid-owner impacts may be mishandled if policies are incomplete.

## Implementation implications

- Posted-state storage rules prevent update/delete through every application path.
- Reversal/adjustment commands are idempotent, authorized, audited, and journal-backed.
- Original receipt/reference remains retrievable and is marked with correction status rather than erased.
- Period policy determines the posting date of corrections.
- Reports follow correction chains and preserve issued snapshots where required.
