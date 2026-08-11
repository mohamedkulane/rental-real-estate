# Financial Data Model

## Receivables

`Charge` is the authoritative receivable obligation. It records debtor, lease/space/property/engagement context, charge type, business/period dates, currency, original/current amounts, status, and source schedule/allocation. `Invoice` is a numbered presentation/legal grouping; `InvoiceLine` must reference a Charge and cannot independently create receivable value. CreditNote, Waiver, and ChargeAdjustment append controlled changes.

## Payments and credits

`Payment` separates capture, verification, posting, allocation, and reversal status and stores payer, account/method, currency, amount, external reference scope, idempotency, and journal link. `PaymentAllocation` joins posted payment to Charge. Overpayment/unallocated value is represented by `TenantCredit` liability movements, not negative charges. `PaymentReversal` and `Refund` are explicit financial sources.

## General ledger

`Account`, `FiscalYear`, `AccountingPeriod`, `JournalEntry`, and `JournalLine` implement accrual double entry. JournalLine uses signed `decimal(20,4)` amount and relational dimensions for branch, property, space, owner, tenant, lease, vendor, and ServiceEngagement. Currency and reporting amount/rate are retained.

Posted journals balance through application prevalidation plus a deferred database constraint trigger. Posted rows are immutable. Period status controls posting/adjustment authority.

## Source linking

`JournalSourceLink` has nullable FKs to approved financial sources (Payment, Refund, OwnerPayout, Expense, DepositTransaction, BrokerageDeal, MasterLeaseCharge, UtilityAllocation, ChargeAdjustment) plus an exactly-one-source CHECK. This preserves real foreign keys and avoids an unenforced generic `(type,id)` as the only link. New source types require an explicit migration.

## Transactions

Business source state, subledger movement, balanced journal, source link, and OutboxEvent commit atomically. Other modules request postings and cannot write JournalEntry/JournalLine.
