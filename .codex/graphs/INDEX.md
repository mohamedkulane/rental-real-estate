# Delivery graph index

## Graph documents

- [`delivery-graph.md`](delivery-graph.md) — dependency waves, status transitions, repair loop, integration, and final gate.
- [`ownership-matrix.md`](ownership-matrix.md) — exclusive and protected write ownership.
- [`worktree-strategy.md`](worktree-strategy.md) — branch/worktree creation, integration order, and preservation rules.
- [`phase-05.md`](phase-05.md) — Phase 5 sub-phase graph and current baseline.
- [`phase-06.md`](phase-06.md) — blocked accounting-phase graph.
- [`phase-07.md`](phase-07.md) — blocked specialized commercial-model graph.
- [`contracts/`](contracts) — shared domain, database, authorization, API, UI, and testing contracts.
- [`runs/README.md`](runs/README.md) — durable execution-state rules and run templates.

## Role documents

The ten role definitions are in `../agents/`, numbered logically from Agent 0 through Agent 9. Role documents define responsibilities, inputs, outputs, write boundaries, and stop conditions. They do not grant authority beyond the current user-approved scope.

## Node status model

Every task node uses exactly one status:

- `BLOCKED` — a dependency or approval is missing.
- `READY` — dependencies passed and the node may be assigned.
- `IN_PROGRESS` — one named owner is actively working.
- `REVIEW` — implementation is frozen for independent verification.
- `FAILED` — acceptance failed and repair routing is required.
- `PASS` — evidence was independently verified by the responsible gate owner.

Only Root Supervisor changes a sub-phase gate to `PASS`. `PASS` never authorizes the next sub-phase automatically.

## Bootstrap baseline

| Item      | State                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------ |
| Phase 1–4 | Closed and verified                                                                                          |
| Phase 5.1 | PASS before graph bootstrap; durable implementation commit `ed1e96d` on `codex/phase5-1-service-engagements` |
| Phase 5.2 | BLOCKED — explicit human approval required                                                                   |
| Phase 6   | BLOCKED — full Phase 5 PASS and approval required                                                            |
| Phase 7   | BLOCKED — Phase 6 PASS and approval required                                                                 |

The graph bootstrap modifies `.codex/` coordination documents only.
