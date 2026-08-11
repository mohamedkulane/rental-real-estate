# Phase 3 Acceptance Criteria

- [x] Active accounts can authenticate and resolve their identity.
- [x] Invalid, suspended, and disabled accounts are denied with a generic response.
- [x] Passwords use Argon2id and hashes are never returned or audited.
- [x] Reset tokens are random, hashed at rest, expiring, and single-use.
- [x] Sessions are server-controlled, expiring, revocable, and invalidated by security changes.
- [x] The singleton company, branches, independent employees, and employee-user links work.
- [x] Branch and role assignments are normalized and effective-dated.
- [x] Permissions—not role names—authorize protected operations.
- [x] Role permission scope and employee branch scope are both required.
- [x] Company-wide access must be explicitly assigned and still requires permission.
- [x] Sensitive changes write safe append-oriented audit evidence.
- [x] Maker self-approval is rejected in application code and by a database trigger.
- [x] Only Phase 3 APIs and administrative views are implemented.
- [x] Migration and seed work from a fresh database and the normal development path.
- [x] All required Prisma, formatting, lint, type, unit, integration, E2E, security, regression, and build gates pass.
