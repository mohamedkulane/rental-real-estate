# REAL ESTATE RENTAL COMPANY MANAGEMENT SYSTEM

# Phased Development, Testing & Quality Gate Policy

**Document Type:** Development Governance & Implementation Strategy
**Status:** Approved Project Rule
**Applies To:** Entire Real Estate Rental Company Management System

---

# 1. Purpose

The Real Estate Rental Company Management System must NOT be developed as one complete system in a single implementation cycle.

The project must be implemented incrementally through controlled development phases.

Each phase must:

1. Have a clearly defined scope.
2. Implement only the approved modules for that phase.
3. Include automated tests.
4. Include integration tests where applicable.
5. Include database validation where applicable.
6. Pass linting and type checking.
7. Pass security and authorization checks relevant to that phase.
8. Pass business-rule tests.
9. Be reviewed against its acceptance criteria.
10. Be considered stable before development moves to the next phase.

The project must never move to the next phase while the current phase contains failing tests, unresolved critical bugs, broken migrations, incomplete acceptance criteria, or known integrity problems.

---

# 2. Core Development Rule

The project follows this rule:

> **No phase may begin until the previous phase is fully implemented, tested, reviewed, documented, and formally marked PASS.**

The workflow is:

```text
Plan Phase
   ↓
Implement
   ↓
Unit Tests
   ↓
Integration Tests
   ↓
Business Rule Tests
   ↓
Security / Authorization Tests
   ↓
Lint
   ↓
Typecheck
   ↓
Build
   ↓
Database Validation
   ↓
Manual Acceptance Review
   ↓
PASS?
   │
   ├── NO → Fix → Test Again
   │
   └── YES
          ↓
       Close Phase
          ↓
       Git Commit / Tag
          ↓
       Start Next Phase
```

---

# 3. Hard Quality Gate

Every phase has a **Phase Gate**.

A phase can have only one of these statuses:

```text
NOT_STARTED
IN_PROGRESS
BLOCKED
TESTING
FAILED
READY_FOR_REVIEW
PASSED
CLOSED
```

Only:

```text
PASSED
```

may transition to:

```text
CLOSED
```

Only a `CLOSED` phase allows the next phase to become `IN_PROGRESS`.

---

# 4. Rules Codex Must Follow

Codex must follow these rules during the entire project.

## Rule 1 — One Phase at a Time

Codex must only implement the currently approved phase.

It must not implement features from future phases.

---

## Rule 2 — No Scope Creep

If functionality belongs to a later phase, Codex must not implement it early merely because it seems useful.

Instead, record it in:

```text
docs/roadmap/future-work.md
```

---

## Rule 3 — Tests Are Part of Implementation

A feature is not complete when the code works manually.

A feature is complete when:

```text
Implementation
+
Validation
+
Authorization
+
Tests
+
Documentation
```

are complete.

---

## Rule 4 — Failing Tests Block Progress

If any required test fails:

```text
NEXT PHASE = BLOCKED
```

Codex must fix the current phase first.

---

## Rule 5 — Existing Tests Must Continue Passing

When implementing new functionality:

> All previous-phase tests must continue passing.

Therefore Phase 5 must pass:

```text
Phase 1 tests
Phase 2 tests
Phase 3 tests
Phase 4 tests
Phase 5 tests
```

This gives the project a growing regression suite.

---

# 5. Required Validation Commands

Once the repository is implemented, every phase should eventually have commands similar to:

```bash
pnpm lint
pnpm typecheck
pnpm build

pnpm test
pnpm test:unit
pnpm test:integration
pnpm test:e2e
```

Backend may additionally run:

```bash
pnpm --filter api test
pnpm --filter api test:integration
pnpm --filter api test:e2e
```

Frontend may run:

```bash
pnpm --filter web test
pnpm --filter web build
```

Database validation may include:

```bash
npx prisma validate
npx prisma format
npx prisma generate
```

Migration phases may additionally use controlled migration tests against a disposable test database.

Exact commands will be finalized during repository foundation setup.

---

# 6. Test Pyramid

The project should use several testing layers.

## 6.1 Unit Tests

Used for individual business logic.

Examples:

- Commission calculation
- Rent calculation
- Owner payable calculation
- Utility allocation
- Area pricing
- Deposit settlement
- Permission decisions

---

# 6.2 Integration Tests

Used when multiple modules or database operations interact.

Examples:

```text
Payment
→ Allocation
→ Journal Posting
```

or:

```text
Lease Activation
→ RentableSpace Occupied
→ Listing Unavailable
```

---

# 6.3 Database Integrity Tests

Required for critical database constraints.

Examples:

- No overlapping exclusive leases
- Journal balance enforcement
- Duplicate payment-reference prevention
- Child space area validation
- Effective-dated ownership integrity
- Immutable posted transactions

---

# 6.4 Authorization Tests

Test:

- role permissions
- branch scopes
- company-wide access
- object-level access
- maker-checker restrictions

Example:

```text
Branch A employee
        ↓
Attempts Property from Branch B
        ↓
ACCESS DENIED
```

---

# 6.5 End-to-End Tests

Used for important complete workflows.

Example:

```text
Owner
→ Property
→ Listing
→ Lead
→ Viewing
→ Application
→ Lease
→ Payment
```

These are especially important after later phases.

---

# 6.6 Regression Tests

Every completed phase becomes part of the permanent regression test suite.

No later feature may silently break earlier functionality.

---

# 7. Definition of Done

A task is considered DONE only when:

- Feature implementation is complete
- Inputs are validated
- Permissions are enforced
- Business rules are enforced
- Database constraints are correct where needed
- Audit behavior exists where required
- Unit tests pass
- Integration tests pass where applicable
- Existing tests pass
- Lint passes
- Typecheck passes
- Build succeeds
- Documentation is updated

---

# 8. Definition of Phase Complete

A PHASE is complete only when:

- Every required feature is implemented
- Every acceptance criterion is satisfied
- No critical TODO remains
- No critical or high-severity bug remains
- Required migrations succeed
- Seed/reference data works
- Unit tests pass
- Integration tests pass
- Authorization tests pass
- Relevant E2E tests pass
- Regression tests pass
- Lint passes
- Typecheck passes
- Production build succeeds
- Documentation reflects implementation
- Phase review report is generated

---

# 9. Phase Completion Report

At the end of every phase Codex must create:

```text
docs/phases/phase-XX/completion-report.md
```

It must contain:

```text
Phase:
Status:

Implemented:
-

Tests:
Unit:
Integration:
E2E:
Authorization:
Database:

Commands executed:
-

Results:
-

Known issues:
-

Deferred items:
-

Documentation updated:
-

Final recommendation:
PASS / FAIL
```

Codex must explicitly state:

```text
PHASE GATE: PASS
```

or:

```text
PHASE GATE: FAIL
```

---

# 10. Failure Rule

If a phase fails:

Codex must NOT:

- Start the next phase
- Scaffold future modules
- Add future database entities
- Add future APIs
- Add future UI
- Hide failing tests
- Disable tests
- Remove valid tests
- Reduce validation merely to obtain a green result

Instead:

```text
Identify failure
→ Fix root cause
→ Rerun tests
→ Rerun regression suite
→ Reevaluate gate
```

---

# 11. Phase 0 — Requirements & Architecture

## Purpose

Define the system before writing production code.

### Includes

- Business requirements
- System requirements
- Business models
- Business rules
- Domain analysis
- Architecture decisions
- Service model definition
- RentableSpace architecture
- Accounting decisions
- Authorization rules
- Technical architecture

### Current Status

Most of this phase has already been completed through:

```text
docs/analysis/
docs/decisions/
docs/architecture/
```

### Gate

Phase 0 passes when:

- Core business rules are approved
- Architecture has no blocking contradiction
- Domain boundaries are stable
- Database design may safely begin

---

# 12. Phase 1 — Database & Data Architecture

This corresponds to the current database-design step.

## Scope

Design and finalize:

- PostgreSQL architecture
- Prisma schema
- Core entities
- Relationships
- Enums
- Constraints
- Indexes
- Effective dating
- RentableSpace hierarchy
- Financial journal model
- Transactional outbox
- Audit structure

## No Business Features Yet

Do not implement:

- dashboards
- CRM UI
- leasing UI
- maintenance UI
- payments UI

### Tests / Validation

Must eventually verify:

- Prisma schema validity
- Relationship integrity
- Database-native constraints
- Migration reproducibility
- Required indexes
- Financial numeric precision

### Gate

```text
Database design reviewed
Prisma validated
Test migration succeeds
Native PostgreSQL constraints tested
Rollback/rebuild tested
PHASE GATE = PASS
```

---

# 13. Phase 2 — Project Foundation

## Scope

- Monorepo/workspace
- Next.js frontend
- NestJS backend
- PostgreSQL
- Prisma
- Redis
- BullMQ foundation
- Environment validation
- Error handling
- Logging
- Testing infrastructure
- CI
- Docker development setup

No major real-estate module should be implemented yet.

### Gate

Required:

```text
Install succeeds
Lint passes
Typecheck passes
Tests pass
Build succeeds
API health check works
Database connection works
Redis connection works
CI succeeds
```

---

# 14. Phase 3 — Identity, Access & Organization

## Scope

### Authentication

- Login
- Logout
- Session/token strategy
- Password management

### Authorization

- Roles
- Permissions
- Branch scope
- Resource-level access

### Organization

- Company settings
- Branches
- Employees
- Employee branch assignments

### Governance

- Initial audit logging
- Approval infrastructure foundation

### Important Tests

- Invalid login
- Suspended account
- Permission denied
- Branch access denied
- Company-wide access
- Role assignment
- Session invalidation

### Gate

No property functionality begins until security boundary passes.

---

# 15. Phase 4 — Parties, Owners, Property & Rentable Space

## Scope

### Parties and owners

- Person and organization Parties
- Protected contact information
- Owner profiles and documents
- Joint ownership, ownership percentages, and payout entitlements
- Effective-dated ownership history

### Portfolio

- Properties and effective-dated operating-branch assignments
- Buildings as optional physical containers
- RentableSpace as the canonical occupancy target
- Parent-child space hierarchy, types, measurements, and partitioning
- Amenities, document metadata, and vacant-land specialization
- Explicit Property, Building, and RentableSpace lifecycle controls

The approved Phase 4 implementation consolidated the originally separate Parties/Owners and Property/RentableSpace roadmap slices. This consolidation is the authoritative delivered scope; it does not start any downstream Service Engagement, CRM, leasing, or financial phase.

### Tests

- Duplicate Party and record-number handling
- Joint-owner and payout percentage validation
- Branch/object authorization and document permissions
- Property activation readiness and lifecycle history
- Building lifecycle and RentableSpace hierarchy
- Concurrent record numbering, hierarchy, and area integrity
- Land, amenity, branch-transfer, and historical-truth behavior

No Service Engagement, CRM, listing, leasing, billing, payment, accounting, deposit, maintenance, or payout workflow is included.

---

# 16. Phase 5 — Service Engagements

## Scope

Implement:

- Brokerage
- Tenant placement
- Full management
- Rent collection only
- Master lease/sublease service designation
- Company-owned mode

Service engagement must determine feature eligibility.

### Tests

Example:

```text
BROKERAGE
Recurring invoice = forbidden

FULL_MANAGEMENT
Recurring rent = allowed
```

Test:

- inheritance
- overrides
- effective dates
- termination
- incompatible overlaps
- offboarding

---

# 17. Phase 6 — CRM & Listings

## Scope

- Leads
- Lead sources
- Lead activities
- Client preferences
- Listings
- Inquiries
- Agent assignment
- Follow-ups
- Property matching

### Tests

- Lead lifecycle
- Listing eligibility
- Unavailable spaces not published
- Brokerage/full-management listing behavior
- Branch agent access
- Lead-source reporting integrity

---

# 18. Phase 7 — Viewings, Applications & Reservations

## Scope

- Property viewings
- Feedback
- Tenant applications
- Screening records
- Application approvals
- Reservations

### Tests

Important:

```text
Reservation
→ RentableSpace = RESERVED
```

but:

```text
Reservation != Occupancy
```

Test reservation expiry, cancellation, conflicts, and permissions.

---

# 19. Phase 8 — Leasing & Contract Management

## Scope

- Tenant profiles
- Lease
- Lease parties
- Lease terms
- Contract versions
- Amendments
- Renewals
- Terminations
- Move-in
- Possession
- Key assignment
- Meter readings

### Critical Tests

- No overlapping exclusive possession
- Signed leases immutable
- Expired lease behavior
- Holdover
- Renewal history
- Reservation-to-lease conversion
- RentableSpace occupancy transition

No rent accounting implementation should be considered complete until this phase passes.

---

# 20. Phase 9 — Brokerage & Tenant Placement

## Scope

### Brokerage

```text
Lead
→ Viewing
→ Deal
→ Commission
→ Rented External
→ Closed
```

### Tenant Placement

```text
Owner Engagement
→ Listing
→ Tenant
→ Placement
→ Placement Fee
→ Handoff
```

### Critical Rule

Neither model creates full recurring management accidentally.

### Tests

Ensure:

```text
Brokerage → no recurring invoice
Brokerage → no owner payout
Brokerage → no maintenance
```

---

# 21. Phase 10 — Billing & Charges

## Scope

- Charge types
- Rent charges
- Recurring schedules
- Utility charges
- Service charges
- Damage charges
- Late fees
- Adjustments
- Waivers
- Invoice/business-document presentation

### Tests

- Charge generation
- No duplicate periods
- Proration
- Rent escalation
- Waivers
- Service-model capability checks

---

# 22. Phase 11 — Payments & Accounting Engine

## Scope

- Payments
- Payment allocations
- Partial payments
- Advance payments
- Overpayments
- Tenant credits
- Reversals
- Refunds
- Journal entries
- Journal lines
- Accounting periods

### Critical Gate

This is one of the strongest project gates.

Required tests:

```text
Every posted journal balances
```

and:

```text
Posted payments cannot be silently edited/deleted
```

Also:

- duplicate payment reference protection
- allocation integrity
- reversal integrity
- closed-period controls
- idempotency

Do not move forward with owner accounting until this phase is fully stable.

---

# 23. Phase 12 — Deposits

## Scope

- Security deposits
- Contributors
- Receipt
- Transfer
- Deduction
- Settlement
- Disputes
- Refunds

### Tests

Critical:

```text
Deposit != Company Revenue
```

Other tests:

- Cannot refund more than held
- Deduction approval
- Transfer audit trail
- Disputed amount protection
- Journal correctness

---

# 24. Phase 13 — Full Management & Owner Accounting

## Scope

- Management fee calculation
- Owner payable
- Owner reserve
- Owner contribution
- Owner statements
- Owner payout
- Joint-owner distribution
- Payout failure/retry

### Required Tests

Example:

```text
Collected Rent      $1,000
Management Fee        $100
Expense                $50
Owner Payable          $850
```

Must verify:

- No payout above available balance
- Reserve rules
- Negative owner balances
- Joint owner distribution
- Maker-checker approvals
- Journal correctness

---

# 25. Phase 14 — Master Lease & Subleasing

## Scope

- Master lease
- Master rent schedule
- Child spaces
- Subleases
- Master-rent expenses
- Sublease income
- Profit tracking

### Required Tests

```text
Sublease Revenue
- Master Rent
- Shared Expenses
= Margin
```

Must not use Full Management owner-payable logic.

---

# 26. Phase 15 — Utilities

## Scope

- Utility accounts
- Utility meters
- Bills
- Meter readings
- Allocation rules
- Allocation lines

Methods:

- Equal
- Area based
- Meter based
- Occupancy based
- Fixed
- Custom percentage

### Tests

For each allocation:

```text
Sum allocated amounts = Bill allocation total
```

Test rounding and reproducibility.

---

# 27. Phase 16 — Maintenance & Vendors

## Scope

- Maintenance tickets
- Work orders
- Vendors
- Quotations
- Assignments
- Expenses
- Completion
- Preventive maintenance where approved

### Tests

- Service engagement eligibility
- Maintenance status machine
- Vendor permissions
- Cost approval
- Owner/company/tenant responsibility
- Expense/journal integration

Land maintenance must remain disabled by default.

---

# 28. Phase 17 — Inspections, Move-Out & Turnover

## Scope

- Inspections
- Move-in condition comparison
- Move-out inspection
- Damage assessment
- Deposit deductions integration
- Keys returned
- Lease closure
- Unit turnover
- Availability restoration

### Tests

Full workflow:

```text
Occupied
→ Notice
→ Move-out
→ Inspection
→ Settlement
→ Lease Closed
→ RentableSpace Available
```

---

# 29. Phase 18 — Documents, Notifications & Communications

## Scope

- File metadata
- File versions
- Private storage
- Notifications
- Email/SMS/WhatsApp architecture integration
- Notification templates
- Delivery tracking

### Tests

- File authorization
- Expired/private URLs
- Notification retry
- Duplicate-send protection
- Template rendering

---

# 30. Phase 19 — Reporting & Dashboards

This phase begins only after transactional modules are trusted.

## Scope

- Executive dashboard
- Leasing dashboard
- Finance dashboard
- Property operations dashboard
- Owner reports
- Tenant reports
- Rent roll
- Occupancy
- Aging
- Owner statements
- Maintenance reports
- Brokerage reports
- Sublease profitability

### Rule

Reports do not become an alternative source of truth.

Transactional modules remain authoritative.

### Tests

Reconcile reports against known database fixtures.

---

# 31. Phase 20 — Owner Portal

## Scope

- Owner authentication/access
- Portfolio
- Occupancy
- Statements
- Payouts
- Maintenance visibility
- Documents

### Tests

An owner must never access another owner's financial or property data.

---

# 32. Phase 21 — Tenant Portal

## Scope

- Current lease
- Balance
- Charges
- Payments
- Receipts
- Deposit
- Maintenance
- Documents
- Notices

### Tests

A tenant must only access leases and records for which they are an authorized party.

---

# 33. Phase 22 — Production Hardening

Final engineering phase.

## Includes

- Full regression suite
- Security testing
- Performance testing
- Backup testing
- Restore testing
- Rate limiting
- Monitoring
- Logging
- Error tracking
- Production configuration
- CI/CD
- Deployment validation

### Required Gate

```text
Unit tests PASS
Integration tests PASS
E2E tests PASS
Authorization tests PASS
Database integrity PASS
Regression tests PASS
Lint PASS
Typecheck PASS
Build PASS
Migration test PASS
Backup test PASS
Restore test PASS
Security review PASS
```

Only then is the system considered production-ready.

---

# 35. Future Phases

The following are outside initial production scope unless separately approved:

- Native mobile application
- Offline-first field application
- Advanced owner analytics
- AI property recommendations
- AI lead matching
- Predictive vacancy
- Automated tenant risk scoring
- Dynamic pricing
- Smart lock integration
- IoT
- Public SaaS multi-tenancy
- Property sales
- Construction management

---

# 36. Test Regression Principle

Suppose we are on Phase 14.

We do not run only Phase 14 tests.

We run:

```text
Phase 1
+
Phase 2
+
Phase 3
+
...
+
Phase 14
```

because a change in owner accounting may accidentally break:

- payment allocation
- leasing
- permissions
- property handling
- service engagements

Therefore every phase increases the permanent regression suite.

---

# 37. Git Strategy

Every phase should preferably finish with a clean Git checkpoint.

Example tags:

```text
phase-01-database
phase-02-foundation
phase-03-identity
phase-04-parties
phase-05-portfolio
...
```

Only create the phase tag after:

```text
PHASE GATE: PASS
```

This provides stable recovery points.

---

# 38. Documentation Rule

Each phase gets:

```text
docs/phases/
├── phase-00-requirements/
├── phase-01-database/
├── phase-02-foundation/
├── phase-03-identity/
...
```

Each phase should contain:

```text
README.md
scope.md
acceptance-criteria.md
test-plan.md
completion-report.md
```

Optional:

```text
known-issues.md
decisions.md
```

---

# 39. Required Codex Behavior Before Starting Any Phase

Before implementation Codex must:

1. Read the approved architecture.
2. Read the current phase scope.
3. Read previous phase completion report.
4. Verify previous phase says:

```text
PHASE GATE: PASS
```

5. If the previous phase is not PASS, stop.
6. Create implementation plan for current phase.
7. Implement only current phase.
8. Run required tests.
9. Produce completion report.
10. Stop.

Codex must not automatically continue into the next phase.

---

# 40. Codex Stop Rule

At the end of every phase Codex must STOP.

Even if all tests pass.

The final response should state:

```text
PHASE XX COMPLETE

PHASE GATE: PASS

The next phase has NOT been started.
Awaiting explicit instruction to begin Phase XX+1.
```

If failing:

```text
PHASE XX NOT COMPLETE

PHASE GATE: FAIL

The next phase is blocked.
```

---

# 41. No Automatic Phase Chaining

The following behavior is prohibited:

```text
Finish Phase 5
→ Automatically start Phase 6
```

Correct behavior:

```text
Finish Phase 5
→ Test
→ PASS
→ Stop

User reviews

User explicitly authorizes Phase 6
→ Begin Phase 6
```

---

# 42. Zero-Test-Bypass Policy

Codex must never make a failing build green by:

- deleting a valid test
- skipping a valid test
- adding `.skip`
- weakening assertions
- commenting out checks
- removing TypeScript strictness
- hiding lint errors
- disabling database constraints
- converting errors into ignored warnings

unless the specification itself was formally changed and documented.

---

# 43. Bug Severity Gate

Before closing a phase:

### Critical

Must be zero.

### High

Must be zero.

### Medium

May only remain if explicitly accepted and documented.

### Low

May be deferred if documented.

Security and financial-integrity defects are automatically considered high or critical depending on impact.

---

# 44. Migration Gate

Any phase changing the database must verify:

```text
Fresh database
→ Apply migrations
→ Success

Existing previous-phase database
→ Apply new migration
→ Success

Seed
→ Success

Application tests
→ Success
```

A migration that works only on a developer's current local database does not pass.

---

# 45. Financial Test Rule

For financial functionality, tests are mandatory before phase closure.

Examples:

- balance calculations
- Decimal precision
- double-entry balance
- owner payable
- commission
- partial payment
- overpayment
- refunds
- reversals
- deposits
- allocation rounding
- shared utilities

Financial logic must not rely solely on manual UI testing.

---

# 46. Authorization Test Rule

Every protected module must test at least:

```text
Allowed user
Denied user
Wrong branch
Wrong resource
Suspended user where applicable
```

Frontend hiding does not count as authorization testing.

---

# 47. Audit Test Rule

Critical actions must test that an audit record is created.

Examples:

- permission changes
- financial reversals
- owner payouts
- deposit deductions
- lease termination
- property transfers
- emergency overrides

---

# 48. Phase Dependency Principle

Modules must be built in dependency order.

For example:

```text
Property
before
Leasing
```

and:

```text
Payments + Accounting
before
Owner Payout
```

and:

```text
Leasing
before
Move-Out
```

This is why the project uses phases rather than building screens independently.

---

# 49. Overall Release Rule

The system may be released internally before all optional phases exist, provided all phases included in that release have passed their respective gates.

For example, an MVP release may include:

```text
Foundation
Identity
Owners
Property
Service Engagement
CRM
Leasing
Brokerage
Billing
Payments
Accounting
Deposits
Full Management
Maintenance
Core Reporting
```

Owner portal and advanced features may come later.

---

# 50. Final Governing Principle

The project's development philosophy is:

> **Build small, validate deeply, stabilize completely, then continue.**

The objective is not to finish the highest number of features quickly.

The objective is to ensure that every completed phase becomes a stable foundation for everything built after it.

Prisma ORM: 6.19.x
@prisma/client: same exact 6.19.x major/minor line

Do not upgrade to Prisma 7 during current implementation phases
unless an explicit migration phase is approved.

Therefore:

```text
NO PASS
=
NO NEXT PHASE
```
