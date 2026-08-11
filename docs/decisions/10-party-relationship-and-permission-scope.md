# Decision 10 — Party relationships and permission-specific branch scope

## Status

Accepted for Phase 3–4 authorization closure.

## Decision

A Party remains one company-wide identity, but operational visibility is established through effective-dated `PartyBranchAssignment` records. Employee assignments and property ownership relationships also establish branch relevance.

A branch-scoped user may read a Party or Owner when at least one active relationship belongs to a branch where that user has the required read capability. A mutation that changes a shared Party or Owner requires the capability across every actively related branch, unless the actor has an explicit company-wide grant for that capability.

Company-level reference catalogs, role definitions, company settings, and branch creation require an explicit company-wide permission grant. Merely holding the permission in one branch is insufficient.

## Rationale

This preserves a single legal/business identity while preventing a branch employee from discovering or changing unrelated branch data. Requiring all related branches for shared-record mutation prevents one branch from silently changing data relied upon by another branch.

## Consequences

- Party creation requires a responsible branch.
- Party and Owner APIs return human-usable branch scope metadata for action visibility.
- Backend authorization remains authoritative; the frontend hides unavailable actions only for usability.
- Cross-branch relationship changes remain auditable and effective-dated.
