# Phase 3 Implementation Plan

1. Extend the approved Prisma schema only for Phase 3 identity, organization, access, session, approval, and audit entities.
2. Apply a controlled migration with effective-date constraints, uniqueness, append-only evidence protection, and maker-checker enforcement.
3. Seed the singleton company, branches, permissions, roles, role mappings, an environment-configured development administrator, and a proof approval policy.
4. Add authentication, session, authorization, branch-scope, employee, company, role, permission, audit, and approval services and REST endpoints.
5. Add a login route and permission-aware administration shell.
6. Prove password, session, role aggregation, branch isolation, audit, suspension, and maker-checker behavior with unit, integration, end-to-end, and security tests.
7. Run migrations on blank and normal development databases, then run all repository quality and build gates.

Implementation remains inside the modular monolith. No Phase 4 module is introduced.
