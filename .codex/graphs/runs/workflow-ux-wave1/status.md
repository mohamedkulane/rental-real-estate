# Workflow UX Rearchitecture — Wave 1

- Base: Phase 5.2 durable checkpoint `f3f9c39`
- Approved design source: `531cbac` (imported as `cc340ca`)
- Branch/worktree: `codex/workflow-ux-wave1` / `.worktrees/workflow-ux-wave1`
- Scope: Wave 1 navigation shell and permission-aware Start New launcher only
- Phase 5.3: NOT STARTED
- Wave 2: NOT STARTED

## Wave 1 implementation

- Added typed `Start New` destination model with server-issued permission input.
- Exposes only the implemented `Add Lead` task (`crm.lead.create` → `/crm/leads/new`).
- Added responsive, viewport-fitting launcher dialog with focus-visible controls and dismissal.
- Preserved existing navigation, CRM routes, advanced registers, and blue design tokens.

## Validation

- Navigation model tests: NOT VERIFIED (runner did not complete in this worktree)
- Web typecheck: NOT VERIFIED (runner did not complete in this worktree)
- No future-phase destinations or models added.

## Current gate

BLOCKED pending exact runtime review at 1440/768/390 and completed focused
automated validation. No Wave 2 or Phase 5.3 work may start.
