# Phase 3 — Identity, Access, Organization & Governance

Status: Complete

## Implemented

First-party identity, company organization, employees, normalized effective-dated branch and role assignments, configurable permission-based access, backend branch authorization, administration UI, audit evidence, and approval infrastructure are complete. Only Phase 3 REST resources and administrative views were added.

## Database migrations

Migration `20260808193000_phase3_identity_access` creates only the Phase 3 tables and the minimum Party dependency. It includes keys, indexes, effective-date checks, overlap exclusion for assignments, append-only audit/decision triggers, and database-level maker-checker protection.

Validation passed against:

- Fresh isolated database: `rerms_phase3_test`.
- Normal development database path: `rerms`.
- No production database was involved.

Commands executed successfully:

```text
pnpm db:migrate:deploy
pnpm prisma:format
pnpm prisma:validate
pnpm prisma:generate
```

## Seed data

The idempotent seed creates the singleton `RERMS` company, `HQ`, `HODAN`, and `WADAJIR` branches, 20 granular permissions, nine initial roles, role-permission mappings, an environment-configured development Super Admin employee/user, and a maker-checker proof policy. The seed ran twice successfully on the fresh database and once on the normal development path.

No real production password is committed. Production initialization must provide the seed environment through a controlled secret channel and replace the development bootstrap process.

## Authentication strategy

Email/password authentication uses Argon2id with library-managed salts, 64 MiB memory, three iterations, parallelism one, and a practical 12–128 character policy. Only `ACTIVE` users authenticate. Invalid, suspended, and disabled users receive a generic failure. Password hashes are excluded from responses and audit evidence.

Password reset uses 256-bit random, hashed, expiring, one-time tokens. Password change and reset apply the documented session-revocation policy.

## Authorization strategy

NestJS session and permission guards protect controllers, while services enforce branch and object scope. Permissions are authoritative and roles are configurable mappings. `SUPER_ADMIN` has no hidden bypass and remains subject to authentication, validation, audit, maker-checker, and database integrity rules.

## Branch access strategy

`BRANCH`, `MULTI_BRANCH`, and explicitly assigned `COMPANY_WIDE` modes are supported. A branch request requires both an active employee branch scope and a role permission granted for that branch or at company level. A Hodan permission cannot be combined with an unrelated Wadajir membership. Company-wide scope still requires the operation permission.

## Audit behavior

User creation/status changes, sessions, employee creation, branch/role assignment, company and branch updates, role/permission changes, and approval actions write append-oriented audit records with actor, action, entity, time, branch, correlation ID, reason, and safe metadata. Passwords, hashes, tokens, and secrets are excluded. Sensitive structured-log fields are redacted.

## Approval foundation

`ApprovalPolicy`, `ApprovalRule`, `ApprovalRequest`, `ApprovalStep`, and `ApprovalDecision` support later bounded approval workflows without introducing a general workflow engine. Maker self-approval is rejected by application logic and a PostgreSQL trigger.

## Unit tests

PASS. API unit suite: 11 tests across password hashing, authentication success/failure, suspended/disabled rejection, role aggregation, branch/company scope, session revocation, health, and maker-checker rejection. Database and web foundation tests also passed in the repository regression run.

## Integration tests

PASS. Three integration tests passed: database connectivity, infrastructure readiness, and Phase 3 persistence covering user creation, branch assignment, role assignment, login, authenticated access, permission/branch enforcement, suspension, existing-session invalidation, and audit creation.

## E2E tests

PASS. Nine API E2E tests passed, including login → protected resource → logout → denied session, unauthorized employee administration, Hodan allowed/Wadajir denied, manager-led employee and role setup, and suspension behavior.

## Security tests

PASS. Automated checks prove `401` for unauthenticated access, `403` for missing permission and cross-branch access, generic inactive-account rejection, protected role APIs, server-side session revocation, maker-checker rejection, safe audit evidence, and absence of password hashes/secrets in normal responses. Authorization headers and authentication fields are redacted from structured logs.

## Regression tests

PASS. The main repository run completed with 23 tests across database, API, and web packages; Phase 2 foundation tests remain passing.

Commands executed successfully:

```text
pnpm test
pnpm test:integration
pnpm test:e2e
```

## Lint

PASS: `pnpm lint`

## Typecheck

PASS: `pnpm typecheck` with strict TypeScript.

## Build

PASS: `pnpm build`. Shared packages, Prisma package, NestJS API, and the optimized Next.js application built successfully. Generated routes include `/login` and protected `/admin`.

## Known issues

No blocking Phase 3 issues remain. Prisma 6 reports that the legacy `package.json#prisma` seed configuration will need migration to `prisma.config.ts` before Prisma 7; this does not affect the pinned 6.19.3 toolchain.

## Deferred items

- Production password-reset delivery adapter.
- Optional HTTP-only same-site cookie transport for the browser’s opaque session token.
- Future identity providers and portal identities.
- Business-specific approval policies and all downstream domain workflows.
- Departments, which were not justified by an approved Phase 3 design.

## Scope verification

No owners, properties, rentable spaces, service engagements, CRM, listings, leasing, payments, accounting, deposits, maintenance, owner payouts, or business reporting were implemented. Manual payment processing remains unaltered and no gateway assumption was introduced.

No Phase 4 property/owner/business functionality was implemented.

## Gate

PHASE GATE: PASS
