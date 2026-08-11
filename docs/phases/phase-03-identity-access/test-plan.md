# Phase 3 Test Plan

## Unit

- Argon2id hashing, verification, and minimum length.
- Authentication success and generic failure for invalid, suspended, and disabled accounts.
- Active role-permission aggregation and assignment branch scope.
- Branch, multi-branch, and company-wide authorization evaluation.
- Server-side session revocation.
- Maker-checker self-approval rejection.

## Integration

- Infrastructure readiness for PostgreSQL, Redis, and BullMQ.
- Employee/user creation, a second normalized branch assignment, role assignment, login, permission and branch enforcement, suspension, session invalidation, and audit persistence.

## End to end and security

- Unauthenticated API requests return `401`; insufficient permission and cross-branch access return `403`.
- Seeded administrator creates a branch employee and branch-scoped role assignment; the employee logs in.
- Hodan is allowed and Wadajir is denied for the Hodan-scoped role grant.
- Suspension rejects the existing session and future login.
- Logout revokes the current session.
- Password hashes and secrets are absent from responses and audit evidence; authorization headers and password fields are redacted from logs.
- Maker self-approval is rejected.

## Database and regression commands

```text
pnpm prisma:format
pnpm prisma:validate
pnpm prisma:generate
pnpm db:migrate:deploy
pnpm db:seed
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
```

Migration rehearsal uses `rerms_phase3_test`; normal development validation uses `rerms`. No production database is involved.
