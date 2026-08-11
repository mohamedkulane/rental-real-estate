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

## AF-004 — Deferred hierarchy/area checks lacked transaction-level serialization

- Severity: HIGH
- Disposition: confirmed during the mandatory second-pass audit.
- Evidence: Phase 4 `validate_all_space_areas()` and hierarchy triggers were deferred but did not serialize concurrent writes for the same Property.
- Root cause: application row locks protected normal service commands, while direct/concurrent database writes could execute under separate snapshots before either transaction committed.
- Remediation: migration `20260811153000_portfolio_concurrency_guards` adds Property-scoped transaction advisory locks before parent-history, measurement, and active-status changes; existing deferred triggers remain final validation authority.
- Tests added: two simultaneous 60 m² child allocations against a 100 m² parent produce exactly one commit and one rejection; concurrent duplicate Property business numbers also produce exactly one winner.
- Final status: FIXED.

## AF-005 — Clean-checkout automation depended on untracked environment and build artifacts

- Severity: MEDIUM
- Disposition: confirmed by remote clean-checkout CI.
- Evidence: prisma.config.ts, root and database-package test/seed scripts, GitHub Actions runs on the remediation PR.
- Root cause: Prisma configuration required a local environment file, while seed and test entry points imported workspace packages whose compiled output existed locally but not after a clean checkout.
- Remediation: local environment-file loading is optional when CI supplies environment variables; seed and test entry points build their declared workspace dependencies before execution.
- Tests added: clean-checkout CI runs Prisma format/validation, migration, seed, unit, integration, and E2E commands without untracked files.
- Final status: FIXED.

## AF-006 — Seeded business numbers did not reserve their automatic sequence values

- Severity: HIGH
- Disposition: confirmed by remote fresh-database E2E.
- Evidence: the seed created EMP-0001 after the automatic-number migration had initialized employee_record_number_seq to 1; the first API-created employee therefore collided with the seeded administrator.
- Root cause: migrations synchronized sequences before seed data existed, and the idempotent seed did not resynchronize them afterward.
- Remediation: the seed now synchronizes all six business-number sequences (branch, employee, party, owner, property, and rentable space) from their matching persisted prefixes after every seed run.
- Tests added: isolated eight-migration database, seed twice, employee next-value inspection (2, not yet called), and full E2E suite (32/32).
- Final status: FIXED.
