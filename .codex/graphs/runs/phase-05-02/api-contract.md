# Phase 5.2 CRM API contract

## Metadata

- Contract ID/version/sub-phase: `CRM-API-5.2` / `1.0.0` / Phase 5.2 CRM Foundation.
- Contract status: `APPROVED FOR IMPLEMENTATION` (Root approval of upstream gates; API remains REVIEW until implementation evidence).
- Owner: Agent 4 Backend / API Engineer.
- Upstream contracts: `CRM-DOMAIN-5.2` v1.0.0, `CRM-DB-5.2` v1.0.0, and Phase 5.2 authorization contract v1.0.0, approved at Root gate `eee921c` on 2026-08-25.
- Consumers: Web, Security Review, QA, UX, Adversarial, Governance, and Root.
- Canonical references: canonical V3 BR-002/007/018 and CRM sections 8, 10-14, 16-18, 20.1-22; ADR 12; Phase 5.1 capability resolver; this run's approved domain/database/authorization contracts.
- Base path and media: `/api/v1`; JSON. Client-supplied `companyId`, stage, current Branch, current assignee, contact ciphertext/token, actor, audit, history, and timestamps are rejected as unknown fields by the global validation pipe.

## Endpoint catalog

All Lead-child routes first resolve the Lead by trusted session Company and then apply its current responsible Branch. Reads require the collection permission named below; child read permissions do not imply `crm.lead.read` except where explicitly stated. Mutation DTOs use `expectedVersion` for mutable aggregates and bounded reason text where shown.

| Method/path | Purpose | Permission/resource check | Request DTO / principal response | Audit |
| --- | --- | --- | --- | --- |
| `GET /crm/leads` | Lead Register | `crm.lead.read`; authorized Branch intersection | Query `limit<=50,cursor,search,branchId[],stage[],intent[],sourceId[],assigneeEmployeeId,createdFrom,createdTo`; `{items,pageInfo,totalCount}` | none |
| `GET /crm/pipeline` | Stage-grouped pipeline | `crm.lead.read`; same final predicate as register | Same relevant filters; per-stage independently paged groups plus exact `stageTotals`/`totalCount` | none |
| `POST /crm/leads` | Create `NEW` Lead and typed preference | `crm.lead.create` in responsible Branch; Source/reference checks | `CreateLeadDto`; Lead detail | `crm.lead.created` |
| `GET /crm/leads/:leadId` | Lead detail/read model | `crm.lead.read` in current Branch | safe detail; masked contact by default, raw only with conjunctive contact permission | raw reveal only: `crm.lead.contact.revealed` |
| `PATCH /crm/leads/:leadId` | Correct display name, Source, contact snapshot, or same-intent preference | `crm.lead.update` in current Branch | `UpdateLeadDto {expectedVersion,reason,...}`; detail | `crm.lead.updated` (allowlisted fields only) |
| `POST /crm/leads/:leadId/intent-correction` | Replace intent and typed preference in `NEW/CONTACTED` | `crm.lead.update` | `{expectedVersion,intent,preference,reason}` | `crm.lead.intent-corrected` |
| `POST /crm/leads/:leadId/party-link` / `party-unlink` | Explicit Party linking/unlinking | `crm.lead.update` plus `party.read` for link, Lead scope first | `{expectedVersion,partyId,reason}` / `{expectedVersion,reason}` | `crm.lead.party-linked/unlinked` |
| `POST /crm/leads/:leadId/contacted` | `NEW -> CONTACTED` | `crm.lead.stage`; qualifying completed contact Activity must exist | `{expectedVersion,activityId,reason?}` | `crm.lead.stage-transitioned` |
| `POST /crm/leads/:leadId/qualified` | `CONTACTED/NURTURING -> QUALIFIED` | `crm.lead.stage`; assignment and typed qualification gate | `{expectedVersion,reason?}` | same |
| `POST /crm/leads/:leadId/matching` | `QUALIFIED/NURTURING -> MATCHING` | `crm.lead.stage`; RENT/BUY and qualification re-check | `{expectedVersion,readinessLabel,reason?}` | same; label excluded from audit |
| `POST /crm/leads/:leadId/nurturing` | `QUALIFIED/MATCHING -> NURTURING` | `crm.lead.stage`; referenced next OPEN Follow-up | `{expectedVersion,followUpId,reason}` | same |
| `POST /crm/leads/:leadId/converted` | legal active stage -> `CONVERTED` | `crm.lead.stage` | `{expectedVersion,outcomeSummary,externalReference?}` | transition plus per-item system Follow-up cancellation audits |
| `POST /crm/leads/:leadId/lost` | legal nonterminal stage -> `LOST` | `crm.lead.stage` | `{expectedVersion,lostReason,lostNotes?}`; `OTHER` requires notes | transition plus per-item system Follow-up cancellation audits |
| `GET /crm/leads/:leadId/history` | Stage/intent/Branch history | `crm.lead.read` | opaque cursor timeline | none |
| `GET /crm/leads/:leadId/activities` | Activity timeline | `crm.activity.read` | `limit<=50,cursor,type,direction`; page | none |
| `POST /crm/leads/:leadId/activities` | Append factual Activity | `crm.activity.create` | `{type,direction,summary,notes?,occurredAt}` | append evidence; no generic sensitive audit required |
| `POST /crm/leads/:leadId/activities/:activityId/correction` / `void` | Append correction or void | `crm.activity.correct`; child must belong to Lead/Company | `{type?,direction?,summary,notes?,occurredAt,reason}` / `{reason}` | `crm.activity.corrected/voided` |
| `GET /crm/follow-ups` | Follow-up workspace | `crm.followup.read`; current Lead Branch predicate | `limit<=50,cursor,search,branchId[],state[],derivedStatus,dueFrom,dueTo,responsibleEmployeeId,leadId`; exact total | none |
| `GET /crm/leads/:leadId/follow-ups` | Lead Follow-ups | `crm.followup.read` | same subset/order/page semantics | none |
| `POST /crm/leads/:leadId/follow-ups` | Create OPEN Follow-up | `crm.followup.create`; nonterminal Lead and eligible employee | `{subject,notes?,dueAt,responsibleEmployeeId,predecessorFollowUpId?}` | `crm.followup.created` |
| `PATCH /crm/leads/:leadId/follow-ups/:followUpId` | Reschedule/correct OPEN Follow-up | `crm.followup.update`; child ownership | `{expectedVersion,reason,subject?,notes?,dueAt?,responsibleEmployeeId?}` | `crm.followup.updated` |
| `POST /crm/leads/:leadId/follow-ups/:followUpId/complete` | `OPEN -> COMPLETED` | `crm.followup.complete` | `{expectedVersion,reason}` | `crm.followup.completed` |
| `POST /crm/leads/:leadId/follow-ups/:followUpId/cancel` | `OPEN -> CANCELLED` | `crm.followup.cancel` | `{expectedVersion,reason}` | `crm.followup.cancelled` |
| `GET /crm/leads/:leadId/assignments` | Assignment history | `crm.assignment.read` | opaque cursor timeline | none |
| `POST /crm/leads/:leadId/assign` | Install first current assignee | `crm.assignment.manage` | `{expectedVersion,employeeId,reason}` | `crm.lead.assigned` |
| `POST /crm/leads/:leadId/reassign` | Close current/open successor at one instant | `crm.assignment.manage` | `{expectedVersion,employeeId,reason}` | `crm.lead.reassigned` |
| `POST /crm/leads/:leadId/unassign` | Close current assignment | `crm.assignment.manage`; rejected for qualified active stages | `{expectedVersion,reason}` | `crm.lead.unassigned` |
| `POST /crm/leads/:leadId/branch-transfer` | Prospective responsible Branch transfer | `crm.lead.branch.transfer` over source and destination | `{expectedVersion,destinationBranchId,reason,replacementEmployeeId?}` | `crm.lead.branch-transferred` |
| `GET /crm/lead-sources/options` | Active intake selector | `crm.source.read` and at least one effective Branch grant | ordered active `{id,code,label}` only | none |
| `GET /crm/lead-sources` | Full Source workspace | company-wide `crm.source.manage` | `limit<=50,cursor,search,status`; exact total/usage count | none |
| `POST /crm/lead-sources` | Create Source | company-wide `crm.source.manage` | `{code,label,description?,sortOrder?}` | `crm.source.created` |
| `PATCH /crm/lead-sources/:sourceId` | Update non-code metadata | company-wide `crm.source.manage` | `{expectedVersion,label?,description?,sortOrder?}` | `crm.source.updated` |
| `POST /crm/lead-sources/:sourceId/deactivate` / `reactivate` | Source lifecycle | company-wide `crm.source.manage` | `{expectedVersion,reason}` | `crm.source.deactivated/reactivated` |

No Phase 5.2 raw-contact export endpoint is exposed. `crm.lead.contact.export` is seeded and reserved for a separately approved purpose/step-up/export design. No generic stage/status route exists.

## DTO and serialization contract

- `CreateLeadDto`: `intent`, `sourceId`, `responsibleBranchId`, optional `currentAssigneeEmployeeId` and `partyId`, `displayName`, optional `phone`/`email`, and exactly one discriminated `preference`. Without Party, display name and at least one contact are required. Unknown fields are rejected; strings trim, empty optional strings become null; enum values remain canonical.
- Preference common fields: `preferredAreaText` (bounded unique trimmed strings), `notes`, `desiredByDate`. RENT/BUY/SELL/CONSTRUCTION variants expose only fields in `CRM-DOMAIN-5.2`; monetary strings are canonical non-negative decimals with ISO-4217 uppercase currency, ranges are ordered, dates are ISO dates, instants ISO-8601, and area is positive with unit. Cross-variant/unknown fields fail validation.
- Explicit RENT Space and BUY/SELL Property links invoke the Phase 5.1 resolver using the current business date and require `canReceiveRentalLead`, `canReceiveBuyerLead`, or `canReceiveSellerLead`. Construction Property is same-Company/authorized location context only. Asset/Party references are independently same-Company and resource scoped.
- Lead list/pipeline/detail return `contact: {phoneMasked,emailMasked,hasPhone,hasEmail}`. Detail may additionally return raw `phone/email` only when `crm.lead.read` and `crm.lead.contact.read` are both effective in the Lead Branch; every reveal is transactionally audited. Ciphertext, HMAC, key version, free-text audit fields, and null-vs-forbidden internals are never serialized.
- Activity, Follow-up, assignment, Branch, Source, Party, employee, Property, and Space summaries use explicit safe selectors. Assignment does not imply access. Historical Source remains labelled inactive in an authorized Lead even when absent from selector options.

## Authorization map

- Exact independent permissions: `crm.lead.read/create/update/stage`, `crm.activity.read/create/correct`, `crm.followup.read/create/update/complete/cancel`, `crm.assignment.read/manage`, `crm.lead.branch.transfer`, `crm.source.read/manage`, `crm.lead.contact.read/export` (19 total). Controller metadata and service checks both apply where resource/conjunctive checks are required.
- Deny formula: active session AND exact permission AND employee access mode AND role-grant permission scope AND current Lead Branch/resource scope AND command state guard. Runtime never checks role names and has no implicit super-admin bypass.
- Every repository predicate includes trusted `principal.companyId`. Requested Branches are intersected with `AuthorizationService.authorizedBranchIds`; an empty intersection returns an empty list/count, never a broader query. A company-wide result requires access mode `COMPANY_WIDE` and an explicit null permission scope.
- Transfer authorizes both stored source and validated destination before mutation. Source management requires `assertCompanyPermission`. Contact reveal is conjunctive; export would require all three explicit company-level grants.
- Cross-Company/undiscoverable IDs return stable 404. After same-Company resolution, missing action/Branch permission returns stable 403 without version/stage/assignee/eligibility detail. State and expected-version validation occurs only after resource authorization.

## Command behavior

- Every multi-row command runs in one Prisma interactive transaction, obtains a row lock for the Lead (and Follow-up/Source where applicable), re-loads by trusted Company, compares `expectedVersion`, mutates via compare-and-swap, appends required immutable history, and writes allowlisted audit before commit. Failure rolls back all effects.
- Duplicate/retried stale commands return conflict; no command silently succeeds twice. A future idempotency-key contract is not invented. `expectedVersion` mismatch is `CRM_VERSION_CONFLICT` / HTTP 409.
- Intent correction closes current preference at one instant, creates the matching next preference version and intent history, changes Lead intent/version, validates capability/reference, and audits atomically.
- Terminal transition cancels every OPEN Follow-up in the same transaction, increments each Follow-up version, appends a `CANCELLED` outcome with a system-terminal reason/actor, and writes redacted audit entries. Any failure rolls back the stage transition.
- Assignment, reassignment, transfer, preference intervals, and Branch history use a shared transaction timestamp so half-open intervals meet exactly. Transfer validates destination employee eligibility or performs the requested replacement/clear atomically; it never rewrites history.
- Errors use the existing API exception envelope with stable codes/messages: 400 `CRM_VALIDATION_FAILED`, `CRM_ILLEGAL_TRANSITION`, `CRM_QUALIFICATION_REQUIRED`, `CRM_CAPABILITY_DENIED`, `CRM_INELIGIBLE_EMPLOYEE`; 403 `CRM_FORBIDDEN`; 404 `CRM_NOT_FOUND`; 409 `CRM_VERSION_CONFLICT`, `CRM_SOURCE_CODE_CONFLICT`; 429 `CRM_SEARCH_RATE_LIMITED`. Database/internal text and protected values are never returned.

## Read model behavior

- Register ordering is `(createdAt DESC,id DESC)`; pipeline cards `(updatedAt DESC,id DESC)`; Follow-ups `(dueAt ASC,id ASC)`; Sources `(sortOrder ASC,label ASC,id ASC)`; timelines use the documented timestamp DESC plus `id DESC`. All are strict keyset orderings.
- Cursor is base64url encoded, versioned, HMAC-authenticated JSON containing read-model kind, ordering tuple, and a hash of normalized filter + trusted Company/effective Branch scope. It contains no contact/search/free text, ciphertext/HMAC contact token, or raw authorization details. Malformed, wrong-kind, filter-changed, tampered, or stale-scope cursor returns 400; a scope change can only narrow/reject continuation and cannot leak prior records.
- `limit` defaults to 25 and maxes at 50. Fetch is `limit+1`; no `limit=100`, load-all, offset, or current-page-only search. Search is trimmed/case-insensitive over Lead number/display name and safe Source/employee labels; an exact normalized phone/email query adds only the Company-scoped HMAC token predicate. Search never logs/audits the raw term and applies Company/Branch scope before materialization.
- Filters are conjunctive; multi-value filters are OR within their field. Date ranges are inclusive lower/exclusive upper. Derived Follow-up `OVERDUE` is `OPEN && dueAt < server now`; it is never persisted. `totalCount` and pipeline stage totals use exactly the same authorized/filter predicate as items, excluding only page cursor.
- Query budgets (constant by page size): register <=3 SQL statements (items/count/contact-reveal audit batch when applicable); pipeline <=4 (cards/totals plus optional audit); detail <=8 including bounded/batched summary collections; Follow-up workspace <=3; Source workspace <=3; timelines <=2. No parent-list/detail-per-row query is permitted; all relations use joined selectors or fixed batched `IN` queries. Integration tests instrument Prisma query events and compare 1-row versus full-page counts.

## Audit allowlist

Audit includes actor ID, action, target type/ID, trusted Company context supplied by AuditService, old/new Branch IDs where applicable, timestamp/correlation, bounded reason/lifecycle code, and before/after version. It excludes names, contact, contact/search tokens, search text, preference/activity/follow-up free text, outcome narrative, external reference, and documents. Required actions are the endpoint entries above plus asset links/unlinks caused by preference corrections, raw reveal, and each automatic terminal cancellation.

## Acceptance

- Authorization mapping: pending post-integration Agent 3 review; implementation must independently positive/negative test all 19 permissions and Branch/MULTI_BRANCH/COMPANY_WIDE intersections.
- Required evidence: DTO/policy unit; PostgreSQL integration for atomic history/audit/version/terminal cancellation and concurrency; E2E endpoint/permission/company-isolation/redaction; >1 page keyset and changed-scope cursor; exact totals; query-count no-N+1; lint/typecheck/unit/integration/E2E and `git diff --check`.
- Open questions/blockers: none. Contact export is deliberately absent; future-phase endpoints and models are prohibited.
- Change log: v1.0.0, 2026-08-25, initial implementation contract from three approved upstream v1.0.0 contracts.
