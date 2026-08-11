# Domain Model Decisions

## Status

Approved direction for conceptual architecture. No schema is authorized by this record.

## Canonical asset and occupancy concepts

### Property

Property represents the legal and physical real-estate asset or site. It owns or contextualizes:

- ownership interests and legal identity;
- location and property-level classification;
- management/service relationships where applicable;
- property-level documents; and
- optional physical containers such as buildings.

Property does not itself become the universal lease target.

### Building

Building is an optional physical container within a property. Land and standalone assets do not require a fictitious building. A building may contain structural locations and rentable spaces.

### RentableSpace

RentableSpace is the canonical resource that may be offered, viewed, reserved, brokered, leased, subleased, occupied, or marked unavailable. Lease, sublease, reservation, viewing, brokerage deal, listing/availability, and occupancy logic must converge on RentableSpace.

RentableSpace types include apartment, room, office, shop, booth, hall, floor, warehouse, land, parking space, storage space, and an entire house or villa where appropriate.

### Unit terminology

`Unit` must not remain a second canonical lease target. Product copy may use familiar terms such as unit, apartment, shop, or booth, but those labels describe RentableSpace types or views. Any retained legacy `Unit` concept may only be a non-competing compatibility/read model during migration and must have a defined removal path.

## Simple and hierarchical assets

A standalone house can be modeled as one Property with one whole-property RentableSpace. More complex arrangements can be modeled as:

`Property -> Building -> RentableSpace -> child RentableSpace`

or as nested RentableSpaces where physical and leasing context require it. Parent-child hierarchy must not require fake building records.

## Service and physical dimensions

Space type answers what is rented. Service model answers the company's commercial role. They are independent. Vacant land is a RentableSpace specialization, not a service model. Land-specific validation excludes irrelevant residential fields and maintenance defaults off unless its service engagement explicitly enables it.

## Temporal and historical model

- Service engagements are effective-dated and drive capabilities.
- Signed contracts retain historical RentableSpace and service-model context.
- Space measurement/configuration changes are versioned or represented by retirement and successors.
- Current display labels and status must not rewrite historical contract or report meaning.
- Physical containment, occupancy, marketing, pricing, and operational lifecycle are distinct concerns even when exposed together in the UI.

## Resulting invariants

- Exclusive occupancy overlap is enforced against RentableSpace.
- Availability is derived from valid lifecycle facts and not independently contradicted by a legacy Unit flag.
- Every child RentableSpace has a stable identity within its configuration context.
- Active child usable area never exceeds active parent usable area.
- Historical spaces referenced by contracts or transactions cannot be hard deleted.
- Service-model changes do not reclassify previous deals, leases, or financial records.

## Related ADRs

- [ADR-001](adr/ADR-001-rentable-space-as-canonical-lease-target.md)
- [ADR-004](adr/ADR-004-service-model-driven-capabilities.md)
- [ADR-005](adr/ADR-005-parent-child-rentable-space-hierarchy.md)

## Remaining policy dependencies

Architecture still requires decisions on shared occupancy, interval semantics, engagement scope inheritance, service offboarding, measurement standards, common areas, and branch transfer history. These do not reopen RentableSpace as the canonical target.
