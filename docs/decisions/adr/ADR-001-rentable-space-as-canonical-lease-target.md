# ADR-001: RentableSpace as Canonical Lease Target

## Status

Accepted — 8 August 2026.

## Context

The source documentation uses both `Unit` and `RentableSpace`, while the business must lease houses, apartments, rooms, floors, halls, shops, booths, offices, warehouses, land, parking, and nested commercial partitions. Competing lease targets would fragment occupancy, availability, permissions, and reporting.

## Decision

RentableSpace is the sole canonical occupiable and leasable entity. Listings, viewings, reservations, brokerage deals, leases, subleases, availability, and occupancy target RentableSpace. Property remains the legal/physical asset and Building is an optional container. UI terminology may display type-specific labels, but `Unit` is not an alternative domain target.

## Rationale

One target provides a single place to enforce overlap, lifecycle, availability, hierarchy, and historical-reference rules across all asset types and service models.

## Consequences

- Simple properties still require a whole-property RentableSpace.
- Residential unit terminology becomes a RentableSpace type/presentation concern.
- Existing or imported unit data needs an explicit mapping.
- Occupancy and availability rules become space-centric.
- Property-level legal/ownership concerns stay separate from leasing concerns.

## Alternatives considered

- Keep `Unit` for residential and RentableSpace for commercial: rejected because it duplicates leasing and finance paths.
- Lease Property directly for standalone assets: rejected because it creates multiple target types.
- Generic polymorphic lease target: rejected because it weakens referential and integrity rules.

## Risks

- Developers may recreate Unit as a competing aggregate for convenience.
- A one-to-one Property/RentableSpace can be mistaken for duplicate data.
- Migration may lose stable identifiers or history without a controlled mapping.

## Implementation implications

- Future schema and APIs must use RentableSpace identifiers for lease-target workflows.
- Exclusive overlap constraints and availability projections operate on RentableSpace.
- UI labels derive from type without changing domain identity.
- Migration/compatibility models must be read-only or transitional and non-canonical.
- No schema or migration is authorized by this ADR alone.
