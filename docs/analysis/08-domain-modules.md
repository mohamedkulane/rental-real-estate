# Domain Modules

The recommended boundaries are business-capability modules inside a modular monolith. They are not proposed microservices. Cross-module changes should use explicit application services, domain events, and database transactions where consistency requires them.

## Foundation modules

### Organization and Access Control

Company, branch, department, portfolio/cost center, employee/user, roles, permissions, scoped assignments, sessions, and access reviews.

### Approval and Policy

Approval definitions, thresholds, conflicts of duty, approval requests/decisions, delegation, holds, and policy versions. This is shared control infrastructure, not embedded ad hoc in each module.

### Audit and Compliance

Append-only audit events, privileged access review, retention/classification policies, data-correction requests, and control reports.

### Configuration, Numbering, and Localization

Currencies, timezone, languages, category vocabularies, sequences, SLAs, templates, and effective-dated policies. Financial policies should remain owned by their domain modules even if administered through common configuration screens.

## Commercial and portfolio modules

### Party and Relationship Management

Owners, representatives, tenants/applicants, guarantors, vendors, contacts, addresses, verification, ownership interests, and communication preferences. Separate role profiles may sit over a common party identity to reduce duplication.

### Service Engagements

Service models, signed management/service agreements, scope by property/space, fee/reserve/approval rules, effective dates, and transitions/offboarding. This module is the authority for capability eligibility.

### Property and Rentable Space

Property/site, building/structural location, rentable-space hierarchy, types, areas, assets/meters, status, readiness, partitions, versions, splits/merges, and predecessor/successor relationships.

### Brokerage and Placement

One-time deal, settlement milestone, commission formulas, agent share, deal profitability, handoff, and `RENTED_EXTERNAL` lifecycle. It consumes CRM/listings but must not trigger managed recurring operations.

### CRM, Marketing, and Viewings

Listings/publication, owner and tenant leads, inquiry sources, activities, matching, viewing scheduling/outcome, consent, and conversion attribution.

### Applications and Reservations

Applicant data, screening evidence, decisions, reason codes, holds, reservation funds/expiry, and conversion to party/lease.

### Contract and Lease Lifecycle

Lease parties, terms, templates, approval, signing, immutable versions, amendments, renewals, notices, termination, possession, move-in/out, and occupancy. Master lease and sublease can share contract primitives without sharing their economics.

### Master Lease and Sublease

Master obligations, subletting constraints, child-space subleases, vacancy exposure, shared costs, and profitability views.

## Financial modules

### Billing and Receivables

Recurring rules, charges, invoices/presentations, proration/escalation, tenant ledger, aging, payment plans, and collections.

### Payments and Allocation

Receipt, verification, posting, allocation, unallocated credits, refunds, reversals, provider references, receipts, and reconciliation hooks.

### Deposits

Requirements, custody, liability transactions, top-ups, disputes, deductions/reclassification, refunds, and settlement statements.

### Property and Owner Accounting

Owner/property subledgers, fees, owner contributions/reserves/holds, statement generation/versioning, owner payable, payout proposals, approvals, execution, and reconciliation.

### Expenses, Procurement, and Payables

Expense requests, quotes, purchase orders if retained in scope, vendor bills, responsibility, allocations, approval, and vendor payable.

### Shared Utilities

Utility source bills, meter/occupancy/area inputs, allocation-rule versions, immutable allocations, child charges, rounding, adjustments, and reconciliation.

### General Ledger and Period Control

Accounts, journals, balanced posting, periods, close/reopen controls, bank/mobile-money reconciliation, accounting exports, and financial statements. The source puts full GL in Phase 2/financial maturity while simultaneously requiring production-grade accounting; that sequencing must be resolved.

## Operations and experience modules

### Maintenance and Work Management

Requests, triage, responsibility, emergency overrides, quotations, work orders, access scheduling, evidence, completion, preventive maintenance, and asset links.

### Inspections and Turnover

Templates, inspections, condition/inventory/meter/key evidence, signatures, comparisons, move-in/move-out, and readiness.

### Cases, Notices, and Communications

Complaints, violations, legal/operational notices, communication preferences, delivery evidence, and shareability classification.

### Tasks, Notifications, and Jobs

Manual/automated tasks, reminders, SLAs, scheduled charge/alert generation, retries, dead-letter handling, and idempotency. It orchestrates work but does not own financial truth.

### Documents and Signatures

Private files, metadata, malware validation, versions, templates, signature evidence/hash, expiry, access policy, and signed-copy preservation.

### Reporting and Analytics

Operational projections, finance reports, audit/control reports, exports, report snapshots, and metric definitions. Source ledgers/modules remain systems of record.

### External Portals and Public Experience

Owner, tenant/applicant, vendor, and public-listing experiences. These are delivery surfaces over domain APIs, not independent domains.

## Coupling cautions

- Do not make `Unit` and `RentableSpace` competing lease targets.
- Do not encode service-model switches independently in billing, maintenance, and payout modules; use one authoritative engagement policy.
- Do not let reporting compute authoritative balances from mutable operational fields.
- Do not make a generic workflow engine the owner of domain states; domain modules enforce their own transitions.
- Do not let portal/UI visibility substitute for backend authorization.
