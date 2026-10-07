# Final Business Workflows

## Rental

Owner -> Property and Units -> Rental Customer -> Match -> Property Viewing -> Interested -> actual Unit selection -> Rental Agreement -> Lease -> Move-In -> Commission -> Move-Out.

## Full Management

Owner -> Property and Units -> Customer -> Match -> Viewing -> Unit selection -> Agreement -> Lease -> Rent Collection -> Expenses -> Management Fee -> Owner Statement -> maker-checker Owner Payout -> Move-Out.

## Sales

Owner/Seller -> Sale Property -> Buyer -> Match -> Shared Viewing -> Interested -> Sale Agreement -> Settlement -> Sale complete.

## Operations

Maintenance request -> Work Order -> Vendor or Employee -> Expense where applicable. Inspection -> Inspection Item -> Defect -> Maintenance follow-up.

Financial records are immutable after posting. Corrections use reversal or adjustment transactions, security deposits remain liabilities, owner funds remain separate from company income, and owner payouts require review and approval by a different person from the preparer.

Operational follow-up is supported by idempotent notifications, user-owned
Saved Views, a bounded per-resource follow-up completion action, generated
business PDFs, authorized WhatsApp deep links, and a readable activity timeline.
These are supporting tools around the canonical workflows, not alternate
business flows.
