# Rentable Space Hierarchy

## Chosen pattern

Use three layers:

1. `RentableSpace` — stable identity, property ownership, type, business code, lifecycle.
2. `RentableSpaceVersion` — immutable effective measurements/descriptions/pricing basis.
3. `RentableSpaceParentHistory` — effective-dated child-to-parent relation, optionally citing child/parent versions for reproducibility.

This separates a space's identity from measurement/topology changes and allows splits/merges through predecessor/successor links without rewriting historical leases.

## Contract references

Lease references stable `rentableSpaceId`; each immutable LeaseVersion also records `rentableSpaceVersionId`. Historical reports therefore retain the measured/configured space used at signing even after a new layout.

## Constraints

- Space and parent belong to the same Property.
- No self-parent or cycle; one active parent relation per child at an effective instant.
- Relation effective interval must be covered by compatible active versions.
- Sum of active child usable area at any effective instant cannot exceed parent usable area.
- Split/merge retirement and successor links execute atomically and cannot strand active reservations/possessions.

Area-sum and cycle checks require deferred PostgreSQL triggers because they span multiple rows/ranges. Application commands take a property/parent-scoped lock to provide deterministic concurrent behavior.
