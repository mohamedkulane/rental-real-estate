# Implementation Sequencing

This is architecture sequencing only; Step 4 database/Prisma design must precede implementation.

## 1. Architecture and data-design gate

Finalize aggregate/state/event catalogs, accounting policy mappings, temporal interval semantics, jurisdiction configuration boundaries, and database integrity strategy. Produce Step 4 schema/Prisma design and migration/testing plan.

## 2. Platform foundation

Organization/branches, company-level parties, IAM/scopes, approvals, audit, configuration/versioning, idempotency, transaction/outbox foundation, files metadata, and core observability.

## 3. Portfolio foundation

Property, Building, RentableSpace/configuration hierarchy, operating-branch history, ServiceEngagement inheritance/compatibility, availability projection, and partition integrity.

## 4. Accounting foundation

Fiscal years/periods, chart/accounts, journals/lines/dimensions, posting contracts, fund classification, reversals/adjustments, and reconciliation primitives. This precedes any production money workflow.

## 5. Brokerage and tenant-placement slice

CRM, listings, viewings, deal/placement lifecycle, documents, commission posting, and atomic `RENTED_EXTERNAL` closure. Verify forbidden recurring jobs.

## 6. Managed leasing and collections

Applications, reservations, immutable contracts, exclusive possession, charges/waivers, payments/allocation/credits, and tenant ledger.

## 7. Deposits and owner accounting

Contributor-aware deposit ledger/disputes/transfers/refunds; ownership/payout entitlement, reserves, negative balances, contributions, statements, maker-checker payout execution/failure/retry.

## 8. Property operations

Maintenance, vendors, quotations/work orders, inspections, expense/payables, evidence, emergency overrides, and service-engagement eligibility.

## 9. Master lease/sublease and utilities

Master obligations, child subleases, shared utility allocation, direct/shared expenses, and margin projections after Finance is stable.

## 10. Experience and optimization

Portals, broader notifications/integrations, advanced reporting, preventive maintenance, performance scaling, and optional maintenance-only/shared-occupancy models.

## Gates per increment

Each increment requires backend authorization, validation, audit, transaction/concurrency tests, idempotency, observability, documentation, and business UAT. No finance increment proceeds without reconciled example postings and invariant tests.
