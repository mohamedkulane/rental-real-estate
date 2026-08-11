# Risks and Edge Cases

## Critical risks

### Financial custody and accounting policy is unapproved

The document correctly separates money conceptually but leaves jurisdiction, custody accounts, recognition basis, tax, owner payable availability, and deposit law unresolved. Building finance before approval risks incorrect balances, illegal commingling, and irreproducible owner statements.

### Service models leak into one another

If capability checks are duplicated across modules, brokerage can accidentally generate rent jobs or payouts; master leases can be treated as managed-owner money; land can inherit residential validation. One effective-dated engagement authority is essential.

### Unit and rentable-space duplication

Parallel lease targets will weaken occupancy, availability, reporting, and permissions. The canonical target must be chosen before physical design.

### History can be rewritten indirectly

Even without deleting contracts/transactions, editing rate rules, ownership shares, service models, space area/topology, or allocation inputs can change regenerated reports. Versioned inputs and issued-report snapshots are required.

### Branch scoping is underspecified

Cross-branch parties, property transfers, central finance, shared accounts, and company-wide roles can expose data or distort reporting unless each entity/action has a clear scope.

## Business-model edge cases

- Brokerage deal completes but commission remains unpaid, partially paid, refunded, or charged back.
- Brokerage deal is cancelled after agreement signing or reopened when an external tenancy ends.
- Tenant placement includes a guarantee/replacement period or temporary deposit/rent custody.
- Full-management agreement ends while lease, deposit, arrears, owner payable, maintenance, or vendor bills remain open.
- Rent-collection-only customer asks the company to issue arrears notices or handle deposits/maintenance.
- Company-owned property becomes jointly owned or sold during an active lease.
- Service model changes mid-period or applies only to selected child spaces.
- Master lease starts after or ends before a dependent sublease, is terminated early, or prohibits the actual sub-use.
- Master landlord grants rent-free periods or charges variable common costs.

## Space and occupancy edge cases

- Two users reserve/activate the same space concurrently.
- Parent is leased while a child is also offered or occupied.
- Future partition overlaps an active or future-dated lease.
- Split/merge reassigns meters, assets, keys, deposits, listings, or maintenance history.
- Child areas equal usable area but omit required common/circulation space.
- Measurements change units/precision or are later corrected.
- A shared-housing model needs capacity-based concurrent leases.
- Tenant occupies before legal start, holds over after end, abandons, or partially surrenders space.
- A space is damaged/unready after reservation but before move-in.

## Billing and payment edge cases

- Leap years, short months, mid-month starts/ends, due day 29-31, and timezone cut-offs.
- Escalation falls during a billing period or is indexed/negotiated retroactively.
- Multiple currencies, FX rounding, refunds at a different rate, and currency-specific minor units.
- One payment covers several leases/owners or is posted to the wrong party.
- Unidentified receipt later matched; duplicate provider reference across accounts.
- Cash receipt is voided, bank transfer returned, mobile payment reversed, or cheque dishonored.
- Allocation must be moved after owner payout or period close.
- Tenant overpays, prepays many months, disputes a charge, or enters a payment plan.
- Charge is waived, discounted, written off, or corrected after invoice/statement issue.

## Deposit edge cases

- Multiple contributors/co-tenants fund one deposit.
- Deposit transfers to renewal/new space or changes currency.
- Deposit is insufficient for deductions; excess becomes receivable.
- Deduction is disputed while undisputed refund is due.
- Interest or statutory custody/refund deadlines apply.
- Owner, company, or external scheme physically holds the deposit.
- Deposit was incorrectly treated as rent or paid to an owner and must be recovered.
- Tenant cannot be located or refund payment fails.

## Owner and payout edge cases

- Ownership shares change mid-period or remain pending/disputed.
- Joint owners use different payout destinations/currencies or have legal holds.
- Owner balance is positive but custody cash is not cleared/available.
- Payout is approved, then source payment is reversed or expense arrives late.
- Payout succeeds partially in a batch, is returned, duplicated, or sent to stale details.
- Owner funds span branches/properties with restrictions against cross-subsidization.
- Owner advances money for expenses or has a negative balance.
- Statement is disputed or corrected after lock/payout.

## Utility and expense edge cases

- Source bill spans periods or includes tax, fixed charge, arrears, penalties, and common-area use.
- Meters reset/fail, readings are estimated, or occupancy changes mid-period.
- Vacant spaces' share is owner/company cost versus redistributed to occupied spaces.
- Custom percentages do not total 100%; rounding leaves residuals.
- A source bill is corrected after child charges are paid.
- Vendor submits duplicate invoice or cost exceeds quote/work-order approval.
- Responsibility moves between tenant, owner, company, warranty, and insurer.

## Workflow, permission, and audit edge cases

- Approver is absent, delegated, also creator, or loses authority mid-workflow.
- Small branch cannot meet segregation; compensating review is needed.
- Property transfers branch while tasks/approvals are open.
- User loses assignment but retains cached/export/file access.
- Owner representative authority expires; co-owner visibility conflicts.
- Bulk exports, background jobs, notifications, and search indexes bypass object scope.
- Audit before/after captures secrets or sensitive document content.
- Clock/timezone differences change deadlines or effective transitions.

## Operational and resilience risks

- Recurring jobs run twice or miss a period.
- Integration webhook is duplicated, delayed, out of order, or malicious.
- File upload contains malware or signed URL is forwarded.
- Report queue creates a snapshot after underlying period changes.
- Backup exists but point-in-time restore loses document/database consistency.
- Partial migration creates occupied spaces without leases or opening balances without source evidence.

## Documentation risks and contradictions

- Requested source filename `_v2.docx` is absent; the repository file declares v2 internally.
- The repository `.docx` is actually plain text, so normal Word validation/version metadata cannot be trusted.
- Full GL is described as required for production-grade accounting but deferred to later financial maturity.
- MVP is called essential yet includes nearly the entire operating platform and all high-risk finance.
- Vacant land appears as a service-model column despite being a physical specialization.
- Maintenance/inspection-only is listed as supported but lacks a defined model/workflow.
- The source allows child-area override while the task's critical rule prohibits exceeding usable area.
- Workflow numbering begins at 8/14/21 in several sections, suggesting editorial merge issues and weak traceability.
