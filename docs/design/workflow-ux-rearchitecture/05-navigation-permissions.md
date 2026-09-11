# Navigation and permissions

## Enforcement model

Visibility improves usability only. Every query/command must independently enforce:

`implemented capability AND permission conjunction AND branch scope AND object scope AND record-state/domain policy`

Company isolation is mandatory. Access modes remain BRANCH, MULTI_BRANCH, and explicit COMPANY_WIDE. Search, counts, exports, document URLs, drafts, and background work use the same predicates.

## Launcher and workflow matrix

Existing permission codes below are current source contracts. Only new workflow/draft permissions and the new preflight response require Wave 0 approval by Domain/Security/API owners.

| Action | Minimum permission domains | Additional gates |
| --- | --- | --- |
| Onboard Property | launcher is visible when at least one authorized Owner path **and** one Property path exist; exact alternative paths are below | authorized operating Branch and resource state; optional choices gated separately |
| Rental Brokerage setup | one authorized Owner path; existing Property `portfolio.property.read` **or** new Property `portfolio.property.create`; existing Space `portfolio.space.read` **or** conditional create path; `service-engagement.create` then `service-engagement.activate`; `portfolio.document.manage` only if upload chosen | server creation/activation preflight permits rental Property/Space request |
| Full Management setup | same alternative asset paths; `portfolio.ownership.read` for readiness; mutation permission only if correction chosen; service create/activate | preflight permits `FULL_MANAGEMENT` request |
| Property Sale setup | one Owner path; existing/new Property alternative; `portfolio.ownership.read`; mutation only for correction; service create/activate; document permission only when used | actual ownership; Property-only preflight |
| Add Lead | durable Phase 5.2 `crm.lead.create` plus its final Branch/object contract | one intent; wait for Phase 5.2 PASS |
| Resume draft | **new pending:** `workflow.draft.read/update/cancel/complete` (names require Wave 0 contract) plus every next domain command | creator/assignee policy, version, Branch/object reauthorization |

Phase 5.2 existing draft contract also includes `crm.lead.read/create/update/stage/branch.transfer`, `crm.assignment.read/manage`, `crm.activity.read/create/correct`, `crm.followup.read/create/update/complete/cancel`, and `crm.source.read/manage`. These codes are recorded for integration planning but remain provisional until the durable Phase 5.2 checkpoint passes.

### Alternative onboarding paths

| Path | Boolean permission requirement |
| --- | --- |
| Reuse existing Owner | `owner.read`; add `party.read` only if the approved returned view requires Party data |
| Existing Party → Owner profile | `party.read AND owner.create` |
| New Party + Owner | `party.create AND owner.create` |
| Reuse existing Property | `portfolio.property.read` |
| Register new Property | `portfolio.property.create` |
| Set/correct ownership | `portfolio.ownership.read AND portfolio.ownership.manage` only when that path is required |
| Add Building | `portfolio.building.read AND portfolio.building.manage` only when selected |
| Reuse existing Space | `portfolio.space.read` |
| Create/partition/update Space | relevant `portfolio.space.create`, `portfolio.space.partition`, or `portfolio.space.update` only for the chosen operation |
| View/upload Documents | `portfolio.document.read`; add `portfolio.document.manage` only for upload/change |

The server capability response returns `availablePaths[]` and safe per-path missing-requirement codes. It must not require every mutually exclusive or optional permission merely to open the launcher.

Permission checks cannot assume a single code. For example, a combined Follow-up view may require both `crm.lead.read` and `crm.followup.read`. Wave 0 must define an API/Security-owned launcher/preflight response with action ID, implemented-phase state, allowed/denied result, safe reason code, allowed Branch IDs, required permission conjunction, and optional resource/capability constraints. The frontend consumes that response; each actual endpoint still authorizes independently.

## Navigation behavior

- Omit actions that are unavailable because their phase is not implemented.
- Explain permission denial only when revealing the resource is safe.
- Never show inaccessible branch/entity names in selector results or draft summaries.
- Preserve selected branch context across workflow steps; revalidate it on resume and finalization.
- Mobile navigation traps focus while open, closes on navigation/Escape, and restores focus.
- Active state uses text/shape as well as color.

## Document authorization

Document list, inline view, download, version history, archive, and upload are mediated by backend authorization. A workflow draft stores only opaque authorized upload-session references. URLs are short-lived; object/storage keys never appear in normal UI or logs.

## Negative tests

Every workflow and workspace must test allowed, missing-permission, wrong-branch, unauthorized MULTI_BRANCH subset, unauthorized company, stale authorization after resume, and capability-denied paths. Hidden navigation never substitutes for these tests.
