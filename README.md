# Real Estate Rental Company Management System

A single-company, multi-branch operations system built as a strict TypeScript modular monolith. It is not a public multi-tenant SaaS product.

## Current gate

Phases 1-4 are implemented: database architecture, project foundation, identity/access/governance, and portfolio management. The repository is completing the mandatory Pre-Phase-5 deep audit. **Phase 5 has not started.** Service engagements, CRM, leasing, finance, payments, deposits, maintenance, and owner statements remain future work.

## Architecture

- Next.js web application: `apps/web`
- NestJS REST API: `apps/api`
- PostgreSQL 17 and Prisma: `prisma`, `packages/database`
- Redis and BullMQ: infrastructure boundary in the API
- Shared configuration and contracts: `packages/config`, `packages/shared`

Implemented business areas include company and branch setup, employees, user accounts and sessions, roles and permissions, approvals and audit evidence, Parties and Owners, Properties, ownership history, RentableSpaces and hierarchy, amenities, and document metadata.

## Local setup

Prerequisites: Node.js 22.17.x, pnpm 11.x, and Docker Desktop with its Linux engine running.

```powershell
Copy-Item .env.example .env
pnpm install --frozen-lockfile
pnpm infra:up
pnpm prisma:generate
pnpm db:migrate:deploy
pnpm db:seed
pnpm dev
```

Local endpoints:

- Web: `http://localhost:3000`
- API: `http://localhost:3001/api/v1`
- PostgreSQL: `localhost:55432`
- Redis: `localhost:56379`
- Liveness: `http://localhost:3001/api/v1/health`
- Readiness: `http://localhost:3001/api/v1/readiness`

API documentation is disabled by default. In a non-production environment only, set `EXPOSE_API_DOCS=true` to expose `/api/docs`.

The seed administrator email and password come from `.env`. Replace the example password before seeding; never commit `.env`.

## Verification

```powershell
pnpm verify:governance
pnpm prisma:format
pnpm prisma:validate
pnpm prisma:generate
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
```

## Security notes

Browser sessions use an HttpOnly, SameSite cookie. Login and password-reset requests are rate-limited through Redis. Full Party contact values require `party.contact.read`; directory results are masked. Sensitive contact values use versioned AES-256-GCM encryption and a keyed search index. Production API docs and development reset-token responses are off by default.

The development encryption key and seed credentials in `.env.example` are local placeholders only. Production secrets must be generated and supplied through the deployment secret manager.

## Documentation map

- [Documentation index](docs/README.md)
- [Architecture](docs/architecture/)
- [Business decisions and ADRs](docs/decisions/)
- [Database design](docs/database/)
- [UI/UX design system](docs/design/Real_Estate_Rental_UI_UX_Design_System_v1.md)
- [Phase reports](docs/phases/)
- [Security](docs/security/)
- [Pre-Phase-5 audit](docs/audits/pre-phase-05/)

Canonical documentation is tracked. Generated screenshots, design-tool exports, runtime logs, local environment files, and secrets are intentionally ignored.