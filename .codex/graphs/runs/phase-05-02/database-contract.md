# Phase 5.2 CRM database contract

## Metadata

- Contract ID/version/sub-phase: `CRM-DB-5.2` / `1.0.1` / Phase 5.2 CRM Foundation
- Contract status: `REVIEW`; P502-DB-001 repair verified on disposable databases, independent review pending; not Database or Phase PASS
- Owner: Agent 2 Database / Prisma Engineer
- Domain contract: `CRM-DOMAIN-5.2` v1.0.0, approved handoff `b6d27d4`, integrated `7ffa212`
- Implementation base/domain gate: `51750d3`
- Consumers: Security, API, Web, QA, Adversarial, Governance, Root
- Canonical references: canonical V3 BR-007 and sections 8, 10–14, 20.1; ADR 12; `domain-decisions.md`; database migration/seed rules

## Model and migration plan

- Foundation migration: `20260825180000_phase5_crm_foundation`, unchanged. Forward repair: `20260830120000_crm_follow_up_historical_scope`.
- Aggregate: `Lead` holds immutable Company/number/creator identity, exact `LeadIntent`, current `LeadStage`, Source, responsible Branch, optional current assignee/Party, encrypted contact snapshot fields, company-scoped HMAC search tokens, terminal metadata, integer version, and timestamps.
- Typed preference history: `LeadPreferenceVersion` owns half-open effective versions and common bounded fields. Exactly one of `RentLeadPreference`, `BuyLeadPreference`, `SellLeadPreference`, or `ConstructionServiceLeadPreference` must exist and match the discriminator. There is no generic preference JSON/key-value table.
- Catalog/history: company `LeadSource`; append-only `LeadStageHistory`, `LeadIntentHistory`, `LeadActivity`, and `LeadFollowUpOutcome`; closure-only `LeadAssignment`, `LeadBranchHistory`, and preference intervals; controlled `LeadFollowUp` lifecycle and linked successors.
- Relations use `RESTRICT` for CRM history and linked Party/Property/RentableSpace/Employee/Branch/User records. No CRM hard-delete cascade exists.
- Numbering uses `lead_record_number_seq`; the seed synchronizes it above all persisted `LEAD-<digits>` values.
- No backfill is needed because no pre-5.2 CRM table existed. The upgrade adds independent tables/types/sequence/functions/triggers/indexes only.
- Explicit exclusions: no Listing, matching record/score/candidate, Viewing, Application, Reservation, Lease, Finance, SaleDeal, ConstructionProject/Agreement/payment, or Development model/table.

## Integrity and concurrency

- `Company + leadNumber` and case-insensitive `Company + Source.code` are unique; Source code, Company, and creator identity are immutable. Referenced Sources cannot be deleted and must be active when newly attributed.
- Native triggers validate same-Company Source, Branch, Party, employee, Property, and RentableSpace references. New assignments and Follow-ups require an active, currently eligible employee. Existing Follow-up updates preserve historical Branch/employee snapshots without rechecking their current eligibility (v1.0.1 repair).
- Deferred aggregate triggers require exactly one current preference matching Lead intent, exactly one open Branch interval matching the responsible Branch, and current-assignee/open-assignment snapshot equivalence. Partial unique indexes plus GiST exclusion constraints prevent concurrent open or overlapping preference/assignment/Branch intervals.
- Native stage validation permits only the v1.0.0 transition table, prohibits terminal reopening and non-RENT/BUY `MATCHING`, requires contact Activity for `NEW -> CONTACTED`, assignment for active qualified stages, typed qualification data, a next open Follow-up in `NURTURING`, and no open Follow-up in terminal stages.
- Lead creation and stage/intent changes require matching append-only history at the same Lead version through deferred constraint triggers. Intent correction is restricted to `NEW/CONTACTED`.
- Activity is insert-only. A correction/void must append a linked same-Lead row with a reason; occurred time cannot exceed recorded time.
- Follow-ups start `OPEN`; only `OPEN -> COMPLETED/CANCELLED` is legal. Identity/Lead/Branch/responsibility/creator/predecessor are immutable, each update advances the version by exactly one, terminal outcomes require actor/time/reason plus matching append-only history, and terminal Leads reject new open Follow-ups.
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

## Original foundation verification evidence (2026-08-25 only)

These historical results predate P502-DB-001 and do not establish that the forward repair passes runtime validation.

- Prisma format/validate: PASS with Prisma 6.19.3.
- Prisma generate: PASS with `PRISMA_GENERATE_NO_ENGINE=1`; normal engine replacement awaits a final retry because Windows held the existing query-engine DLL open (`EPERM`). Generated types and the existing engine successfully executed seed/tests.
- Fresh deploy: PASS, all 15 migrations on disposable `rerms_p502_final_0825d`.
- Fresh seed twice: PASS; both runs reported the Phase 5.2 foundation and native deferred constraints accepted the complete demo aggregate.
- Prior-state upgrade: PASS on disposable `rerms_p502_upgrade_0825c`; 14 pre-5.2 migrations deployed from an isolated migration path, then only `20260825180000_phase5_crm_foundation` applied; status reported up to date.
- Upgrade seed twice: PASS.
- Database tests: PASS, 3 files / 11 tests. Coverage includes connectivity, schema/future exclusions, seed aggregate, exact Security permission matrix, typed-variant rejection, interval concurrency, valid/invalid lifecycle edges, Activity append-only correction, and append-only Follow-up outcome history.
- Migration/schema diff: new array defaults match Prisma. Two legacy Phase 4 index-name differences predate 5.2 and are unchanged; no Phase 5.2 table/column drift remains.

## Forward-fix and review

### P502-DB-001 repair checkpoint (2026-08-31)

- Authority: approved historical Follow-up clarification in Security contract v1.0.1, source `7539d28`, integrated `1dbe3d9`. Current Lead Branch controls actor authorization in the API; the immutable task Branch/employee are historical snapshots, not continuing target-eligibility preconditions.
- Forward migration `20260830120000_crm_follow_up_historical_scope` replaces only `validate_lead_follow_up_write()`. Current Branch, active same-Company eligible employee, same-Lead predecessor, initial OPEN state, and nonterminal Lead checks remain on INSERT, including successor creation. UPDATE retains immutable snapshots, OPEN-only lifecycle, and exact version increment; existing deferred aggregate/outcome triggers remain unchanged.
- No Prisma model, seed behavior, prior migration, index, data backfill, or future-phase change. Original foundation migration Git blob remains `70beda67b511662067d4ab1e2ea51b7d68e959c2`, matching `b5509c5` exactly.
- Added 18 regression cases: transferred Lead, deactivated employee, and reassigned employee each permit complete/cancel/reschedule/terminal cancellation but reject invalid new tasks. Additional assertions cover stale expected-version writes, immutable snapshots, missing outcomes, terminal reopening/rewriting, atomic rollback when one of two task outcomes is omitted, and a valid destination successor retaining its historical predecessor.
- Fixtures select the seeded `EMP-0001` employee and `REFERRAL` Source explicitly. Runtime gates must use disposable seeded databases, not a shared development database.
- `test:integration` now includes both connectivity and CRM native files. Vitest discovery lists 26 integration tests (25 native CRM plus one connectivity).
- Static checks: TypeScript `tsc --noEmit -p packages/database/tsconfig.json` PASS; ESLint `src test` PASS after correcting a type-only import; schema unit tests PASS (one file / three tests). Final formatting/diff results are recorded in the commit handoff.
- Fresh migration deploy/status PASS on disposable `rerms_p502_repair_fresh_0831a`: all 16 migrations, schema up to date, unchanged seed executed twice successfully.
- Upgrade deploy/status PASS on disposable `rerms_p502_repair_upgrade_0831a`: isolated copy of the first 15 migrations deployed, then only the forward repair applied from the full 16-migration path; schema up to date, unchanged seed executed twice successfully.
- Direct pinned Vitest full database run against the fresh disposable database PASS: three files / 29 tests, including all 25 CRM native tests, real PostgreSQL constraints, interval concurrency, stale writes, rollback and successors. No runtime test failures occurred.
- Direct pinned Vitest integration selection against the upgrade disposable database PASS after the launcher attempts: two files / 26 tests. This executes the exact two test paths now declared by `test:integration`, without claiming the pnpm launcher succeeded.
- Initial `pnpm run test:integration` attempts stalled and were interrupted. Buffered output showed registry metadata/dependency resolution failures (`ERR_PNPM_META_FETCH_FAIL`, `ETIMEDOUT`/`EACCES`), not test execution. Root identified pnpm 11.17.0's default pre-run automatic install against the worktree junction layout (repository pins 11.16.0). No install was requested, and tracked package manager/config/lockfile files remain unchanged.
- Actual `pnpm run test:integration` subsequently PASS against the upgrade disposable database: two files / 26 tests, using transient `PNPM_CONFIG_PM_ON_FAIL=ignore` and `pnpm_config_verify_deps_before_run=warn` to prevent automatic installation. Warning retained: node_modules are out of sync with the lockfile and dependency freshness cannot be checked. A normal clean-checkout frozen install remains part of the final integration gate; these transient settings do not change repository configuration.
- Docker startup remained unavailable, but Root identified a possible local PostgreSQL listener. A read-only probe using the approved root `.env` connected successfully to the configured `localhost:55432`, reporting PostgreSQL 17.6 and CREATE DATABASE permission. Only the two uniquely named disposable databases above were created/migrated/seeded; existing `rerms` was untouched. No Docker reset, socket deletion, reinstall, or WSL changes occurred. Keep disposable databases for Root's independent rerun.
- Prisma 6.19.3 format/validate and normal engine generation PASS. Worktree-junction resolution initially failed, and the prior no-engine client rejected a normal PostgreSQL URL. Generating from an exact schema copy in ignored root `node_modules/.cache/p502-repair-0831` resolved both issues without changing the tracked schema or installing dependencies.
- This checkpoint requests independent repair review only. Root and Security own defect closure and gate approval; the clean-checkout dependency qualification remains explicit.

Safe independent rerun from the integration worktree's `packages/database` directory (loads approved credentials without printing them; targets only the retained disposable fresh database):

```powershell
node -e 'const p=require("node:process");p.loadEnvFile("C:/Users/maxam/real-estate-rental-system/.env");const u=new URL(p.env.DATABASE_URL);u.pathname="/rerms_p502_repair_fresh_0831a";p.env.DATABASE_URL=u.href;const r=require("node:child_process").spawnSync(p.execPath,["C:/Users/maxam/real-estate-rental-system/packages/database/node_modules/vitest/vitest.mjs","run","test/connection.integration.test.ts","test/crm-native.integration.test.ts"],{env:p.env,stdio:"inherit"});p.exitCode=r.status??1;'
```

- Migration history is append-only. Any post-integration defect is corrected by a new forward migration; this migration is never edited after integration.
- The migration contains no destructive existing-table change and requires no rollback/backfill script. Operational rollback is application disablement followed by a reviewed forward fix; CRM data/history is retained.
- Node state after Agent 2 handoff: `REVIEW`, never self-declared PASS. Root and independent reviewers own approval.

## Change log

| Version | Date       | Change                                                                                     |
| ------- | ---------- | ------------------------------------------------------------------------------------------ |
| `1.0.0` | 2026-08-25 | Initial Phase 5.2 relational/native implementation and verification contract.              |
| `1.0.1` | 2026-08-31 | Forward P502-DB-001 repair; fresh/upgrade/seed/native and integration-script verification. |
