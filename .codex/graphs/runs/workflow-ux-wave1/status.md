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

- Navigation model tests: PASS (9/9)
- Web typecheck: PASS
- Web lint: PASS
- Web production build: PASS
- `git diff --check`: PASS
- No future-phase destinations or models added.

## Current gate

PASS under approved deferral: exact responsive evidence is recorded as
DEFERRED FOR FINAL RESPONSIVE VALIDATION in Wave 9. Wave 2 may proceed; Phase
5.3 remains NOT STARTED.
