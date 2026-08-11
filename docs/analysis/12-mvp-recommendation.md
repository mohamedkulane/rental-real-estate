# MVP Recommendation

## Recommendation

The documented "MVP" is too broad. It includes most of the final operating platform, multiple distinct business models, high-risk client-money accounting, maintenance/procurement, owner payouts, reporting, and audit. That scope is unlikely to be a safe first release and makes financial controls harder to validate.

Adopt a staged MVP with control foundations first. Do not defer accounting integrity while implementing money-moving workflows.

## Readiness gate: policy and domain baseline

Before implementation, approve the blockers in `11-open-decisions.md`, especially:

- authoritative documentation/version control;
- canonical rentable-space and occupancy model;
- service-model catalog/capability boundaries;
- accounting/custody/period policy;
- deposits and owner payout availability;
- branch access and segregation of duties; and
- local legal review of contracts, notices, screening, deposits, privacy, and eviction/termination.

Produce explicit state-transition tables and financial event/accounting mappings for the first release scope.

## Recommended release slices

### Foundation release

Deliver company/branch configuration, staff identity, scoped authorization, approval framework, audit logging, document/version controls, party identity, property/rentable-space registry, service engagements, and migration-quality tooling.

Acceptance focus: cross-branch denial, immutable audit evidence, valid space hierarchy, effective-dated engagement behavior, and no legacy `Unit`/`RentableSpace` split-brain.

### MVP-A: brokerage operations

Use brokerage as the first end-to-end commercial slice because its post-deal lifecycle is bounded:

- owner/client and property/space onboarding;
- listings, leads, activities, viewings, negotiation;
- brokerage deal approval and signed evidence;
- commission and agent-share accounting;
- payment/receipt/reversal controls required for commission;
- atomic completion to `RENTED_EXTERNAL` and availability removal;
- brokerage pipeline/profitability/control reports.

This slice still requires accounting and audit discipline, but avoids recurring tenant rent, deposits, owner payouts, and maintenance.

### MVP-B: full-management finance core

Add managed lease, move-in, recurring charges, payment verification/allocation, tenant ledger/aging, deposit liability, essential property expense, contractual management fee, owner ledger/statement, controlled payout, reconciliation, and period close.

Do not call this production-ready until double-entry or an equivalently approved balanced posting foundation is active. Owner/tenant portals can wait; internal users can validate the ledgers first.

### MVP-C: essential managed operations

Add maintenance request/triage/work order/vendor bill, inspections, move-out/deposit settlement, renewal/termination, complaints/notices, and role-appropriate notifications.

Keep procurement light unless purchase orders are a confirmed operational requirement.

### Later specialized releases

Add master lease/sublease and shared utilities only after the full-management finance foundation is stable. Then add commercial partition operations and land specialization. Although the core data model must anticipate these from day one, their complex workflows do not need to ship in the first operational release.

Rent-collection-only, tenant placement, and maintenance/inspection-only should not ship until their capability boundaries are approved.

## Items to defer from the first production release

- external owner, tenant, and vendor portals;
- public self-service beyond essential listing/inquiry capture;
- advanced procurement, budgets, preventive maintenance, and asset management;
- broad communications integrations;
- multi-currency unless immediately required;
- advanced BI/forecasting, offline mobile, and AI features;
- specialized master/sublease and utility allocation; and
- large accounting/export integrations beyond required reconciliation/export.

## Architecture implications for the MVP

- Build one modular monolith with strict module boundaries and one transactional PostgreSQL database.
- Make service engagement the single eligibility authority.
- Use rentable space as the canonical leasing/occupancy resource.
- Establish immutable financial posting, idempotency, period control, and audit foundations before workflows move client money.
- Keep scheduled jobs idempotent and policy/version aware.
- Apply authorization in every backend query/command and external file access.
- Preserve signed documents, configurations, allocation inputs, and issued financial report versions.
- Design report dimensions early, but avoid a separate warehouse in the initial release.

## MVP acceptance gates

1. No critical financial or authorization defect remains open.
2. Occupancy conflicts are prevented under concurrency.
3. Brokerage cannot trigger managed jobs; other model eligibility tests pass.
4. Posted transactions can only be corrected by linked reversal/adjustment.
5. Deposits, company money, owner money, tenant credits, and vendor payable reconcile separately for the released scope.
6. Owner payout requires independent approval and verified destination.
7. Cross-branch and portal/object access tests prove deny-by-default behavior.
8. Signed documents and space/service history remain reproducible after later changes.
9. Recurring generation and integration events are idempotent.
10. Backup restore, migration reconciliation, operating procedures, and business UAT are complete.

## Is the documentation ready for technical architecture design?

**Partially.** It is ready for conceptual architecture workshops, bounded-context/module design, threat modeling, decision records, and prototypes that do not commit financial or lifecycle semantics. It is **not ready for detailed database schema, finance architecture, or production workflow design** until the blocker decisions and contradictions are resolved.

The correct next step is a short business/legal/accounting decision phase, not application implementation.
