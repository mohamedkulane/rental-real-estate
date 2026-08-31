# Phase 5.2 CRM API contract

## Metadata

- Contract ID/version/sub-phase: `CRM-API-5.2` / `1.0.1` / Phase 5.2 CRM Foundation.
- Contract status: `APPROVED FOR IMPLEMENTATION` by Root on 2026-08-31 after complete artifact review and independent Security contract review of `14f16f0`, plus sequencing clarification `00252e2`. Feature implementation remains `BLOCKED` until the reopened DATABASE gate passes. This approval is contract-only, not implementation or Phase 5.2 PASS.
- Owner: Agent 4 Backend / API Engineer.
- Upstream contracts: `CRM-DOMAIN-5.2` v1.0.0; `CRM-DB-5.2` v1.0.0 with forward repair review pending; `CRM-AUTHZ-5.2` v1.0.1, source `7539d28151b683c7a542a1be9dc90b6e96398f6b`, approved by Root and integrated at `1dbe3d9` on 2026-08-30. API v1.0.0 was approved by Root and committed separately as `088b9a41c71d7d7bdd5f1992f78bd04e251f0387`.
- Consumers: Web, Security Review, QA, UX, Adversarial, Governance, and Root.
- Canonical references: canonical V3 BR-002/007/018 and CRM sections 8, 10-14, 16-18, 20.1-22; ADR 12; Phase 5.1 capability resolver; this run's approved domain/database/authorization contracts.
- Base path and media: `/api/v1`; JSON. Only fields explicitly listed for each DTO are accepted. In particular clients cannot set Company, stage, stored history, creator/actor, protected contact fields, or persistence timestamps. Creation explicitly accepts responsible Branch and optional initial assignee; transfer/assignment use only their named command inputs below.

## Endpoint catalog

All Lead-child routes first resolve the Lead by trusted session Company and then apply its current responsible Branch. Activity, Follow-up, and assignment reads require BOTH `crm.lead.read` AND their exact collection-read permission, each effective in the SAME current Lead Branch. The global Follow-up workspace uses this same two-permission Branch-set intersection for rows, Lead summaries, filters, totals, and cursor binding. Action permissions do not imply read. Successful mutable commands return only `{id,version}`; append-only Activity commands return only `{id}`. UI refreshes a GET only when independently permitted. Mutation DTOs use `expectedVersion` for mutable aggregates and bounded reason text where shown.

| Method/path | Purpose | Permission/resource check | Request DTO / principal response | Audit |
| --- | --- | --- | --- | --- |
| `GET /crm/leads` | Lead Register | `crm.lead.read`; authorized Branch intersection | Query `limit<=50,cursor,search,branchId[],stage[],intent[],sourceId[],assigneeEmployeeId,createdFrom,createdTo`; `{items,pageInfo,totalCount}` | none |
| `GET /crm/pipeline` | Stage-grouped pipeline | `crm.lead.read`; same final predicate as register | `PipelineQuery` below; independently paged `groups` plus exact `stageTotals`/`totalCount` | none |
| `POST /crm/leads` | Create `NEW` Lead and typed preference | `crm.lead.create` in responsible Branch; initial assignee additionally requires `crm.assignment.manage`; Source/reference checks | `CreateLeadDto`; `{id,version}` | `crm.lead.created` plus assignment/link audits when applicable |
| `GET /crm/leads/:leadId` | Lead detail/read model | `crm.lead.read` in current Branch | safe detail; masked contact by default, raw only with conjunctive contact permission | raw reveal only: `crm.lead.contact.revealed` |
| `PATCH /crm/leads/:leadId` | Correct display name, Source, contact snapshot, or same-intent preference | `crm.lead.update` in current Branch | `UpdateLeadDto {expectedVersion,reason,...}`; `{id,version}` | `crm.lead.updated` plus asset link/unlink audits when applicable |
| `POST /crm/leads/:leadId/intent-correction` | Replace intent and typed preference in `NEW/CONTACTED` | `crm.lead.update` | `{expectedVersion,intent,preference,reason}` | `crm.lead.intent-corrected` |
| `POST /crm/leads/:leadId/party-link` / `party-unlink` | Explicit Party linking/unlinking | `crm.lead.update` plus `party.read` for link, Lead scope first | `{expectedVersion,partyId,reason}` / `{expectedVersion,reason}` | `crm.lead.party-linked/unlinked` |
| `POST /crm/leads/:leadId/contacted` | `NEW -> CONTACTED` | `crm.lead.stage`; qualifying completed contact Activity must exist | `{expectedVersion,activityId,reason?}` | `crm.lead.stage-transitioned` |
| `POST /crm/leads/:leadId/qualified` | `CONTACTED/NURTURING -> QUALIFIED` | `crm.lead.stage`; assignment and typed qualification gate | `{expectedVersion,reason?}` | same |
| `POST /crm/leads/:leadId/matching` | `QUALIFIED/NURTURING -> MATCHING` | `crm.lead.stage`; RENT/BUY and qualification re-check | `{expectedVersion,readinessLabel,reason?}` | same; label excluded from audit |
| `POST /crm/leads/:leadId/nurturing` | `QUALIFIED/MATCHING -> NURTURING` | `crm.lead.stage`; referenced next OPEN Follow-up | `{expectedVersion,followUpId,reason}` | same |
| `POST /crm/leads/:leadId/converted` | legal active stage -> `CONVERTED` | `crm.lead.stage` | `{expectedVersion,outcomeSummary,externalReference?}` | transition plus per-item system Follow-up cancellation audits |
| `POST /crm/leads/:leadId/lost` | legal nonterminal stage -> `LOST` | `crm.lead.stage` | `{expectedVersion,lostReason,lostNotes?}`; `OTHER` requires notes | transition plus per-item system Follow-up cancellation audits |
| `GET /crm/leads/:leadId/history` | Stage/intent/Branch history | `crm.lead.read` | opaque cursor timeline | none |
| `GET /crm/leads/:leadId/activities` | Activity timeline | `crm.lead.read` AND `crm.activity.read` in same current Branch | `limit<=50,cursor,type,direction`; `Page<Activity>` | none |
| `POST /crm/leads/:leadId/activities` | Append factual Activity | `crm.activity.create` | `{type,direction,summary,notes?,occurredAt}` | append evidence; no generic sensitive audit required |
| `POST /crm/leads/:leadId/activities/:activityId/correction` / `void` | Append correction or void | `crm.activity.correct`; child must belong to Lead/Company | `{type,direction,summary,notes?,occurredAt,reason}` / `{reason}`; `{id}` | `crm.activity.corrected/voided` |
| `GET /crm/follow-ups` | Follow-up workspace | `crm.lead.read` AND `crm.followup.read`; intersect current-Branch scopes | `FollowUpQuery`; `Page<FollowUp>` | none |
| `GET /crm/leads/:leadId/follow-ups` | Lead Follow-ups | `crm.lead.read` AND `crm.followup.read` in same current Branch | same subset/order/page semantics | none |
| `POST /crm/leads/:leadId/follow-ups` | Create OPEN Follow-up | `crm.followup.create`; nonterminal Lead and eligible employee | `{subject,notes?,dueAt,responsibleEmployeeId,predecessorFollowUpId?}` | `crm.followup.created` |
| `PATCH /crm/leads/:leadId/follow-ups/:followUpId` | Reschedule/correct OPEN Follow-up | `crm.followup.update`; child ownership and CURRENT Lead Branch | `{expectedVersion,reason,subject?,notes?,dueAt?}`; responsibility is immutable | `crm.followup.updated` |
| `POST /crm/leads/:leadId/follow-ups/:followUpId/complete` | `OPEN -> COMPLETED` | `crm.followup.complete` | `{expectedVersion,reason}` | `crm.followup.completed` |
| `POST /crm/leads/:leadId/follow-ups/:followUpId/cancel` | `OPEN -> CANCELLED` | `crm.followup.cancel` | `{expectedVersion,reason}` | `crm.followup.cancelled` |
| `GET /crm/leads/:leadId/assignments` | Assignment history | `crm.lead.read` AND `crm.assignment.read` in same current Branch | `Page<Assignment>` | none |
| `POST /crm/leads/:leadId/assign` | Install first current assignee | `crm.assignment.manage` | `{expectedVersion,employeeId,reason}` | `crm.lead.assigned` |
| `POST /crm/leads/:leadId/reassign` | Close current/open successor at one instant | `crm.assignment.manage` | `{expectedVersion,employeeId,reason}` | `crm.lead.reassigned` |
| `POST /crm/leads/:leadId/unassign` | Close current assignment | `crm.assignment.manage`; rejected for qualified active stages | `{expectedVersion,reason}` | `crm.lead.unassigned` |
| `POST /crm/leads/:leadId/branch-transfer` | Prospective responsible Branch transfer | `crm.lead.branch.transfer` over source and destination | `{expectedVersion,destinationBranchId,reason,replacementEmployeeId?,clearAssignee?}`; replacement and explicit clear are mutually exclusive | `crm.lead.branch-transferred` |
| `GET /crm/lead-sources/options` | Active intake selector | `crm.source.read` and at least one effective Branch grant | `limit<=50,cursor,search`; `Page<SourceOption>` | none |
| `GET /crm/lead-sources` | Full Source workspace | company-wide `crm.source.manage` | `limit<=50,cursor,search,status`; exact total/usage count | none |
| `POST /crm/lead-sources` | Create Source | company-wide `crm.source.manage` | `{code,label,description?,sortOrder?}` | `crm.source.created` |
| `PATCH /crm/lead-sources/:sourceId` | Update non-code metadata | company-wide `crm.source.manage` | `{expectedVersion,label?,description?,sortOrder?}` | `crm.source.updated` |
| `POST /crm/lead-sources/:sourceId/deactivate` / `reactivate` | Source lifecycle | company-wide `crm.source.manage` | `{expectedVersion,reason}` | `crm.source.deactivated/reactivated` |
| `GET /crm/selectors/branches` | Workflow-scoped Branch selector | exact server-mapped purpose formula below | `BranchSelectorQuery`; `Page<BranchOption>` | none |
| `GET /crm/selectors/employees` | Workflow-scoped eligible employee selector | exact server-mapped purpose formula below | `EmployeeSelectorQuery`; `Page<EmployeeSummary>` | none |
| `GET /crm/selectors/parties` | Safe existing Party link selector | CRM create/update purpose AND existing independent `party.read` scope | `ReferenceSelectorQuery`; `Page<PartySummary>` | none |
| `GET /crm/selectors/properties` | Safe BUY/SELL/site Property context selector | CRM purpose AND `portfolio.property.read`, plus applicable capability-read scope | `ReferenceSelectorQuery`; `Page<PropertyOption>` | none |
| `GET /crm/selectors/spaces` | Safe RENT Space context selector | CRM purpose AND `portfolio.property.read` AND `portfolio.space.read` AND `service-engagement.capability.read` | `ReferenceSelectorQuery`; `Page<SpaceOption>` | none |

No Phase 5.2 raw-contact export endpoint is exposed. `crm.lead.contact.export` is seeded and reserved for a separately approved purpose/step-up/export design. No generic stage/status route exists.

## DTO and serialization contract

- `CreateLeadDto`: `intent`, `sourceId`, `responsibleBranchId`, optional `currentAssigneeEmployeeId` and `partyId`, `displayName`, optional `phone`/`email`, and exactly one typed `preference` selected by the sibling `intent`. An initial assignment additionally requires `crm.assignment.manage` in that Branch. Without Party, display name and at least one contact are required. Unknown/cross-variant fields are rejected; strings trim, empty nullable text becomes null; enum values remain canonical. Concrete types below are normative.
- Preference common fields: `preferredAreaText` (bounded unique trimmed strings), `notes`, `desiredByDate`. RENT/BUY/SELL/CONSTRUCTION variants expose only fields in `CRM-DOMAIN-5.2`; monetary strings are canonical non-negative decimals with ISO-4217 uppercase currency, ranges are ordered, dates are ISO dates, instants ISO-8601, and area is positive with unit. Cross-variant/unknown fields fail validation.
- Explicit RENT Space and BUY/SELL Property links invoke the Phase 5.1 resolver using the current business date and require `canReceiveRentalLead`, `canReceiveBuyerLead`, or `canReceiveSellerLead`. Asset scope additionally requires `portfolio.property.read`, `portfolio.space.read` for Space, and `service-engagement.capability.read` for RENT/BUY/SELL. Construction Property is independently authorized location context only, with no invented capability. Party links retain the existing same-Company `party.read` shared-Party scope rule; CRM authority is never a substitute.
- Lead list/pipeline/detail return `contact: {phoneMasked,emailMasked,hasPhone,hasEmail}`. Detail may additionally return raw `phone/email` only when `crm.lead.read` and `crm.lead.contact.read` are both effective in the Lead Branch; every reveal is transactionally audited. Ciphertext, HMAC, key version, free-text audit fields, and null-vs-forbidden internals are never serialized.
- Activity, Follow-up, assignment, Branch, Source, Party, employee, Property, and Space summaries use explicit safe selectors. Assignment does not imply access. Historical Source remains labelled inactive in an authorized Lead even when absent from selector options.

## Authorization map

- Exact independent permissions: `crm.lead.read/create/update/stage`, `crm.activity.read/create/correct`, `crm.followup.read/create/update/complete/cancel`, `crm.assignment.read/manage`, `crm.lead.branch.transfer`, `crm.source.read/manage`, `crm.lead.contact.read/export` (19 total). Controller metadata and service checks both apply where resource/conjunctive checks are required.
- Deny formula: active session AND exact permission AND employee access mode AND role-grant permission scope AND current Lead Branch/resource scope AND command state guard. Runtime never checks role names and has no implicit super-admin bypass.
- Every repository predicate includes trusted `principal.companyId`. Requested Branches are intersected with `AuthorizationService.authorizedBranchIds`; an empty intersection returns an empty list/count, never a broader query. A company-wide result requires access mode `COMPANY_WIDE` and an explicit null permission scope.
- For child/workspace reads, compute the intersection of the Lead-read Branch set and the exact collection-read Branch set before querying; a grant for one in A and another in B does not combine. Selector purposes use their own closed formulas below, never a global OR of unrelated grants.
- Transfer authorizes both stored source and validated destination before mutation. Source management requires `assertCompanyPermission`. Contact reveal is conjunctive; export would require all three explicit company-level grants.
- Cross-Company/undiscoverable IDs return stable 404. After same-Company resolution, missing action/Branch permission returns stable 403 without version/stage/assignee/eligibility detail. State and expected-version validation occurs only after resource authorization.

## Command behavior

- Every multi-row command runs in one Prisma interactive transaction, obtains a row lock for the Lead (and Follow-up/Source where applicable), re-loads by trusted Company, compares `expectedVersion`, mutates via compare-and-swap, appends required immutable history, and writes allowlisted audit before commit. Failure rolls back all effects.
- Duplicate/retried stale commands return conflict; no command silently succeeds twice. A future idempotency-key contract is not invented. `expectedVersion` mismatch is `CRM_VERSION_CONFLICT` / HTTP 409.
- Intent correction closes current preference at one instant, creates the matching next preference version and intent history, changes Lead intent/version, validates capability/reference, and audits atomically.
- Terminal transition cancels every OPEN Follow-up in the same transaction, increments each Follow-up version, appends a `CANCELLED` outcome with a system-terminal reason/actor, and writes redacted audit entries. Any failure rolls back the stage transition.
- Follow-up responsibility, historical Branch, Lead, creator, creation instant, and predecessor are immutable. PATCH rejects `responsibleEmployeeId` and `branchId` as unknown fields. Change responsibility through a new Follow-up carrying `predecessorFollowUpId` and the existing explicit cancel command; each request independently requires its create/cancel permission and version/eligibility checks. For a NURTURING Lead's last OPEN Follow-up, create the authorized, eligible linked successor FIRST, then cancel the predecessor: cancelling first can fail because the Lead must retain an OPEN next task. The linked successor may reference that still-OPEN same-Lead predecessor; creation must not require it to be terminal. Alternatively, preserve another OPEN Follow-up throughout. There is no implicit reassignment, hidden combined command, or bypass of the NURTURING invariant. Historical employee deactivation/Branch change and Lead transfer must not strand reschedule/outcome/terminal cancellation; current actor authority is checked against the CURRENT Lead Branch, never old employee eligibility. This aligns existing domain rules, not a new lifecycle.
- All mutable successes are exactly `{id,version}` and append-only successes `{id}`. No detail/contact/history/assignment or outcome text is echoed. Transfer does not perform a read under its old source grant. A valid write cannot become a misleading failure because an optional read is unavailable; the client separately reads only when permitted.
- Assignment, reassignment, transfer, preference intervals, and Branch history use a shared transaction timestamp so half-open intervals meet exactly. Transfer validates destination employee eligibility or performs the requested replacement/clear atomically; it never rewrites history.
- Errors use the existing API exception envelope with stable codes/messages: 400 `CRM_VALIDATION_FAILED`, `CRM_ILLEGAL_TRANSITION`, `CRM_QUALIFICATION_REQUIRED`, `CRM_CAPABILITY_DENIED`, `CRM_INELIGIBLE_EMPLOYEE`; 403 `CRM_FORBIDDEN`; 404 `CRM_NOT_FOUND`; 409 `CRM_VERSION_CONFLICT`, `CRM_SOURCE_CODE_CONFLICT`; 429 `CRM_SEARCH_RATE_LIMITED`. Database/internal text and protected values are never returned.

## Read model behavior

- Register ordering is `(createdAt DESC,id DESC)`; pipeline cards `(updatedAt DESC,id DESC)`; Follow-ups `(dueAt ASC,id ASC)`; Sources `(sortOrder ASC,label ASC,id ASC)`; timelines use the documented timestamp DESC plus `id DESC`. All are strict keyset orderings.
- Cursor is an opaque integrity-protected token, bound server-side to model kind, strict ordering tuple, normalized filter hash, trusted Company, and every effective permission scope in the conjunction. Ordering identifiers are not client-decodable: use an authenticated-encrypted cursor payload or opaque server-held handle, not merely signed base64 JSON exposing IDs. No contact/search/free text, contact-derived token, or raw authorization detail appears in the cursor. Malformed, wrong-kind, filter-changed, tampered, or stale-scope cursor returns 400; a scope change can only reject continuation and cannot leak prior records.
- `limit` defaults to 25 and maxes at 50. Fetch is `limit+1`; no `limit=100`, load-all, offset, or current-page-only search. Search is trimmed/case-insensitive over Lead number/display name and safe Source/employee labels; an exact normalized phone/email query adds only the Company-scoped HMAC token predicate. Search never logs/audits the raw term and applies Company/Branch scope before materialization.
- Filters are conjunctive; multi-value filters are OR within their field. Date ranges are inclusive lower/exclusive upper. Derived Follow-up `OVERDUE` is `OPEN && dueAt < server now`; it is never persisted. `totalCount` and pipeline stage totals use exactly the same authorized/filter predicate as items, excluding only page cursor.
- Query budgets (constant by page size): register <=3 SQL statements (items/count/contact-reveal audit batch when applicable); pipeline <=4 (cards/totals plus optional audit); detail <=8 including bounded/batched summary collections; Follow-up workspace <=3; Source workspace <=3; timelines <=2. No parent-list/detail-per-row query is permitted; all relations use joined selectors or fixed batched `IN` queries. Integration tests instrument Prisma query events and compare 1-row versus full-page counts.

## Audit allowlist

Audit includes actor ID, action, target type/ID, trusted Company ID in the safe audit context, old/new Branch IDs where applicable, timestamp/correlation, bounded reason/lifecycle code, and before/after version. It excludes names, contact, contact/search tokens, search text, preference/activity/follow-up free text, outcome narrative, external reference, and documents. Required actions are the endpoint entries above plus asset links/unlinks caused by preference corrections, raw reveal, and each automatic terminal cancellation.

User-entered `reason` is domain-history text, not a safe audit reason code. Generic audit stores a fixed action/reason code and version/identity allowlist; it must not copy arbitrary request reason text, names, Source labels/descriptions, or free-text fields. Contact-reveal audit must commit before a response contains plaintext.

## Concrete wire contract (v1.0.1, normative)

These are JSON shapes, expressed with TypeScript notation for precision. `UUID` is a UUID string (including UUIDv7), `Instant` an ISO-8601 UTC timestamp, `DateOnly` exactly `YYYY-MM-DD`, and `DecimalString` a base-10 non-exponential decimal string. Nullable response fields are present with `null` unless explicitly described as permission-omitted. `?` in request types means omission is permitted, not that arbitrary null is accepted. Empty-string/whitespace handling never bypasses required-field rules.

```ts
type LeadIntent = 'RENT' | 'BUY' | 'SELL' | 'CONSTRUCTION_SERVICE';
type LeadStage = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'MATCHING'
  | 'NURTURING' | 'CONVERTED' | 'LOST';
type PageInfo = { hasNextPage: boolean; nextCursor: string | null };
type Page<T> = { items: T[]; pageInfo: PageInfo; totalCount: number };
type MutationAck = { id: UUID; version: number };
type AppendAck = { id: UUID };
type VersionedReason = { expectedVersion: number; reason: string };

type BranchOption = { id: UUID; code: string; name: string; active: boolean };
type EmployeeSummary = { id: UUID; employeeNumber: string; displayName: string };
type SourceOption = { id: UUID; code: string; label: string };
type SourceSummary = SourceOption & { status: 'ACTIVE' | 'INACTIVE' };
type PartySummary = { id: UUID; partyNumber: string; displayName: string; active: boolean };
type PropertySummary = { id: UUID; propertyCode: string; name: string };
type SpaceSummary = { id: UUID; spaceCode: string; name: string; propertyId: UUID };
type ContactMask = {
  hasPhone: boolean; hasEmail: boolean;
  phoneMasked: string | null; emailMasked: string | null;
};
type LeadSummary = {
  id: UUID; leadNumber: string; displayName: string; intent: LeadIntent;
  stage: LeadStage; version: number; createdAt: Instant; updatedAt: Instant;
  responsibleBranch: BranchOption;
  currentAssignee: EmployeeSummary | null;
  source: SourceSummary;
  contact: ContactMask;
};
type LeadDetail = LeadSummary & {
  preference: PreferenceResponse;
  party: PartySummary | null;
  property: PropertySummary | null;
  rentableSpace: SpaceSummary | null;
  lostReason: LostReason | null; lostNotes: string | null;
  outcomeSummary: string | null; externalReference: string | null;
  contact: ContactMask & { phone?: string | null; email?: string | null };
};
```

`GET /crm/leads` is `Page<LeadSummary>`. Detail has no embedded Activities, Follow-ups, assignment collection, or counts that would bypass their read conjunction; those use their separately authorized endpoints. `phone`/`email` keys exist only on an independently authorized, audited detail reveal; they are absent from lists, pipeline, selectors, child records, and all mutation acknowledgements even for a contact-authorized actor. `party`, `property`, `rentableSpace`, and corresponding preference link IDs are null/redacted if the linked resource is no longer independently readable; no raw stored foreign key leaks through another representation.

### Lead and preference request types

```ts
type CreateLeadInput = {
  intent: LeadIntent; sourceId: UUID; responsibleBranchId: UUID;
  currentAssigneeEmployeeId?: UUID; partyId?: UUID;
  displayName: string; phone?: string; email?: string;
  preference: PreferenceFields; // variant selected by sibling intent
};
type UpdateLeadInput = VersionedReason & {
  sourceId?: UUID; displayName?: string; phone?: string | null;
  email?: string | null; preference?: PreferenceFields;
};
type CorrectIntentInput = VersionedReason & {
  intent: LeadIntent; preference: PreferenceFields;
};
type CommonPreference = {
  preferredAreaText?: string[]; notes?: string; desiredByDate?: DateOnly;
};
type AreaUnit = 'SQM' | 'SQFT' | 'HECTARE' | 'ACRE';
type RentFields = CommonPreference & {
  propertyTypeCodes?: string[]; rentableSpaceTypeCodes?: string[];
  minRent?: DecimalString; maxRent?: DecimalString; currency?: string;
  rentPeriod?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  minBedrooms?: number; maxBedrooms?: number;
  minBathrooms?: DecimalString; maxBathrooms?: DecimalString;
  minArea?: DecimalString; maxArea?: DecimalString; areaUnit?: AreaUnit;
  moveInDate?: DateOnly;
  furnishedPreference?: 'REQUIRED' | 'PREFERRED' | 'NOT_REQUIRED' | 'NO_PREFERENCE';
  parkingRequired?: boolean; rentableSpaceId?: UUID;
};
type BuyFields = CommonPreference & {
  propertyTypeCodes?: string[]; minBudget?: DecimalString; maxBudget?: DecimalString;
  currency?: string; minBedrooms?: number; maxBedrooms?: number;
  minBathrooms?: DecimalString; maxBathrooms?: DecimalString;
  minArea?: DecimalString; maxArea?: DecimalString; areaUnit?: AreaUnit;
  targetPurchaseDate?: DateOnly;
  financingReadiness?: 'CASH_READY' | 'FINANCE_PREAPPROVED' | 'FINANCE_NEEDED' | 'UNDECIDED';
  propertyId?: UUID;
};
type SellFields = CommonPreference & {
  propertyId?: UUID; subjectDescription?: string; subjectLocation?: string;
  expectedMinPrice?: DecimalString; askingPrice?: DecimalString; currency?: string;
  desiredSaleDate?: DateOnly;
  sellerRelationship?: 'OWNER' | 'AUTHORIZED_REPRESENTATIVE' | 'OTHER_UNVERIFIED';
};
type ConstructionFields = CommonPreference & {
  projectBrief: string; category: 'NEW_BUILD' | 'EXTENSION' | 'RENOVATION' | 'OTHER';
  propertyId?: UUID; siteLocation?: string;
  estimatedMinBudget?: DecimalString; estimatedMaxBudget?: DecimalString;
  currency?: string; targetStartDate?: DateOnly; targetCompletionDate?: DateOnly;
  plotArea?: DecimalString; floorArea?: DecimalString; areaUnit?: AreaUnit;
  bedrooms?: number; floors?: number;
  siteControl?: 'OWNS_SITE' | 'AUTHORIZED_TO_BUILD' | 'SEEKING_SITE' | 'UNKNOWN';
};
type PreferenceFields = RentFields | BuyFields | SellFields | ConstructionFields;
// Response is FLAT: no rent/buy/sell/constructionService nested ORM records.
// Arrays default []; absent optional scalar values serialize null.
type PreferenceValues<T> = {
  [K in keyof T]-?: Exclude<T[K], undefined> extends readonly unknown[]
    ? Exclude<T[K], undefined>
    : undefined extends T[K] ? Exclude<T[K], undefined> | null : T[K];
};
type PreferenceResponse =
  | ({ intent: 'RENT' } & PreferenceValues<RentFields>)
  | ({ intent: 'BUY' } & PreferenceValues<BuyFields>)
  | ({ intent: 'SELL' } & PreferenceValues<SellFields>)
  | ({ intent: 'CONSTRUCTION_SERVICE' } & PreferenceValues<ConstructionFields>);
type LostReason = 'DUPLICATE' | 'UNREACHABLE' | 'NOT_QUALIFIED'
  | 'NO_LONGER_INTERESTED' | 'WRONG_INTENT' | 'OUT_OF_SCOPE' | 'OTHER';
```

`PreferenceResponse` uses the same field names as its request variant, with all variant fields present (optional scalar request fields become nullable response fields). No preference row ID, actor ID, correlation ID, or history interval is embedded. Updating `preference` replaces the complete current typed component through a new immutable preference version; omission leaves it unchanged. Asset linking/unlinking is explicit through that replacement and audited. UI must not resubmit a scope-redacted link as an intentional unlink; asset edits require independent reference authority and an explicit user decision.

Branch transfer retains the current assignee by default and requires that employee to remain eligible at destination. `replacementEmployeeId` installs an eligible successor. `clearAssignee:true` explicitly requests clearing under the already-approved stage guard; it is rejected for QUALIFIED/MATCHING/NURTURING. Replacement and clear cannot be supplied together. An ineligible current assignee is not silently cleared. These fields encode the existing retain/replace/clear domain choice, not an additional transfer permission or lifecycle.

Bounds: display name 1-240 trimmed characters; phone 5-80; email valid and <=254; generic command reason 3-500; common preference notes <=1000; preferred areas <=20 unique nonempty strings <=120 each; type-code arrays <=20 entries <=80 each. Money uses non-negative precision <=20/scale <=4 plus an uppercase valid ISO-4217 currency, ranges min<=max. Area uses positive precision <=20/scale <=6 plus AreaUnit. Bathrooms use non-negative precision <=4/scale <=1; integer room/floor values are non-negative. SELL description <=500, location <=300; construction brief 3-2000 and site location <=300. Optional fields do not waive the approved intent-specific qualification gates. Date ranges and stage prerequisites are evaluated server-side, after resource authorization.

### Query encoding and independent pipeline pages

```ts
type PageQuery = { limit?: number; cursor?: string }; // default25, max50
type LeadQuery = PageQuery & {
  search?: string; branchId?: UUID[]; stage?: LeadStage[]; intent?: LeadIntent[];
  sourceId?: UUID[]; assigneeEmployeeId?: UUID;
  createdFrom?: DateOnly; createdTo?: DateOnly;
};
type PipelineQuery = LeadQuery & { pipelineStage?: LeadStage };
type PipelineResponse = {
  groups: Partial<Record<LeadStage, Page<LeadSummary>>>;
  stageTotals: Record<LeadStage, number>;
  totalCount: number;
};
```

Wire arrays use repeated UNBRACKETED keys, e.g. `?stage=NEW&stage=CONTACTED&branchId=<uuid>&limit=25`; a single key is normalized to a one-element array. Empty arrays are represented by omission. Bracket-key and comma-delimited aliases are not part of the API. Unknown query fields are rejected. Filter arrays are normalized/deduplicated/sorted before cursor binding; search is trimmed and case-normalized. Search length <=120; Branch/Source arrays <=50 entries, stage <=7, intent <=4. Lower date bounds are inclusive and upper bounds exclusive.

- Initial `GET /crm/pipeline?...baseFilters&limit=25` returns all seven group keys. Each contains its own first page, its exact filtered stage count, and its own opaque next cursor. A stage excluded by the `stage` filter is present as an empty zero-count group. Limit applies PER group, never to a global page subsequently grouped.
- Advance one group with `GET /crm/pipeline?...sameBaseFilters&limit=25&pipelineStage=NEW&cursor=<NEW-nextCursor>`. Response `groups` contains only `NEW`; the UI replaces/appends that lane and retains other lanes. `pipelineStage` without a cursor requests that lane's first page.
- A cursor without `pipelineStage` is invalid. A cursor from one lane cannot be used for another lane/register/filter/scope. `pipelineStage` controls page selection only; it does NOT alter `stageTotals` or global `totalCount`.
- `stageTotals` always has all seven keys and exact counts under the base filters and authorized predicate; `totalCount` is their sum. There is no global pipeline `items` or `pageInfo` field. Cards order `(updatedAt DESC,id DESC)` independently in each lane.
- Register order remains `(createdAt DESC,id DESC)`. Strict keyset comparison includes both timestamp and UUID tie-breaker, including timestamp ties. Cursors retain sufficient database precision to avoid skipped equal-instant records; no offset pagination or raw-ID cursor fallback.

### Activities, Follow-ups, assignments, history, and Sources

```ts
type Activity = {
  id: UUID; branchId: UUID;
  type: 'CALL' | 'EMAIL' | 'MESSAGE' | 'MEETING' | 'NOTE' | 'OTHER';
  direction: 'INBOUND' | 'OUTBOUND' | 'INTERNAL';
  recordKind: 'ORIGINAL' | 'CORRECTION' | 'VOID';
  summary: string; notes: string | null; occurredAt: Instant; recordedAt: Instant;
  originalActivityId: UUID | null; correctionReason: string | null;
};
type FollowUpState = 'OPEN' | 'COMPLETED' | 'CANCELLED';
type FollowUpDerivedStatus = FollowUpState | 'OVERDUE';
type FollowUp = {
  id: UUID; leadId: UUID; branchId: UUID; responsibleEmployeeId: UUID;
  subject: string; notes: string | null; dueAt: Instant;
  state: FollowUpState; derivedStatus: FollowUpDerivedStatus; version: number;
  createdAt: Instant; updatedAt: Instant;
  outcomeAt: Instant | null; outcomeReason: string | null;
  predecessorFollowUpId: UUID | null;
  lead: { id: UUID; leadNumber: string; displayName: string; stage: LeadStage };
  responsibleEmployee: EmployeeSummary;
};
type FollowUpQuery = PageQuery & {
  search?: string; branchId?: UUID[]; state?: FollowUpState[];
  derivedStatus?: FollowUpDerivedStatus; dueFrom?: Instant; dueTo?: Instant;
  responsibleEmployeeId?: UUID; leadId?: UUID;
};
type FollowUpPage = Page<FollowUp> & { asOf: Instant };
type Assignment = {
  id: UUID; branchId: UUID; employeeId: UUID;
  assignedFrom: Instant; assignedTo: Instant | null; reason: string;
  employee: EmployeeSummary;
};
type HistoryEntry =
  | { id: UUID; kind: 'STAGE'; occurredAt: Instant; fromStage: LeadStage | null;
      toStage: LeadStage; reason: string | null; leadVersion: number }
  | { id: UUID; kind: 'INTENT'; occurredAt: Instant; fromIntent: LeadIntent | null;
      toIntent: LeadIntent; reason: string; leadVersion: number }
  | { id: UUID; kind: 'BRANCH'; occurredAt: Instant; branchId: UUID;
      assignedFrom: Instant; assignedTo: Instant | null; reason: string };
type Source = SourceSummary & {
  description: string | null; sortOrder: number; version: number;
  createdAt: Instant; updatedAt: Instant; usageCount: number;
};
```

All collection endpoints return `Page<T>` with exact `totalCount`; Follow-up endpoints return `FollowUpPage`. Follow-up `branchId` is historical attribution, while authorization uses its Lead's current Branch. `derivedStatus` is computed at the response's `asOf`; an OPEN item due before that instant is OVERDUE, otherwise OPEN. `state=OPEN` includes overdue items; `derivedStatus=OPEN` excludes overdue items. If both filters are supplied they are conjunctive, not overrides. An opaque continuation preserves its first-page `asOf`; starting a new query refreshes it. No `DUE_TODAY`, `UPCOMING`, persisted OVERDUE, or reopen transition is invented.

Activity query adds optional `type`/`direction`; order `(occurredAt DESC,id DESC)`. Correction requires the complete factual Activity fields plus reason; void accepts only reason and appends a VOID record. Assignment order is `(assignedFrom DESC,id DESC)`. Unified Lead history includes only stage/intent/Branch records, ordered `(occurredAt DESC,id DESC,kind DESC)`; Branch `occurredAt=assignedFrom`. Activities, Follow-ups, and assignments are not smuggled into this Lead-read-only endpoint.

Source admin query is `PageQuery & {search?:string,status?:'ACTIVE'|'INACTIVE'}`; response `Page<Source>`. `usageCount` is an exact same-Company Lead count, not `_count` or a current-page count. Source options query is `PageQuery & {search?:string}`; response `Page<SourceOption>`, ACTIVE only. Both use `(sortOrder ASC,label ASC,id ASC)`; code/label search is case-insensitive. `CreateSourceInput={code,label,description?,sortOrder?}`, `UpdateSourceInput={expectedVersion,label?,description?:string|null,sortOrder?}`; code never appears in update. Code is trimmed/case-normalized for immutable Company-unique attribution (2-50 uppercase letters/digits/underscore, beginning with a letter), label 1-120, description <=500, sortOrder a non-negative integer. All Source mutations return `MutationAck`.

### Purpose-scoped selector DTOs and permission formulas

Every selector is searched/paged server-side (`search<=120`, default limit25/max50), returns `Page<T>` with exact authorized totals, and binds its cursor to purpose/context/Company/effective scope/search. No selector loads the entire directory. Query purpose is required and closed; arbitrary permission strings or unknown purpose values are rejected. The `P(permission,Branch)` notation means the existing exact permission + employee access + role-grant scope conjunction.

```ts
type BranchSelectorPurpose = 'LEAD_REGISTER' | 'PIPELINE' | 'FOLLOW_UPS'
  | 'CREATE_LEAD' | 'TRANSFER_LEAD';
type BranchSelectorQuery = PageQuery & {
  purpose: BranchSelectorPurpose; search?: string; leadId?: UUID;
};
type EmployeeSelectorPurpose = 'ASSIGNMENT_READ' | 'ASSIGN_LEAD' | 'REASSIGN_LEAD'
  | 'CREATE_FOLLOW_UP' | 'INITIAL_ASSIGNMENT' | 'TRANSFER_REPLACEMENT';
type EmployeeSelectorQuery = PageQuery & {
  purpose: EmployeeSelectorPurpose; search?: string;
  leadId?: UUID; branchId?: UUID; destinationBranchId?: UUID;
};
type ReferenceSelectorQuery = PageQuery & {
  purpose: 'CREATE_LEAD' | 'UPDATE_LEAD'; search?: string;
  leadId?: UUID; branchId?: UUID; intent?: LeadIntent; propertyId?: UUID;
};
type PropertyOption = PropertySummary & {
  capability: 'canReceiveBuyerLead' | 'canReceiveSellerLead' | null;
  capabilityAllowed: boolean | null;
};
type SpaceOption = SpaceSummary & {
  capability: 'canReceiveRentalLead'; capabilityAllowed: boolean;
};
```

| Selector purpose | Required context | Exact actor formula / result rule |
| --- | --- | --- |
| Branch `LEAD_REGISTER` / `PIPELINE` | no Lead/body Branch accepted | `P(crm.lead.read,offeredBranch)`; authorized inactive Branches may appear with `active:false` |
| Branch `FOLLOW_UPS` | no Lead/body Branch accepted | `P(crm.lead.read,offeredBranch) AND P(crm.followup.read,offeredBranch)` |
| Branch `CREATE_LEAD` | no Lead/body Branch accepted | `P(crm.lead.create,offeredBranch)`; active same-Company Branches only |
| Branch `TRANSFER_LEAD` | `leadId` required | resolve stored source first, then `P(crm.lead.branch.transfer,source) AND P(crm.lead.branch.transfer,destination)`; active destination Branches only |
| Employee `ASSIGNMENT_READ` | exactly one of `leadId` or `branchId` | resolve target Branch; `P(crm.lead.read,target) AND P(crm.assignment.read,target)` |
| Employee `ASSIGN_LEAD` / `REASSIGN_LEAD` | `leadId` required; no body Branch | `P(crm.assignment.manage,storedCurrentLeadBranch)` |
| Employee `CREATE_FOLLOW_UP` | `leadId` required; no body Branch | `P(crm.followup.create,storedCurrentLeadBranch)` |
| Employee `INITIAL_ASSIGNMENT` | `branchId` required; no Lead | same-Company active Branch lookup, then `P(crm.lead.create,target) AND P(crm.assignment.manage,target)` |
| Employee `TRANSFER_REPLACEMENT` | `leadId` and `destinationBranchId` required | authorize stored source AND active same-Company destination with transfer permission; employee eligibility evaluated at destination |
| Party/Property/Space `CREATE_LEAD` | `branchId` required; no Lead | active same-Company target Branch + `P(crm.lead.create,target)` AND independent linked-resource permissions below |
| Party/Property/Space `UPDATE_LEAD` | `leadId` required; no body Branch | resolve Lead + `P(crm.lead.update,storedCurrentLeadBranch)` AND independent linked-resource permissions below |

Unused context fields for a purpose are rejected, not ignored. Branch results contain only `BranchOption`; employee results contain only `EmployeeSummary`. Eligible employee results must be active, same-Company, and COMPANY_WIDE or have an effective target-Branch assignment. Assignment/employee eligibility does not confer actor permissions, and no general identity-directory permission is inferred. There is no Follow-up-update employee purpose.

Party selector returns `PartySummary` under existing `party.read` Company/shared-Party scope rules; it excludes staff identities as the existing Party module does. Property selector requires `portfolio.property.read` at each Property's effective Branch. Space selector additionally requires `portfolio.space.read` and same-Property/Company integrity. RENT/BUY/SELL candidates require `service-engagement.capability.read`; capability is resolved in a fixed batch, never one service lookup per row. Independent resource permissions must be effective at the SAME linked-resource Branch, not borrowed from another Branch. `propertyId` is an optional narrowing filter for Space selection only and is itself validated under those resource permissions.

Asset selectors require `intent` for CREATE; UPDATE defaults to stored intent. A differing proposed intent on UPDATE is permitted only in the already-approved NEW/CONTACTED correction window and still requires update authority. Property intent is BUY/SELL/CONSTRUCTION_SERVICE; Space intent is RENT; incompatible endpoint/intent combinations fail validation. Party selection rejects asset-only `intent/propertyId` fields. Asset selectors may return authorized candidates with `capabilityAllowed:false` so the UI can explain unavailability without treating them as valid links; exact totals count the authorized resource predicate, not only enabled candidates. Construction site Property has `capability:null,capabilityAllowed:null`, never a fabricated construction entitlement. Final link commands independently recheck scope/capability and cannot rely on a stale selector result.

Selector ordering is Branch `(code ASC,id ASC)`, Employee `(employeeNumber ASC,id ASC)`, Party `(displayName ASC,id ASC)`, Property `(propertyCode ASC,id ASC)`, Space `(spaceCode ASC,id ASC)`. Search covers only those safe codes/numbers/names. Query budget is <=6 business SQL statements per selector request (including fixed batched capability/reference work), invariant with page size; never N+1. Missing command-context resources use stable 404, forbidden workflows stable 403, and an authorized filter with an empty effective intersection returns an empty page/zero total.

### HTTP and examples

GET/PATCH succeed with HTTP200, POST with HTTP201. Minimal acknowledgement versions refer to the mutated aggregate: Lead commands return the Lead version, Follow-up commands the Follow-up version, Source commands the Source version. Append Activity commands do not invent a version. There is no automatic post-command detail fetch in the service.

```json
{"id":"019d0000-0000-7000-8000-000000000001","version":2}
```

```json
{
  "groups": {
    "NEW": {"items":[],"pageInfo":{"hasNextPage":false,"nextCursor":null},"totalCount":0}
  },
  "stageTotals":{"NEW":0,"CONTACTED":0,"QUALIFIED":0,"MATCHING":0,"NURTURING":0,"CONVERTED":0,"LOST":0},
  "totalCount":0
}
```

The second example is a selected-lane response (`pipelineStage=NEW`), not an initial all-lanes response. Every empty collection preserves its normal `Page<T>` envelope. No cursor is returned unless another page exists.

Errors use `{statusCode,code,message,details,correlationId}`; `details` is a safe string array (empty when no DTO field violations), never submitted values or a stored record snapshot. API implementation must preserve the CRM code map above through its scoped exception handling; existing global `HTTP_ERROR` behavior is not permission to lose the contract codes. Expected-version conflicts return409 without disclosing a stored version to an unauthorized actor. Malformed/stale-scope cursors return400 `CRM_VALIDATION_FAILED`. Audit/history failures roll back mutations and return a safe failure, never partial-success data.

## Acceptance

- Authorization mapping: pending post-integration Agent 3 review; implementation must independently positive/negative test all 19 permissions and Branch/MULTI_BRANCH/COMPANY_WIDE intersections.
- Required evidence: DTO/policy unit; PostgreSQL integration for atomic history/audit/version/terminal cancellation and concurrency; E2E endpoint/permission/company-isolation/redaction; >1 page keyset and changed-scope cursor; exact totals; query-count no-N+1; lint/typecheck/unit/integration/E2E and `git diff --check`.
- Open blockers: reopened database gate / `P502-DB-001`; API production draft remains unverified and frozen until Root reapproval. Root approval of this v1.0.1 contract and later integrated Security/QA reviews remain pending. Contact export and future-phase endpoints/models remain absent.
- Change log: v1.0.0, 2026-08-25, initial implementation contract. v1.0.1, 2026-08-31, AUTHZ v1.0.1 alignment: explicit child-read conjunctions, minimal acknowledgements, immutable Follow-up responsibility, purpose-scoped selectors, concrete wire types, query encoding, independent pipeline cursors, and explicit encoding of the existing transfer retain/replace/clear choice. Contract clarification does not claim production implementation.
