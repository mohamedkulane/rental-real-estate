# Phase 3 Scope

## Included

- Email/password login, logout, identity resolution, password change, and reset-token foundation.
- `PENDING`, `ACTIVE`, `SUSPENDED`, and `DISABLED` account lifecycle.
- Opaque, hashed, expiring, revocable sessions with activity and client metadata.
- The single company profile, branches, parties used by employees, and employee records.
- Effective-dated employee branch and role assignments.
- Configurable roles, granular permissions, and role-permission mappings.
- `BRANCH`, `MULTI_BRANCH`, and explicitly assigned `COMPANY_WIDE` access.
- Backend permission and branch-object checks.
- Security audit records and maker-checker-compatible approval records.
- Login and administration views required to exercise the foundation.

## Excluded

Owners, properties, rentable spaces, engagements, CRM, leads, listings, viewings, applications, tenants, leasing, brokerage, charges, payments, accounting, deposits, maintenance, payouts, and operational reports remain out of scope. Manual payment processing remains the approved MVP direction; no payment-gateway dependency was introduced.

A minimal `Department` table/model was added as foundation-only reference data. Department hierarchy, assignments, API/UI, authorization semantics, and operational behavior were not approved and remain deferred. Payroll and complete business approval workflows are also deferred.
