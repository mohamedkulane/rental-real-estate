# Phase 4 Portfolio Hierarchical Navigation

Date: 2026-08-16
Phase 5 started: **No**

## Navigation model

Portfolio uses a compact expandable hierarchy. Parties, Owners, Properties, and Rentable Spaces are collapsed by default unless one of their child views is active. Amenities remains a direct link to the reusable catalog.

Only one parent group is normally expanded. Selecting a child writes both the Portfolio section and child view to the URL, so refresh restores the correct expanded parent and active child.

## Child views

- Parties: All Parties, People, Organizations.
- Owners: Owner Directory, Owned Properties, Documents.
- Properties: Overview, Buildings, Spaces, Ownership, Amenities, Documents, Branch History, Activity.
- Rentable Spaces: Overview, Hierarchy, Measurements, Space Details, Amenities, Documents, Lifecycle.
- Amenities: Amenity Catalog.

The hierarchy reuses current directories and detail workspaces. It does not duplicate backend ownership, document, building, amenity, or rentable-space logic. Selecting a focused child opens the related entity detail in that section.

## Interaction and accessibility

- Parent controls are native buttons with `aria-expanded` and `aria-controls`.
- Active children use `aria-current="page"`.
- Native button keyboard behavior supports Enter and Space.
- Chevron rotation and submenu expansion use a subtle 200 ms transition.
- The mobile drawer uses the same hierarchical menu and closes after child navigation.
- Breadcrumbs expose Portfolio, parent section, and active child.

## Presentation cleanup

- Category and status selections are compact by default.
- Search remains opt-in for long data-backed lists.
- Option search and API search are case-insensitive.
- Document categories and access classes are humanized.
- MIME types and byte counts display as readable document types and file sizes.
- Document metadata forms use visible labels.

## Verification

Automated checks cover collapsed-state resolution, parent switching/collapse, active-child parent restoration, human-readable labels, canonical Property and Rentable Space child lists, route fallback, document labels, and case-insensitive option matching.

Visual browser capture remains subject to the recorded Windows in-app-browser sandbox blocker.
