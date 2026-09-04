# Gate report

- Sub-phase: Phase 5.2 — CRM Foundation
- Candidate SHA: `9184fc5`
- Root Supervisor: blocked pending runtime and responsive evidence
- Gate timestamp: 2026-09-04

## Evidence

| Command/review | Environment | Exit/result | Counts | Evidence link |
| -------------- | ----------- | ----------- | ------ | ------------- |

| Governance | integration worktree | FAIL — GOV-001/GOV-002 HIGH evidence blockers | 0 CRITICAL, 2 HIGH | `governance-findings.md` |
| API unit/typecheck/build/lint | integration worktree | PASS | API unit 67/67; CRM focused 15/15 | `testing-contract.md` |
| Web unit/typecheck/build/lint | integration worktree | PASS | Web 97/97 | `testing-contract.md` |
| CRM API HTTP E2E | integration worktree | PASS | 4/4 | `testing-contract.md` |
| Native CRM DB integration | integration worktree | BLOCKED | 5 skipped; test DB/Docker unavailable | `qa-findings.md` |
| Responsive UX 1440/768/390 | browser/runtime | NOT RUN | static review PASS only | `ux-findings.md` |
| Adversarial review | integration candidate | PASS | 0 product Critical/High | `adversarial-findings.md` |
| Clean checkout/full monorepo gate | integration worktree | PENDING | not recorded for frozen candidate | `governance-findings.md` |

Include governance, lint, typecheck, unit, integration, E2E, build, Prisma validation/status, fresh/upgrade migration, seed twice, clean checkout, `git diff --check`, security, concurrency, N+1, and responsive UX as applicable.

## Independent review chain

- QA: FAIL — native database evidence missing (`qa-findings.md`)
- Security: PASS — CRM log redaction (`adversarial-findings.md`)
- UX: PASS static; responsive NOT RUN (`ux-findings.md`)
- Adversarial: PASS (`adversarial-findings.md`)
- Governance: FAIL (`governance-findings.md`)

## Findings and verdict

- CRITICAL: 0
- HIGH: 2 unresolved governance evidence findings (`GOV-001`, `GOV-002`)
- MEDIUM dispositions: GOV-003 release evidence incomplete; pending required runs
- LOW dispositions: none
- SUB-PHASE 5.2: FAIL
- NEXT SUB-PHASE STARTED: NO

STOP. Await explicit human approval.
