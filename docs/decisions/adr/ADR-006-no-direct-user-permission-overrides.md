# ADR-006: No direct user permission overrides

**Status:** Accepted
**Date:** 2026-08-18

## Decision

The final Phase 1?4 authorization model deliberately does not support arbitrary
per-user permission overrides. Authorization is granted through effective-dated
role assignments, granular role permissions, branch scope, and resource scope.

## Context

Migration `20260816170000_user_permission_overrides` briefly introduced a
`user_permission_overrides` table. The immediately following append-only
migration, `20260816190000_remove_user_permission_overrides`, removes it. The
current Prisma schema intentionally has no corresponding model.

## Consequences

- Permissions remain reviewable and auditable through roles rather than hidden
  exceptions on individual user accounts.
- Branch and resource controls remain backend-authoritative.
- Exceptional access is handled by a time-bounded role/branch assignment, not
  by reintroducing direct overrides.
