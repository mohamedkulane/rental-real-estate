# Full Management fee settlement — audit (no implementation)

Status: **Audit only.** Repository code unchanged except this decision record.

## Question

Distinguish:

1. **Deducted fee** — management fee taken from rent collected on behalf of the owner  
2. **Separate fee payment** — owner pays management fee directly to the company  

And confirm whether the domain can represent rent collected, fee earned, net owner payable, and separate owner→company fee payment.

---

## Rental Brokerage (contrast)

| Concept | Current representation |
| -------- | ------------------------ |
| Owner / tenant commission | Stored on `RentalAgreement` commercial fields; on confirm, `BrokerageDeal.grossCommission` |
| Company cash from commission | **Not implemented** — no Charge, no Payment, no journal to `4010` |
| Business-facing payment path | **Missing** (P0 from prior audit) |

Brokerage commissions are **intended company cash revenue** and need an explicit Record Payment / receivable path showing Owner vs Tenant Commission. That is separate from Full Management.

---

## Full Management — how money works today

### Start

- `POST /rental/start-full-management` → `ServiceEngagement` `FULL_MANAGEMENT` + `ServiceEngagementCommercialTerms.managementFeePercent`
- **No** `managementFeeMethod` / settlement-mode field
- UI copy in `rental-service-start-drawers.tsx` says *“Owner pays management fee”* — **misleading** relative to actual code (deduction from collections)

### (a) Rent collected from tenant

```
BillingSchedule (FULL_MANAGEMENT only)
→ Charge (usually RENT, debtor = tenant)
→ optional Invoice
→ Payment (CAPTURED) + PaymentAllocation
```

- Recurring billing is **forbidden** for `RENTAL_BROKERAGE`
- Payment stores `receivingAccountId` but **does not auto-post journals**
- Operational cash capture exists; owner liability in GL (`2010`) is **not** auto-created

### (b) Management fee earned by company

```
fee = Σ(non-reversed PaymentAllocations on property/period) × managementFeePercent / 100
```

(`computeManagementFee` in `finance.policy.ts`)

Recorded as:

- Owner statement line `MANAGEMENT_FEE` (**negative** / deduction)
- `OwnerPayout.managementFee` field

**Not** a Charge to the company, **not** AR, **not** posted to COA `4030 Management Fee Income`.

### (c) Net amount payable to owner

```
netPayable =
  collectedIncome
  − owner-responsibility expenses
  − managementFee
  − otherDeductions (manual)
```

Then split by ownership %. Payout lifecycle is status workflow only — **PAID does not move cash/journals**.

### (d) Separate management-fee payment from owner

| Representable today? | **No** as first-class fee settlement |
| -------------------- | ------------------------------------ |
| Charge type `MANAGEMENT_FEE` | Missing |
| Owner as Payment payer | Technically allowed (any Party) but nothing to allocate to |
| Settlement mode flag | Missing — cannot choose deduct-vs-invoice |
| Double-charge guard | Missing |

---

## Domain capability matrix

| Money concept | Representable now? | How |
| ------------- | ------------------ | --- |
| Rent collected from tenant | **Yes** (ops) | Charge + Payment + Allocation |
| Management fee earned (deduction) | **Soft yes** | Statement/payout calculation only |
| Net owner payable | **Yes** (ops) | `OwnerPayout.netPayable` |
| Separate owner→company fee payment | **No** | No charge type / workflow / flag |
| Brokerage commission as company cash | **No** | Deal snapshot only |
| GL posting for any of the above | **No auto** | Accounts exist; journals manual |

---

## Two Full Management cases — current fit

| Case | Current system | Fit |
| ---- | -------------- | --- |
| **Case 1 — Fee deducted from rent collected** | This **is** the implemented model | Supported (soft calc) |
| **Case 2 — Owner pays fee separately** | Not modeled | Unsupported |

They are **not** the same payment flow. Do not collapse them in UX.

---

## Smallest proposed changes (proposal only — do not implement)

### Case 1 — Deducted fee (default / current)

**Business model:** Keep fee as deduction from owner payable.

**Smallest UX:**

- Label clearly: “Full Management — Management Fee (deducted from rent collected)”
- Show on owner statement / payout: Rent collected, Fee %, Fee amount, Net to owner
- Finance overview: report **fee earned** from statement/payout totals (not expense category `MANAGEMENT`)
- Do **not** use Record Payment for this fee

**Optional later integrity (SOL):** On payout create/approve, draft journal Dr Owner Payable / Cr Management Fee Income (`2010`/`4030`).

### Case 2 — Separate owner payment (only if product chooses it)

**Business model:** Add settlement mode on commercial terms, e.g. `DEDUCT_FROM_RENT | OWNER_INVOICE`.

**Smallest path when `OWNER_INVOICE`:**

- Charge type `MANAGEMENT_FEE`, debtor = owner
- Record Payment from owner → allocate to that charge
- Source label: “Full Management — Management Fee”
- When this mode is on, **do not also deduct** the same fee from rent collections

### Rental Brokerage commissions (cash revenue)

**Smallest path:**

- On Agreement confirm (or Deal CONFIRMED), create receivable Charge(s) for Owner Commission and/or Tenant Commission (or one charge with clear subtype)
- Record Payment inherits agreement/deal/property/payer
- Source: “Rental Brokerage — Owner Commission” / “Tenant Commission”
- Never reuse Full Management fee language or deduction math

---

## Decision needed from product owner

1. Is Full Management fee **always Case 1 (deducted)** for MVP?  
2. Is Case 2 (owner pays separately) **in scope** for Wave A, later, or never?  
3. Confirm Brokerage commissions are **always company cash** (Record Payment path) — already stated; proceed in Wave A after this decision.

## Recommendation (non-binding)

MVP: **Case 1 only** for Full Management + **cash Record Payment** for Brokerage commissions. Defer Case 2 until a settlement-mode field is approved.
