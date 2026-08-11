# ADR-005: Parent-Child RentableSpace Hierarchy

## Status

Accepted — 8 August 2026.

## Context

Commercial halls/floors and master-leased spaces may be partitioned into smaller rentable spaces without corresponding building structures. Layouts can change, while historical leases must keep their original physical context. Active child areas must remain physically consistent with the parent.

## Decision

RentableSpace supports a parent-child hierarchy independent of optional Building containment. Split, merge, retirement, and measurement changes preserve effective configuration and predecessor/successor history. In every active configuration, total active child usable area must not exceed active parent usable area. No arbitrary override is allowed.

## Rationale

The hierarchy represents real commercial and sublease arrangements without fake buildings, while strict area and history rules protect availability, pricing, contracts, and reporting.

## Consequences

- Topology and measurements need temporal/version context.
- Parent/child simultaneous marketing or occupancy requires explicit exclusivity rules.
- Layout changes cannot mutate historical lease references.
- Split/merge affects listings, meters, assets, maintenance, pricing, and future contracts.
- Area-based calculations must retain the measurement basis used.

## Alternatives considered

- Force every partition into Property/Building/Unit: rejected because it invents physical structures and cannot model arbitrary nesting.
- Store only current parent-child rows: rejected because historical layouts become unreproducible.
- Permit manager-approved excess area: rejected because approval cannot make inconsistent physical measurements valid.

## Risks

- Ambiguous gross/usable/common-area definitions can still produce incorrect totals.
- Concurrent topology changes can conflict with reservations or future leases.
- Reused codes can make history ambiguous.

## Implementation implications

- Future persistence must support effective configurations and predecessor/successor relationships.
- Split/merge/retire operations are transactional and validate occupancy and area.
- Historical records are retained and cannot be hard deleted.
- Measurement units, precision, common area, code reuse, and asset reassignment require policy approval.
- No schema is authorized by this ADR alone.
