# Evidence index

Store or link durable evidence without committing secrets, generated databases, large build output, or confidential data.

| Evidence ID | Command/review | UTC timestamp | Candidate SHA | Environment | Exit/result/counts | Log/artifact link |
| ----------- | -------------- | ------------- | ------------- | ----------- | ------------------ | ----------------- |
| PRE-001 | Git baseline/status/log/worktree/stash inspection | 2026-08-25 | `fbe04db` | Windows workspace | PASS; protected root file and stash recorded | `status.md` |
| DOMAIN-001 | Domain handoff and Root semantic contract review | 2026-08-25 | `7ffa212` | Isolated domain + integration worktrees | PASS; contract v1.0.0, no blockers, no future-phase leakage | `domain-decisions.md`, `integration-report.md` |
| SEC-001 | Authorization contract handoff and Root review | 2026-08-25 | `2cbf00d` | Isolated security + integration worktrees | REVIEW; API unit 49/49, focused auth 12/12, seed handoff delivered | `authorization-contract.md`, `integration-report.md` |
| DB-001 | Database contract/migration handoff and Root review | 2026-08-25 | `f6ef316` | Isolated database + integration worktrees, disposable fresh/upgrade databases | PASS; 14→15 fresh/upgrade, seed twice, DB 3 files/11 tests, exact permission matrix | `database-contract.md`, `integration-report.md` |
| CONTRACT-002 | Joint Database/Security Root contract gate | 2026-08-25 | `f6ef316` | Integration candidate | PASS; Database and Authorization contracts v1.0.0 approved; API READY | `status.md`, `task-graph.md` |
