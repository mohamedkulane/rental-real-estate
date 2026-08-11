# Chart of Accounts Baseline

This is the approved minimum seed template. Company configuration may add child accounts; system-reserved control accounts cannot be repurposed. All listed leaf accounts allow posting unless marked header.

| Code | Name                        | Type      | Normal | Reserved | Posting | Intended use                                                                            |
| ---- | --------------------------- | --------- | ------ | -------- | ------- | --------------------------------------------------------------------------------------- |
| 1000 | Assets                      | ASSET     | Debit  | Yes      | Header  | Asset group                                                                             |
| 1010 | Cash on Hand                | ASSET     | Debit  | Yes      | Yes     | Controlled cash receipts/payments                                                       |
| 1020 | Bank                        | ASSET     | Debit  | Yes      | Yes     | Company/client bank accounts via account dimension                                      |
| 1030 | Mobile Money                | ASSET     | Debit  | Yes      | Yes     | Mobile-money balances                                                                   |
| 1100 | Accounts Receivable         | ASSET     | Debit  | Yes      | Yes     | Tenant/customer charges                                                                 |
| 1110 | Owner Receivable            | ASSET     | Debit  | Yes      | Yes     | Approved amounts owners owe the company/property; not owner payable netting by accident |
| 1200 | Prepaid Expenses            | ASSET     | Debit  | No       | Yes     | Time-apportioned prepaid costs                                                          |
| 2000 | Liabilities                 | LIABILITY | Credit | Yes      | Header  | Liability group                                                                         |
| 2010 | Owner Payable               | LIABILITY | Credit | Yes      | Yes     | Cleared owner-entitled funds due/held                                                   |
| 2020 | Security Deposits Held      | LIABILITY | Credit | Yes      | Yes     | Tenant/third-party deposits held                                                        |
| 2030 | Tenant Credits              | LIABILITY | Credit | Yes      | Yes     | Overpayments/unallocated credits                                                        |
| 2040 | Vendor Payable              | LIABILITY | Credit | Yes      | Yes     | Approved vendor obligations                                                             |
| 2050 | Accrued Expenses            | LIABILITY | Credit | Yes      | Yes     | Incurred unpaid expenses, including master-rent accruals when applicable                |
| 3000 | Equity                      | EQUITY    | Credit | Yes      | Header  | Equity group                                                                            |
| 3010 | Opening Balance Equity      | EQUITY    | Credit | Yes      | Yes     | Approved migration/opening balancing only                                               |
| 3020 | Retained Earnings           | EQUITY    | Credit | Yes      | Yes     | Closed prior-period results                                                             |
| 4000 | Income                      | INCOME    | Credit | Yes      | Header  | Income group                                                                            |
| 4010 | Brokerage Commission Income | INCOME    | Credit | Yes      | Yes     | Company brokerage entitlement                                                           |
| 4020 | Tenant Placement Fee Income | INCOME    | Credit | Yes      | Yes     | Placement fee entitlement                                                               |
| 4030 | Management Fee Income       | INCOME    | Credit | Yes      | Yes     | Full-management fees                                                                    |
| 4040 | Rent Collection Fee Income  | INCOME    | Credit | Yes      | Yes     | Collection-only fees                                                                    |
| 4050 | Company-Owned Rental Income | INCOME    | Credit | Yes      | Yes     | Rent from company-owned property                                                        |
| 4060 | Sublease Rental Income      | INCOME    | Credit | Yes      | Yes     | Master-lease/sublease rent revenue                                                      |
| 4070 | Maintenance Service Income  | INCOME    | Credit | No       | Yes     | Contractual service fee/markup, not owner reimbursement                                 |
| 4090 | Other Service Income        | INCOME    | Credit | No       | Yes     | Approved company services                                                               |
| 5000 | Expenses                    | EXPENSE   | Debit  | Yes      | Header  | Expense group                                                                           |
| 5010 | Master Lease Rent Expense   | EXPENSE   | Debit  | Yes      | Yes     | Company master-rent cost                                                                |
| 5020 | Maintenance Expense         | EXPENSE   | Debit  | No       | Yes     | Company/property maintenance by responsibility dimensions                               |
| 5030 | Utilities Expense           | EXPENSE   | Debit  | No       | Yes     | Company/property utility cost                                                           |
| 5040 | Vendor Costs                | EXPENSE   | Debit  | No       | Yes     | Other direct vendor services                                                            |
| 5050 | Agent Commission Expense    | EXPENSE   | Debit  | Yes      | Yes     | Earned agent commissions                                                                |
| 5060 | Marketing Expense           | EXPENSE   | Debit  | No       | Yes     | Advertising/listing costs                                                               |
| 5070 | Office Expense              | EXPENSE   | Debit  | No       | Yes     | Branch/company office costs                                                             |
| 5080 | Payroll Expense             | EXPENSE   | Debit  | No       | Yes     | Payroll summaries/approved exports                                                      |
| 5090 | Bank Charges                | EXPENSE   | Debit  | No       | Yes     | Bank/provider fees                                                                      |

Tax, withholding, statutory trust, and jurisdiction-specific accounts are intentionally deferred to qualified legal/accounting approval. Account dimensions and FundClass distinguish company, owner, deposit, and tenant-credit balances without multiplying the chart unnecessarily.
