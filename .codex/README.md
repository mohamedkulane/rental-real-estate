# Project-local Codex delivery graph

This directory contains the governed multi-agent delivery system for the Real Estate Operations Platform. It is documentation and coordination state only; it does not install an orchestration dependency or change application runtime behavior.

## Authority order

1. The user's current approved sub-phase instruction.
2. Repository `AGENTS.md` files.
3. Canonical V3 product documentation and accepted ADRs.
4. Phase scope and completion reports.
5. Graph contracts and run artifacts.
6. Individual agent recommendations.

An agent must stop and escalate when lower-level guidance conflicts with a higher authority. No agent may infer approval for the next sub-phase.

## Current baseline

The graph was bootstrapped after Phase 5.1 had reached PASS on branch `codex/phase5-1-service-engagements`. Canonical V3 is durable at `3371ba0`, and the verified Phase 5.1 implementation, migration, tests, and closure evidence are durable at `ed1e96d`. Phase 5.1 is recorded as a verified pre-graph baseline—not re-executed by this bootstrap. Phase 5.2 has not started and requires explicit human approval.

## Using the graph

- Start at [`graphs/INDEX.md`](graphs/INDEX.md).
- Root Supervisor creates a run from `graphs/runs/_template/` only after approval.
- Contracts pass before dependent implementation nodes start.
- Builders work in isolated branches/worktrees with explicit file ownership.
- QA, UX, adversarial, and governance reviewers independently verify evidence.
- Root Supervisor alone may declare a sub-phase or phase PASS, then must stop.

The Markdown role files are durable project playbooks. Codex's native multi-agent and worktree capabilities execute the roles; no third-party orchestrator is required.
