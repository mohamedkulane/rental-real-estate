# Branch and worktree strategy

## Preflight

Root must inspect `git status`, current branch/HEAD, remotes, existing worktrees, untracked files, and stashes before creating any worktree. Dirty user files are documented and preserved. `final-remediation.diff`, stashes, and local evidence must never be deleted, applied, moved, or staged without explicit instruction.

The current Phase 5.1 branch contains canonical V3 commit `3371ba0` and verified Phase 5.1 implementation commit `ed1e96d`. The root worktree still contains protected untracked `final-remediation.diff`, which remains excluded from commits and worktree operations. Future graph worktrees must start from the committed graph checkpoint that follows `ed1e96d`, never from an earlier Phase 4 base.

## Naming

Use one integration branch and role branches scoped to the approved sub-phase:

```text
codex/p5-02-integration
codex/p5-02-domain
codex/p5-02-database
codex/p5-02-security
codex/p5-02-api
codex/p5-02-web
codex/p5-02-tests
codex/p5-02-review
```

Equivalent `p6-*` and `p7-*` names are allowed only after their phase gates and human approvals.

No agent, including Root, performs implementation edits directly on `master` or `main`. Root owns a dedicated integration branch/worktree and only merges to the protected primary branch when separately authorized.

## Isolation rules

- Every worktree starts from the same verified integration commit.
- One migration owner exists per sub-phase.
- Shared protected files are assigned to one active writer at a time.
- Agents do not merge their own branches into integration.
- Review roles inspect integration or a frozen candidate commit.
- Root records branch, worktree path, base commit, owner, and file scope in `task-graph.md`.

## Integration and cleanup

Root selects and records the integration method in `status.md` when opening the run. The default is ordered cherry-picks of clean role commits for an auditable source/result SHA trail; a non-fast-forward merge is allowed when preserving branch history is explicitly useful. Builders never merge into integration or master.

Root integrates in contract order, reruns affected checks after each integration, and resolves semantic conflicts against approved contracts. Dependency refreshes (merge, rebase, or cherry-pick) are Root-controlled and recorded. A handoff requires a clean role worktree, commit SHA, diff/stat, owned-path confirmation, and test evidence. Worktrees and branches are removed only after the change is safely integrated, no unmerged/user files remain, and removal is explicitly in scope. No destructive reset or stash operation is part of normal graph execution.
