# Business Models

## Why the models must remain distinct

The service model controls workflow eligibility, accounting treatment, party roles, reporting, and risk. It must not be inferred from property type or a current space status. A single rentable space may move between service models over time, but only through an effective-dated, approved transition.

## Model analysis

### Brokerage only

The company markets or sources a rentable space, closes a one-time deal, earns commission, and hands the ongoing relationship to the external parties. The completed space becomes `RENTED_EXTERNAL` and leaves active availability.

Required records include the owner/client, lead, listing, viewings, negotiated terms, signed evidence, gross commission, company share, agent share, taxes/fees, receipts, settlement, and profitability. Prohibited downstream behavior includes monthly tenant billing, owner-payable cycles, recurring owner statements, and managed maintenance.

Key unresolved points are the legal completion event, which party owes commission, whether commission can be recognized before collection, treatment of cancelled/refunded deals, and how the company learns when an external tenancy ends so availability may be reopened.

### Tenant placement

The source lists tenant placement separately but does not specify its lifecycle in the same depth as brokerage. Placement may involve application/screening, lease preparation, first-money handling, or a short guarantee period before handoff. Those differences affect whether a limited tenant ledger and deposit custody exist.

It should not simply be an alias for brokerage until the business defines completion, handoff evidence, post-placement obligations, refund/guarantee policy, and whether the property is marked `RENTED_EXTERNAL`.

### Full management

The company acts for the owner throughout the managed lifecycle. It bills recurring rent and other charges, allocates collections, manages receivables and maintenance, records property expenses, calculates company fees, issues owner statements, and controls payouts.

The service agreement is the economic authority for fee schedules, reserves, approval thresholds, expense responsibility, and payout instructions. A managed lease must retain the agreement/rule versions used to calculate each posting. Terminating management while leases, deposits, arrears, open work, or owner balances remain requires a formal offboarding and settlement workflow, which the source does not yet define.

### Rent collection only

This model is named but not operationally specified. It likely supports recurring charges, receipts, allocations, arrears, statements, and a collection fee, while excluding or limiting maintenance, inspections, leasing, and expense administration. The exact boundary is critical: it determines what money is held, whether the company calculates owner payable, who issues notices, and what tenant/owner portal data is valid.

### Master lease/sublease

The company is tenant under a master lease and landlord-side counterparty under subleases. Master rent is a company obligation/cost; sublease billing is company receivable/revenue subject to approved accounting policy. Parent and child spaces, vacancies, shared utilities, and direct costs drive margin reporting.

This model cannot reuse owner-payout accounting from full management. The owner is normally a creditor under the master lease, not a beneficiary of collected tenant funds. The system must still handle deposits, incentives, escalation, break clauses, common-area costs, and exposure where sublease terms exceed the master lease or permitted-use constraints.

### Company-owned property

The company owns the asset and retains property income. There is no external owner payable, but ownership proof, property-level income/expense reporting, deposits, receivables, maintenance, and leases still apply. The source does not clarify joint ventures or partially company-owned properties; these should not be forced into this model without an approved treatment.

### Vacant-land leasing

Land is primarily a physical specialization, not necessarily a distinct service model. It can be managed, company-owned, brokered, or possibly master leased. Residential fields are excluded, maintenance defaults off, and long-term review, escalation, expiry, permitted-use, access, boundary, and document controls become prominent.

The capability matrix's standalone "Vacant Land" column conflicts conceptually with the stated separation of property type and service model. Land behavior should be a specialization layered onto an actual service model.

### Maintenance/inspection-only service

The document lists this commercial arrangement but provides no eligibility, contract, billing, approval, or accounting lifecycle. It is either future scope or a missing service model. Treating it as supported today would create ambiguity about owner funds, work authorization, vendor liabilities, and portal access.

## Cross-model transition rules needed

Every transition should define:

- effective date and authorizing agreement;
- treatment of active listings, reservations, leases, deposits, arrears, work orders, and documents;
- final statement/settlement responsibilities;
- jobs that stop, continue, or transfer;
- portal access changes;
- status and availability consequences; and
- immutable retention of the prior model context.

No service-model transition should edit historical financial classification or silently replace signed contracts.
