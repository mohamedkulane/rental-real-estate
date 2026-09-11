# Phase 5.2 CRM authorization contract

## Metadata

- Contract ID/version/sub-phase: `CRM-AUTHZ-5.2` / `1.0.1` / Phase 5.2 CRM Foundation
- Contract status: `APPROVED FOR IMPLEMENTATION`; final integrated security review pending
- Owner: Agent 3 Authorization & Security Engineer
- Domain/database contract versions: `CRM-DOMAIN-5.2` `1.0.0`; `CRM-DB-5.2` `1.0.0`, with `P502-DB-001` repair review pending
- Approval: v1.0.0 approved by Root at `eee921c` on 2026-08-25; v1.0.1 clarification reviewed and approved from `7539d28151b683c7a542a1be9dc90b6e96398f6b` by Root on 2026-08-30. No implementation or final security PASS implied.
- Consumers: Database seed, CRM API, Web capability projection, QA, Security Review,
  Adversarial, Governance, Root
- Canonical references: approved Phase 5.2 instruction; canonical V3 BR-002/007/018
  and sections 8, 10–14, 16–18, 20.1; ADRs 7, 10, 12, and 15;
  `docs/security/{authorization,branch-scoping}.md`; `CRM-DOMAIN-5.2` `1.0.0`

Role names are seed recommendations only and are never policy. Every protected path
is deny-by-default and requires an active authenticated account, the exact permission,
employee access mode, a compatible active role-grant scope, current Lead Branch and
resource scope, and the command state guard.

## Permission catalog

| Code                       | Meaning and boundary                                                                                                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crm.lead.read`            | Read authorized Lead register, pipeline, detail, stage/Branch history, and safe Source/assignee/linked summaries. Does not reveal raw contact fields or Activity/Follow-up collections.                                         |
| `crm.lead.create`          | Create a `NEW` Lead in an authorized responsible Branch. Does not grant contact disclosure after creation.                                                                                                                      |
| `crm.lead.update`          | Correct permitted non-stage Lead fields, typed preferences, intent in its allowed window, Party link, and asset intake link. No generic stage, assignment, Branch, Activity, or Follow-up mutation.                             |
| `crm.lead.stage`           | Execute named legal Lead stage transitions only.                                                                                                                                                                                |
| `crm.activity.read`        | Read Activities for an otherwise readable Lead.                                                                                                                                                                                 |
| `crm.activity.create`      | Append an Activity to an otherwise writable authorized Lead.                                                                                                                                                                    |
| `crm.activity.correct`     | Append a reasoned correction/void record; never overwrite the original.                                                                                                                                                         |
| `crm.followup.read`        | Read authorized Follow-up workspace and a readable Lead's Follow-ups.                                                                                                                                                           |
| `crm.followup.create`      | Create an open Follow-up for a non-terminal authorized Lead.                                                                                                                                                                    |
| `crm.followup.update`      | Reschedule or correct permitted open Follow-up fields with expected version.                                                                                                                                                    |
| `crm.followup.complete`    | Complete an open Follow-up with its outcome.                                                                                                                                                                                    |
| `crm.followup.cancel`      | Cancel an open Follow-up with a reason. System terminal-stage cancellation does not impersonate this user permission.                                                                                                           |
| `crm.assignment.read`      | Read assignment history and safe eligible/current assignee summaries for an otherwise readable Lead.                                                                                                                            |
| `crm.assignment.manage`    | Assign, reassign, or unassign using the domain eligibility/state rules. Assignment never grants access.                                                                                                                         |
| `crm.lead.branch.transfer` | Transfer responsible Branch; requires this permission over both source and destination Branches.                                                                                                                                |
| `crm.source.read`          | Read active Source selector values when the actor has at least one authorized Branch grant; inactive historical Source summary is returned only through an authorized Lead.                                                     |
| `crm.source.manage`        | Company-wide create/update/deactivate/reactivate and full Source workspace access; requires an explicit company-level role grant and `COMPANY_WIDE` employee access.                                                            |
| `crm.lead.contact.read`    | Reveal Lead snapshot phone/email on an otherwise readable Lead. Without it return stable masked values/availability flags, never ciphertext, hashes, or null-vs-forbidden clues.                                                |
| `crm.lead.contact.export`  | Export raw Lead contact values; requires `crm.lead.read` and `crm.lead.contact.read` too, an explicit company-wide grant, purpose/reason, step-up control when configured, and audit. No Phase 5.2 export endpoint is required. |

Permissions are conjunctive where specified. `crm.lead.read` never implies Activity,
Follow-up, assignment-history, contact, Party, Property, RentableSpace, capability,
listing, viewing, application, leasing, construction, finance, document, or export
authority. Create/update permissions do not imply read.

## Resource/action and access-mode policy

`B` means permission scope must contain the current resource Branch (or an allowed
company-level grant) and employee scope must contain it. `BOTH` means source and
destination must independently pass. `CW` means explicit company-level permission
scope (`null`) plus employee `COMPANY_WIDE`. A requested or stored `companyId` is
never trusted from the client.

| Resource/action                       | Permission(s)                                   | BRANCH         | MULTI_BRANCH   | COMPANY_WIDE                                          | Object/resource rule                                                                                                                                 |
| ------------------------------------- | ----------------------------------------------- | -------------- | -------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lead list/pipeline/detail/history     | `crm.lead.read`                                 | B              | B per Branch   | all only with `null`; otherwise granted Branch subset | Predicate includes trusted `companyId` and current responsible Branch. Detail repeats the check.                                                     |
| Lead create                           | `crm.lead.create`                               | B              | B              | B or all with `null`                                  | Target Branch must be active, same Company, and authorized; active Source and reference checks also apply.                                           |
| Lead correction/link                  | `crm.lead.update`                               | B              | B              | B or all with `null`                                  | Authorize stored Lead Company/Branch before accepting fields; expected version and state gates apply.                                                |
| Lead stage transition                 | `crm.lead.stage`                                | B              | B              | B or all with `null`                                  | Named transition only; prerequisite Activity/Follow-up/assignment checks do not confer those mutation permissions.                                   |
| Activity read/create/correct          | matching `crm.activity.*`                       | B              | B              | B or all with `null`                                  | Lead must independently be readable for read and within its current Branch for command; original correction target must belong to same Lead/Company. |
| Follow-up list/detail                 | `crm.followup.read`                             | B              | B              | all only with `null`; otherwise granted Branch subset | Scope by Follow-up's Lead Company and current responsible Branch, not the historical Branch snapshot alone.                                          |
| Follow-up create/update/outcome       | matching `crm.followup.*`                       | B              | B              | B or all with `null`                                  | Load through Lead Company/current Branch; Follow-up and target employee must match Lead Company; expected version/state required.                    |
| Assignment read                       | `crm.assignment.read`                           | B              | B              | B or all with `null`                                  | Lead scope controls history; employee summaries are safe fields only.                                                                                |
| Assign/reassign/unassign              | `crm.assignment.manage`                         | B              | B              | B or all with `null`                                  | Assignee ID cannot widen scope; validate active same-Company employee and current Branch eligibility server-side.                                    |
| Responsible-Branch transfer           | `crm.lead.branch.transfer`                      | BOTH           | BOTH           | BOTH or all with `null`                               | Authorize stored source and resolved destination, then validate/replace/clear assignee atomically. A user with only one side is denied.              |
| Active Source selector                | `crm.source.read`                               | at least one B | at least one B | at least one B or `null`                              | Returns active IDs/codes/labels only; no Branch-private Source catalog exists.                                                                       |
| Source administration                 | `crm.source.manage`                             | deny           | deny           | CW only                                               | Company catalog mutation/list including inactive, usage count, version, creator, lifecycle; never branch-derived.                                    |
| Raw Lead contact reveal               | `crm.lead.read` + `crm.lead.contact.read`       | B              | B              | B or all with both `null`                             | Lead scope first; decrypt only selected authorized records after the final predicate.                                                                |
| Raw contact export, if later approved | read + contact read + `crm.lead.contact.export` | deny           | deny           | CW only for all three                                 | Purpose-limited server export; no raw contact in filename, job payload, logs, cursor, audit payload, or event.                                       |

For `BRANCH`, only active employee Branch assignments may pass. For `MULTI_BRANCH`,
the effective set is the intersection of active employee Branch assignments and the
Branch scopes of the exact permission. For `COMPANY_WIDE`, a Branch-scoped role grant
still authorizes only its explicit Branches; only a `null` role-grant scope authorizes
all Company Branches. Neither a powerful role nor a `null` role grant converts a
`BRANCH`/`MULTI_BRANCH` employee to Company-wide access.

## Explicit read conjunctions and safe selectors (v1.0.1 clarification)

This section expands the table's shorthand and the phrase "otherwise readable Lead";
it does not add a permission, change role grants, or make a command require general
read permission. `P(permission, branch)` means the existing exact-permission and
employee-scope check, with trusted Company/resource resolution performed first.

- Activity reads require `P(crm.lead.read, currentLeadBranch)` AND
  `P(crm.activity.read, currentLeadBranch)`.
- Assignment-history reads require `P(crm.lead.read, currentLeadBranch)` AND
  `P(crm.assignment.read, currentLeadBranch)`.
- Lead and workspace Follow-up reads require `P(crm.lead.read, currentLeadBranch)` AND
  `P(crm.followup.read, currentLeadBranch)`. The intersection of both permission
  Branch sets governs items, Lead summaries, totals, search, and cursor scope. A grant
  for one permission in Branch A cannot be combined with the other in Branch B.
- Raw contact reveal additionally requires `P(crm.lead.contact.read,
currentLeadBranch)` and its reveal audit; child read permission never substitutes
  for either contact-read or Lead-read authority.

`/crm/selectors/branches` and `/crm/selectors/employees` accept a closed, server-mapped
purpose enum, not an arbitrary client permission string. They are scoped read models
for an already authorized workflow, not general Organization/Employee directory APIs.
Search, pages, and counts use the final authorized predicate; a missing or unknown
purpose is rejected. Requested filters can only narrow that predicate.

| Branch-selector purpose          | Required effective permission formula                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Lead register or pipeline filter | `P(crm.lead.read, offeredBranch)`                                                                             |
| Follow-up workspace filter       | `P(crm.lead.read, offeredBranch)` AND `P(crm.followup.read, offeredBranch)`                                   |
| Lead creation                    | `P(crm.lead.create, offeredBranch)`                                                                           |
| Transfer destination             | `P(crm.lead.branch.transfer, storedSourceBranch)` AND `P(crm.lead.branch.transfer, offeredDestinationBranch)` |

Branch results contain only same-Company ID/code/name and lifecycle label. Creation
and transfer offer active Branches only. Read filters may label inactive authorized
Branches to retain complete-data access. Transfer must resolve and authorize the
stored source Lead before returning any destination options.

Every employee option must be active, in the trusted Company, and currently eligible
in the target Branch using the existing employee eligibility rule: explicit
`COMPANY_WIDE` employee access or an active effective-dated Branch assignment. This
target eligibility is not a permission grant to either the actor or employee.

| Employee-selector purpose          | Required actor permission formula                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Safe assignment read               | `P(crm.lead.read, targetBranch)` AND `P(crm.assignment.read, targetBranch)`                                  |
| Assign or reassign existing Lead   | `P(crm.assignment.manage, storedCurrentLeadBranch)`                                                          |
| Create Follow-up                   | `P(crm.followup.create, storedCurrentLeadBranch)`                                                            |
| Optional initial Lead assignment   | `P(crm.lead.create, targetBranch)` AND `P(crm.assignment.manage, targetBranch)`                              |
| Replacement during Branch transfer | `P(crm.lead.branch.transfer, storedSourceBranch)` AND `P(crm.lead.branch.transfer, targetDestinationBranch)` |

These are purpose-specific alternatives, not a global OR across all listed
permissions. Existing Lead context always resolves its Branch from persistence.
Creation target Branch is independently looked up and authorized. Employee options
contain only ID, employee number, and safe display name: no contact, account/session,
role-grant, unrelated Branch, or general employee-detail fields. No employee selector
is offered for Follow-up UPDATE because its responsible employee is immutable. An
initial assignment inside Lead creation still performs the separate assignment action
and therefore requires `crm.assignment.manage`; it is not obtained from create alone.

Party/asset selectors also require the exact CRM create/update purpose on the Lead or
creation Branch, plus the existing independent `party.read`, `portfolio.property.read`,
`portfolio.space.read`, and applicable `service-engagement.capability.read` checks
described below. They never use CRM permission as a substitute, expose full contacts,
or manufacture commercial capability for construction site context.

## Mutation response confidentiality (v1.0.1 clarification)

Command authorization does not confer response-read authority. The default successful
response is a minimal acknowledgement such as `{id, version}` for a mutable aggregate
or `{id}` for an append-only record. Do not echo stored detail, contact, current
assignment, or free text merely because create/update/transition succeeded.

An enriched response may be returned only after independently satisfying the same
read permissions, Company/Branch predicates, safe projections, and reveal audit as its
GET equivalent. Nested Activity/Follow-up/assignment content requires the read
conjunction above. Transfer responses re-evaluate destination Branch read scope; the
old source grant is not sufficient. Lack of read permission must not turn a valid
committed write into a misleading failure: return the acknowledgement instead.
Unauthorized or failed commands reveal no stored version, stage, target identity, or
eligibility detail before action/resource authorization.

## Follow-up historical attribution (v1.0.1 clarification)

INSERT (including a linked successor) validates the current Lead Branch snapshot and
an active same-Company employee eligible there. Lead, historical Branch, responsible
employee, creator, creation time, and predecessor remain immutable thereafter.

UPDATE/reschedule/complete/cancel authorizes the active actor's exact action in the
Lead's CURRENT responsible Branch and validates expected version and OPEN state.
The actor need not equal the historical responsible employee. A later Lead transfer,
employee deactivation, or employee Branch reassignment must not block these actions
or terminal-stage system cancellation merely because historical eligibility changed.
Do not rebase the snapshot or rewrite responsibility to get an update through.
Responsibility changes use cancellation plus a linked successor with current creation
checks. This preserves the domain's creation-time eligibility rule, append-only
attribution, current-Branch security boundary, and transactional outcome/audit rules.

Regression evidence must separately prove allowed current-Branch actors can complete,
cancel, and reschedule historical-Branch items and close the parent Lead; old-Branch-
only actors remain denied; inactive/reassigned historical employees do not strand
cleanup; new invalid employees/Branches remain rejected; immutable snapshots, stale
versions, and terminal reopening remain protected.

## Company, resource, and linked-record checks

- Obtain Company only from the resolved server session. Every query, count, cursor,
  uniqueness probe, HMAC search, history lookup, mutation, audit lookup, and export
  includes it. Cross-Company and nonexistent identifiers have the same not-found
  response and never disclose an ID, number, name, count, or conflict/version fact.
- Resolve authorization from the stored Lead/Follow-up/Activity/assignment/Source,
  never a body/query Branch or Company. Creation resolves the target Branch from a
  same-Company Branch lookup before checking authorization.
- Linking a Party requires `crm.lead.update` on the Lead plus existing `party.read`
  scope for that same-Company Party. Shared-Party rules remain unchanged. Linking
  preserves the contact snapshot and grants no Party contact access. Later Lead reads
  omit/redact a linked Party summary if independent Party scope is no longer present;
  they do not broaden Party visibility.
- Linking a Property requires Lead authority plus `portfolio.property.read` on its
  effective Branch and same Company. Linking a RentableSpace additionally requires
  `portfolio.space.read`, same Property/Company integrity, and the Property effective
  Branch scope. RENT/BUY/SELL asset links consume the Phase 5.1 capability resolver
  with `service-engagement.capability.read`; resolver denial rejects only the link.
  Construction site Property is location context and has no invented capability.
  Later reads expose only independently authorized safe asset summaries.
- Assignment target discovery and command validation use safe employee fields only.
  The target must be active, same Company, and actively eligible in the Lead's current
  Branch. The actor's assignment, the target's assignment, and historical Branch
  snapshots never grant policy authority.
- A terminal transition's system cancellation of open Follow-ups executes inside the
  already-authorized stage transaction under a named internal policy action. It is
  not a background-principal bypass and records the initiating actor/correlation.

## Requested-filter intersection and enforcement

- Lists first compute `AuthorizationService.authorizedBranchIds(principal,
exactPermission)`. `null` means all Company Branches only for an explicit Company-
  wide grant; an empty set means an empty authorized result, never an unscoped query.
- No Branch filter means apply the complete authorized set. One or many requested
  Branches are intersected with that set before the database query. An entirely
  unauthorized requested set returns an empty page/zero exact total to avoid Branch
  enumeration. Mixed sets return only the authorized intersection.
- Assignee, employee, Lead, Source, intent, stage, date, overdue, search, and open/
  terminal filters only narrow the already Company/Branch-scoped predicate. The same
  final predicate drives items, exact total, pipeline totals, and protected contact
  search. Authorization is never a post-filter.
- Opaque cursors are signed or integrity-protected and bound to Company, normalized
  query/sort, and an authorization-scope fingerprint; they contain no contact, search
  tokens, free text, or raw internal identifiers. A changed filter or effective scope
  invalidates/reset the cursor without leaking the old result.
- Controllers require session and coarse permission metadata. Application services
  repeat exact Company/Branch/object and conjunctive permission checks. Repository
  selectors carry final predicates and select safe fields by default. Domain/database
  policies enforce lifecycle, version, interval, and reference integrity after access
  is established. Frontend capability visibility is usability only.
- Missing principal, permission map entry, Branch context, linked-resource context,
  invalid system purpose, or policy result is denial. Workers/jobs must carry a safe
  Company/resource/purpose/correlation envelope and re-resolve current authority; no
  Phase 5.2 job may inherit a user's stale serialized permission set.

## Privacy, redaction, audit, and errors

- Encrypt Lead phone/email with versioned AES-256-GCM and index normalized values with
  domain-separated keyed HMAC. Never return ciphertext, IV/tag, HMAC, encryption-key
  version, or contact-derived cursor/event/log data.
- Without `crm.lead.contact.read`, return consistent masked presentation (for example
  last digits/domain only where safe) and coarse contact-availability flags. Do not
  vary not-found/forbidden behavior based on whether a contact exists. Free text,
  Party identity secrets, and raw contacts never enter generic JSON or audit payloads.
- Search may match protected phone/email under `crm.lead.read` without revealing the
  matched value. Search is Company/final-Branch scoped before result materialization,
  bounded/rate-limited, and emits no raw term to logs or audit.
- Audit in the same transaction: Lead creation; intent/preference correction; Party/
  asset link or unlink; stage transition; assignment/reassignment/unassignment;
  Branch transfer; Source create/update/deactivate/reactivate; Follow-up create,
  reschedule, complete, cancel, and system terminal cancellation; Activity correction/
  void; every raw contact reveal and contact export; and selected
  repeated/high-risk cross-scope denials. Activity creation remains append history and
  may use normal structured operational evidence unless policy elevates it.
- Safe audit fields are actor, action, target type/ID, trusted Company, relevant old/
  new Branch IDs, timestamp, correlation, bounded reason code, and before/after version
  or lifecycle code. Exclude names, phone/email, search terms/HMAC/ciphertext, typed
  preference free text, Activity/Follow-up notes, outcome narrative, and document data.
- Cross-Company or undiscoverable objects return not found. An authenticated actor who
  may know the object but lacks action/Branch scope receives a stable forbidden error;
  responses never expose allowed Branches, current version, state, assignee, or target
  identity before authorization. Validation that could reveal stored state runs after
  access checks.

## Permission seed handoff

Database owns `prisma/seed.ts`. Add every permission code above with its exact
description/meaning, then apply these least-privilege development-role recommendations:

| Role                                                 | CRM grants                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPER_ADMIN`                                        | All Phase 5.2 CRM permissions (by existing all-permissions construction).                                                                                                                                                                                                        |
| `GENERAL_MANAGER`                                    | All Phase 5.2 CRM permissions, including Company-wide Source administration and contact export when its role assignment is company-level.                                                                                                                                        |
| `BRANCH_MANAGER`                                     | All except `crm.source.manage` and `crm.lead.contact.export`. Branch transfer still succeeds only when the actor has the permission in both Branches.                                                                                                                            |
| `PROPERTY_MANAGER`                                   | `crm.lead.read/create/update/stage`, all `crm.activity.*`, all `crm.followup.*`, `crm.assignment.read/manage`, `crm.lead.branch.transfer`, `crm.source.read`, `crm.lead.contact.read`.                                                                                           |
| `LEASING_AGENT`                                      | `crm.lead.read/create/update/stage`, `crm.activity.read/create`, all `crm.followup.*`, `crm.assignment.read`, `crm.source.read`, `crm.lead.contact.read`. No Activity correction, assignment management, Branch transfer, Source administration, or export.                      |
| `RECEPTIONIST`                                       | `crm.lead.read/create/update`, `crm.activity.read/create`, `crm.followup.read/create`, `crm.assignment.read`, `crm.source.read`, `crm.lead.contact.read`. No stage, correction, Follow-up outcome/reschedule, assignment management, transfer, Source administration, or export. |
| `ACCOUNTANT`, `MAINTENANCE_COORDINATOR`, `INSPECTOR` | No Phase 5.2 CRM permission by default. Add only through an explicit later business decision, never inferred from existing Party/portfolio contact access.                                                                                                                       |

Seed verification must prove the permission catalog is repeatable, stale grants are
reconciled by the existing seed behavior, expected role mappings are exact, and no
role name is checked at runtime. A role's effective Branch/company scope continues to
come from `EmployeeRoleAssignment.branchId`, not this recommendation table.

## Horizontal-escalation threat model

| Threat                                                                      | Required control / negative test                                                                                                         |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Client swaps `companyId`, Lead/child ID, or Branch ID                       | Ignore client Company; load through trusted Company + authorized current Branch; wrong Company/not found indistinguishable.              |
| User combines employee access in Branch B with permission granted only in A | Exact permission-scope/employee-scope intersection; deny B.                                                                              |
| `COMPANY_WIDE` employee uses a Branch-scoped role as a global grant         | Only the role's explicit Branch passes; `null` grant required for all.                                                                   |
| Branch transfer used to steal or strand a Lead                              | Require transfer permission on source and destination; lock/version Lead; atomically validate assignee and history/audit.                |
| Assignment used as authorization                                            | Prove assignee without permission cannot read; actor with permission but no Branch cannot manage; assignment grants no scope.            |
| Child ID references another Lead/Company                                    | Activity/Follow-up/assignment/correction loads require child + parent + Company and parent current Branch; deny without existence leak.  |
| Linked Party/asset reveals another Branch or Company                        | Independent Party/asset scope and same-Company check; safe summary redacted/omitted after scope loss.                                    |
| Protected search becomes contact oracle                                     | Company/authorized-Branch predicate, stable masked results, rate limit, no term logs, identical no-match behavior.                       |
| Filter/count/cursor leaks unauthorized records                              | Intersect before query; identical item/total predicate; mixed-filter and stale-scope cursor tests.                                       |
| Contact permission omitted on nested/history/export path                    | Default-safe selectors/serializers; matrix tests for every representation; export requires three explicit Company-wide grants.           |
| Stale/suspended principal or serialized job authority                       | Session resolution rejects non-active/revoked principal; jobs re-resolve current policy and purpose.                                     |
| Validation/version conflict leaks object state                              | Authorize first; unauthorized responses never reveal current version, state, Source usage, assignee eligibility, or transition legality. |
| Audit/event/log exfiltrates PII/free text                                   | Allowlisted safe audit/event schema and assertions over serialized payload/log/job/cursor.                                               |

## Security test requirements and approval

- Positive/negative test every permission independently; a neighboring create/update/
  read permission must not satisfy it. Include active allowed user, missing permission,
  revoked/suspended session, and expired role/Branch assignment where fixtures permit.
- For every Lead/Activity/Follow-up/assignment read and command: same Branch allowed;
  wrong Branch denied; MULTI_BRANCH subset only; explicit Company-wide `null` grant all;
  COMPANY_WIDE employee plus Branch grant subset only; wrong Company/not found stable.
- Test requested Branch absent, authorized, unauthorized, and mixed; exact totals and
  all pipeline groups must use the same intersection. Change effective scope between
  cursor pages and prove no continuation leakage.
- Test transfer with both Branch grants allowed and either-side grant missing denied.
  Test concurrent transfer/version conflict and ineligible assignee atomic rollback.
- Test assignee/non-assignee combinations to prove assignment is not access. Test
  same-Company active/disabled/other-Branch employee targets and foreign IDs.
- Test Party, Property, RentableSpace, and capability links independently: authorized
  allowed; wrong Company/Branch/type/parent/capability denied; unlinked intake remains
  allowed; linked safe summary disappears/redacts after independent scope loss.
- Test masked vs raw contact serialization on list, pipeline, detail, Activity,
  Follow-up, assignment, search, error, audit, event, log, cursor, and any export.
  Protected search can match but not disclose. Ciphertext/HMAC/key metadata never leave
  persistence. Contact access/export audit is redacted and transactional as required.
- Test append-only Activity correction, source lifecycle, every Follow-up transition,
  stage/assignment/Branch histories, and terminal automatic cancellation for audit
  creation and rollback on audit/history/version failure.
- Test no frontend-only enforcement, no role-name bypass, no implicit super-admin
  bypass, no unscoped repository/count query, no `limit=100` authorization surrogate,
  and absence of Phase 5.3+ permissions/endpoints/models.

Existing `AuthorizationService` primitives are sufficient for this contract; no
generic security production change is justified before API integration. Post-
integration Security Review must inspect every controller/service/repository selector
against this contract and may add routed tests or remediation.

- Current open threats/questions/blockers: HIGH `P502-DB-001` requires independent
  recheck of the forward-only Follow-up repair; HIGH `P502-AUTH-001` remains open until
  API alignment and negative tests pass. No final integrated security PASS is claimed.
- Node transition: Agent 3 handed off v1.0.1 at REVIEW; Root approved the contract clarification only. Post-integration Security Review remains mandatory.

## Change log

| Version | Date       | Change                                                                                                                                                                                          |
| ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `1.0.0` | 2026-08-25 | Initial complete Phase 5.2 CRM authorization contract and seed handoff.                                                                                                                         |
| `1.0.1` | 2026-08-30 | Make existing child-read conjunctions, purpose-scoped safe selector formulas, write-response confidentiality, and historical Follow-up attribution explicit; no new permissions or role grants. |
