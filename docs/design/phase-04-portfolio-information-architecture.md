# Phase 4 Portfolio Information Architecture

Status: Implemented on the Phase 4 Portfolio UX/IA refactor branch.

This document is the canonical user-facing structure for the Phase 4 Portfolio domain. It reorganizes existing Phase 4 capabilities; it does not introduce Phase 5 business behavior.

## Primary navigation

The Portfolio sidebar remains compact:

```text
Portfolio
├── Parties
├── Owners
├── Properties
├── Rentable Spaces
└── Amenities
```

Buildings, ownership, documents, hierarchy, measurements, and history remain contextual to the business record they describe rather than becoming top-level navigation.

## Detail structure

```text
Portfolio
├── Parties
│   ├── People
│   └── Organizations
├── Owners
│   ├── Overview
│   ├── Owned Properties
│   ├── Documents
│   └── Ownership History
├── Properties
│   ├── Overview
│   ├── Buildings
│   ├── Spaces
│   ├── Ownership
│   ├── Amenities
│   ├── Documents
│   ├── Branch History
│   └── Activity
├── Rentable Spaces
│   ├── Overview
│   ├── Hierarchy
│   ├── Measurements
│   ├── Residential / Commercial / Land Details
│   ├── Amenities
│   ├── Documents
│   ├── Activity / History
│   └── Lifecycle
└── Amenities
    └── Reusable Amenity Catalog
```

## Interaction rules

- Property Details has no generic `Operations` tab. Buildings, assignments, documents, and branch transfer are first-class tabs.
- Owner current properties and historical ownership are separate views.
- Property and Rentable Space amenity removal deletes only the assignment, never the global catalog record.
- Branch transfers preserve and display effective-dated assignment history.
- Rentable Space specialization is contextual: land never displays residential fields.
- Lifecycle actions are separated from everyday edits and explain their consequences.
- Human-readable names, record codes, dates, percentages, and relation summaries replace raw IDs and JSON.
- Tabs scroll horizontally at narrow widths; dialogs reflow within the viewport and retain smooth scrolling.
- Every write action is hidden when its existing frontend permission check fails. Backend permission and branch authorization remain authoritative.
- Loading, empty, error, and populated states are explicit for data-backed sections.

## Rentable Space directory filters

Search, Property, Building, Type, and Status are sent to the authorization-filtered cursor-paginated API. The Building filter becomes available after choosing a Property. The directory uses one server cursor paginator rather than a competing client paginator.

## Activity boundary

Property Activity uses already-authorized effective-dated branch and ownership history. It does not broaden `property.read` access to governance audit reasons, raw snapshots, or other sensitive audit metadata.

## Responsive behavior

Desktop and laptop remain primary. Detail tabs use a horizontally scrollable tab list at smaller widths, action groups wrap, forms collapse to one column, and modal drawers stay within the viewport with smooth vertical scrolling.

Phase 5 has not been started.
