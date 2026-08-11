# Deposit Data Model

`Deposit` is a lease-scoped liability account with currency, required amount, status, and custody/fund classification. `DepositContributor` links any contributing Party and records contribution basis without assuming the tenant paid.

`DepositTransaction` is immutable and typed `RECEIPT`, `ADJUSTMENT`, `DEDUCTION`, `TRANSFER`, `REFUND`, or `REVERSAL`; it records amount, contributor where relevant, source/reversal link, journal, business date, status, and reason.

`DepositSettlement` snapshots the move-out calculation. `DepositDeduction` links a deduction to Charge/Expense/evidence and approval. `DepositDispute` freezes a specified amount with lifecycle/history. `DepositTransfer` links paired outgoing/incoming transactions and source/destination deposits.

Available, disputed, refundable, and settled balances derive from transactions and disputes. Database/application checks prohibit overdrawing liability. Receipt credits deposit liability; deduction reclassifies to an approved accounting destination; refund debits liability. No deposit movement is revenue merely by type.
