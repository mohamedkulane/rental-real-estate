# ADR-002: Double-Entry Accounting from Foundation

## Status

Accepted — 8 August 2026.

## Context

The system handles company money, owner/client money, deposits, receivables, payables, property expenses, commissions, and master/sublease economics. The earlier roadmap deferred full GL screens while the business rules required production-grade financial integrity.

## Decision

Journal-backed double-entry accounting is part of the MVP foundation. Account, JournalEntry, JournalLine, and AccountingPeriod are core concepts from the start. Advanced finance screens and reports may be phased, but material financial source events must create balanced, traceable postings.

## Rationale

Adding double entry after operational balances exist would require risky reclassification and migration. Foundation-level posting supports reconciliation, reversals, auditability, owner accounting, and reliable financial reporting.

## Consequences

- Finance policy and chart design precede detailed financial implementation.
- Operational events need documented accounting mappings.
- Posting services become shared controlled infrastructure.
- Period and reconciliation semantics cannot be deferred completely.
- MVP scope includes accounting correctness even if user-facing accounting features are limited.

## Alternatives considered

- Mutable balance fields with later GL migration: rejected due to reconciliation and history risk.
- Cashbook-only MVP: rejected because deposits, owner payable, receivables, and accrual obligations cannot be represented safely.
- External accounting system as sole ledger: rejected as the system must enforce operational-financial invariants and source linkage.

## Risks

- Unapproved accounting policy could be mistaken for a technical choice.
- An overly generic posting engine may obscure domain meaning.
- Scope may expand if advanced accounting UI is confused with foundation posting.

## Implementation implications

- Each source transaction retains journal linkage and dimensions needed for approved reports.
- Multi-line postings are atomic and idempotent.
- Authoritative balances come from posted ledgers/subledgers.
- Accounting periods and closed-period enforcement apply to all posting paths.
- Chart, basis, recognition, currency, and reporting decisions remain prerequisites.
