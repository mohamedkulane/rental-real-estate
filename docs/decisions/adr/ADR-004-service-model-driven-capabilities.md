# ADR-004: Service-Model-Driven Capabilities

## Status

Accepted — 8 August 2026.

## Context

The same RentableSpace type can be brokered, placed, fully managed, collection-only, master leased/subleased, or company-owned. Inferring operations from physical type or duplicating feature flags across modules would cause invalid billing, payout, or maintenance behavior.

## Decision

An effective service engagement is the authoritative source of enabled capabilities. Physical RentableSpace type does not determine the company's commercial role. Backend commands, scheduled jobs, and integrations must enforce engagement eligibility. Optional services must be explicitly enabled.

## Rationale

Centralized, effective-dated capability policy prevents model leakage, supports transitions without rewriting history, and keeps accounting and workflow behavior aligned with signed commercial authority.

## Consequences

- Every downstream workflow needs engagement/model context.
- Brokerage and tenant placement stop recurring processes at closure/handoff.
- Rent collection only enables its defined finance capabilities without full management by default.
- Master lease/sublease uses company economics rather than managed-owner payout.
- Land remains a physical specialization and can participate in an applicable service model.

## Alternatives considered

- Feature enablement based on RentableSpace type: rejected because physical type and business model are independent.
- Boolean flags independently stored in each module: rejected due to drift and inconsistent enforcement.
- Hard-coded workflows per property category: rejected due to duplication and inability to support model changes.

## Risks

- Engagement inheritance and transition rules remain unresolved.
- A permissive default could accidentally enable sensitive features.
- Historical records may be reinterpreted if model context is not retained.

## Implementation implications

- Capability checks are deny-by-default and enforced server-side.
- Engagements are effective-dated, scoped, versioned, and linked to authorizing agreements.
- Generated jobs record the engagement/policy version used.
- Model changes are auditable and prospective.
- Detailed inheritance, transition, and offboarding rules require separate approval.
