# Financial Accounting Decisions

## Status

Core financial architecture direction is approved. Local accounting, custody, tax, and operating policies remain subject to business and professional approval.

## Foundation decision

The MVP financial foundation is journal-backed double-entry accounting. Advanced accounting screens and reports may be phased, but financial events must post through balanced entries from the first production release.

Core concepts are:

- Account;
- JournalEntry;
- JournalLine; and
- AccountingPeriod.

Operational source records such as charges, payments, allocations, deposit movements, expenses, commissions, fees, owner payouts, master-rent obligations, and utility allocations must retain traceable links to their financial postings.

## Posting integrity

- Draft or unposted records may follow controlled correction rules.
- Posted financial records are immutable and cannot be physically deleted.
- Corrections use linked reversal or adjustment entries with reason, actor, authorization, and period context.
- Multi-step financial operations must be atomic.
- Closed-period behavior applies across every posting path.
- Authoritative balances derive from posted entries or controlled subledgers, not editable summary fields.

## Economic separation

The following are logically distinct:

- company cash and income;
- owner/client funds;
- tenant receivables;
- tenant security-deposit liabilities;
- tenant credits where applicable;
- owner payable;
- vendor payable;
- property income and expenses; and
- master-lease expense/liability and sublease company revenue.

Rent collected for a fully managed owner property does not automatically become company revenue. Only contractually company-entitled fees and other company-entitled amounts are company revenue.

## Security deposits

Deposits are liabilities while held. A deduction requires a valid charge or settlement reason, required approval, and audit evidence. The remaining valid held amount must remain refundable according to the lease and approved rules. A deduction is an accounting reclassification, not deletion of a deposit balance.

## Owner payable and payout

Default owner payout is based on cleared or verified collected funds, not merely invoiced rent. Payout cannot exceed available owner payable. Exceptions may exist only as explicit approved business rules with their own accounting and authorization effects; ad hoc overrides are prohibited.

Owner balance, owner payable, collected funds, cleared cash, reserves, holds, and payout in process are not synonymous and must remain distinguishable.

## Master lease/sublease

Master lease economics are company economics:

- master rent owed is a company expense/liability;
- sublease rent is company revenue/receivable under the approved recognition basis;
- shared and attributable costs reduce company margin; and
- the normal owner-payable mechanism for full management does not apply.

Profitability must preserve revenue, master cost, shared costs, direct expenses, vacancy, and accrued/paid or billed/collected views rather than storing only net margin.

## Related ADRs

- [ADR-002](adr/ADR-002-double-entry-accounting-from-foundation.md)
- [ADR-003](adr/ADR-003-immutable-posted-financial-records.md)
- [ADR-008](adr/ADR-008-segregation-of-financial-duties.md)

## Remaining policy dependencies

The chart of accounts, recognition basis, tax rules, journal dimensions, physical custody, currency/FX, payment allocation, fee calculations, deposit details, owner-share entitlement, reconciliation, close/reopen, payout schedule/failures, write-offs, and required statements remain open.
