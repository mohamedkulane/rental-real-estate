# Domain Glossary

This glossary normalizes terms that the source sometimes uses interchangeably. Terms marked **approval needed** require a business definition before detailed design.

## Organization and access

- **Company**: the single legal/operating real-estate company using the system.
- **Branch**: an organizational and access boundary within the company; it is not a tenant boundary.
- **Portfolio**: a managed grouping of properties, potentially used for assignment, reporting, and access. Its relationship to branches needs explicit rules.
- **Assignment scope**: records a staff member may access because of branch, portfolio, property, or task assignment.
- **Approval authority**: permission constrained by action, amount, branch/portfolio, and possibly service model.

## Parties and agreements

- **Party**: a person or organization acting as owner, applicant, tenant, guarantor, vendor, representative, or other role. A unified party model is an observation, not an approved requirement.
- **Owner**: person or entity with verified legal or contractual interest in a property.
- **Ownership interest**: an owner's effective-dated percentage or legal interest in a property.
- **Service engagement**: effective-dated commercial relationship describing what the company is authorized to do for a property or rentable space.
- **Management agreement**: signed agreement authorizing full or limited management services and their economics.
- **Master lease**: contract under which the company rents a parent space from an owner/landlord.
- **Sublease**: contract under which the company leases all or part of a master-leased space to a subtenant.
- **Lease**: generic rental contract and operational record. The source also models master leases and subleases separately; the shared contract boundary requires design.
- **Amendment**: signed change that preserves the original signed contract and becomes effective under controlled rules.

## Physical asset and inventory

- **Property**: real-estate site or asset used as the stable top-level business/ownership context.
- **Building**: physical structure on a property; optional where not applicable.
- **Structural level**: floor or other non-leasable location grouping. A floor may instead be leasable, so structural level and rentable space must not be conflated.
- **Rentable space**: stable identity for a physical space that can be independently marketed, reserved, or leased.
- **Space type**: physical classification such as house, apartment, room, floor, hall, shop, booth, office, warehouse, land, parking, or storage.
- **Parent space / child space**: containment relationship between rentable spaces.
- **Space configuration/version**: effective-dated description of area and topology at a point in time.
- **Space relationship**: predecessor/successor, split, merge, or containment link that preserves partition history.
- **Usable area**: maximum area available for allocation to active child spaces under the approved measurement policy.
- **Exclusive occupancy**: occupancy that prohibits overlapping active leases for the same space/date range.
- **Shared occupancy**: explicitly supported capacity/bed/room arrangement with defined overlap rules. **Approval needed.**

## Commercial models and status

- **Service model**: policy-driving classification of the company's role: brokerage, tenant placement, full management, master lease/sublease, company-owned, or rent collection only.
- **Brokerage deal**: one-time transaction earning commission without ongoing rent administration.
- **`RENTED_EXTERNAL`**: unavailable because a brokerage/placement deal produced an externally managed tenancy.
- **Operational status**: whether a physical record is active, suspended, offboarded, retired, or archived.
- **Marketing status**: whether a space/listing may be marketed.
- **Occupancy status**: availability/occupation derived from valid reservations and leases, not a free-standing source of truth.
- **Reservation**: temporary exclusive hold with expiry and configurable funds treatment.

## Leasing and billing

- **Charge**: an amount owed by a party, with due date, currency, source, and accounting classification.
- **Invoice**: presentation/grouping of one or more charges. The source does not clearly establish whether invoices are accounting documents or optional statements.
- **Recurring charge rule**: effective-dated instruction used to generate charge occurrences.
- **Proration**: partial-period calculation using an approved day-count policy. **Approval needed.**
- **Payment**: receipt of money pending verification/posting and allocation.
- **Payment allocation**: amount from a payment applied to an open charge.
- **Tenant credit/overpayment**: posted funds not currently allocated to charges; liability/credit treatment needs approval.
- **Receipt**: immutable evidence of a posted receipt with a unique reference; reversal does not delete it.
- **Reversal**: new linked financial event that negates a posted event.
- **Adjustment**: approved new entry correcting classification or value without modifying the original.

## Deposits and owner accounting

- **Security deposit**: tenant funds held as a liability, not rent or company revenue.
- **Deposit transaction**: receipt, top-up, approved deduction, refund, transfer, or reversal affecting deposit liability.
- **Owner funds**: money held or controlled for an owner/client and segregated from company money.
- **Owner ledger**: detailed owner-attributable income, expenses, fees, reserves, contributions, holds, and payouts.
- **Owner payable**: verified amount currently eligible to be paid to an owner after deductions, reserves, holds, and reconciliation.
- **Owner balance**: broader ledger balance; it is not necessarily immediately payable.
- **Owner reserve**: owner funds retained for approved future property costs.
- **Owner statement**: versioned period report derived from ledger activity and locked after payout/issue under policy.
- **Owner payout**: controlled disbursement to a verified owner destination.

## Operations and control

- **Maintenance request**: reported issue requiring triage; distinct from a complaint.
- **Work order**: approved assignment to perform maintenance.
- **Vendor bill**: supplier claim payable after verification/approval.
- **Shared utility bill**: approved source cost allocated among eligible spaces.
- **Utility allocation rule**: versioned calculation basis such as equal, area, meter, occupancy, fixed, or custom percentage.
- **Utility allocation**: immutable posting result with factors, rounding, and child charges linked to the source bill.
- **Posting**: transition that commits a financial event to ledgers and prevents ordinary editing/deletion.
- **Reconciliation**: matching internal transactions to external account evidence.
- **Accounting period close**: control preventing edits to a completed period; later corrections post to an open period.
- **Audit event**: append-only evidence of actor, action, target, time, context, reason, and relevant before/after values.
