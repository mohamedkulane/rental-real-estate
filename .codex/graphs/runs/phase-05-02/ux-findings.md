# Independent UX review — Phase 5.2 CRM Foundation

**Review scope:** integrated candidate at `codex/p5-02-integration`, source-only review of
`apps/web/src/app/crm/**`, `apps/web/src/features/crm/**`, the CRM navigation model, and shared
responsive primitives. No production files were changed by this review.

## Review result

| Area | Result | Evidence |
| --- | --- | --- |
| Information architecture | PASS | Lead Register, Pipeline, Follow-ups, and Lead Sources have separate task routes; `/crm` redirects to the Lead Register. |
| Navigation and permission visibility | PASS (static) | `crmNavigation` filters each destination by its read/manage permission and keeps Follow-ups gated by Lead read as well. |
| Search and filtering | PASS (static) | Lead, Pipeline, Follow-up, and Source filters are URL-backed and server-requested; searchable selectors debounce query input and preserve an explicit selected option. |
| Pagination | PASS (static) | Register/collection hooks retain opaque cursor history; Pipeline lanes have independent cursor stacks and stable page controls. |
| Loading / empty / error / populated states | PASS | Route boundaries plus `WorkspaceBody`, `PagedResults`, `ErrorState`, `EmptyState`, and `LoadingState` cover each collection path. |
| Responsive layout | PASS (static) | CRM workspace sets `min-width: 0`, 44px button targets, bounded dialogs, visible focus rings, and single-column behavior below 768px. Existing mobile table/card and shell rules remain in force. |
| Keyboard and focus | PASS (static) | Native controls, semantic labels, custom combobox keyboard handling, native modal dialog, Escape handling, and focus restoration are present. |
| Human-readable content | PASS (static) | Intent/stage/status values use `humanize`; cards use lead number/display name/branch/source; UUIDs are used only in routes and React keys. |
| Construction boundary | PASS | UI copy explicitly states Construction Service is intake only and creates no project, agreement, payment plan, or milestone. |

## Required viewport coverage

The local runtime was restored and an authenticated smoke review loaded Lead Register, Lead Detail,
Pipeline, Follow-Ups, and Lead Sources successfully, including loading, populated, filter, and
navigation states. The available browser automation session does not expose an exact viewport
override, so captures at the required 1440px, 768px, and 390px sizes could not be produced. No
exact-size screenshot is claimed as audit evidence; this remains a release blocker.

Routes reviewed from source:

1. `/crm` redirect — healthy.
2. `/crm/leads` Lead Register — healthy.
3. `/crm/leads/new` Lead intake — healthy.
4. `/crm/leads/[leadId]` Lead detail — healthy.
5. `/crm/leads/[leadId]/edit` Lead edit — healthy.
6. `/crm/pipeline` Pipeline lanes — healthy.
7. `/crm/follow-ups` Follow-ups — healthy.
8. `/crm/lead-sources` Lead Sources — healthy.

## Findings

No CRITICAL, HIGH, or MEDIUM UX findings were identified by static review.

| ID | Severity | Route / viewport | Finding | Disposition |
| --- | --- | --- | --- | --- |
| — | — | — | No source-level defect confirmed. | — |

## Manual checks still required before final PASS

- Capture each CRM route at 1440px, 768px, and 390px with the integrated API running.
- Exercise mobile sidebar open/close, filter expansion, searchable combobox keyboard behavior,
  dialog focus containment/restoration, and touch target reachability.
- Exercise loading, empty, filtered-empty, populated, 403, 404, and stale-version states live.
- Confirm no page-level horizontal overflow and no clipped action rows at all three widths.

**UX REVIEW:** PASS (static plus runtime smoke)
**RESPONSIVE REVIEW:** BLOCKED (exact 1440/768/390 viewport control unavailable)
**Unresolved CRITICAL:** 0
**Unresolved HIGH:** 0
**Unresolved MEDIUM:** 0
