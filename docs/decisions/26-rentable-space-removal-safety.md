# Rentable Space Removal Safety

## Decision

`RentableSpace` removal is a guarded lifecycle command, not an ordinary CRUD delete.

- The user-facing action is **Remove Unit**.
- The backend owns the disposition decision inside one database transaction.
- Any business or hierarchy history causes the unit to be **retired** and preserved.
- A permanent delete is allowed only for an erroneous, unused unit with no dependent business,
  document, hierarchy, service, operational, contractual, or financial records.
- Active leases and active child spaces must be resolved before retirement.
- Both retirement and permanent deletion require `portfolio.space.update`, branch authorization,
  an effective business date, a reason, and an audit event.

## Preserved history

The dependency guard includes leases and possession, agreements, viewings, reservations,
applications, listings, service engagements, brokerage, charges, expenses, journal dimensions,
maintenance, work orders, inspections, defects, documents, lead preferences, hierarchy, and
successor relationships.

Permanent deletion removes only configuration records owned by the unused unit: its version,
physical profile, and amenity assignments. It never cascades through business history.
