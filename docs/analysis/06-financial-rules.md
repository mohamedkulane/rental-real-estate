# Financial Rules

## Required accounting separation

At minimum, the financial design must maintain distinct subledger/accounting identities for:

- company operating cash and company revenue;
- owner/client money and owner payable;
- tenant receivables;
- security-deposit liabilities;
- tenant credits/overpayments;
- vendor payable;
- property-attributable income and expense;
- owner contributions, reserves, advances, and holds; and
- master-lease liabilities/costs and sublease receivables/revenue.

Logical separation in ledgers is mandatory. Physical bank-account separation is jurisdiction/policy dependent and requires legal/accounting approval.

## Posting doctrine

- Every financial source event produces balanced, linked entries in the production-grade design.
- Draft/verified events may be corrected before posting under controlled rules; posted events are immutable.
- Reversal creates an equal and opposite linked posting. Adjustment creates a new approved posting. Neither overwrites the source.
- All multi-entry operations are atomic: payment plus ledger entry, allocations, deposit movements, fee creation, utility allocation, payout posting, and master/sublease postings.
- Posting commands require idempotency keys and deterministic duplicate behavior.
- Entries carry transaction date, posting date/time, accounting period, currency, exchange rate where relevant, source entity/version, actor, and approval context.
- Closed-period corrections post in an open period and disclose the affected source period.

## Payment and allocation

- Receipt, verification, posting, allocation, reconciliation, refund, and reversal are separate states/actions.
- A payment's posted amount equals allocated amount plus unallocated credit; neither can become negative.
- An allocation cannot exceed the charge's remaining balance or the payment's remaining allocatable balance.
- Allocation priority across rent, fees, utilities, damages, and oldest debt must be an approved policy, not incidental UI order.
- External references need provider/account scope; global uniqueness may reject valid same-reference events across providers.
- Duplicate overrides require evidence and review, but an override cannot allow the same provider event to be posted twice.
- Partial, advance, overpayment, returned payment, chargeback, and cross-party mispayment need explicit accounting flows.

## Charges, invoices, credits, and revenue

- Recurring rules are effective-dated and each generated charge stores the rule/version and calculation inputs.
- Proration, escalation, rounding, tax, grace period, late fee, discount, concession, rent-free period, and write-off policies require approval.
- Invoice and charge boundaries must be settled. Reports and payment allocation should operate on a stable financial obligation regardless of presentation grouping.
- Credit notes/adjustments must not delete original charges.
- Revenue recognition basis must be approved per model; cash collection and accounting revenue are not synonymous.

## Security deposits

- Receipt credits a deposit liability, not income or owner payable.
- Deposits require a lease/party contribution trail, custody location, currency, and held/available/disputed status.
- A deduction requires evidence and an accounting destination: tenant charge settlement, owner payable, property recovery, vendor/company receivable, or another approved classification.
- Refund is limited to available held liability and uses verified recipient/payment controls.
- Deposit disputes should freeze the disputed amount without obscuring undisputed portions.
- Interest, statutory deadlines, trust-account rules, transfer between leases, joint tenants, and forfeiture/abandonment require local approval.

## Owner accounting and payout

The formula in the source is a useful presentation formula, not a sufficient ledger rule. Owner balance, owner payable, collected cash, and payout availability must be distinct.

Payout availability should consider:

- owner-attributable collected/cleared funds;
- contractual fee and expense postings;
- reserves and manual/legal holds;
- unreconciled or reversible receipts;
- prior payouts in process;
- negative property/owner balances;
- joint-owner entitlements and effective shares; and
- actual available cash in the relevant custody account.

Owner statements are derived, versioned outputs. If later corrections affect an issued or paid statement, policy must define supplementary statements/restatements without rewriting the original.

## Business-model accounting

- **Brokerage:** commission receivable/revenue and agent commission/cost; no recurring tenant rent or owner payable solely from the external tenancy.
- **Tenant placement:** same one-time economics unless the approved model includes temporary collection/custody obligations.
- **Full management:** tenant receivable and collections, owner/client funds, fees, property costs, reserves, owner payable, and payout.
- **Rent collection only:** boundaries depend on approved custody, fee, notice, and statement responsibilities.
- **Master lease/sublease:** company master obligation/cost is separate from sublease receivable/revenue. Margin reports show accrued/billed and cash views separately.
- **Company-owned:** property income belongs to the company; deposits and tenant credits remain liabilities.
- **Land:** follows its service model, with long-term schedules and escalations.

## Shared utilities

- Source bill approval precedes allocations.
- Stored calculation evidence includes eligible recipients, method, unit factors, areas/meter periods/occupancy counts, custom percentages, total, rounding rule, and remainder.
- Generated child charges link to allocation results and source bill.
- Sum of posted allocations cannot exceed the approved source amount; an unallocated remainder remains visible.
- Corrections reverse/adjust posted allocation results and related charges. Editing a rule is prospective.
- Meter resets, estimated readings, vacancy, common area, mixed units, late bills, and tax/fees need defined policies.

## Financial policy blockers

Detailed finance architecture should not be approved until the business confirms accounting basis, chart of accounts, recognition policies, custody rules, currencies/FX, taxes, fee bases, payment allocation order, period close, owner payout availability, deposit treatment, write-offs, and required regulatory reports.
