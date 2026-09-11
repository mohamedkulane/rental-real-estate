# Migration and integration plan

## Phase 5.2 decision

Use a hybrid B→A strategy:

- **B now:** isolated documentation only on `codex/workflow-ux-design` at the Phase 5.2 integration baseline. No production files.
- **A later:** wait for a durable Phase 5.2 PASS/frozen candidate, then rebase the approved UX work before editing shared navigation, CRM routes, selectors, APIs, or workflow persistence.

This is required because active Phase 5.2 frontend work modifies `app-shell.tsx` and navigation models, while API/Security findings and final QA/UX/adversarial/governance gates remain open.

## Implementation waves

| Wave | Scope | Hard gate |
| --- | --- | --- |
| 0 | Approve this pack; resolve visual token source; approve workflow/draft/orchestration/permission contracts | independent Domain/Security/UX/Governance PASS; zero C/H |
| 1 | Rebase after durable Phase 5.2; target IA + permission/phase-aware Start New, no dead destinations | conflict review, backend negative auth tests, nav tests, 1440/768/390 + keyboard |
| 2 | Minimal durable draft/resume envelope + Property onboarding vertical slice | encryption/isolation/version/recovery plus identity reuse, ownership+payout, hierarchy, Branch, audit, two-tab idempotency |
| 3 | Extend the passed draft foundation for additional workflow types | typed schemas, expiry, assignment, recovery and concurrency tests |
| 4 | Rental Brokerage and Full Management setup | resolver compatibility; no downstream scope leakage |
| 5 | Property Sale setup boundary | external/company ownership proof; no listing/deal/settlement |
| 6 | CRM contextual entry after final Phase 5.2 APIs | one Lead, intent filters, permissions, pagination, no duplicate model |
| 7 | Responsive, accessibility, microcopy, localization hardening | manual/e2e review at 1440/768/390 and keyboard/screen-reader checks |
| 8 | cumulative regression and clean-checkout validation | all gates, independent adversarial/governance PASS |

No wave advances with unresolved CRITICAL/HIGH findings. Every MEDIUM receives owner, disposition, and verification evidence.

## Exact affected routes/components after approval

| Existing path | Disposition |
| --- | --- |
| `apps/web/src/components/shared/app-shell.tsx` | add launcher/default task IA after Phase 5.2 shell freeze; preserve mobile/access shell |
| `apps/web/src/components/shared/navigation-model.ts` and test | extend typed phase/permission-aware entries; merge deliberately with Phase 5.2 CRM edits |
| `apps/web/src/features/portfolio/portfolio-console.tsx` | keep registers; route create entry toward approved workflows without reducing advanced actions |
| `apps/web/src/features/portfolio/portfolio-ia.ts` and test | keep Phase 4 hierarchy/contextual child views |
| `party-directory.tsx`, `owner-directory.tsx`, `property-registry.tsx` | keep advanced CRUD/details; reuse their APIs/validation in guided paths, not their large drawers as the wizard |
| `ownership-workflow.tsx`, `property-operations.tsx`, `building-detail-workspace.tsx`, `rentable-space-operations.tsx` | preserve canonical actions; expose contextual subflows with durable workflow context |
| `entity-documents.tsx` and Portfolio API clients | reuse canonical upload/view/download/version/archive behavior |
| `features/commercial/engagement-register.tsx`, `engagement-detail.tsx`, types/API | preserve advanced lifecycle; add approved server preflight, never move compatibility to UI |
| Phase 5.2 `/crm`, `/crm/leads*`, `/crm/pipeline`, `/crm/follow-ups`, `/crm/lead-sources` and `features/crm/**` | integrate contextual entry only after durable freeze; preserve one Lead |
| API Portfolio/Commercial controllers/services and permission seeds | extend only through approved orchestration/preflight contracts; existing endpoints stay authoritative |

New paths (names provisional until Wave 0): launcher; `/workflows/new`, `/workflows/[workflowId]`, `/workflows/incomplete`; typed step components; orchestration controller/service/repository; migration; permission seeds; audit/outbox adapters; unit/integration/E2E tests. No production path is created in this run.

## Preserved advanced pages

Current top-level Party, Owner, Property, Rentable Space, Amenity, Service Engagement, administration, audit, and—after durable Phase 5.2—CRM registers remain. Building detail plus Ownership, Document, and Branch Assignment views remain contextual rather than being promoted to peer registers. Nothing is deleted or reduced to partial data.

## Governance placement

After this design run stops, implementation requires a separate explicit human approval. It runs as a separately named governed UX sub-phase only after Phase 5.2 reaches durable PASS; Phase 5.3 remains `NOT_STARTED`. The run records base SHA, ownership matrix, per-wave workers, independent Domain/Security/Frontend/QA/UX/Adversarial/Governance reviews, and stops at every gate. Approval of this document alone does not start Wave 1.

## Protected state

Do not modify `master`, `final-remediation.diff`, existing stashes, active Phase 5.2 worktrees, or unrelated root changes. Never use destructive clean/reset commands. Before implementation, record durable Phase 5.2 SHAs, rebase in a new isolated worktree, and rerun conflict and scope scans.

## Per-wave evidence

Governance, lint, strict typecheck, unit/integration/E2E/build, migration fresh+upgrade, repeat seed, authorization negatives, audit, pagination boundaries, N+1 query budgets, loading/empty/error/populated states, responsive screenshots, accessibility interaction, `git diff --check`, clean checkout, and independent reviews.
