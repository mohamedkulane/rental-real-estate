# Unresolved Business Decisions

## Purpose

This file contains only decisions that remain genuinely unresolved after applying the approved Step 2 direction. It does not reopen any accepted architecture decision. Items are grouped by the latest point at which they must be resolved.

## Gate A: required before technical architecture starts

1. **Authoritative source control:** confirm/reissue the approved v2 baseline under the intended filename and in a valid controlled document format.
2. **Service-engagement scope and transition:** define inheritance/override across Property, parent RentableSpace, and child RentableSpace; mid-life changes; and offboarding with active contracts, money, work, and portal access.
3. **Accounting policy baseline:** approve accounting basis, chart of accounts, recognition rules, journal dimensions, close/reopen policy, and mandatory financial statements.
4. **Financial custody:** approve jurisdiction-specific physical custody/account rules for company funds, owner funds, deposits, and tenant credits.
5. **Owner-payable policy:** define fee basis, reserves, holds, negative balances, joint-owner entitlement, statement lock/restatement, payout schedule, and failed/returned payout treatment.
6. **Deposit policy:** define contributor ownership, custody, disputes, transfers, interest, statutory deadlines, deductions' accounting destination, failed refunds, and abandoned funds.
7. **Occupancy interval policy:** define lease/reservation/possession date semantics, conflict periods, shared occupancy/capacity, activation waivers, and holdover.
8. **Authorization scope model:** define branch/portfolio/property inheritance, central-team roles, cross-branch party visibility, property transfers, and historical scope.
9. **Segregation policy:** approve exact prohibited role combinations, action/amount thresholds, delegation, small-branch compensating controls, and emergency exceptions.
10. **Local legal contract baseline:** approve required parties/signatures, notices, renewals, termination, eviction/abandonment, waivers, and templates.

## Gate B: required before finance module design

1. Fee and commission schedules; billed-versus-collected calculation basis; agent vesting, tax, refund, reversal, and clawback.
2. Charge versus invoice semantics; numbering/legal receipt requirements; taxes, credits, concessions, write-offs, late fees, and grace periods.
3. Payment verification evidence; provider-reference scope; allocation waterfall; unallocated credit, overpayment, chargeback, refund, and returned-payment rules.
4. Currency and FX policy, including permitted currencies, source/timing, precision, gains/losses, and reporting currency.
5. Joint-owner effective entitlement, rounding, owner advances, negative balances, cross-property netting, and property restrictions.
6. Procurement scope, vendor onboarding, expense responsibility, quotation requirements, thresholds, and emergency limits.
7. Shared-utility vacancy/common-area rules, meter estimates, period splitting, taxes, rounding residuals, and correction procedure.
8. Master-lease deposits, incentives/rent-free periods, common charges, defaults/breaks, and sublease continuity when the master lease changes or ends.
9. Reconciliation standards, close calendar/cut-offs, payout batching, and statement issue schedule.

## Gate C: required before leasing and operations module design

1. Brokerage commission debtor, exact completion evidence, cancellation/refund/chargeback, reopening `RENTED_EXTERNAL`, and conversion to another engagement.
2. Tenant-placement guarantee/replacement/refund terms, first-money custody, and post-placement support.
3. Rent-collection-only rules for notices, deposits, optional service activation, and offboarding.
4. Screening criteria and authority, owner approval, reservation expiry/funds/refunds, proration/day-count, due dates, escalation, incentives, negotiated pricing, and retroactivity.
5. Partition measurement standard, common areas, precision, topology effective dates, code reuse, and meter/asset reassignment.
6. Land permitted-use categories, maintenance enablement authority, long-term alerts, escalation/review, and required documents.
7. Maintenance responsibility, SLAs, after-hours emergencies, approvals, tenant access, warranty/insurance recovery, completion verification, and disputes.

## Gate D: required before security, portals, reporting, and go-live design

1. Data classification, retention/anonymization, correction/export rights, consent, screening retention, and legal holds.
2. Owner representative powers, joint-owner and co-tenant privacy, vendor visibility, internal-note classification, and portal document sharing.
3. MFA/re-authentication, session management, break-glass, support impersonation, bulk export, and access-review cadence.
4. Audit event catalog, sensitive-data redaction, retention, tamper evidence, access/export roles, and monitoring thresholds.
5. KPI definitions, denominator populations, date basis, cash/accrual views, branch/model attribution, exclusions, and historical restatement.
6. Report snapshots, regulatory outputs, owner statement presentation, export formats, and migration reconciliation/sign-off.

## Approval discipline

Each decision needs a named business owner and, where relevant, finance, legal, security, or operations co-approval. Accepted outcomes should be added as dated decision records. Configuration must not be used to conceal an unapproved policy.
