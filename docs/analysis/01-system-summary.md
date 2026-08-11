# System Summary

## Purpose and operating context

The system is the operating and financial system of record for one real-estate company that may work through multiple branches, portfolios, and operating accounts. It is not a public multi-tenant SaaS product. External owners, tenants, applicants, and vendors are participants in the company's processes, not tenant organizations with independent administration domains.

The company can conduct materially different businesses against the same physical asset:

- one-time brokerage;
- tenant placement followed by handoff;
- full property management;
- rent-collection-only service;
- master leasing and subleasing;
- operation of company-owned property; and
- specialist leasing of commercial partitions or vacant land.

The central domain rule is therefore: **the physical classification of an asset and the company's service model are independent dimensions**. A shop, floor, house, or land parcel does not determine whether the company is a broker, manager, principal landlord, collection agent, or tenant/sublessor.

## Core system responsibilities

The proposed system spans:

1. company, branch, staff, role, scope, and approval administration;
2. owner acquisition, verification, ownership interests, and service agreements;
3. property and flexible rentable-space registration, including partition history;
4. listings, lead CRM, viewings, applications, screening, and reservations;
5. contract drafting, approval, signing, activation, renewal, termination, and preservation;
6. recurring and one-time charges, receipts, payment allocation, credits, reversals, and receivables;
7. deposits, property expenses, company fees, owner accounting, statements, and payouts;
8. master-lease obligations, sublease receivables, shared costs, and margin reporting;
9. maintenance, inspection, vendor, complaint, notice, communication, task, and approval workflows;
10. auditable reporting, reconciliation, period close, integrations, and external portals.

## Domain shape

The physical hierarchy cannot be hard-coded as `Property -> Building -> Unit`. A property may have a building, but an independently leasable space may also be a floor, hall, room, shop, booth, office, parking space, storage area, or land parcel. Rentable spaces may contain other rentable spaces. Splits, merges, and retirement must preserve predecessor/successor relationships and historical lease references.

The commercial relationship should be effective-dated at the property or space engagement level. Historical charges, contracts, and reports must retain the service model that governed them when created. Changing from brokerage to management, or from one management arrangement to another, must not reinterpret history.

## Financial character

The system is not only an invoicing application. It must distinguish legally and economically different balances:

- tenant receivables;
- collected owner/client money;
- company cash and revenue;
- security-deposit liabilities;
- owner payable and owner reserves;
- vendor payable;
- property income and expenses; and
- company obligations and revenue under master lease/sublease arrangements.

Posted financial events must be immutable. Corrections are new reversals or adjustments. Multi-step postings require atomic transactions, stable source links, idempotency, approval evidence, and closed-period controls.

## Primary control model

Authorization is role-based but cannot stop at roles. Access must also account for branch, portfolio/property assignment, party relationship, amount thresholds, approval authority, and conflicts of duty. Portal users must be limited to their own authorized records. Sensitive internal notes must never become portal-visible merely because they share an entity timeline.

## Overall assessment

The documentation provides a strong domain direction and correctly separates the major service models. It is not yet an implementation-ready specification. Several financial policies, state-transition rules, temporal boundaries, and exception policies remain unresolved. Technical architecture can begin at a conceptual level only after the high-impact decisions in `11-open-decisions.md` receive owners and deadlines; detailed finance and lifecycle design should wait for business, accounting, and legal approval.
