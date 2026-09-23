# Business workflow audit — viewings, brokerage, payments

Status: **Audit complete — implementation not started** (awaiting approval).

Companion canvas: Cursor canvas `business-workflow-audit.canvas.tsx`.

## Summary verdicts

| Topic | Verdict |
| ----- | ------- |
| Same customer, many opportunities | **Supported** at schema/API (no Lead-global unique). Soft-hold gap on CONFIRMED-but-unleased units (P1). |
| Brokerage Deals page | Keep as **history register**; remove manual create path from normal UX (P1). |
| Payment UX | Too technical (GL account, no business source) (P0). |
| Payment methods | Seed lacks EVC / E-Dahab / Somnet / Salaam Bank (P0). |
| Payment status | Create→CAPTURED; no void/reversal; dead enum states (P0). |
| Brokerage revenue as cash | Deal gross ≠ money received; no commission payment path (P0). |
| Management fee | Owner-statement deduction today; not “Record Payment”; must not mix with brokerage (P0 product decision). |
| Finance overview | Accounting-leaning; needs business money-in by source/method (P1). |

## Priority counts

- **P0:** Payments UX, methods, status/void, brokerage cash attribution, management-fee product clarity
- **P1:** Viewing soft-hold / multi-opportunity tests, Brokerage Deals UX, Finance overview
- **P2:** Orphan create workspaces, doc/schema alignment

## Implementation waves (proposed)

1. **Wave A (SOL+TERRA):** 4 payment methods; status UX + controlled void; brokerage commission receivable/payment + contextual Record Payment
2. **Wave B (TERRA):** Finance overview business tiles; source labels
3. **Wave C (LUNA+TERRA):** Deals history-only; confirmed-unit soft-hold; viewing regression tests
4. **Wave D:** Management fee — implement only after cash-vs-deduction decision

## Non-goals

- No second Viewing / Deal / Payment / Finance module
- No DB reset
- No migration-history rewrites
- No weakening of journal/authorization integrity

## Decision needed before coding Wave D

Is Full Management fee:

**A)** Company cash received (Record Payment with source Full Management — Management Fee), or  
**B)** Net deduction on owner statements/payouts only (document + overview language; do not expose as Record Payment)?
