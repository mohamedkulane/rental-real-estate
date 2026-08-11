# Authorization Architecture

## Policy decision

Every backend command/query evaluates:

`permission AND branch scope AND object/resource scope AND record-state/approval constraints`

Branch access modes are `BRANCH`, `MULTI_BRANCH`, and `COMPANY_WIDE`. Company-wide is explicit. Owners, tenants, and vendors are company-level parties; Properties carry effective-dated operating-branch assignments.

## Enforcement points

- Controller authenticates the principal and validates transport input.
- Application service authorizes action and resource scope before loading/mutating sensitive data.
- Repository/query specifications include branch/object predicates to prevent post-filter leakage.
- Domain policy enforces state/amount/conflict invariants.
- Document URL issuance, exports, reports, search, workers, and provider callbacks use the same policy services.

Frontend route/component guards improve UX only and are not relied upon for enforcement.

## Object scope

Staff object scope can derive from portfolio/property/work assignment. External scope derives from verified owner representation, tenant/application/lease relationship, or vendor work-order assignment. Field/document classifications restrict what an otherwise authorized relationship may see.

## Maker-checker

Approval policy evaluates action, amount, branch, resource, creator, proposed approver, beneficiary/conflict, and previous sensitive changes. The same user normally cannot make and approve a protected operation. Small-branch compensating control is an explicit policy outcome with reason and post-review; never a hidden bypass.

Payout destination changes require re-verification, separation from payout approval/execution, and configurable hold. Emergency overrides are time-limited, reasoned, audited, notified, and placed in a post-review queue.

## Security and scale

Authorization decisions avoid fetching unnecessary sensitive fields. Permission/scope metadata may be cached briefly with revision/version invalidation, but denials and changes must take effect predictably. High-risk decisions are audit logged. Tests cover cross-branch, cross-owner, cross-tenant, cross-vendor, export, worker, and signed-file access.

See [authorization diagram](diagrams/authorization-model.md).
