# Owner payout approval enforcement

## Decision

Every owner payout requires one formal maker-checker approval before it can enter the approved or execution stages.

- Moving a payout from `DRAFT` to `REVIEW` creates and links an `ApprovalRequest`.
- The payout preparer is the approval request maker and cannot approve or reject that request.
- An authorized second employee records the decision. Only an approved request moves the payout to `APPROVED`.
- The approval request, decision, payout transition, actor, reason, and correlation context remain auditable.
- Amount thresholds are intentionally not inferred. The default policy applies to every owner payout because the project rule requires review and approval for all payouts.

This implements the accepted segregation direction in ADR-008 without adding an undocumented small-value bypass or emergency override.
