# Authorization and Approval Decisions

## Status

The authorization composition and segregation principles are approved. Detailed scopes, thresholds, conflicts, delegation, and emergency procedures remain open.

## Authorization composition

The company is a single organization with multiple branches. Backend authorization must combine:

1. role permission for the requested action;
2. branch scope allowing one, multiple, or all branches; and
3. resource/object scope where assignment or party relationship requires it.

Frontend visibility is not a security control. Every command, query, report, search, export, background job, notification, integration, and private-file authorization path must apply the relevant backend scope.

## Company-wide and branch access

Company-wide access is explicit. It does not arise merely because a user has a role in one branch. A user may hold different roles/scopes in different branches. Central teams may receive multi-branch access only through explicit authorization.

Historical branch attribution must be preserved even when a property or assignment transfers. Shared company records require deliberate field/action-level access, not wholesale cross-branch visibility.

## Object scope

Object scope may include portfolio/property assignment, workflow assignment, ownership/representation, tenant/application/lease relationship, or vendor work-order assignment. External users are always relationship scoped and field/document visibility is private by default.

## Segregation of duties

Sensitive financial actions must support configurable separation among creation/preparation, review/approval, and finalization/execution. Covered actions include:

- owner payouts;
- refunds;
- payment reversals;
- deposit deductions;
- write-offs;
- high-value expenses; and
- owner payout-account changes.

A person should not normally perform all stages alone. Approval policy may vary by action, amount, branch, and risk. Any exception must be an explicit approved rule with enhanced audit, not an ad hoc bypass.

## Approval integrity

- Approval evaluates the actor's authority at decision time.
- Creator/beneficiary/conflict relationships must be detectable.
- Payout-account changes require verification and separation from payout approval/execution.
- Rejected, withdrawn, expired, delegated, and superseded decisions remain in history.
- Approval does not replace domain validation; both are required.
- Sensitive decisions and overrides create audit events with reason and supporting evidence.

## Related ADRs

- [ADR-007](adr/ADR-007-backend-branch-scoped-authorization.md)
- [ADR-008](adr/ADR-008-segregation-of-financial-duties.md)

## Remaining policy dependencies

The business must approve scope inheritance, central roles, cross-branch party access, property transfers, exact conflicts and thresholds, delegations, small-branch compensating controls, emergency/break-glass access, external representative powers, export rights, MFA/re-authentication, and access-review cadence.
