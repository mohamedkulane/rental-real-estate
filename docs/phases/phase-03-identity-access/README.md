# Phase 3 — Identity, Access, Organization & Governance

Phase 3 establishes the authenticated security boundary for every later module. It implements first-party password authentication, revocable server-side sessions, company and branch organization, employees, effective-dated assignments, permission-based authorization, append-oriented audit evidence, and maker-checker-compatible approval infrastructure.

The implementation follows the approved modular-monolith architecture. PostgreSQL is authoritative for identities, sessions, roles, scopes, approvals, and audit records. NestJS guards and services enforce authorization; the Next.js interface improves usability but is not a security boundary.

See [scope.md](scope.md), [implementation-plan.md](implementation-plan.md), [acceptance-criteria.md](acceptance-criteria.md), [test-plan.md](test-plan.md), and [completion-report.md](completion-report.md).
