# Phase 1–4 role workspaces

**Status:** Approved for implementation on 2026-08-11

## Decision

The system remains permission- and scope-driven. Role codes are used only to present a clear workspace heading; they never bypass backend authorization. Every menu item, button, API endpoint, and returned record must require its documented permission and branch scope.

Default-role grants are synchronized by the seed so removed grants do not remain in the database. Custom company roles are not changed by this synchronization.

## Default roles

| Role                    | Phase 1–4 workspace                                                                                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Super Admin             | All implemented company, access, governance, party, owner, property, space, amenity, and document capabilities.                                                   |
| General Manager         | All implemented operations except changing the protected role-capability catalog.                                                                                 |
| Branch Manager          | Branch-scoped team and user administration, role assignment, governance, parties, owners, properties, spaces, amenities, and documents.                           |
| Property Manager        | Branch-scoped party and owner onboarding plus property, building, space, ownership, amenity, and document management.                                             |
| Leasing Agent           | Party/contact management and read-only owner and portfolio reference. Leasing workflows remain unavailable until their phase.                                     |
| Accountant              | Approval request/reference plus read-only parties, owners, property ownership, properties, and documents. Finance workflows remain unavailable until their phase. |
| Maintenance Coordinator | Read-only contacts, properties, spaces, amenities, and documents. Maintenance workflows remain unavailable until their phase.                                     |
| Inspector               | Read-only properties, spaces, amenities, and documents. Inspection workflows remain unavailable until their phase.                                                |
| Receptionist            | Branch staff directory, party/contact registration and updates, and read-only owners, properties, spaces, and amenities.                                          |

## Workspace behaviour

- The overview identifies the signed-in employee's active business role or roles and access scope.
- Metrics and quick links appear only when the corresponding read permission exists.
- Mutation controls appear only when the relevant permission is effective for the record's branch.
- A hidden control is not security: the API independently returns `403` for unauthorized operations.
- Roles whose future operational module is not implemented receive only the useful Phase 1–4 reference workspace and a plain explanation of the deferred module.

## Verification

Tests must cover synchronized default grants, role presentation in `/auth/me`, permission-filtered navigation, branch restrictions, and representative allowed and denied operations.

## UI/UX review

**UI/UX REVIEW: PASS.** The workspace uses the approved navy, white, slate, and emerald system; navigation and actions are reduced to the employee's effective capabilities; role and branch scope are stated in plain language; read-only actions are labelled as viewing rather than management; and the existing responsive, focus-visible, and loading-state patterns are preserved.
