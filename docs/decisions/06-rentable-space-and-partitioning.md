# Rentable Space and Partitioning Decisions

## Status

The canonical hierarchy and strict area invariant are approved. Measurement and topology operating policies remain open.

## Canonical hierarchy

RentableSpace may exist directly under a Property, inside an optional Building or structural location, or inside another RentableSpace. This supports, for example:

- a standalone house represented by one whole-property RentableSpace;
- a building containing floors and rentable apartments;
- a floor or hall partitioned into shops, booths, or offices; and
- a master-leased parent space containing child sublease spaces.

The hierarchy must not create fake buildings solely to represent commercial partitions.

## Leasing and availability target

Listings, viewings, reservations, brokerage deals, leases, subleases, occupancy, and availability target RentableSpace. Parent and child spaces require explicit exclusivity rules so the same physical area cannot be concurrently promised through different levels.

## Strict area integrity

For any effective active configuration:

`sum(active child usable areas) <= active parent usable area`

No arbitrary override may violate this invariant. Approval cannot legitimize physically inconsistent area data.

## Measurement correction and configuration change

When measurement or layout changes:

1. record the corrected/effective measurement and evidence;
2. validate the affected configuration and future occupancy;
3. create a new effective configuration or successor spaces as appropriate;
4. retire the previous configuration prospectively; and
5. preserve prior spaces, leases, pricing calculations, contracts, and reports.

A change must not edit the area basis used by a signed contract or posted area-based charge. Corrections to posted financial results use adjustment/reversal processes.

## Split and merge history

Split/merge operations create explicit predecessor/successor relationships and execute atomically. Historical identities cannot be hard deleted. Assets, meters, listings, reservations, maintenance, and future contracts must be deliberately reassigned or closed; they must not follow a topology change by accident.

## Vacant land

Vacant land is a RentableSpace type/specialization. It uses land-appropriate area, boundary, permitted-use, access, term, review/escalation, and document data without residential-only fields. Maintenance defaults off and may be enabled only by a specific engagement.

## Related ADRs

- [ADR-001](adr/ADR-001-rentable-space-as-canonical-lease-target.md)
- [ADR-005](adr/ADR-005-parent-child-rentable-space-hierarchy.md)

## Remaining policy dependencies

Detailed design still requires the approved measurement standard, area units/precision, gross versus usable definitions, walls/common/circulation treatment, effective-date overlap rules, parent/child simultaneous marketing, shared occupancy/capacity, code reuse, future partition scheduling, and meter/asset reassignment policy.
