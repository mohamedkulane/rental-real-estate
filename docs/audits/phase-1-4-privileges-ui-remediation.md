# Phase 1-4 Privileges and UI Remediation

Date: 2026-08-16
Branch: phase-1-4-final-audit
Phase 5 status: NOT STARTED

## Scope completed

- Added a reusable searchable select control and migrated every Phase 1-4 native selection control to it.
- Moved Settings and Sign out from the sidebar into the persistent header.
- Made the sidebar scrollbar visually unobtrusive while retaining keyboard and pointer scrolling.
- Centered form drawers as bounded, smooth-scrolling dialogs.
- Corrected search and filter icon spacing so icons no longer overlap entered text.
- Added the admin Privileges workspace for per-user capability selection.
- Added backend-enforced per-user allow/deny overrides, validation, self-lockout protection, audit evidence, migration, and seed permissions.

## Access-control decision

Role permissions remain the baseline. A complete set of user overrides is stored when an administrator saves the Privileges form. Explicit denies remove inherited role permissions; explicit allows add permissions within the employee's authorized company or branch scope. Session resolution applies overrides on every authenticated request, so changes take effect without relying on frontend state.

Only an actor with identity.user.privilege.manage may save changes. The actor must provide a reason. The system refuses an attempt to remove that capability from the actor's own account.

## Verification

- Prisma schema format/validate/generate: PASS
- Migration deploy/status: PASS (11 migrations applied; database up to date)
- Seed idempotency (two consecutive runs): PASS
- Lint: PASS
- Strict TypeScript: PASS
- Unit tests: PASS (database 3, web 18, API 32)
- Production builds: PASS
- Override allow/deny authorization regression test: PASS
- Git diff whitespace check: PASS

The installed Prisma CLI could not run the requested migrations-to-datamodel diff because this repository does not contain prisma/migrations/migration_lock.toml; deploy/status and schema validation passed.
