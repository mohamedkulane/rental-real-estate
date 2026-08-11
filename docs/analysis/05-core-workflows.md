# Core Workflows

Each workflow below identifies the required control points and unresolved edges rather than repeating the source's happy path.

## 1. Service acquisition and activation

**Flow:** capture owner/client lead -> verify party and authority -> inspect/register asset -> select service model -> negotiate terms -> approve and sign engagement -> configure fee/reserve/approval rules -> assign branch/portfolio -> activate eligible inventory.

**Controls:** effective-dated ownership and service engagement; verified payout details; signed-version preservation; explicit scope by property/space; readiness evidence; audit of activation.

**Missing:** joint-owner approval rules, owner-share changes, authority expiry, partially managed properties/spaces, and offboarding/transfer with open leases and money.

## 2. Brokerage-only closure

**Flow:** activate brokerage engagement -> market -> qualify/view/negotiate -> create deal -> attach signed agreement -> calculate commission and agent share -> record invoice/receipt/settlement -> complete -> set `RENTED_EXTERNAL` -> remove from availability.

**Controls:** completion must be idempotent and atomic with availability closure; recurring-job eligibility must be checked from the effective service model; commission formula/version and approvals must be stored.

**Missing:** legal completion trigger, payer of commission, unpaid commission collection, cancellation/refund/chargeback, external lease end date, re-list authorization, and conversion to managed service.

## 3. Lead to managed lease

**Flow:** inquiry -> deduplicate -> assign/qualify -> match space -> viewing -> application/screening -> approval -> reservation -> lease preparation/approval/signature -> initial-money verification -> move-in -> activation.

**Controls:** branch/object authorization; consent and restricted screening data; concurrent hold protection; negotiation limits; signed document hash/version; activation transaction that validates occupancy and financial prerequisites.

**Missing:** multiple applicants for one space, waitlists, reservation expiry races, rejected-applicant retention, conditional approvals, guarantor/co-tenant signature requirements, and waiver authority.

## 4. Monthly managed cycle

**Flow:** select eligible active lease rules -> generate charges idempotently -> notify -> receive/verify/post payments -> allocate -> manage arrears/credits -> post fees and approved costs -> reconcile cash accounts -> draft statement -> review -> approve payout -> reconcile -> close period.

**Controls:** effective-dated rule snapshots; unique generation key; allocation priority; atomic postings; deposit exclusion; owner-fund segregation; payout destination verification; statement version lock.

**Missing:** cash versus accrual policy, fee basis (billed/collected), allocation waterfall, tax handling, cut-off timing, negative owner balances, owner advances, credit carry-forward, statement restatement, and payout failure/retry.

## 5. Payment correction

**Flow:** identify incorrect posted payment/allocation -> restrict downstream actions -> request reversal -> approve -> post linked reversal -> reverse/reapply allocations -> issue corrected evidence -> reconcile exception.

**Controls:** no deletion; original receipt remains; closed-period handling; reason and approver; impact analysis for owner statements/payouts/deposits; idempotency.

**Missing:** treatment when money has already been paid to owner, chargebacks/provider reversals, cross-period FX differences, and whether receipts are voided or counter-receipted.

## 6. Deposit lifecycle

**Flow:** establish requirement -> receive/post to deposit liability -> top-up/transfer if allowed -> hold through lease -> inspect/finalize obligations -> propose deductions -> notify/dispute -> approve -> reclassify deductions -> refund remaining amount -> reconcile and close.

**Controls:** custody account, liability subledger, no excess refund/deduction, evidence, approval, recipient verification, immutable settlement statement.

**Missing:** interest, commingling/legal trust rules, multi-tenant contribution ownership, deposit transfer on renewal/unit transfer, dispute freezes, abandoned deposits, and deductions paid to owner versus company/vendor.

## 7. Owner payout

**Flow:** define cut-off -> verify eligible collections -> compute owner ledger -> deduct contractual fees/costs/reserves/holds -> draft statement -> finance review -> independent approval -> execute to verified destination -> notify -> reconcile -> lock version.

**Controls:** available cash and ledger entitlement are separate checks; no self-approval; changed destination hold; idempotent disbursement; partial/failure states; source-to-statement traceability.

**Missing:** joint-owner split and rounding, tax withholding, negative balances, dispute/hold policy, statement reissue, returned payment, payout batching, and whether approvals are per owner or batch.

## 8. Maintenance and vendor cost

**Flow:** request -> acknowledge/triage -> determine responsibility -> obtain approvals/quotes -> assign work order -> schedule/access -> execute/evidence -> verify -> approve vendor bill -> allocate/post cost -> close/rate.

**Controls:** emergency exception review; owner agreement thresholds; tenant charge evidence; vendor segregation; duplicate invoice checks; cost allocation traceability.

**Missing:** after-hours authority, warranty/insurance recovery, tenant refusal of access, scope changes, partial completion, recurring issue reopening, disputed bill, and liability where service model excludes maintenance.

## 9. Master lease and sublease cycle

**Flow:** verify master agreement/subletting right -> activate parent obligation -> configure child topology -> list/lease child spaces -> bill master rent and subleases separately -> allocate shared costs -> collect/pay -> accrue vacancies/costs -> report margin.

**Controls:** sublease term/use within master constraints; no physical occupancy conflict; separate payable/receivable ledgers; effective topology; component-level profitability.

**Missing:** master lease termination/default, rent-free periods, master deposit, landlord reimbursements, subtenant deposits, company liability after vacancy, and continuity of subleases if master agreement ends.

## 10. Partition change

**Flow:** propose effective future layout -> measure parent/children -> validate area and occupancy -> approve -> create successor spaces/relationships atomically -> retire superseded configuration -> update future listings only.

**Controls:** active/historical leases keep old configuration; no hard deletion; stable codes/IDs; area basis and evidence; concurrency lock.

**Missing:** common areas, partial split effective during occupancy, code reuse, meter/asset reassignment, capacity constraints, and reporting across successor spaces.

## 11. Lease renewal, termination, and move-out

**Flow:** alert/review -> offer/notice -> negotiate/approve -> sign amendment or record termination -> update future charge schedule -> inspect/recover keys/meters -> post final charges -> settle deposit -> close occupancy -> turnover -> restore availability.

**Controls:** legal notice dates, signed-version preservation, no retroactive charge mutation, outstanding-work/financial checklist, atomic release of occupancy.

**Missing:** holdover tenancy, early termination fees, partial surrender, eviction/legal workflow, abandonment, death/change of party, post-move-out receivable collection, and reactivation before deposit resolution.

## 12. Period close

**Flow:** stop/define posting cut-off -> reconcile accounts -> resolve or disclose unallocated items -> validate ledgers -> issue statements -> approve close -> lock period -> report exceptions -> post later corrections to open periods.

**Controls:** role separation, checklist evidence, lock enforcement in all posting paths, auditable reopen if permitted.

**Missing:** close calendar, soft versus hard close, reopen authority, late provider settlements, FX revaluation, and report restatement policy.
