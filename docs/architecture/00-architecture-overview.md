# Architecture Overview

## Decision

The system is a **modular monolith**: one Next.js web application family, one NestJS REST application, one PostgreSQL transactional database, Redis/BullMQ for retryable background work, and S3-compatible private object storage. Modules run in one backend process and share infrastructure, but own their data and business rules behind explicit application interfaces.

No microservices, Kafka, distributed transactions, or independently owned databases are introduced.

## Architectural goals

- Preserve business-model differences through effective-dated ServiceEngagement capability policy.
- Use RentableSpace as the only reservable, brokerable, leasable, and occupiable target.
- Make all financial posting accrual-based, balanced, immutable, and journal-backed.
- Enforce permission + branch scope + object scope at backend boundaries.
- Preserve signed contracts, partition history, financial history, and issued report snapshots.
- Keep synchronous consistency local and use asynchronous work only for retryable side effects or projections.

## Technology baseline

| Layer        | Direction                                                                  |
| ------------ | -------------------------------------------------------------------------- |
| Web          | Next.js, strict TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Zod   |
| API          | NestJS modular monolith, REST `/api/v1`, strict TypeScript                 |
| Data         | PostgreSQL, Prisma ORM, explicit SQL where advanced constraints require it |
| Jobs/cache   | Redis and BullMQ                                                           |
| Files        | S3-compatible private storage or Cloudflare R2                             |
| Edge/runtime | Nginx, Docker, Ubuntu VPS initially                                        |

## Bounded contexts

1. **Platform & Governance** — organization/branches, identity/access, approvals, audit, configuration.
2. **Parties** — company-level people/organizations and their role profiles, including owners and vendors.
3. **Portfolio** — Property, Building, RentableSpace, partition history, and ServiceEngagement.
4. **Commercial Pipeline** — CRM, listings, viewings, applications, reservations, brokerage, and tenant placement.
5. **Leasing & Contracts** — lease parties, immutable signed versions, occupancy, amendments, renewals, holdover, termination.
6. **Finance** — billing/charges, payments/allocation, accounting/periods, deposits, owner accounting/payouts, expenses/payables, utilities.
7. **Master Lease & Sublease** — master obligations, child subleases, shared costs, and company margin; postings are delegated to Finance.
8. **Property Operations** — maintenance, work orders, inspections, and vendor operations.
9. **Content & Communications** — documents/files, templates, notifications, and delivery records.
10. **Reporting & Read Models** — optimized projections and snapshots; never the transactional source of truth.

## Core dependency direction

Platform and Parties are foundational. Portfolio depends on them. Pipeline, Leasing, Master Lease, and Operations depend on Portfolio contracts. Finance owns posting and exposes commands to other contexts. Documents, Notifications, Audit, and Reporting consume references/events without owning upstream truth. Direct cross-module table access is prohibited.

## Consistency model

- Business invariants that must succeed together use one PostgreSQL transaction.
- Cross-module synchronous calls use public application interfaces and participate in a deliberately coordinated transaction only when required.
- Domain/application events are in-process; durable asynchronous publication uses an outbox written in the source transaction and dispatched to BullMQ after commit.
- Notifications, search/read projections, exports, and external integrations are eventually consistent.

## Canonical inputs

Markdown under `docs/analysis/` and `docs/decisions/` is authoritative. The legacy DOCX is reference material only. This package does not authorize application code, database schema, or Prisma design.
