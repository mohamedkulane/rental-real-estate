# Test gap analysis

## Coverage added

- Business date around the Nairobi/UTC rollover.
- Effective-date lower/upper bounds and later-scheduled replacement rejection.
- Property DRAFT -> ACTIVE and complete allowed/forbidden lifecycle matrix.
- Versioned Party encryption, old-key decryption after rotation, keyed lookup normalization and key separation.
- Login limiter threshold and opaque Redis key contents.
- Reset-token exposure across development, explicit test switch, and production.
- UUIDv7 version, variant, ordering, and same-millisecond uniqueness.
- HttpOnly/SameSite cookie, no token response, logout and administrator revocation.
- CORS rejection, Helmet headers, x-powered-by removal, Swagger default-off.
- Party directory masking, full-contact permission, sensitive metadata rejection, and cross-branch denial.
- Direct child-area prevalidation, native parent/area constraints, and simultaneous child-allocation race rejection.
- Employee branch-role containment and same-day audited role cancellation.
- Operational schema/future design separation and schema/migration parity.
- Concurrent duplicate business-number one-winner behavior.
- Source/docs encoding scan.

## Existing critical coverage retained

Argon2 login failure equivalence, suspended/disabled users, maker-checker self-approval denial, branch isolation, ownership/payout totals, property branch history, hierarchy cycles, measurement history, document immutability, audit redaction, CRUD workflows, database connectivity, loading/empty/error UI states, and build/type/lint checks.

## Bounded follow-up

Server-side cursor pagination/search/filter/sort remains required before CRM data growth. Current Phase 4 screens page at 10 records and do not create an integrity or authorization bypass; this is a scalability follow-up, not a CRITICAL/HIGH gate risk.
