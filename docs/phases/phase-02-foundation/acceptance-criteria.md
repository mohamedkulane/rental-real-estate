# Acceptance Criteria

- Workspace install succeeds from the lockfile.
- Prisma schema formats, validates, and generates with Prisma and client both at 6.19.3.
- PostgreSQL, Redis, and BullMQ readiness checks pass against local containers.
- API liveness, correlation ID, global validation, and error-envelope tests pass.
- Web smoke test passes.
- Lint, Prettier check, strict TypeScript typecheck, unit tests, integration tests, end-to-end tests, and production builds pass.
- CI repeats the same gate with service containers.
- No migrations and no Phase 3 domain features are introduced.
