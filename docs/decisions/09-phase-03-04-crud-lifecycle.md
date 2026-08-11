# Phase 3–4 CRUD and Lifecycle Decision

## Status

Accepted for the Phase 1–4 closure retrofit on 2026-08-10.

## Context

The Phase 3 and Phase 4 APIs preserved business history correctly, but the browser interface exposed mostly create/list flows. Users reasonably interpreted the absence of visible edit, status, archive, and safe delete actions as incomplete CRUD.

## Decisions

1. CRUD is expressed through business lifecycle actions, not unconditional hard delete.
2. Branches are created, read, edited, activated, and deactivated. They are not hard-deleted because employee and Property assignment history references them.
3. Employees are created, read, edited, activated, and deactivated. Deactivation disables an attached login account and revokes active sessions. Reactivating employment does not silently reactivate a disabled login account; account access is restored explicitly under User accounts.
4. Roles are created, read, renamed, activated, and deactivated. Capabilities are granted and revoked with audit evidence. Deactivation preserves assignments and history but stops the role from providing active access.
5. Properties are created as Draft, read, edited, and moved through Draft, Active, Inactive, and Retired states. Activation continues to use the database-backed completeness gate.
6. A Property may be permanently discarded only when it is still Draft and has no Phase 4 ownership, Building, RentableSpace, or amenity records. Its initial operating-branch assignment is removed in the same transaction. The action and reason are written to the audit log before deletion.
7. A non-Draft Property, or a Draft with dependent business records, is never hard-deleted. It must be made Inactive or Retired so history remains reproducible.
8. The draft-discard dependency check intentionally references only tables created by the completed Phase 4 migrations. Future service-engagement migrations must extend the dependency check when that phase is implemented.
9. Safe draft discard currently uses `portfolio.property.update` because Phase 4 did not define or seed a separate delete capability. A later permissions-governance phase may split this into a dedicated capability without changing the lifecycle rule.

## Authorization and audit

- Every mutation is protected by backend permission checks.
- Employee mutations repeat object-level checks across the employee’s current branch assignments.
- Property mutations inherit the Property’s current operating branch and repeat object-level authorization.
- Company-wide scope never bypasses the required operation permission.
- Employee, role, branch, company, and Property mutations write safe audit evidence.

## Consequences

- The UI may use familiar CRUD language while preserving contractual, operational, and authorization history.
- “Delete” is shown only as **Discard draft** when the backend can prove the operation is safe.
- Archived or historical business records remain reportable and auditable.
