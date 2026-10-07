# Final Closure Audit

This document is the human-readable source of truth for the final system
remediation. The machine-readable gate remains
`docs/decisions/32-final-closure-audit.md`.

## Product boundary

The product is a single-company, multi-branch real estate operations platform
with Portfolio, Rental Brokerage, Full Management, Sales, Operations, Finance,
Reports, Administration, and independent Development. Construction is retired
as a functional product domain. Historical migration files and the explicitly
marked superseded Phase 10 decision are retained as append-only history only.

## Canonical workflows

- Rental: owner -> property and units -> customer -> match -> property viewing
  -> interested -> selected unit -> rental agreement -> lease -> move-in ->
  commission -> move-out.
- Full Management: owner -> property and units -> customer -> match -> viewing
  -> selected unit -> agreement -> lease -> rent collection -> expenses ->
  management fee -> owner statement -> reviewed and approved owner payout ->
  move-out.
- Sales: seller -> sale property -> buyer -> match -> shared viewing ->
  interested -> sale agreement -> settlement -> sale complete.
- Operations: maintenance request -> work order -> vendor or employee ->
  expense where applicable; inspection -> item -> defect -> maintenance.

## Completed remediation

- Development is independent of the retired Construction domain.
- Construction runtime code, schema, permissions, navigation, seed data,
  reports, and tests were removed through forward migrations.
- Canonical navigation and compatibility redirects are documented in
  `docs/FINAL-ROUTE-MAP.md`.
- Global search is one bounded PostgreSQL query with ranked exact, prefix,
  contains, token, and pg_trgm fuzzy matches, scoped before disclosure.
- The command palette reuses global search and exposes only permission-aware
  navigation actions.
- Notifications are generated idempotently from upcoming viewings, due and
  overdue charges, lease endings, payout review, follow-ups, and urgent/high
  maintenance.
- Generated PDFs are available for leases, sale agreements, payment receipts,
  and owner statements. Each endpoint reads canonical server data and enforces
  company and branch authorization.
- WhatsApp actions are lightweight `wa.me` links and only use unmasked phone
  values already authorized for the current user.
- Saved views are user-owned, workspace-allowlisted, bounded scalar filter
  payloads. Ownership and authorization are re-evaluated on every request.
- Bulk action scope is deliberately narrow: follow-up completion is bounded,
  duplicate-safe, version-checked, and authorized per resource.
- Activity timeline is a user-facing read model over existing lifecycle,
  viewing, maintenance, lead, lease, payment, and sales events; raw audit JSON
  remains technical evidence.

## Integrity and security

Posted financial records remain immutable and are corrected by reversal or
adjustment. Security deposits remain liabilities, owner funds remain separate
from company income, and owner payouts retain maker-checker approval. Branch
scope, permission checks, masked contacts, protected documents, and audit
events remain backend-enforced.

## Verification record

The final acceptance run must include governance, Prisma format/validation/
generation, migrations, seed, lint, formatting, typecheck, unit tests,
integration tests, E2E tests, build, diff checks, and a successful GitHub
Actions run for the pushed `master` commit. Counts and the final CI run URL are
recorded in `docs/decisions/32-final-closure-audit.md` after that run.
