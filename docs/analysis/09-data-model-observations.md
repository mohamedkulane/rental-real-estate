# Data Model Observations

This document records conceptual observations only. It is not a database schema.

## 1. Replace the legacy unit-centric lease target

The source retains `Unit` in representative tables while introducing `RentableSpace`. If leases, listings, reservations, and occupancy can point to either, invariants and reports will fragment. A single canonical occupancy resource is needed. Residential "unit" can be a rentable-space type or compatible profile, while building and structural levels remain location/containment concepts.

## 2. Separate stable identity from changing configuration

A stable rentable-space identity may need effective-dated configurations for area, pricing basis, permitted use, and topology. Splits/merges should create successor/predecessor records and retire configurations rather than rewriting identities cited by signed leases.

Questions include whether a physical successor receives a new identity, how codes are reused, and whether signed contracts snapshot descriptive attributes in addition to referencing the space.

## 3. Model temporal facts explicitly

Effective dating is required for:

- ownership interests and representative authority;
- branch/portfolio/property assignments;
- service engagements and fee rules;
- space configurations and relationships;
- pricing and recurring charge rules;
- leases/amendments and party participation;
- approval limits and policy versions; and
- meter, allocation, and reporting bases.

Created/updated timestamps alone cannot answer "what governed this transaction at that time?"

## 4. Service engagement is the capability authority

Attaching only a current enum to property/space is insufficient. The engagement needs scope, parties, effective dates, signed agreement version, model, fee/reserve/approval terms, and transition history. Historical transactions should persist the engagement/model reference or immutable classification snapshot.

The model also needs a rule for nested scopes: whether a child inherits the parent's engagement and how an explicit child engagement overrides it.

## 5. Ownership and payout entitlement are different

`PropertyOwner.sharePercent` describes ownership, but payout entitlement may depend on effective dates, property, income category, agreement, reserve, and payment instruction. Joint-owner rounding and disputed/pending shares require a temporal allocation policy. A simple owner ID on payout is insufficient for explainability.

## 6. Contract record versus signed artifact

Operational lease data, generated document version, signatures, amendments, and signed binary/hash should be connected but not conflated. Signed text must remain immutable even if operational status or contact details later change. Amendments need explicit legal effect and charge-schedule consequences.

Master leases, subleases, managed leases, and external brokerage agreement evidence share contract/document primitives but have different party roles and financial behavior.

## 7. Occupancy overlap needs temporal integrity

A partial unique index on `status = ACTIVE` cannot by itself prevent overlapping date ranges. The design needs a canonical occupancy interval and concurrency-safe enforcement, such as PostgreSQL exclusion constraints where compatible plus transactional locking/application validation. Reservations and possession before/after legal lease dates also need coordinated conflict rules.

Shared occupancy should be a different capacity model, not an override that weakens the exclusive-space invariant.

## 8. Physical containment is not sufficient for area control

Parent-child rows need an effective interval/configuration context. The area invariant must specify normalized units, usable versus gross area, common area, walls/circulation, precision, and whether inactive/future children count. Enforcing only on current rows will not protect scheduled future layouts.

The instruction supplied with this task says child totals must never exceed usable parent area, while the source allows authorized override. This should be resolved before constraint design.

## 9. Financial records need source-event and ledger layers

Operational entities such as payment, charge, deposit movement, expense, utility allocation, and payout should link to immutable journal entries/lines. Authoritative balances should derive from posted entries or controlled subledger projections, not stored mutable totals.

Important dimensions include company, branch, property, rentable space, owner/party, lease/engagement, account, currency, period, source type/id/version, and reconciliation state. Not every dimension belongs on every row, but reporting requirements must be mapped before finalizing journal dimensions.

## 10. Do not use a single generic status field

Property/space operational, readiness, marketing, occupancy, legal/contract, posting, reconciliation, and portal-publication statuses have different authorities. Combining them creates invalid states such as "available" and "occupied" simultaneously. Derived statuses should be marked as projections; command-owned states need transition history.

## 11. Allocation is a first-class auditable result

Payment, utility, owner-share, and expense allocations should not be modeled as anonymous amount links. Each needs method/rule version, inputs, results, rounding/remainder, source, recipient, effective period, status, reversals, and provenance. The algorithms differ and should not be forced into one overly generic table.

## 12. Party deduplication and privacy

The same person/entity can be owner, tenant, representative, guarantor, employee, or vendor contact and can span branches. A common party identity could reduce duplicate KYC/contact data, but role-specific sensitive profiles and retention rules must remain separated. Deduplication matches are not proof and need merge/unmerge governance.

## 13. Branch is a dimension, not universal ownership

Some records are company-wide (party identity, chart of accounts, central accounts), some branch-owned, and some span branches. Every aggregate needs an explicit scope and transfer rule. Historical transactions should retain original branch/cost-center attribution after a property transfer.

## 14. Snapshots and reporting history

Owner statements, payout calculations, rent rolls, allocation runs, close reports, and material approval calculations need reproducible snapshots/version references. Live queries alone cannot reproduce an issued report after later corrections or configuration changes.

## 15. Immutability and deletion policy

Referenced master records should be archived/retired, not deleted. Financial postings, audit events, signed artifacts, approval decisions, and posted allocation results are append-only. Privacy erasure may require anonymization/pseudonymization while preserving legally required financial and contract evidence; the policy must be defined per data class.

## 16. Concurrency hotspots

Lease/reservation activation, payment posting/allocation, receipt numbering, charge generation, split/merge, utility allocation, owner payout, period close, and external webhook processing require explicit transaction isolation, locking/idempotency, and retry behavior.

## 17. Reporting-driven observations

Required reports demand retained facts for billed versus collected rent, period attribution, vacancy, ready dates, model context, commission splits, child-space area utilization, master cost accrued/paid, allocation inputs, owner entitlement, and audit decisions. These facts cannot be reconstructed reliably if only current statuses or net totals are stored.
