# Durable run state

Create one directory per explicitly approved sub-phase by copying `_template/` to a stable name such as `phase-05-02`. Do not create a future run merely because the prior run passed.

## Run lifecycle

1. Root records user approval, baseline branch/SHA, dirty/protected files, existing worktrees/stashes, and canonical references.
2. Root fills `task-graph.md`, assigns exclusive paths/worktrees, and changes dependency-satisfied nodes from BLOCKED to READY.
3. Agents update durable contracts/findings/evidence before handoff. Critical decisions may not live only in chat.
4. Root integrates in approved order and records every source/result SHA and conflict decision.
5. Independent reviewers record findings and rechecks.
6. Agent 9 audits the frozen candidate; Root records the gate and stops.

## Evidence rules

Each command record includes command, UTC timestamp, candidate SHA, environment/database, exit code, counts, and a durable log/evidence link. Do not edit evidence to hide failures. Findings use stable IDs and are closed only by an independent re-reviewer.

The six task states are BLOCKED, READY, IN_PROGRESS, REVIEW, FAILED, and PASS. Contract metadata may use DRAFT/APPROVED but those are not task states.
