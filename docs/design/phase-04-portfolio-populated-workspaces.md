# Phase 4 Portfolio populated workspaces

## Outcome

The hierarchical Portfolio navigation now opens a dedicated, data-backed workspace for every
child destination. Child navigation is no longer implemented as a context banner above the parent
directory.

## Data ownership

- People and Organizations remain filtered views of the authoritative Party directory.
- Owner Directory remains the owner CRUD entry point. Owned Properties and Documents aggregate
  the effective owner detail and document endpoints for the owners on the current authorized page.
- Property Overview remains the property CRUD entry point. Buildings, Spaces, Ownership,
  Amenities, Documents, Branch History, and Activity aggregate the corresponding collections from
  the authoritative property detail endpoint.
- Rentable Space Overview remains the space CRUD entry point. Hierarchy, Measurements, Space
  Details, Amenities, Documents, and Lifecycle aggregate the corresponding collections from the
  authoritative rentable-space detail endpoint.
- Amenity Catalog remains the canonical amenity management page.

No duplicate portfolio state is introduced in the web application. Aggregate workspaces reload
the existing REST resources and preserve backend authorization as the source of truth.

## Empty and failure states

Every child workspace renders one of three explicit states:

1. a loading state while authorized detail data is fetched;
2. a visible error state if the authoritative API cannot supply the workspace;
3. a descriptive zero state when the selected records genuinely have no matching child data.

A zero state explains that nothing is hidden and directs staff to maintain the information through
the corresponding parent record. No route intentionally renders an empty content surface.

## Responsive behavior

Workspace summaries use responsive metric grids and record cards. Cards collapse from three
columns to two and then one without requiring a horizontal page scroll. Existing directory filters,
cursor pagination, centered dialogs, smooth internal scrolling, and the thin application sidebar
scrollbar remain unchanged.

## Verification

The workspace projection tests cover property child collections, owner-property/document
separation, rentable-space measurements, amenities, documents, retirement counts, and profile
field presentation. The standard web lint, strict typecheck, unit test, and production build gates
must pass before this change is merged.

Phase 5 has not been started.
