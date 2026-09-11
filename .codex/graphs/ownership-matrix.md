# Write ownership matrix

Ownership is exclusive by default. Root Supervisor records any temporary exception in the active run before work begins.

Broad directory globs are responsibility boundaries, not permission for overlapping writes. Exact per-run `Owned paths` take precedence: database/API/web test paths assigned to Agent 6 and security modules/tests assigned to Agent 3 are excluded from the builder's broad glob for that node. Root must assign disjoint exact globs and freeze handoffs before any overlapping node becomes READY.

| Role                         | Primary write ownership                                                                                     | Must not independently change                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Agent 0 Root Supervisor      | Run state, integration report, gate report, narrowly scoped conflict resolution                             | Feature semantics without contract approval             |
| Agent 1 Domain Architect     | `docs/domain/**`, `docs/decisions/**`, domain contract                                                      | Frontend, migrations, authorization implementation      |
| Agent 2 Database Engineer    | `packages/database/**`, `prisma/**`, migrations, database seed, database contract                           | UI/API semantics or security policy                     |
| Agent 3 Security Engineer    | Authorization/security modules, permission configuration/seed slice, security tests, authorization contract | Domain lifecycle or unrelated API/UI                    |
| Agent 4 Backend Engineer     | `apps/api/**`, assigned shared API contracts                                                                | Prisma migrations, frontend, security contract          |
| Agent 5 Frontend Engineer    | `apps/web/**`, UI contract                                                                                  | Backend authorization, Prisma schema, domain rules      |
| Agent 6 QA Engineer          | Test files, fixtures, test utilities, testing contract                                                      | Production behavior merely to make tests green          |
| Agent 7 UX Reviewer          | Read-only findings initially                                                                                | Implementation until Root routes a specific remediation |
| Agent 8 Adversarial Reviewer | Read-only findings initially                                                                                | Implementation before reporting findings                |
| Agent 9 Governance Auditor   | Read-only findings and final audit initially                                                                | Builder code or gate evidence fabrication               |

## Protected architectural files

Root must serialize edits to:

- `prisma/schema.prisma` and migration history;
- permission seed/config and shared authorization guards;
- global navigation and shared UI primitives;
- canonical V3 documentation and accepted ADRs;
- `docs/governance/current-phase.json` and completion reports;
- root `package.json`, lockfile, workspace/environment configuration, and governance scripts;
- API module registration/shared contracts and other cross-feature composition roots.

No two agents may concurrently edit a protected file. Permission seed coordination between Agents 2 and 3 uses an approved boundary: Agent 3 specifies permission semantics; Agent 2 owns the seed transaction unless Root explicitly assigns a disjoint file.

## Ownership handoff

A handoff records: source owner, target owner, exact files, reason, approved contract version, start/end time, and completion commit. Test files are assigned per task node; builders freeze an assigned test file before Agent 6 receives it. Until a handoff is recorded, the original owner retains write authority.
