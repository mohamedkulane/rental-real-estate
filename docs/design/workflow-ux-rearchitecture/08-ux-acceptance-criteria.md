# UX acceptance criteria

## Navigation and comprehension

- A new employee answers “Where do I onboard a Property?” with `+ Start New → Onboard Property`.
- Rental Brokerage, Full Management, Property Sales, Construction intake, and Development are not conflated.
- Only implemented, authorized actions are interactive.
- Advanced registers remain discoverable and complete.
- Internal IDs, storage keys, raw JSON, and raw enum strings are absent from normal UI.

## Workflow behavior

- Progress, Back, Continue, Save Draft, Resume Later, and safe Cancel work.
- Conditional steps/fields ask only relevant questions.
- Existing records are searched server-side and never auto-selected.
- Duplicate warnings never auto-merge.
- Ownership and payout totals are visibly separate and correct.
- Portfolio-only onboarding does not require Service or Space.
- Review shows per-domain outcomes and failures resume precisely.
- No finalized command runs twice under retry or two tabs.

## Data, authorization, and performance

- BRANCH, MULTI_BRANCH, COMPANY_WIDE, wrong-Branch, wrong-company, permission-revoked, and object-scope cases pass.
- Search is case-insensitive, server-side, cursor-paginated, and stable.
- No load-all, `limit=100`, current-page-only filtering, or N+1 detail loop.
- Counts are global authorized totals or clearly page-scoped.
- Canonical Party/Owner/Property/Space/Engagement/Lead records are not duplicated.
- Domain transitions, history, audit, and resolver remain authoritative.

## Responsive and accessibility

At 1440, 768, and 390 pixels verify shell, launcher, stepper, every workflow step, Incomplete Work, contextual CRM, record links, dialogs, tables, validation, and failure recovery.

- no page-level horizontal overflow;
- labels/actions do not collide or clip;
- mobile primary action and save remain reachable without consuming the screen;
- dialogs/sheets fit the viewport;
- touch targets are usable;
- focus order and restoration are correct;
- visible focus, semantic labels, announcements, and keyboard operation work;
- status is not color-only;
- reduced motion is respected;
- contrast meets approved WCAG 2.1 AA target.

Screenshots support visual review but do not prove full accessibility; keyboard and assistive-technology checks are separate evidence.

## Required automated scenarios

Unit: step state, conditional logic, validation, service mapping, draft versions, context preselection.

Integration: multi-aggregate onboarding, identity reuse/duplicate prevention, separate ownership+payout validation, Branch/company isolation, resolver conflicts, Document linking, stale drafts, recovery, concurrency, idempotent finalization.

E2E: each approved workflow; existing/new record branches; save/resume; Back; validation recovery; mobile; permission loss; no future dead action.

Regression: all passed Phase 1–5 tests and clean-checkout validation.

## Hard fails

Fail for duplicated identity; collapsed canonical domains; generic Unit; resolver bypass; giant forms; manual register hopping as the normal path; mixed business models; fake future modules; weakened auth; incomplete datasets; load-all/large-limit/N+1; lost drafts; duplicate finalization; responsive failure; or unresolved CRITICAL/HIGH findings.

## Design-run limitation

This first run proposes an implementation design; it does not self-approve or implement UX. Runtime responsive/accessibility acceptance remains NOT RUN until production work is explicitly approved and Phase 5.2 is durably complete.
