# Test Plan

## Static checks

- Prisma format, validation, generation, and schema invariant test
- ESLint, Prettier, strict TypeScript, and production builds across the workspace

## Unit and smoke tests

- API liveness response does not depend on external services
- web foundation page renders

## End-to-end tests

- versioned health endpoint responds successfully
- correlation ID is returned
- rejected input uses the standard error envelope

## Integration tests

- Prisma connects to PostgreSQL
- readiness endpoint confirms PostgreSQL, Redis, and BullMQ
