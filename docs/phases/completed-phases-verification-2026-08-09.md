# Completed Phases Verification — 2026-08-09

## Result

Phase 1 through Phase 4 passed the repository, database, API, UI, build, and runtime gates defined for the completed scope.

## Corrections made during verification

- Employee list responses now resolve the canonical employee name from the related Party record. This removes the misleading `Not available` value shown in the employee table.
- The Prisma Employee/Party relation is declared in the production schema and matches the existing database foreign key.
- Frontend fallback text is human-readable, and corrupted punctuation/loading copy was repaired.
- NestJS logger middleware uses the current named wildcard syntax, removing the legacy route-conversion warning.
- Prisma seed configuration moved from deprecated `package.json#prisma` configuration to `prisma.config.ts`.
- Next.js output mode now matches the supported production start command, removing the runtime deployment warning.
- A comprehensive completed-phase CRUD E2E suite was added.

## CRUD and lifecycle evidence

The completed-phase E2E suite verifies:

- company read and update;
- branch create, list, read, and update;
- employee create, list with canonical display name, branch assignment, and role assignment;
- role create/list, permission grant/revoke, assignment, and effective-dated assignment end;
- user create/list, login, password change, session list/revoke, status suspension/restoration, and reset request;
- party create/list/read/update;
- owner create/list/read/update;
- property create/list/read/update, ownership replacement, branch transfer, building creation, and amenity assignment;
- rentable-space create/list/read, effective-dated measurement correction, parent change, partition/history, amenity assignment, and retirement;
- document metadata creation, approvals list, and audit evidence.

Historical, contractual, and governance records do not receive invented hard-delete operations. Where the approved design preserves history, deletion is represented by revoke, effective-dated end, status change, correction, or retirement.

## Database rehearsal

An isolated Docker PostgreSQL database was created from zero, both production migrations were applied, and the seed completed successfully. Verification found two completed migrations, one company, and one seeded admin user. The isolated database was then removed.

## Automated gates

| Gate                       | Result    |
| -------------------------- | --------- |
| Prisma format and validate | PASS      |
| Prisma client generation   | PASS      |
| Migration deployment       | PASS      |
| Repository format check    | PASS      |
| Lint                       | PASS      |
| Strict TypeScript          | PASS      |
| Database tests             | PASS — 2  |
| Web tests                  | PASS — 8  |
| API unit tests             | PASS — 15 |
| Database integration       | PASS — 1  |
| API integration            | PASS — 7  |
| API E2E                    | PASS — 27 |
| Production build           | PASS      |

## Runtime and performance smoke

The production web and API builds were started against local Docker PostgreSQL and Redis. Login, health, readiness, employee data, branches, owners, properties, rentable spaces, and audit endpoints all returned successfully. Runtime logs contained no warnings or errors.

Observed local production response times on the verification machine:

| Request                   |      Time |
| ------------------------- | --------: |
| Login page, first request |    359 ms |
| Admin page, warm          |     92 ms |
| Portfolio page, warm      |    103 ms |
| Health, warm              |     57 ms |
| Readiness, warm           |     49 ms |
| Authenticated login       |    460 ms |
| Employees                 |    179 ms |
| Other dashboard APIs      | 72–104 ms |

The authenticated login is intentionally more expensive because password verification uses a secure password hash. Ordinary local API requests are below 200 ms in this smoke run. Development-mode first compilation can be slower than the verified production build.

## Login connectivity follow-up — 2026-08-10

The local login failure shown as “We could not reach the service” was traced to a strict CORS origin mismatch when the web application was opened through `127.0.0.1:3000` while `WEB_URL` was configured as `localhost:3000`. Development and test environments now accept both equivalent loopback origins. Production remains restricted to the explicitly configured `WEB_URL`.

Regression evidence:

- real login from `http://localhost:3000`: PASS;
- real login from `http://127.0.0.1:3000`: PASS;
- untrusted external origin: rejected;
- API unit: 15 passed;
- API integration: 7 passed;
- API E2E: 28 passed;
- API production build: passed.

## Final status

No blocking error remains in the completed Phase 1–4 scope. Future business modules remain outside this verification and must follow their own phase gates.
