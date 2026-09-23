# Decision Register

## Purpose

This register reconciles the open decisions recorded in `docs/analysis/11-open-decisions.md` with the approved Step 2 directions dated 8 August 2026. It is the navigation point for the decision package and records whether each earlier decision is resolved, partially resolved, or still open.

Status meanings:

- **Resolved**: the approved direction is sufficient for conceptual technical architecture.
- **Partially resolved**: a governing principle is approved, but business policy is still needed before the affected detailed design or implementation.
- **Open**: business, legal, finance, security, or operational approval is still required.

## Approved architecture decisions

| Decision                                                                    | Status   | Governing record                                                   |
| --------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------ |
| RentableSpace is the sole canonical leasing and occupancy target            | Accepted | [ADR-001](adr/ADR-001-rentable-space-as-canonical-lease-target.md) |
| Journal-backed double-entry accounting is an MVP foundation                 | Accepted | [ADR-002](adr/ADR-002-double-entry-accounting-from-foundation.md)  |
| Posted financial records are immutable and corrected by reversal/adjustment | Accepted | [ADR-003](adr/ADR-003-immutable-posted-financial-records.md)       |
| Service engagements determine enabled capabilities                          | Accepted | [ADR-004](adr/ADR-004-service-model-driven-capabilities.md)        |
| RentableSpace supports parent-child hierarchy and historical configurations | Accepted | [ADR-005](adr/ADR-005-parent-child-rentable-space-hierarchy.md)    |
| Signed contracts are versioned and never silently overwritten               | Accepted | [ADR-006](adr/ADR-006-contract-versioning-and-immutability.md)     |
| Backend authorization combines role, branch, and object scope               | Accepted | [ADR-007](adr/ADR-007-backend-branch-scoped-authorization.md)      |
| Sensitive financial actions support configurable segregation of duties      | Accepted | [ADR-008](adr/ADR-008-segregation-of-financial-duties.md)          |

## Reconciliation of previous open decisions

| Prior ID | Status after Step 2 | Resolution or remaining issue                                                                                                                                                                                        |
| -------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OD-01    | Open                | The authoritative v2 source still needs a valid, controlled document and confirmed filename.                                                                                                                         |
| OD-02    | Resolved            | Brokerage, tenant placement, full management, rent collection only, master lease/sublease, company-owned, and optional future maintenance-only have defined boundaries. Land is a physical specialization.           |
| OD-03    | Partially resolved  | Capabilities are engagement-driven and non-recurring after handoff where specified. Scope inheritance, mid-life transitions, and offboarding remain open.                                                            |
| OD-04    | Partially resolved  | Double entry, journals, periods, and immutable posting are approved. Accounting basis, chart, recognition, dimensions, close/reopen, and statements remain open.                                                     |
| OD-05    | Partially resolved  | Required balances are logically distinct. Physical/legal custody and bank-account rules remain jurisdiction dependent.                                                                                               |
| OD-06    | Partially resolved  | Default payout uses cleared/verified collections and cannot exceed owner payable. Fee basis, reserves, holds, restatement, and failures remain open.                                                                 |
| OD-07    | Partially resolved  | Deposits are liabilities; deductions need reason, approval where required, and audit. Contributor, dispute, transfer, interest, deadline, and abandoned-funds rules remain open.                                     |
| OD-08    | Resolved            | RentableSpace is canonical; Unit is not a competing target; area override is prohibited; history is versioned.                                                                                                       |
| OD-09    | Open                | Date interval semantics, reservation conflicts, shared occupancy, waivers, holdover, and precise overlap enforcement remain open.                                                                                    |
| OD-10    | Partially resolved  | Backend role + branch + object scope is approved, including one/many/all branch access. Inheritance, central roles, party sharing, and transfers remain open.                                                        |
| OD-11    | Partially resolved  | Core segregation principle and configurable action/amount approvals are approved. Exact conflicts, thresholds, delegation, and compensating controls remain open.                                                    |
| OD-12    | Resolved            | Journal-backed double entry is an MVP foundation; advanced screens/reports may follow.                                                                                                                               |
| OD-13    | Open                | Fee and commission rates, calculation basis, vesting, taxes, reversal, refund, and clawback remain open.                                                                                                             |
| OD-14    | Open                | Charge/invoice, tax, receipt, credit, write-off, concession, late-fee, and grace rules remain open.                                                                                                                  |
| OD-15    | Open                | Verification evidence, allocation order, provider reference scope, credits, chargebacks, refunds, and returned payments remain open.                                                                                 |
| OD-16    | Open                | Currency, exchange-rate, rounding, gain/loss, and reporting-currency policy remain open.                                                                                                                             |
| OD-17    | Open                | Joint-owner entitlement, rounding, advances, negative balances, and cross-property netting remain open.                                                                                                              |
| OD-18    | Open                | Procurement scope, vendor controls, expense responsibility, quotations, thresholds, and emergency limits remain open.                                                                                                |
| OD-19    | Open                | Utility eligibility, vacancy/common-area treatment, meter estimates, period splits, taxes, rounding, and correction remain open.                                                                                     |
| OD-20    | Partially resolved  | Master rent is company expense/liability; sublease rent is company revenue; shared costs reduce margin; no normal owner payable. Deposits, incentives, defaults, break clauses, and sublease continuity remain open. |
| OD-21    | Open                | Close cut-offs, reconciliation standard, payout frequency/batching/failures, and statement schedule remain open.                                                                                                     |
| OD-22    | Partially resolved  | Brokerage lifecycle and prohibited recurring behavior are approved. Commission debtor, exact completion evidence, refunds, reopening, and conversion remain open.                                                    |
| OD-23    | Partially resolved  | Tenant-placement lifecycle and handoff boundary are approved. Guarantees, refunds, first-money custody, and post-placement support remain open.                                                                      |
| OD-24    | Partially resolved  | Required collection-only capabilities and default exclusions are approved. Notice, deposit, service opt-in, and detailed settlement policies remain open.                                                            |
| OD-25    | Open                | Parties/signatures, screening, approval, notices, renewal, termination, eviction/abandonment, and local templates remain open.                                                                                       |
| OD-26    | Open                | Reservation duration, expiry, funds, cancellation, conflicts, and return-to-market rules remain open.                                                                                                                |
| OD-27    | Open                | Proration, due dates, escalations, incentives, negotiated pricing, and retroactivity remain open.                                                                                                                    |
| OD-28    | Partially resolved  | No active child-area excess and versioned measurement correction are approved. Measurement standards, common area, precision, topology timing, and asset transfer remain open.                                       |
| OD-29    | Partially resolved  | Land is a RentableSpace specialization and maintenance defaults off. Permitted uses, alerts, escalation, documents, and enablement authority remain open.                                                            |
| OD-30    | Open                | Maintenance responsibility, SLAs, emergencies, approvals, access, recovery, verification, and disputes remain open.                                                                                                  |
| OD-31    | Open                | Engagement offboarding with live contracts, money, work, documents, and portal access remains open.                                                                                                                  |
| OD-32    | Open                | Privacy classification, retention, anonymization, rights, consent, screening, and legal holds remain open.                                                                                                           |
| OD-33    | Open                | Representative, joint-owner, co-tenant, vendor, note, and portal-sharing policies remain open.                                                                                                                       |
| OD-34    | Open                | MFA, re-authentication, sessions, break-glass, impersonation, exports, and review cadence remain open.                                                                                                               |
| OD-35    | Open                | Audit catalog, redaction, retention, tamper evidence, access, exports, and monitoring remain open.                                                                                                                   |
| OD-36    | Open                | KPI formulas, populations, timing, attribution, exclusions, and restatement remain open.                                                                                                                             |
| OD-37    | Open                | Report snapshots, regulatory outputs, statement format, exports, and migration sign-off remain open.                                                                                                                 |

## Decision package index

- `01-domain-model-decisions.md`
- `02-financial-accounting-decisions.md`
- `03-service-model-decisions.md`
- `04-contract-lifecycle-decisions.md`
- `05-authorization-and-approvals.md`
- `06-rentable-space-and-partitioning.md`
- `07-unresolved-business-decisions.md`
- `22-rental-simplification-wave1.md`
- `24-rental-placement-order.md`
- `25-listing-for-public-marketing.md`

## Governance rule

Architecture may rely on accepted decisions immediately. A partially resolved item must not be interpreted beyond its approved principle. Open policy choices must be resolved in a dated decision record before committing the affected detailed design.
