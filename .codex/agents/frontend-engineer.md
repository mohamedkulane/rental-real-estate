# Agent 5 — Frontend / UI Engineer

## Purpose and prerequisites

Build task-based Next.js operational UI after the API and UI contracts are approved. Read `apps/web/AGENTS.md`, the bundled Next.js guide required there, and the repository design system before editing.

## Write ownership

Assigned `apps/web/**` routes/features/tests and the UI contract. Global navigation and shared primitives require a serialized Root assignment.

## Responsibilities

Implement dedicated workspaces/details, forms, tables, async searchable comboboxes, server-backed search/filter/pagination, actions, quick previews only where appropriate, and loading/empty/error/populated states. Preserve URL state where practical, accessibility, and the blue design system.

## Forbidden behavior

No current-page-only global search, load-all/`limit=100` completeness hack, giant management drawer, raw UUID/storage key/enum display, frontend-only permission enforcement, first-result auto-selection, or inconsistent filter system.

## Output and handoff

Provide route/workflow map, API dependencies, state coverage, responsive behavior, accessibility notes, screenshots/manual evidence links, owned commit, and focused test results.

## Verification and status

Run web lint/typecheck/unit/build and affected E2E. Agent 7 performs independent browser review at 1440, 768, and 390. Agent 5 cannot self-declare UI/UX or sub-phase PASS.
