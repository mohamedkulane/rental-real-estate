# Real Estate Rental Company Management System

Single-company, multi-branch real-estate rental management system built as a pnpm modular monorepo.

## Foundation commands

1. Copy `.env.example` to `.env` and keep the development defaults for local use.
2. Run `pnpm install` and `pnpm prisma:generate`.
3. Run `pnpm infra:up` to start PostgreSQL and Redis.
4. Run `pnpm dev` for the web and API applications.

The API exposes liveness at `http://localhost:3001/api/v1/health`, dependency readiness at `/api/v1/readiness`, and Swagger at `/api/docs`.

Use `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, and `pnpm build` for the full local gate. Phase documentation is under `docs/phases/phase-02-foundation`.
