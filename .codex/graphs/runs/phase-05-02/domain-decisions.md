# Phase 5.2 CRM domain contract

## Metadata

- Contract ID/version: `CRM-DOMAIN-5.2` / `1.0.0`
- Sub-phase: Phase 5.2 — CRM Foundation
- Status: `REVIEW` — complete and approval-ready; Root owns approval
- Owner: Agent 1 Domain Architect
- Approval SHA/date: Pending Root contract gate
- Consumers: Database, Security, API, Web, QA, UX, Adversarial, Governance, Root
- Authority: approved 5.2 instruction → `AGENTS.md` → canonical V3 → accepted
  ADRs/Phase 5.1 PASS → graph contracts → older architecture recommendations
- Canonical references: V3 BR-002/007/018 and sections 8, 10–14, 16–18,
  20.1–22; ADRs 10, 12, and 15; `docs/phases/phase-05/**`;
  `.codex/graphs/{phase-05,contracts/domain-contract}.md`

This is the complete Phase 5.2 semantic contract. Consumers may translate it but
must not redefine it. No separate ADR is required because this applies the existing
authority order rather than changing an accepted cross-phase decision.

## Scope

### In scope

- one canonical `Lead` with exactly one `RENT`, `BUY`, `SELL`, or
  `CONSTRUCTION_SERVICE` intent;
- a typed intent-specific preference component;
- configurable company Lead Sources;
- append-only Activities, controlled Follow-ups, current assignment with complete
  reassignment history, responsible-Branch history, controlled stage history;
- company/branch security, privacy, audit, concurrency, and stable read models;
- optional links to an existing Party and, where allowed below, an existing Property
  or RentableSpace as intake context.

### Explicit exclusions

Phase 5.2 creates, mutates, or emulates none of: Rental/Sale/Generic Listings,
matching candidates/algorithms/scores/results, Viewings, Applications, Screening,
Reservations, Tenants, Leases, renewals, move-in, Finance records, offers, Sale Deals,
settlement, ownership transfer, commissions, `ConstructionProject`,
`ConstructionAgreement`, construction contracts/milestones/handover/payment plans/
down payments/installments, `DevelopmentProject`, blocks, plots, inventory, or
development accounting.

`MATCHING` is a V3 Lead stage only; it creates no Phase 5.3 record.
`CONSTRUCTION_SERVICE` is intake only. Conversion stores a CRM outcome/handoff
summary and never creates a Phase 10 aggregate.

## Vocabulary and aggregate

| Term               | Contract meaning                                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Lead               | Company-owned opportunity/intake record; not a person, Party subtype, listing, application, deal, or project.          |
| Intent             | Exactly one stable discriminator. Separate simultaneous needs are separate Leads, optionally linked to the same Party. |
| Preference         | Exactly one typed variant matching intent; never arbitrary key/value JSON.                                             |
| Source             | Company-configured attribution category retained historically when inactive.                                           |
| Activity           | Append-only interaction/note that occurred; not a future task.                                                         |
| Follow-up          | Future/overdue CRM task with its own lifecycle; not a delivery/job record.                                             |
| Assignment         | Exclusive current employee responsibility plus immutable intervals; orthogonal to stage.                               |
| Responsible Branch | Required operational owner and authorization dimension, preserved historically.                                        |
| Conversion         | Terminal CRM outcome; it does not itself create any later-phase entity.                                                |

CRM owns writes to Lead, preference, stage/assignment/Branch histories, Source,
Activity, and Follow-up. It only holds validated same-Company identifiers to
Organization/Employee, Party, Branch, Property, or RentableSpace and never writes
those modules.

A Lead has immutable UUIDv7-compatible identity and Company; concurrency-safe,
company-unique human number (recommended `LEAD-####`); intent and matching
preference variant; one current responsible Branch; required Source; optional
`partyId`; contact snapshot; stage/version/creator/timestamps; histories; and
terminal outcome metadata only in `CONVERTED`/`LOST`.

When no Party is linked, display name and at least one phone/email are required.
Lead contact is not canonical identity. Explicit Party linking is audited and
preserves the Lead snapshot/history; it never merges or overwrites Party data.
Phone/email and protected search tokens follow ADR 12 encryption/HMAC rules.
Raw contacts, identity secrets, documents, and free text never enter generic JSON,
logs, audit payloads, cursor tokens, or events. Hard delete is forbidden; mistaken
or duplicate intake becomes `LOST` with reason.

Intent is not a general edit field. `correctLeadIntent` may atomically replace
intent and preference only in `NEW` or `CONTACTED`, with reason, expected version,
history, and audit. From `QUALIFIED` onward, a different intent requires a new Lead;
the old Lead may close `LOST/WRONG_INTENT`.

## Typed preferences and qualification

Preferences are strict discriminated DTO/domain components. Unknown fields are
rejected. Money is non-negative decimal plus ISO 4217 currency; min ≤ max. Area is
positive decimal plus configured unit. Common optional fields are bounded
`preferredAreaText[]`, `notes`, and `desiredByDate`.

| Intent                 | Typed fields                                                                                                                                                                                                                                                                                                    | Minimum to enter `QUALIFIED`                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `RENT`                 | preferred Property/RentableSpace type codes; min/max rent, currency, rent period; min/max bedrooms/bathrooms/area + unit; move-in date; furnished preference (`REQUIRED/PREFERRED/NOT_REQUIRED/NO_PREFERENCE`); parking required; optional `rentableSpaceId` as intake context                                  | preferred area or authorized Space; max rent/currency/period; move-in date                            |
| `BUY`                  | preferred Property type codes; min/max budget + currency; min/max bedrooms/bathrooms/area + unit; target purchase date; financing readiness (`CASH_READY/FINANCE_PREAPPROVED/FINANCE_NEEDED/UNDECIDED`); optional `propertyId` as intake context                                                                | preferred area or authorized Property; max budget/currency; target purchase date                      |
| `SELL`                 | optional `propertyId`, otherwise bounded subject description/location; expected min/asking price + currency; desired sale date; seller relationship (`OWNER/AUTHORIZED_REPRESENTATIVE/OTHER_UNVERIFIED`)                                                                                                        | authorized Property or description + location; asking price/currency; desired sale date; relationship |
| `CONSTRUCTION_SERVICE` | project brief; optional site `propertyId`, otherwise site/location text; category (`NEW_BUILD/EXTENSION/RENOVATION/OTHER`); estimated min/max budget + currency; target start/completion; optional plot/floor area + unit, bedrooms/floors; site control (`OWNS_SITE/AUTHORIZED_TO_BUILD/SEEKING_SITE/UNKNOWN`) | brief; site Property or location; max budget/currency; target start                                   |

These gates establish CRM completeness only—not matching, title, financing,
screening, sale, or construction approval. References must be same-Company and
authorized. A SELL/construction Property reference proves no title or authority.

## Sources, Activities, and Follow-ups

Lead Source is a Company-level catalog with immutable ID and case-insensitive unique
immutable code; mutable label/description/sort order; `ACTIVE/INACTIVE`; version,
creator, and timestamps. Company-wide source authority manages it; authorized branch
users may read active sources for intake. New Leads require an active Source.
Referenced Sources cannot be deleted or repurposed; inactive historical Sources
remain visible with a marker. Deactivate/reactivate is reasoned, versioned, audited.

Activity types are `CALL/EMAIL/MESSAGE/MEETING/NOTE/OTHER`, with Lead, Branch
snapshot, occurred-at, `INBOUND/OUTBOUND/INTERNAL`, bounded summary/notes,
actor/recorder, recorded-at, and correlation ID. Activities are append-only and
`occurredAt` cannot be future. Correction/void appends a reasoned record referencing
the original; it never overwrites it. Stage, assignment, Branch, and Follow-up
histories remain first-class even if one detail timeline projects them together.
Terminal Leads may receive factual Activities, not new open Follow-ups.

Follow-up states are `OPEN/COMPLETED/CANCELLED`; `OVERDUE` is derived from
`OPEN && dueAt < now`. It records Lead, Branch snapshot, subject/notes, due-at,
responsible employee, state, creator, version, outcome actor/time/reason, timestamps.
Creation requires a non-terminal Lead and active same-Company employee eligible in
the responsible Branch. Legal transitions are only `OPEN -> COMPLETED` or
`OPEN -> CANCELLED`. Open reschedule uses expected version and audit. Terminal
items never reopen; create a linked successor. Entering `CONVERTED` or `LOST`
atomically cancels all open Follow-ups with system closure reason.

## Assignment and Branch semantics

Assignment is optional in `NEW`/`CONTACTED`, but required to enter
`QUALIFIED`. At most one interval is open. Each immutable interval records employee,
assigned-from/to, actor, reason, Branch snapshot, and correlation ID.

- `assign` requires none current; `reassign` closes current and opens successor
  atomically at one instant; `unassign` closes with reason.
- A `QUALIFIED/MATCHING/NURTURING` Lead cannot become unassigned unless the same
  transaction installs an eligible successor.
- Assignee must be active, same-Company, and eligible in the responsible Branch.
  Assignment grants no permission; current role/scope checks still apply.
- Later employment/Branch changes never rewrite assignment history.

Responsible Branch is required from creation. Its immutable half-open history uses
`[assignedFrom, assignedTo)`. Transfer closes/open intervals atomically and requires
authority over source and destination, reason, expected version, and audit. Current
assignee must be eligible at destination or be replaced/cleared atomically. Transfer
is prospective and never rewrites histories. Company never changes.

## Canonical lifecycle

V3 section 10 is higher/newer than
`docs/architecture/07-workflow-and-state-machine-architecture.md`. Stored/API stages
are exactly `NEW, CONTACTED, QUALIFIED, MATCHING, NURTURING, CONVERTED, LOST`.
`ASSIGNED` is assignment history, not stage. `ACTIVE_OPPORTUNITY` is absent;
V3 replaces it with explicit `MATCHING/NURTURING`. Labels may localize but values
may not alias older states.

No generic status update exists. Named transitions require permission, Company/
Branch/resource authorization, expected version, append-only stage history, and audit
in one transaction.

| From        | Allowed target        | Guard                                                                             |
| ----------- | --------------------- | --------------------------------------------------------------------------------- |
| create      | `NEW`                 | Company, Branch, active Source, matching preference discriminator, contactability |
| `NEW`       | `CONTACTED`           | Activity documents completed contact attempt/interaction                          |
| `NEW`       | `LOST`                | lost reason                                                                       |
| `CONTACTED` | `QUALIFIED`           | current assignment + intent qualification gate                                    |
| `CONTACTED` | `LOST`                | lost reason                                                                       |
| `QUALIFIED` | `MATCHING`            | `RENT/BUY` only; readiness label, creates no match                                |
| `QUALIFIED` | `NURTURING`           | reason + next open Follow-up                                                      |
| `QUALIFIED` | `CONVERTED`           | bounded outcome summary; creates no future entity                                 |
| `QUALIFIED` | `LOST`                | lost reason                                                                       |
| `MATCHING`  | `NURTURING`           | reason + next open Follow-up                                                      |
| `MATCHING`  | `CONVERTED` or `LOST` | outcome summary or lost reason                                                    |
| `NURTURING` | `QUALIFIED`           | qualification guard re-evaluated                                                  |
| `NURTURING` | `MATCHING`            | `RENT/BUY` only; qualification re-evaluated                                       |
| `NURTURING` | `CONVERTED` or `LOST` | outcome summary or lost reason                                                    |
| terminal    | none                  | renewed opportunity is a new Lead                                                 |

`SELL` and `CONSTRUCTION_SERVICE` never enter `MATCHING` in 5.2. Direct
`NEW -> QUALIFIED`, `CONTACTED -> CONVERTED`, arbitrary backward movement, and
terminal reopening are forbidden. Controlled lost codes include
`DUPLICATE/UNREACHABLE/NOT_QUALIFIED/NO_LONGER_INTERESTED/WRONG_INTENT/OUT_OF_SCOPE/OTHER`;
`OTHER` requires notes. Conversion may have non-authoritative external reference
text, but no future-phase foreign key.

## Capability and authorization

Unlinked Lead intake is not universally Service-Engagement-gated because the asset
may be unknown. Explicit asset intake consumes Phase 5.1 resolver, never duplicated
model logic:

| Reference                    | Required capability                                                             |
| ---------------------------- | ------------------------------------------------------------------------------- |
| RENT + Space                 | `canReceiveRentalLead`                                                          |
| BUY + Property               | `canReceiveBuyerLead`                                                           |
| SELL + Property              | `canReceiveSellerLead`                                                          |
| CONSTRUCTION + site Property | no construction capability exists; location context only, granting no authority |

Resolver denial rejects the asset link, not valid unlinked intake. Later Engagement
change does not rewrite history; future asset-scoped commands re-evaluate capability.
No CRM permission implies later-phase permission. Probable duplicates may warn using
protected company-scoped search, but never auto-merge or impose global contact
uniqueness.

Backend policy is deny-by-default:

`active account AND CRM permission AND access mode AND role-grant Branch scope AND Lead Branch/resource scope AND state guard`.

Every query/mutation is Company-scoped. BRANCH/MULTI_BRANCH intersect current
responsible Branch; COMPANY_WIDE remains explicit and still needs permission.
Object checks repeat on detail/actions/search/count/export/history. Source mutation
is company-wide. Linked Party/asset and assignment never widen access. Existing
shared-Party rules remain unchanged. Contact fields are masked absent sensitive-
contact permission; protected search may match without disclosure. Security owns
granular names/matrix but must separate Lead read/create/update/stage, Activity,
Follow-up, Assignment, Branch transfer, Source administration, and contact access.
Role names are never policy.

## Concurrency, history, and audit

- Lead, Follow-up, and mutable Source commands use integer expected version; stale
  writes conflict atomically. Number allocation is concurrency-safe; exposed command
  retries use approved idempotency.
- Stage, preference/intent correction, assignment, Branch transfer, terminal closure,
  and Follow-up cancellation persist atomically with history/audit.
- Native constraints/locking guarantee at most one open assignment and one open Branch
  interval under concurrency. Database owns mechanism, not semantics.
- Stage, assignment, Branch, Activity, and Follow-up outcome histories are append-only.
- Audit Lead creation, intent/preference correction, Party/asset link, stage,
  assignment changes, Branch transfer, Source lifecycle, Follow-up lifecycle,
  Activity correction, sensitive contact access/export, and policy-selected denials.
  Include safe actor/action/target/Company/Branch/time/correlation/reason/version;
  exclude contacts, identity data, and free text. Audit never replaces history.
- Optional outbox events are past-tense, schema-versioned, PII-safe, and idempotently
  consumed.

## Stable read models

All operate on complete authorized server-side data. Cursors are opaque, company/query
bound, PII-free, reset on query change, and end in immutable `id` tie-breaker.

| Workspace     | Contract                                                                                                                                                                                                        |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lead Register | `createdAt DESC,id DESC`; search number/authorized name/protected phone-email; filter Branch, intent, stage, Source, assignee/unassigned, created range, open/terminal; exact total under identical predicate.  |
| Pipeline      | Seven canonical stage groups and exact totals; row has number, safe name, intent, Source, assignee, Branch, last Activity, next Follow-up, version; within-stage `updatedAt DESC,id DESC`; no match candidates. |
| Follow-ups    | `dueAt ASC,id ASC`; Branch/employee/Lead/intent/state/derived overdue/due-today/date filters; Lead summary/current stage without N+1; exact total.                                                              |
| Lead Sources  | `sortOrder ASC,label ASC,id ASC`; active/inactive and safe usage count; active selector for branch users, lifecycle/version for admins.                                                                         |
| Lead Detail   | versioned safe summary, permissioned contact, typed preference, Source, stage/history, Branch/history, assignment/history, pageable activities/follow-ups, terminal outcome, safe Party/asset summaries.        |

No `limit=100`, current-page search, client joins/totals, per-row detail calls, raw
UUID/error leakage, or post-filter authorization. Model loading, empty,
filtered-empty, error, populated, stale, and forbidden/not-found states. If an
eventually consistent projection is used, expose freshness; commands/detail resolve
authoritative state. Historical reports retain historical Branch/assignment/Source/
intent/stage rather than current labels.

## Traceability and downstream impact

| Requirement           | Contract evidence                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| V3 BR-007/section 8   | one Lead/four intents, typed preferences, Sources, Activities, Follow-ups, assignment, pipeline |
| V3 section 10         | exact lifecycle and legal table; older conflict rejected                                        |
| BR-002/sections 11/16 | backend Company/Branch/resource/privacy policy                                                  |
| BR-018                | atomic append histories and safe audit                                                          |
| sections 12/14        | stable complete-data register/pipeline/follow-up/source/detail reads                            |
| sections 13/18        | integrity, concurrency, cursors, testable invariants                                            |
| section 20.1/graph    | 5.3+, Finance, Sales execution, Phase 10 excluded                                               |
| Phase 5.1             | resolver consumed only for explicit asset references                                            |

- Database: implement typed variants, closed stages, histories, Company/reference
  integrity, intervals, versions, numbering, protected search, indexes; reject old
  `LeadPreference(key,value Json)` and future tables.
- Security: define permission/scope matrix and test Company/Branch/mixed-grant/contact/
  Party/asset boundaries; assignment is not authorization.
- API: strict discriminated DTOs/unknown rejection, named commands, expected versions,
  stable errors/cursors/counts; no future endpoints/FKs.
- UI: Lead Register, Pipeline, Follow-ups, Sources, Detail; intent-aware fields/legal
  actions. MATCHING copy cannot claim matching ran; construction says intake/brief.
- QA: every allowed/prohibited edge, typed validation, source retirement, immutable
  corrections, follow-up/overdue, assignment/transfer concurrency, atomic terminal
  cleanup, resolver references, isolation, cursors/totals/N+1, audit redaction, and
  explicit absence of future artifacts.

## Rejected alternatives

1. Older `NEW -> ASSIGNED -> CONTACTED -> QUALIFIED -> ACTIVE_OPPORTUNITY ->
CONVERTED/LOST`: lower authority; assignment is orthogonal and V3 replaces active
   opportunity with MATCHING/NURTURING.
2. Four Lead aggregates or multiple intents per Lead: conflicts with one canonical
   Lead and makes qualification/history/reporting ambiguous.
3. Arbitrary key/value JSON preferences: cannot guarantee strict shape, indexing, or
   qualification.
4. Gating all intake on Engagement: asset can be unknown; only explicit references
   resolve capability.
5. Implementing matching because the stage exists: violates the 5.3 gate.
6. Construction project/contract/payment creation on conversion: violates Phase 10.
7. Hard delete, mutable history, terminal reopening: destroys reproducibility.
8. Assignee as authorization boundary: responsibility is not permission/scope.
9. Branch-private Source catalogs: Source is a Company reporting dimension.

## Assumptions, blockers, checklist, change log

- Assumptions requiring confirmation: none.
- Open questions/blockers: none. Changing intent cardinality, stages, qualification
  gates, responsible-Branch meaning, or exclusions reopens DOMAIN before dependents.
- Checklist: canonical Lead/intents/preferences/sources/activities/follow-ups/
  assignment/stages/Branch/security/audit/concurrency/read models/exclusions all
  defined and traced. Root approval/date/SHA remains pending.

| Version | Date       | Change                                                 |
| ------- | ---------- | ------------------------------------------------------ |
| `1.0.0` | 2026-08-25 | Initial complete Phase 5.2 contract for Root approval. |
