# ADR-007: Backend Branch-Scoped Authorization

## Status

Accepted — 8 August 2026.

## Context

The system serves one company with multiple branches. Staff may work in one, several, or all branches, while some records also require portfolio/property assignment or external party relationship checks. Frontend-only restrictions are bypassable and do not protect APIs, exports, jobs, files, or integrations.

## Decision

Backend authorization combines role permission, explicit branch scope, and resource/object scope where required. Company-wide access is explicit. The same controls apply to commands, queries, reports, exports, background work, integrations, and private document access.

## Rationale

Composed server-side authorization provides least privilege without treating branches as separate SaaS tenants and accommodates central teams and assigned operational work.

## Consequences

- Roles alone do not grant data access.
- Users can hold different scopes across branches.
- Every resource must define its organizational/object scope rules.
- Cross-branch and company-wide reporting needs explicit authority.
- External users require relationship and field/document-level checks.

## Alternatives considered

- Frontend menu/route hiding: rejected as non-enforcement.
- Separate database/tenant per branch: rejected because this is one company with shared parties and central functions.
- Role-only RBAC: rejected because it cannot constrain records within a role.

## Risks

- Inconsistent filters can leak data in search, exports, queues, or file URLs.
- Shared parties and property transfers can create ambiguous scope.
- Broad central roles may accumulate excessive privilege.

## Implementation implications

- Authorization policy is centralized and deny-by-default but evaluated at each backend boundary.
- Tests cover cross-branch, cross-owner, cross-tenant, and cross-vendor attempts.
- Scope changes and privileged access are audited.
- Historical branch attribution is retained.
- Inheritance, transfers, central roles, and representative visibility require detailed policy approval.
