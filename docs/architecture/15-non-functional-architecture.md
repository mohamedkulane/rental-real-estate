# Non-Functional Architecture

## Performance and scale

Target most normal reads under two seconds and indexed list APIs p95 under 1.5 seconds. Use bounded pagination, deliberate indexes, batched loading, read projections, queued large reports, and direct object-store transfers. Baseline supports thousands of properties, tens of thousands of RentableSpaces, and long-lived financial/audit history.

## Reliability and consistency

Financial posting and critical state transitions are atomic or roll back. Outbox + BullMQ provides at-least-once asynchronous delivery; consumers are idempotent. Redis/cache loss cannot lose business truth. Timeouts, circuit breakers, backoff, dead letters, and operator recovery cover provider failures.

## Availability and recovery

Initial availability target is 99.5% excluding planned maintenance. Backups, point-in-time recovery where available, object versioning, quarterly restore tests, and documented failover/cutover procedures support continuity. Recovery verifies journals, outbox, files, and projections.

## Maintainability

Strict TypeScript, public module contracts, no cross-module table access, automated architecture dependency tests, explicit state machines, versioned events, transactional tests, and decision-linked documentation control complexity. New modules require a cohesive aggregate/policy boundary, not merely a noun.

## Accessibility and localization

Web experiences target WCAG-aligned accessible semantics, keyboard use, visible focus, non-color-only statuses, and mobile field workflows. English/Somali text, timezone, currency, dates, and templates are configurable; persisted business dates and UTC instants are distinguished.

## Privacy and retention

Collect minimum necessary data, classify it, restrict purpose and field access, and support policy-driven retention/anonymization/legal hold. Financial/legal evidence may outlive mutable contact/profile data.

## Test quality gates

Unit tests cover policies/calculations/state transitions; integration tests cover constraints/transactions/outbox; contract tests cover REST/events; end-to-end tests cover critical money and lifecycle flows; security and performance tests cover scope leakage and contention. Architecture docs are updated with each boundary decision.
