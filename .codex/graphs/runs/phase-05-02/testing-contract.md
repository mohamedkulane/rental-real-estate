# Phase 5.2 QA testing contract and evidence

## Candidate

- Review date: 2026-09-04
- Worktree: `codex/p5-02-integration`
- Candidate HEAD: `9184fc5`
- Scope: independent QA review only; no production code changed by QA.

## Executed checks

| Surface | Command / suite | Result |
| --- | --- | --- |
| API unit | Focused CRM core, authorization, normal privacy, and early-parser privacy suites | PASS, 4 files / 24 tests |
| API HTTP E2E | `test/e2e/phase5-2-crm-http.e2e.test.ts` | PASS, 1 file / 4 tests |
| Web unit/component | CRM workflows and service-engagement suites | PASS, 2 files / 44 tests |
| Web full unit/component | `apps/web/node_modules/.bin/vitest.cmd run` | PASS, 13 files / 97 tests |
| API native integration | `test/integration/phase5-2-crm-api.integration.test.ts` | PASS: 1 file / 5 tests on disposable `rerms_p502_resume_0904` |

## Requirement traceability

| Requirement | Evidence | Status |
| --- | --- | --- |
| Cursor/pagination and stable ordering | API core cursor tests PASS; HTTP bounded-filter test PASS; native suite 5/5 PASS | PASS |
| BRANCH / MULTI_BRANCH / COMPANY_WIDE authorization | Authorization unit suite 6/6 PASS; HTTP conjunctive child permission test PASS; native scope test PASS | PASS |
| Company isolation | Unit scope composition PASS; native DB isolation test PASS | PASS |
| N+1 regression / bounded reads | API contract inspection, web full suite, and native bounded query-count test PASS | PASS |
| Protected contact/search/log privacy | Core + normal and early-parser adversarial privacy suites PASS | PASS for covered probes |
| CRM frontend loading/empty/error/populated states | CRM workflow state tests PASS; all web suites PASS | PASS |
| Concurrency/version conflict | API core contract test and native transactional race test PASS | PASS |
| Migration/seed/full repository gate | Not executed by this independent review | PENDING root final gate |

## Independent observations

- No `limit=100` occurrence was found in `apps/api/src` or `apps/web/src`; remaining matches are regression assertions.
- No CRM frontend list implementation loops rows and fetches a detail endpoint per row. Async selectors use focused paginated endpoints; detail pages load bounded collections.
- The integrated security repair at `9184fc5` is covered by the early-parser adversarial tests and the focused suite passed.
- The absent test database is an environment gate blocker, not a QA PASS. The five native CRM integration tests must execute and pass on an approved isolated database before Phase 5.2 can close.

## Verdict

`AUTOMATED QA: FAIL (runtime database evidence missing)`

Unresolved product Critical findings: 0
Unresolved product High findings: 0
QA environment blockers: 1

This review does not authorize Phase 5.3.
