# ADR 15: Phase 5.1 Service Engagement policy

## Status

Accepted for Phase 5.1 on 2026-08-25.

## Context

Property and RentableSpace describe the physical/legal portfolio. They must not encode the commercial authority under which the company markets, leases, collects, or manages an asset. Later Phase 5 modules need one auditable decision point and must not scatter `ServiceModel` checks through controllers or UI code.

## Decision

`ServiceEngagement` is the effective-dated commercial-policy aggregate. It has a company, Property, optional RentableSpace override, Service Model, half-open effective period `[effectiveFrom, effectiveTo)`, explicit lifecycle, stable `ENG-*` number, optimistic version, creator, append-only lifecycle history, and audit trail.

The compatibility policy is deny-by-default. `SALE_BROKERAGE` may overlap one rental-oriented model at the same exact scope. All other different pairs are incompatible; duplicate models are incompatible; `COMPANY_OWNED` is exclusive. Database triggers serialize activation by scope and reject invalid overlap even when writes bypass the API.

`COMPANY_OWNED` is commercial authority, not a substitute for ownership. Activation requires the Company canonical Party to own the Property for the full Engagement period.

The resolver accepts Property, optional RentableSpace, and business date. A Space-scoped rental model overrides inherited Property rental authority. Property sale authority remains inherited. With no effective active Engagement, every capability is false. Later modules must consume the resolver instead of examining models themselves.

Lifecycle transitions are:

- Draft → Active or Cancelled.
- Scheduled Active → Cancelled.
- Current Active → Inactive.
- Ended Active is displayed as Expired.
- Activated scope and policy fields are immutable; notes remain correctable and policy changes use an ended Engagement plus successor.

Authorization combines granular permissions with current effective Property branch scope and company isolation. Resolution at another business date uses the Property branch effective on that date.

The canonical V3 documentation establishes blue as the product identity. Where the older v1 design reference uses emerald examples, Phase 5.1 follows V3 blue tokens (`#0D47A1`, `#2196F3`, `#90CAF9`, `#E3F2FD`) without changing the established layout language.

## Consequences

- Phase 5.2 and later modules have a single deny-by-default capability source.
- Effective policy is queryable historically and is not inferred from Property type.
- Direct database writes cannot bypass the primary ownership, scope, overlap, or history invariants.
- Phase 5.2 remains unimplemented until explicit approval.
