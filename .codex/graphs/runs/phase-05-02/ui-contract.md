# CRM Foundation UI contract

## Metadata

- Contract ID: CRM-UI-5.2; version: **1.0.0**; sub-phase: Phase 5.2 only.
- Contract status: DRAFT, submitted for Root approval. Implementation handoff: **REVIEW**, not UI/UX PASS.
- Owner: Agent 5, Frontend/UI Engineer, `codex/p5-02-web`.
- Dependencies: CRM-API-5.2 v1.0.1, authorization v1.0.1, domain v1.0.0; no new wire fields or lifecycle rules.
- Approved upstream gate supplied by Root: `27f4cf3`; implementation base `99b7ac1`. UI approver/SHA/date: pending independent frozen-candidate review.
- References: root and web `AGENTS.md`, canonical V3 CRM requirements, run domain/API/authorization contracts, graph ownership, `docs/design/Real_Estate_Rental_UI_UX_Design_System_v1.md`, existing blue Phase 4 shell/primitives, installed Next 16.3 App Router documentation.

## Information architecture and tasks

| Route                      | Workspace and primary task                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `/crm`                     | Redirect to Lead Register                                                                                          |
| `/crm/leads`               | Search/filter the authorized Lead Register; open a selected Lead; create when permitted                            |
| `/crm/leads/new`           | Choose intent, Branch, Source and optional eligible assignee/Party; capture typed preferences and contact snapshot |
| `/crm/leads/[leadId]`      | Dedicated Lead detail with Summary, Activity, Follow-ups, Assignment and History sections                          |
| `/crm/leads/[leadId]/edit` | Edit ordinary fields; explicitly replace preferences or correct intent with reason and version check               |
| `/crm/pipeline`            | Inspect each legal stage as an independently paged queue, with exact stage/global totals                           |
| `/crm/follow-ups`          | Search and filter operational Follow-ups; schedule/update/complete/cancel or create a linked successor             |
| `/crm/lead-sources`        | Search Sources; authorized create/update/activate/deactivate; immutable Source code and usage count                |

The CRM navigation group contains Lead Register, Pipeline, Follow-ups and Lead Sources. There is no Viewings page or future-phase navigation. Navigation visibility is usability, not authorization. Detail collections are only requested when `crm.lead.read` and the collection's read grant both apply to the same current Lead Branch. History uses Lead read and does not expose child collections. Separate grants control visible action buttons.

Short actions use a focused native dialog; full intake/edit uses dedicated pages. Detail actions are named commands, never a free-edit stage dropdown: Mark Contacted, Mark Qualified, Move to Matching, Move to Nurturing, Close as Converted and Close as Lost. Terminal stages have no reopen action. Assignment, reassignment, unassignment, Branch transfer, Activity correction/void, Party link/unlink and Source state changes remain explicit tasks. Human labels are rendered for intents, stages, statuses and option values; business numbers/names identify records, not UUIDs or storage keys.

## Data and interaction

| Surface                     | API dependencies                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Register/intake/detail/edit | `GET/POST /crm/leads`, `GET/PATCH /crm/leads/:id`, named intent/stage/Party/Branch commands                          |
| Pipeline                    | `GET /crm/pipeline`, including `pipelineStage` for subsequent lane pages                                             |
| Lead Activity               | paginated `/crm/leads/:id/activities`, create and correction/void commands                                           |
| Follow-ups                  | paginated `/crm/follow-ups` and `/crm/leads/:id/follow-ups`, versioned update/complete/cancel and successor creation |
| Assignment/history          | paginated Lead assignment and history endpoints; assign/reassign/unassign commands                                   |
| Sources                     | `/crm/lead-sources`, `/crm/lead-sources/options`, versioned Source commands                                          |
| Large entity choices        | purpose-scoped `/crm/selectors/branches`, `/employees`, `/parties`, `/properties`, `/spaces`                         |

- Register and pipeline search/filters are server-backed: search, stage, intent, Branch, Source, assignee and created date range. Assignee choices require a chosen Branch and the same-Branch assignment-read conjunction. Source options require Source read. Follow-ups use server search, Branch, state, derived status and due-date bounds. Sources use server search/status. Date lower bounds include the start; upper bounds exclude the end.
- Filter state lives in URL search parameters where practical; changing a filter resets the corresponding cursor stack. Query arrays use repeated unbracketed keys. Clear filters removes URL filters. No client-side global search, client joins, N+1 lookups or load-all selector exists.
- All collections/options request 25 records and use opaque cursor pages with exact server totals. Previous navigation uses the retained cursor stack. Errors on later collection pages offer a restart at page one. Pipeline retains independent lane cursor stacks; a lane request supplies `pipelineStage` plus that lane's cursor and preserves other lanes. Base-filter changes reset all lanes. Counts are never inferred from current-page length.
- Large entity lists use the shared searchable combobox with debounced server search, explicit selection, loading/error feedback, paged options and no automatic first-result selection. Native selects are limited to closed enums. Historical labels remain visible when an existing Source is inactive.
- Flat `PreferenceResponse` variants are rendered through an allowlisted field presentation. Requests contain only the selected intent's typed fields. Complete preference replacement is explicit; an unknown/scope-redacted asset link is not interpreted as permission to clear it. Ordinary fields can be saved independently. Linked Party/assets remain subject to independent backend authority.
- Mutations consume minimal acknowledgements and invalidate CRM queries for a fresh authorized read. No mutation response is treated as an audited contact reveal. Contact lists remain masked; detail only displays raw keys when actually returned by the API.
- Follow-up responsibility is immutable in PATCH. The UI creates a linked successor first, then leaves predecessor cancellation as an explicit reviewed action; it does not hide an intermediate cancellation or invent a combined command. NURTURING prerequisites stay server-authoritative.
- Branch transfer explicitly offers retain, replace or clear. Clear sends `clearAssignee:true`, is not combined with replacement and is unavailable for QUALIFIED/MATCHING/NURTURING. No implicit clearing occurs.
- Terminal commands explain closure of the Lead and cancellation of open Follow-ups. Correction, destructive and lifecycle forms request the contracted reason/version and state the consequence before submission. Pending forms disable resubmission and cancellation; success gives a toast and refreshed data; failures keep the form open with actionable, sanitized feedback.

## States and safety

- Loading: route loading boundary plus authorized collection/selector/detail loading states.
- Empty: task-oriented guidance; filtered-empty: clear/change filters, not an invitation to create duplicate records.
- Populated: business labels, exact totals, cursor controls and permission-aware actions.
- Error: sanitized error message, retry and later-page restart; no backend/SQL/storage text is exposed.
- Stale version (409): asks the user to close, refresh and review current details before resubmitting; no automatic mutation retry.
- Forbidden (403): current Branch access explanation; not-found (404): unavailable in authorized scope; session expiry and throttling have distinct guidance.
- MATCHING copy says readiness only: matching has not run and no candidates were created. CONSTRUCTION_SERVICE copy says intake only: no project, agreement or payment plan is created.
- Explicit exclusions: Viewings (Phase 5.4), Listings/Matching records, Applications, Reservations, Leases, Finance, SaleDeal, Construction/Development records. No raw UUID/enum/JSON display, `limit=100`, first-result auto-selection, or current-page search represented as global search.

## Responsive and accessibility acceptance

- 1440px: existing application shell, bounded content, multi-column cards/forms and detail context aside; pipeline stages remain distinct queues.
- 768px: existing responsive shell, wrapping action rows and compact two-column content where space permits; all workflow controls remain reachable.
- 390px: single-column cards/forms, stacked dialog actions, bounded dialogs and horizontally scrollable detail-section navigation; no required page-level horizontal scrolling.
- Keyboard: visible focus ring, semantic labels/buttons/links, shared combobox keyboard behavior, native dialog modal focus containment, Escape when idle and focus restored to the initiating control. Checkbox clear actions have explicit accessible names. No drag-and-drop-only stage movement.
- Touch/status: CRM buttons use at least 44px height; status is conveyed by readable text plus color. No custom motion is introduced. Existing shared reduced-motion behavior remains unchanged.
- Blue identity: reuse `AppShell`, `PageHeader`, loading/empty/error/status primitives, searchable select and cursor controls; blue actions/focus/selected navigation, white cards, slate borders and neutral text. CRM-only CSS adds focus/touch/dialog constraints without redesigning shared primitives.
- Manual browser evidence: pending integrated API candidate and independent frozen-candidate review at 1440/768/390, keyboard/focus, touch, permission changes, stale versions and all major states. Agent 5 does not self-certify these as PASS from source or unit tests.

## Verification and handoff

- Fresh verification on 2026-09-01: strict TypeScript `tsc --noEmit -p apps/web/tsconfig.json` PASS (exit 0); ESLint `eslint apps/web` PASS (exit 0); Vitest `vitest run` PASS (13 files / 96 tests); Next 16.3 `next build --webpack` PASS (all eight CRM route entries, including dynamic detail/edit). Commands used the existing installed local binaries; no install, manifest, lockfile or shared dependency regeneration was performed by Agent 5. Production build used approved network access for the configured font fetch.
- Prettier was run on every owned source file and this contract; final formatting/diff checks are part of the commit handoff evidence.
- CRM tests cover same-Branch permission conjunction, repeated query keys, lane cursor binding, lifecycle action availability, stage payloads, successor-first immutable responsibility, no automatic selection, typed preference payload/validation, Source code immutability, safe business-label rendering and loading/empty/error state selection. Shared navigation tests cover CRM visibility and no Viewings.
- Live API E2E/integration and responsive browser evidence remain an integration/independent QA handoff, not waived acceptance. No backend/config/dependency/lockfile changes are part of this frontend delivery.

## Change log

- 2026-09-01 — v1.0.0: task-based CRM Foundation UI contract submitted for REVIEW against API/authz v1.0.1; explicit exclusions and pending independent UX evidence recorded.
