# Open Decisions Requiring Business Approval

These are not ordinary implementation choices. Each changes legal obligations, accounting outcomes, access, or core workflow behavior. Architecture should record the decision owner, approval evidence, effective date, and affected requirements.

## Blockers before detailed technical architecture

| ID    | Decision                                                                                                                                                            | Required approvers                              | Why it blocks design                                                             |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------- |
| OD-01 | Confirm the authoritative v2 source file and reissue it in a valid, controlled document format.                                                                     | Project sponsor / document owner                | Current filename differs from the request and the `.docx` is plain text.         |
| OD-02 | Approve the definitive service-model catalog and capability matrix, especially tenant placement, rent collection only, and maintenance/inspection-only.             | General manager, operations, finance            | Determines aggregates, workflows, jobs, permissions, and money custody.          |
| OD-03 | Decide service-engagement scope/inheritance across property, parent space, and child space, including mid-life model changes and offboarding.                       | Operations, legal, finance                      | Prevents contradictory model behavior and historical reinterpretation.           |
| OD-04 | Approve accounting basis, chart of accounts, recognition rules, journal dimensions, period close/reopen, and required financial statements.                         | Finance control committee / external accountant | Determines the financial source of truth and reporting architecture.             |
| OD-05 | Approve physical/legal custody rules for owner funds, deposits, tenant credits, and company funds.                                                                  | Finance, legal, banking                         | Determines account structure, reconciliation, controls, and legal compliance.    |
| OD-06 | Define owner balance versus owner payable/payout availability, fee basis, reserves, holds, statement locking/restatement, and payout failure handling.              | Finance, owners/directors                       | Controls whether payouts are correct and reproducible.                           |
| OD-07 | Define deposit receipt, contributors, deductions, disputes, transfer, interest, deadline, refund, and abandoned-funds policy.                                       | Legal, finance, operations                      | Deposit ledger and move-out state machine depend on it.                          |
| OD-08 | Approve the canonical physical/occupancy model: retire or redefine legacy `Unit`, define rentable-space identity/versioning, and resolve the no-area-override rule. | Product steering, operations, legal             | Needed for lease targets, overlap constraints, partition history, and reporting. |
| OD-09 | Define lease/occupancy/reservation interval semantics, shared occupancy, activation waivers, holdover, and overlap enforcement.                                     | Operations, legal                               | Central integrity constraint and state-machine design.                           |
| OD-10 | Approve branch/portfolio/property access inheritance, central roles, cross-branch party records, transfers, and company-wide authorization.                         | Executives, security, operations                | Determines object-level authorization and data partitioning.                     |
| OD-11 | Approve minimum segregation-of-duties conflicts, thresholds, delegation, and small-branch compensating controls.                                                    | Finance, security, executives                   | Shapes approval engine and prevents self-dealing.                                |
| OD-12 | Resolve whether balanced double-entry/GL is MVP foundation or deferred.                                                                                             | Sponsor, finance, product                       | Current roadmap conflicts with stated production-grade financial requirements.   |

## Decisions required before finance implementation

| ID    | Decision                                                                                                                                                        |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OD-13 | Fee/commission schedules per model; billed-versus-collected basis; agent commission vesting, reversal, refund, tax, and clawback.                               |
| OD-14 | Charge/invoice distinction, numbering/legal receipt rules, taxes, credit notes, write-offs, concessions, late fees, and grace periods.                          |
| OD-15 | Payment verification evidence, provider-reference scope, allocation waterfall, unallocated credit, overpayment, chargeback, refund, and returned-payment rules. |
| OD-16 | Currency policy, allowed currencies per contract/account, exchange-rate source/timing, rounding, gains/losses, and reporting currency.                          |
| OD-17 | Owner-share entitlement timing, joint-owner rounding, owner advances/negative balances, cross-property netting, and property-specific restrictions.             |
| OD-18 | Expense responsibility, procurement stages actually in MVP, vendor onboarding, quote requirements, approval thresholds, and emergency limits.                   |
| OD-19 | Shared-utility eligibility, vacancy/common-area treatment, meter estimates, period splitting, taxes/fees, rounding residual, and correction policy.             |
| OD-20 | Master-lease accounting policy, master deposits/incentives, common charges, break/default treatment, and sublease continuity constraints.                       |
| OD-21 | Cut-off calendar, reconciliation standard, payout frequency, payout batching, failed/returned payments, and statement issue schedule.                           |

## Decisions required before leasing and operations implementation

| ID    | Decision                                                                                                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OD-22 | Brokerage completion event, commission debtor, handoff evidence, `RENTED_EXTERNAL` reopening, and conversion to management.                                                    |
| OD-23 | Tenant-placement lifecycle, guarantee/replacement/refund terms, first-money handling, and post-placement support.                                                              |
| OD-24 | Rent-collection-only boundaries for billing, notices, deposits, maintenance, owner statements, and payouts.                                                                    |
| OD-25 | Required lease parties/signatures, approval authority, screening criteria, owner approval, waivers, notices, renewals, termination, eviction/abandonment, and local templates. |
| OD-26 | Reservation duration, conflicts, expiry, payment classification, cancellation/refund, and automated return-to-market rules.                                                    |
| OD-27 | Proration/day-count, due-day behavior, escalations/reviews, incentives/rent-free periods, negotiated pricing approval, and retroactivity.                                      |
| OD-28 | Partition measurement standard, common areas, precision, future layouts, code reuse, meter/asset transfer, and parent/child simultaneous leasing.                              |
| OD-29 | Land permitted-use classifications, maintenance enablement authority, long-term alerts, escalation/review, and document requirements.                                          |
| OD-30 | Maintenance responsibility, SLAs, after-hours emergencies, owner approval thresholds, tenant access, warranty/insurance, verification, and dispute handling.                   |
| OD-31 | Offboarding of an owner/property/service engagement with active leases, deposits, balances, documents, arrears, open work, and portal access.                                  |

## Decisions required before security, privacy, and reporting implementation

| ID    | Decision                                                                                                                                                       |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OD-32 | Data classification, retention/anonymization, correction/export rights, consent, screening retention, and legal-hold rules.                                    |
| OD-33 | Owner representative powers, joint-owner visibility, co-tenant privacy, vendor access fields, internal-note classification, and portal document-sharing rules. |
| OD-34 | MFA/re-authentication scope, session policy, break-glass access, support impersonation, bulk export, and access-review cadence.                                |
| OD-35 | Audit event catalog, before/after redaction, retention, tamper-evidence, access/export roles, and monitoring thresholds.                                       |
| OD-36 | Canonical KPI definitions: denominator populations, dates, cash/accrual views, branch/model attribution, exclusions, and historical restatement.               |
| OD-37 | Required report snapshots, legal/regulatory reports, owner statement presentation, data-export formats, and migration reconciliation sign-off.                 |

## Decision discipline

Unresolved items should not be hidden as configurable flags. Configuration is appropriate only after the allowed choices, accounting effects, permissions, defaults, and change governance are approved. Each accepted decision should be captured in `docs/decisions/` with its rationale and impact.
