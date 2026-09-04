# QA findings

| ID  | Severity | Requirement/test | Reproduction/evidence | Owner | Status/disposition | Repair SHA | Re-reviewer/result |
| --- | -------- | ---------------- | --------------------- | ----- | ------------------ | ---------- | ------------------ |
| P502-QA-ENV-001 | BLOCKED (environment) | Native CRM database integration coverage must execute before the Phase 5.2 QA gate can pass | On 2026-09-04, `apps/api/test/integration/phase5-2-crm-api.integration.test.ts` was invoked directly with Vitest. All five tests were skipped because `CRM_TEST_DATABASE_URL` is unset. A Docker probe also failed because the Docker engine pipe is unavailable (`//./pipe/docker_engine` not found). This leaves pagination boundary, exact totals, concurrent expected-version, and database company/Branch isolation unexecuted in this environment. | Root / Database owner | OPEN — environment blocker, not a production defect; rerun against an approved fresh/upgrade test database and attach output before final gate | — | Independent QA review: FAIL pending runtime database evidence |

Builders do not close their own findings. Use only the six task states for finding workflow status; disposition explains accepted MEDIUM/LOW items.
