# Phase 5.2 CRM database contract

## Metadata

- Contract ID/version/sub-phase: `CRM-DB-5.2` / `1.0.0` / Phase 5.2 CRM Foundation
- Contract status: `REVIEW` (implementation complete; independent review pending)
- Owner: Agent 2 Database / Prisma Engineer
- Domain contract: `CRM-DOMAIN-5.2` v1.0.0, approved handoff `b6d27d4`, integrated `7ffa212`
- Implementation base/domain gate: `51750d3`
- Consumers: Security, API, Web, QA, Adversarial, Governance, Root
- Canonical references: canonical V3 BR-007 and sections 8, 10–14, 20.1; ADR 12; `domain-decisions.md`; database migration/seed rules

## Model and migration plan

- Migration: exactly one append-only migration, `20260825180000_phase5_crm_foundation`.
- Aggregate: `Lead` holds immutable Company/number/creator identity, exact `LeadIntent`, current `LeadStage`, Source, responsible Branch, optional current assignee/Party, encrypted contact snapshot fields, company-scoped HMAC search tokens, terminal metadata, integer version, and timestamps.
- Typed preference history: `LeadPreferenceVersion` owns half-open effective versions and common bounded fields. Exactly one of `RentLeadPreference`, `BuyLeadPreference`, `SellLeadPreference`, or `ConstructionServiceLeadPreference` must exist and match the discriminator. There is no generic preference JSON/key-value table.
- Catalog/history: company `LeadSource`; append-only `LeadStageHistory`, `LeadIntentHistory`, `LeadActivity`, and `LeadFollowUpOutcome`; closure-only `LeadAssignment`, `LeadBranchHistory`, and preference intervals; controlled `LeadFollowUp` lifecycle and linked successors.
- Relations use `RESTRICT` for CRM history and linked Party/Property/RentableSpace/Employee/Branch/User records. No CRM hard-delete cascade exists.
- Numbering uses `lead_record_number_seq`; the seed synchronizes it above all persisted `LEAD-<digits>` values.
- No backfill is needed because no pre-5.2 CRM table existed. The upgrade adds independent tables/types/sequence/functions/triggers/indexes only.
- Explicit exclusions: no Listing, matching record/score/candidate, Viewing, Application, Reservation, Lease, Finance, SaleDeal, ConstructionProject/Agreement/payment, or Development model/table.

## Integrity and concurrency

- `Company + leadNumber` and case-insensitive `Company + Source.code` are unique; Source code, Company, and creator identity are immutable. Referenced Sources cannot be deleted and must be active when newly attributed.
- Native triggers validate same-Company Source, Branch, Party, employee, Property, and RentableSpace references. An assignee/follow-up employee must be active and currently eligible for the Branch.
- Deferred aggregate triggers require exactly one current preference matching Lead intent, exactly one open Branch interval matching the responsible Branch, and current-assignee/open-assignment snapshot equivalence. Partial unique indexes plus GiST exclusion constraints prevent concurrent open or overlapping preference/assignment/Branch intervals.
- Native stage validation permits only the v1.0.0 transition table, prohibits terminal reopening and non-RENT/BUY `MATCHING`, requires contact Activity for `NEW -> CONTACTED`, assignment for active qualified stages, typed qualification data, a next open Follow-up in `NURTURING`, and no open Follow-up in terminal stages.
- Lead creation and stage/intent changes require matching append-only history at the same Lead version through deferred constraint triggers. Intent correction is restricted to `NEW/CONTACTED`.
- Activity is insert-only. A correction/void must append a linked same-Lead row with a reason; occurred time cannot exceed recorded time.
- Follow-ups start `OPEN`; only `OPEN -> COMPLETED/CANCELLED` is legal. Lead/Branch/responsibility/creator/predecessor are immutable, terminal outcomes require actor/time/reason, and terminal Leads reject new open Follow-ups.
- Interval history may only change once from an open end to a later closed end; all other updates/deletes fail. Stage/intent/activity/typed preference rows reject update/delete.
- Money is non-negative `Decimal`, ranges enforce min <= max, any money requires ISO currency storage, areas are positive and require `AreaUnit`, and operational instants use `TIMESTAMPTZ(6)` with half-open intervals.
- Direct database writes enforce structural/domain invariants. Backend authorization, expected-version compare-and-swap, audit writes, capability resolution, and atomic command orchestration remain API/Security responsibilities.

## Query/index contract

- Lead Register: `(companyId, createdAt DESC, id DESC)` with Branch/stage, intent/stage, Source, assignee, and protected token companion indexes.
- Pipeline: `(companyId, stage, updatedAt DESC, id DESC)` and `(companyId, currentAssigneeEmployeeId, stage, updatedAt DESC, id DESC)` support stable groups/totals and employee filters.
- Follow-ups: Branch/state/due/id, employee/state/due/id, and Lead/due/id indexes support contract ordering, overdue derivation, and scoped totals.
- Source selector/admin list: Company/status/sortOrder/label/id. History tables use Lead + descending time + immutable ID tie-breakers.
- Contact search indexes contain HMAC tokens only; raw encrypted contacts/free text never enter index/cursor/audit payloads.

## Seed and Security handoff

- Agent 2 remains sole `prisma/seed.ts` writer. Security supplied the exact permission handoff on 2026-08-25.
- Exact codes: 19 `crm.*` permissions separating Lead read/create/update/stage, Activity read/create/correct, Follow-up read/create/update/complete/cancel, Assignment read/manage, Branch transfer, Source read/manage, and contact read/export.
- Exact grants: Super Admin and General Manager all 19; Branch Manager all except Source manage/contact export; Property Manager the same 17; Leasing Agent excludes Activity correct, Assignment manage, Branch transfer, Source manage, and contact export; Receptionist receives only the ten approved intake/read codes; Accountant, Maintenance Coordinator, and Inspector receive none.
- Idempotent reference data: `WALK_IN`, `REFERRAL`, and `WEBSITE` Sources. The idempotent `LEAD-000001` RENT demo includes one typed preference, NEW history, responsible Branch interval, and current employee assignment interval.
- Repeated seed reconciles role permissions, updates allowed Source labels/order, preserves CRM history, and does not duplicate the demo Lead or intervals.

## Migration and verification evidence

- Prisma format/validate: PASS with Prisma 6.19.3.
- Prisma generate: PASS with `PRISMA_GENERATE_NO_ENGINE=1`; normal engine replacement awaits a final retry because Windows held the existing query-engine DLL open (`EPERM`). Generated types and the existing engine successfully executed seed/tests.
- Fresh deploy: PASS, all 15 migrations on disposable `rerms_p502_final_0825d`.
- Fresh seed twice: PASS; both runs reported the Phase 5.2 foundation and native deferred constraints accepted the complete demo aggregate.
- Prior-state upgrade: PASS on disposable `rerms_p502_upgrade_0825c`; 14 pre-5.2 migrations deployed from an isolated migration path, then only `20260825180000_phase5_crm_foundation` applied; status reported up to date.
- Upgrade seed twice: PASS.
- Database tests: PASS, 3 files / 11 tests. Coverage includes connectivity, schema/future exclusions, seed aggregate, exact Security permission matrix, typed-variant rejection, interval concurrency, valid/invalid lifecycle edges, Activity append-only correction, and append-only Follow-up outcome history.
- Migration/schema diff: new array defaults match Prisma. Two legacy Phase 4 index-name differences predate 5.2 and are unchanged; no Phase 5.2 table/column drift remains.

## Forward-fix and review

- Migration history is append-only. Any post-integration defect is corrected by a new forward migration; this migration is never edited after integration.
- The migration contains no destructive existing-table change and requires no rollback/backfill script. Operational rollback is application disablement followed by a reviewed forward fix; CRM data/history is retained.
- Node state after Agent 2 handoff: `REVIEW`, never self-declared PASS. Root and independent reviewers own approval.

## Change log

| Version | Date       | Change                                                                        |
| ------- | ---------- | ----------------------------------------------------------------------------- |
| `1.0.0` | 2026-08-25 | Initial Phase 5.2 relational/native implementation and verification contract. |
