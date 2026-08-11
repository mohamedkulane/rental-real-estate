# Module Dependency Rules

## Rules

1. A module owns its tables, repositories, aggregates, and write rules; no direct cross-module writes or repository imports.
2. Cross-module synchronous use goes through exported application interfaces or read-only query contracts.
3. Public contracts expose identifiers and purpose-built DTOs, never internal entities/Prisma models.
4. Finance alone creates journals and financial postings. Other modules submit typed posting requests.
5. Platform authorization is invoked at application boundaries; domain modules still enforce record-state and business invariants.
6. ServiceEngagement capability resolution is owned by Portfolio and is required before model-dependent commands/jobs.
7. Leasing/Reservation/Brokerage target RentableSpace only; `Unit` cannot reappear as an alternative target.
8. Documents owns files/versions; business modules own why a document is required and its lifecycle effect.
9. Approvals coordinate decisions; approving does not bypass the owning module's final validation.
10. Audit receives append-only records; upstream modules do not query audit to reconstruct current truth.
11. Notifications and Reporting primarily consume events and cannot mutate source aggregates.
12. Asynchronous consumers call public commands and are idempotent; queue handlers never write tables directly.
13. Cycles are broken with identifiers, query contracts, application orchestration, or events—not reciprocal repository imports.

## Permitted direction

`Platform/Parties -> Portfolio -> Pipeline/Leasing/MasterLease/Operations -> Finance requests`

Content, Audit, Notifications, and Reporting are side-effect/support consumers reached through interfaces/events. Finance may validate stable identifiers through narrow contracts but must not depend on upstream domain internals.

## Transaction coordinators

Where a business invariant spans modules, an application-level coordinator may open one database transaction and call public transactional participants. Such cases must be named and limited: lease activation, brokerage closure, payment posting, deposit movement, owner payout execution, partition change, and property branch transfer. This does not permit arbitrary shared-table access.

## Enforcement

Use TypeScript/NestJS package boundaries, lint/import rules, module API barrels, code review, and architecture tests. Any exception requires an ADR documenting why the dependency cannot be expressed through the allowed patterns.

See [major domain modules diagram](diagrams/major-domain-modules.md).
