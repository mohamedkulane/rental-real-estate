# Phase 5.2 independent adversarial review

Review target: integrated Phase 5.2 candidate at `9184fc5` (including the early-parser logging repair). Review date: 2026-09-04.

## Result

**PASS — no unresolved Critical or High findings.**

| Area | Result | Evidence |
| --- | --- | --- |
| Company isolation | PASS | `CrmSupportService` resolves records by authenticated `principal.companyId`; read SQL bases, counts, cursor scopes, and mutation predicates repeat the company predicate. |
| BRANCH / MULTI_BRANCH / COMPANY_WIDE | PASS | `CrmSupportService.branches()` intersects every required permission scope; object reads and commands resolve stored current Lead Branch before authorization; destination Branch and assignee eligibility are checked independently. |
| Cursor tampering/replay | PASS | `CrmCursorService` uses AES-GCM with AAD, canonical base64url validation, kind/scope binding, key-shape validation, and rejects malformed, cross-lane, filter-changed, or scope-changed tokens. |
| Contact/privacy leakage | PASS | `crm-log-privacy.adversarial.test.ts` passes 5/5, including unsupported charset and oversized JSON before request context, malformed JSON, global CRM errors, and the non-CRM diagnostic control. CRM exception logs are allowlisted and omit URL/query, body, stack, cause, and free text. |
| N+1/query leakage | PASS | CRM list/read models use joined SQL projections and batched selector capability enrichment. No CRM frontend list-to-detail fetch or large-limit workaround was found by static scan. |
| Concurrency/TOCTOU | PASS | Mutating Lead commands lock the Lead in the transaction and use expected-version predicates; assignment, transfer, follow-up outcome, and history writes are atomic and audited. |
| Future-scope leakage | PASS | `CONSTRUCTION_SERVICE` remains CRM intake context; no later-phase construction/project or transaction workflow was introduced. |

## Targeted automated evidence

- `apps/api/test/unit/crm-log-privacy.adversarial.test.ts`: 5/5 passed.
- Existing cursor/authorization/API core tests cover authenticated encrypted cursor binding, tamper rejection, permission conjunctions, branch intersection, and query boundaries.
- Static scan of `apps/api/src/crm` and `apps/web/src` found no `limit=100` or high-limit completeness workaround and no CRM list-to-detail N+1 pattern.

## Disposition

The prior `P502-SEC-002` early-parser logging finding is **closed** by the current `ApiExceptionFilter` CRM boundary and the five-case adversarial test. No new Critical or High finding was confirmed. No production source was edited by this review.

### Non-finding considered

`CrmSupportService.asset()` derives the Property from a supplied Space when a Space is present. This is safe at the HTTP boundary because the intent-specific preference validator rejects a Property+Space combination for RENT/BUY/SELL; the persisted schema and resolver enforce same-Company/same-Property Space membership. It is therefore not raised as a finding.

ADVERSARIAL REVIEW: PASS
UNRESOLVED CRITICAL: 0
UNRESOLVED HIGH: 0
ALL MEDIUM FINDINGS DISPOSITIONED: YES
