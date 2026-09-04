# QA findings

| ID  | Severity | Requirement/test | Reproduction/evidence | Owner | Status/disposition | Repair SHA | Re-reviewer/result |
| --- | -------- | ---------------- | --------------------- | ----- | ------------------ | ---------- | ------------------ |
| P502-QA-ENV-001 | BLOCKED (environment) | Native CRM database integration coverage must execute before the Phase 5.2 QA gate can pass | On 2026-09-04, the resume probe confirmed no listening PostgreSQL test port, no `CRM_TEST_DATABASE_URL`, and Docker `info` cannot connect to the engine (permission denied on `//./pipe/docker_engine`). The five native tests therefore remain skipped. Pagination boundary, exact totals, concurrent expected-version, and database company/branch isolation remain unexecuted. | Root / Database owner | OPEN — environment blocker, not a production defect; rerun against an approved isolated test database and attach output before final gate | — | Independent QA review: FAIL pending runtime database evidence |

Builders do not close their own findings. Use only the six task states for finding workflow status; disposition explains accepted MEDIUM/LOW items.
