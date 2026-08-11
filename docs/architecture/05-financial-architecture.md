# Financial Architecture

## Accounting core

Finance uses accrual accounting and double entry from MVP foundation. It owns Account, JournalEntry, JournalLine, FiscalYear, and AccountingPeriod. Period states are `OPEN`, `SOFT_CLOSED`, `CLOSED`, and `LOCKED`; the exact permission matrix for adjustments is configurable but later states never permit silent mutation.

Journal lines may carry nullable, validated dimensions for branch, property, RentableSpace, owner, tenant, lease, vendor, and ServiceEngagement. Dimensions identify economic attribution; they do not transfer ownership of journal data to other modules.

## Posting interface

Business modules submit typed posting requests such as `PostBrokerageCommission`, `PostTenantCharge`, `PostPayment`, `PostDepositReceipt`, `PostVendorExpense`, or `PostMasterRentObligation`. Finance validates policy, period, currency, dimensions, idempotency, and balance, then atomically stores source-finance linkage, journal entry/lines, and outbox events. Other modules never create JournalLine records.

## Subledgers and funds

Billing/receivables, payments, deposits, owner accounting, vendor payables, and master/sublease accounts reconcile to the general ledger. Fund classification is explicit: `COMPANY_FUNDS`, `OWNER_FUNDS`, `SECURITY_DEPOSIT_FUNDS`, `TENANT_CREDIT_FUNDS`. Classification is not inferred only from bank account.

Tenant overpayments become tenant-credit liabilities until allocated, transferred under approved rules, or refunded. Owner rent collections remain owner funds/liability; company fees become revenue only through approved entitlement postings.

## Payments

Receipt capture, verification, posting, allocation, reconciliation, refund, and reversal are distinct. Payment posting and initial journal entry are atomic. Allocation cannot exceed cleared/unallocated payment or open charge. Reversal creates linked opposite postings and allocation consequences; it never deletes the receipt.

## Deposits

Deposit transactions include `RECEIPT`, `ADJUSTMENT`, `DEDUCTION`, `TRANSFER`, `REFUND`, and `REVERSAL`. Contributors may differ from tenants. Transfers are explicit linked movements. Disputed amounts are held separately from available refundable amounts until resolution. Deductions require a settlement reason/charge, authorization, and accounting destination.

## Owner accounting

Ownership percentage and payout entitlement percentage are separate effective-dated facts. Owner payable is calculated from cleared/verified owner-entitled collections less approved fees, costs, reserves, holds, prior/in-flight payouts, and adjustments. Negative balances and contribution requests are first-class. Payout has immutable calculation snapshot, approval, execution attempts, failure/retry, and reconciliation.

## Master lease/sublease

Master rent is company expense/liability; sublease rent is company receivable/revenue; shared/direct costs reduce company margin. No full-management owner-payable flow applies. Profitability read models expose accrued/billed and paid/collected components.

## Transaction and control rules

- Balanced journal entry + subledger/source link + outbox: one transaction.
- Owner payout approval does not move money; execution posting is a separately idempotent transaction.
- Reconciliation links are controlled and auditable.
- Posted records cannot be updated/deleted.
- Maker-checker policies apply to payouts, refunds, reversals, deductions, write-offs, high expenses, and payout destination changes.

See [payment flow](diagrams/payment-accounting-flow.md) and [owner payout flow](diagrams/owner-payout-flow.md).
