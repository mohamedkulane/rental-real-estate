# Deployment Architecture

## Initial topology

Nginx fronts Dockerized Next.js web, NestJS API, and NestJS/BullMQ worker processes on hardened Ubuntu. PostgreSQL and Redis run as protected services with no public exposure; managed equivalents are preferred when operationally feasible. S3/R2 is external private object storage.

## Environments

Separate local, integration, staging/UAT, and production configurations and credentials. Staging uses production-like topology and anonymized data. Production changes flow through CI/CD, immutable image builds, reviewed migrations, health checks, smoke tests, monitoring, and rollback criteria.

## Network and runtime controls

- TLS at Nginx; only required public ports exposed.
- API, database, Redis, and admin endpoints restricted by network/firewall.
- Containers run non-root, read-only where practical, with resource limits and health checks.
- Secrets injected at runtime and rotated.
- Background workers scale independently from API/web.
- Database connection pooling and deployment concurrency protect PostgreSQL.

## Data durability

Automated PostgreSQL backups with point-in-time recovery where available; versioned object storage; Redis is disposable. Restore exercises verify database/object consistency. Initial targets remain RPO <= 24 hours and RTO <= 8 hours until business impact analysis tightens them.

## Deployment evolution

Scale vertically first, then multiple stateless web/API/worker replicas behind Nginx. Move PostgreSQL/Redis to managed infrastructure before introducing service decomposition. The modular monolith remains one versioned release unit unless measured operational evidence justifies change.
