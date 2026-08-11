# Business Rules

## Highest-priority invariants

1. An exclusive rentable space cannot have overlapping active lease occupancy for the same time range.
2. A reservation cannot conflict with another effective reservation or an active lease according to a defined hold policy.
3. Signed contract content is immutable. Amendments, replacements, cancellation, and renewals create linked versions.
4. Posted financial transactions and issued receipts are never physically deleted or silently edited.
5. A reversal/adjustment must reference the source, record a reason, respect period rules, and follow approval policy.
6. Payment allocations cannot exceed either the allocatable payment balance or the relevant open charge balance.
7. Deposit movements cannot create a refund/deduction greater than the held deposit; excess claims become separate receivables.
8. Owner payout cannot exceed verified payout availability after reserves, holds, unreconciled items, and prior disbursements.
9. Child-space area totals cannot exceed parent usable area except through an explicitly approved, evidenced override.
10. Historical spaces, contracts, transactions, allocations, and service-model contexts remain referentially available.
11. Every privileged or sensitive action is authorized in the backend and creates an audit event.
12. Branch/company-wide access is deny-by-default and must be explicitly scoped.

## Service-model rules

- Brokerage completion posts deal economics, transitions the space to `RENTED_EXTERNAL`, removes availability, and creates no recurring rent, owner payout, owner statement, or managed-maintenance jobs.
- Full management permits recurring billing, managed operations, fee calculation, owner statements, and controlled payout only while an effective agreement authorizes them.
- Master lease/sublease keeps the company's payable master obligation separate from subtenant receivables/revenue. Profitability must preserve components rather than store only net margin.
- Company-owned property creates no external owner payable.
- Rent collection only and tenant placement require approved capability matrices before implementation.
- Service-model changes are effective-dated, approved as configured, audited, and non-retroactive.

## Rentable-space rules

- Property, building, structural location, and rentable space are separate concepts even where they appear one-to-one.
- Each independently leasable space has a stable identifier and a code unique within its defined parent/effective range.
- Split and merge operations are versioned, atomic, and create predecessor/successor relationships.
- A topology change must not alter the space identity/configuration cited by a signed historical lease.
- Parent and child spaces cannot both be exclusively occupied for the same physical area and time unless an approved coexistence rule explicitly permits it.
- Area validation requires one normalized measurement basis and rules for common areas, walls, circulation, and rounding.
- Occupancy and availability should be derived from leases/reservations and controlled transitions, not independently editable flags.

## Contract and lease rules

- Activation requires signatures and configured initial payments or a separately authorized waiver.
- Contract dates, possession dates, billing dates, and status-effective timestamps must be distinguished.
- Renewal or amendment must preserve the previous contract, charge schedule, and approval evidence.
- Escalation creates future effective charge rules; it must not rewrite previously posted charges.
- Termination/move-out must address final charges, keys, meters, deposits, open maintenance, and occupancy release.
- A sublease may not violate the master lease's term, area, capacity, permitted use, or subletting authority.

## Financial rules

- Security deposits are liabilities and never company income merely upon receipt.
- Owner/client funds, company funds, tenant credits, vendor payable, and deposits require distinct ledger classifications and, where law/policy requires, separate bank/cash accounts.
- A fee requires an effective agreement/rule version or a privileged, approved override.
- Property expenses identify responsible party and allocation basis.
- Duplicate external payment references enter review; allowing duplicates must not weaken idempotency or conceal separate provider events.
- Posted utility allocations are immutable; corrections use reversals/adjustments.
- Allocation rounding is deterministic, fully allocated or explicitly left as a reported remainder, and reproducible from stored inputs.
- Closed periods do not accept back-dated edits; corrections post in an open period with source-period disclosure.

## Approval and access rules

- Users cannot finally approve their own material payouts, refunds, expenses, write-offs, or vendor changes where segregation policy prohibits it.
- Changing an owner payout destination triggers re-verification and a configured hold; the changer cannot immediately approve payment to it.
- Emergency maintenance can bypass normal pre-approval only with reason, evidence, notification, limits, and subsequent review.
- External users see only records belonging to their verified relationship and only fields classified for external sharing.
- Internal notes are private by default.
- Export, bulk access, impersonation, access-policy change, authentication events, and authorization failures need risk-based auditing.

## State machines still requiring explicit transition tables

The source lists typical states but does not define permitted transitions, commands, guards, side effects, reversibility, or terminal semantics. Explicit state machines are required for:

- property/service-engagement onboarding and offboarding;
- rentable-space lifecycle and partition changes;
- listing, reservation, and brokerage deal;
- application and screening;
- lease, renewal, notice, termination, and move-out;
- payment, allocation, refund, and reversal;
- deposit settlement and dispute;
- owner statement and payout;
- expense, vendor bill, procurement, and utility allocation;
- maintenance request and work order;
- accounting close and reopen; and
- document draft, approval, signature, supersession, and voiding.

## Rule conflicts and ambiguities

- `BUS-001` says one active exclusive lease per "unit", while v2 introduces generic rentable spaces. The invariant must apply to the occupancy resource, not only the legacy `Unit` entity.
- The partial unique database constraint suggested for active leases cannot enforce arbitrary date-range overlap by itself; the rule needs a temporal exclusion strategy plus transaction/concurrency control.
- The source permits area override but the user-provided rule says child total area must never exceed parent usable area. The stricter rule should govern unless business explicitly approves a different physical-area model.
- Brokerage commission is described as both recorded and collected/settled at completion. Recognition, receivable, collection, and completion must be separate states.
- Deposit "deduction" is ambiguous: it may reclassify liability to receivable/income/payable, not simply reduce a balance without accounting entries.
