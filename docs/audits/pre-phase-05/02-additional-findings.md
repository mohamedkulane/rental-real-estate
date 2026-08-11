# Additional findings

## AF-001 — Employee branch role could outlive or mismatch branch assignment

- Severity: HIGH
- Disposition: confirmed
- Evidence: `organization.service.ts`; migration `20260811150000_employee_role_branch_integrity`.
- Root cause: role scope and employee operating-branch history were constrained independently.
- Remediation: API containment check, PostgreSQL trigger, existing-row repair, and row locking. Same-day role removal is an audited cancellation to avoid zero-length DATE intervals.
- Tests added: Phase 3/CRUD role assignment, cancellation, branch-scope integration.
- Final status: FIXED.

## AF-002 — Controlled documents used misleading `.docx` extensions and mojibake appeared in source/docs

- Severity: MEDIUM
- Disposition: confirmed
- Evidence: renamed canonical Markdown files; `apps/web/src/lib/encoding.test.ts`.
- Root cause: plain text was named as Word packages and mixed encoding entered fixtures/content.
- Remediation: honest `.md` names, references updated, repository mojibake scan test.
- Tests added: source/docs encoding scan.
- Final status: FIXED.

## AF-003 — `/auth/me` exposed a raw session database identifier to normal browser state

- Severity: MEDIUM
- Disposition: confirmed
- Evidence: `auth.controller.ts`, `phase3-api.ts`.
- Root cause: internal revocation identifier was included in the ordinary principal DTO.
- Remediation: removed it from the normal session profile; admin session IDs remain only in the protected account-management endpoint.
- Tests added: revocation e2e correlates server-side token hash instead of browser-visible session ID.
- Final status: FIXED.
