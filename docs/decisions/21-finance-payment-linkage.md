# Finance payment linkage

## Decision

A confirmed Rental Brokerage agreement creates one confirmed BrokerageDeal and
two commission Charges in the same transaction. The owner Charge represents
the owner commission receivable and the tenant Charge represents the tenant
commission receivable. Their amounts are derived from the agreement commission
terms and final rent; staff never re-enter the expected amount.

Each brokerage commission Charge has a validated `brokerageDealId` and a typed
commission side. A unique constraint on `(brokerageDealId, commissionSide)`
prevents duplicate owner or tenant receivables. The BrokerageDeal remains the
operational placement record while Charge and PaymentAllocation remain the
accounting authority for expected, received, and outstanding amounts.

Payments do not create commission Charges. A contextual commission payment
targets an existing open Charge, uses the Charge debtor, currency, branch, and
outstanding balance, and allocates the received amount immediately. Partial
payments reduce the existing Charge. Contextual overpayments are rejected.

Payment reversal preserves the Payment and Charge history, marks active
allocations reversed, restores Charge outstanding balances, and voids an
issued receipt. It does not delete or rewrite posted financial records.

## Payment methods and receiving accounts

The normal operational selector exposes EVC, E-Dahab, Somnet, and Salaam Bank.
Historical payment-method rows remain in the database and remain readable.
EVC, E-Dahab, and Somnet map to the configured Mobile Money account; Salaam
Bank maps to the configured Bank account. Contextual payments resolve this
mapping automatically and fail clearly when it is missing. General finance
payments retain explicit receiving-account selection.

## Management fees and sales

Management Fee Earned is aggregated from the management-fee value calculated
by Owner Payout using the same Full Management commercial terms. Expenses are
not treated as management-fee revenue. Full Management continues to deduct the
fee from collected rent before owner payout.

SaleSettlement remains the authority for sale price, commission, and proceeds.
Phase D does not create duplicate rental-style commission Charges for sales and
does not count settlement proceeds and Payment cash as separate earnings.

## Operational closure

BrokerageDeal closure remains tied to placement operations and its linked
lease. Unpaid commission does not keep the operational deal open; Finance
continues to track its receivable independently through Charge status.
