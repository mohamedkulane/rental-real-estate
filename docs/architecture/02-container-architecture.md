# Container Architecture

## Web container

Next.js serves the internal portal and later external portals/public pages. It owns presentation, navigation, accessible components, client cache, and browser-side Zod validation. It does not own authorization or financial rules. Server rendering/backend-for-frontend behavior may proxy API requests but cannot bypass NestJS policies.

## API container

NestJS hosts all bounded contexts in one deployable modular monolith. REST controllers validate transport input and call application commands/queries. Application services enforce authorization and orchestrate domain operations. Domain code owns invariants. Infrastructure adapters implement Prisma persistence, queues, files, and external providers.

## Worker container

A worker process uses the same versioned NestJS modules/application code but runs BullMQ processors rather than HTTP controllers. It handles outbox dispatch, recurring charge generation, notifications, report/export jobs, file scans, integration retries, and scheduled alerts. Jobs call public application use cases; they never write module tables directly.

## Data and infrastructure containers

- PostgreSQL: transactional data, journals, audit records, outbox, and read models.
- Redis: BullMQ queues, rate-limit/cache data, and ephemeral coordination.
- S3/R2: private document binaries and public-approved listing media.
- Nginx: TLS termination, routing, request-size limits, and security headers.

## Deployment shape

Initial production may run web, API, worker, PostgreSQL, Redis, and Nginx as Docker services on a hardened Ubuntu VPS, with object storage external. PostgreSQL/Redis may later move to managed services without changing domain boundaries.

## Scaling

Scale web/API/worker processes horizontally when required. API instances are stateless. BullMQ provides job coordination. PostgreSQL remains the consistency center. Read-heavy reports use projections, replicas, or queued exports before any service extraction is considered.

See [container diagram](diagrams/container-architecture.md).
