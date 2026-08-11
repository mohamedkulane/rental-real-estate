# Approval and Audit Model

## Approvals

ApprovalPolicy and ordered ApprovalRule define action type, amount/currency thresholds, branch/access scope, required sequence, maker-checker conflicts, delegation allowance, emergency/compensating controls, and effective dates.

ApprovalRequest records one protected action, maker, branch/context, target locator, requested amount, policy/rule version, status, and correlation. ApprovalStep materializes required sequence/assignee constraints. ApprovalDecision is immutable and records approver, outcome, reason, delegation, emergency/compensating-control evidence, and time.

Sensitive domain records (payout, refund, reversal, deduction, write-off, high expense, destination change) carry a real `approvalRequestId` FK when approval applies. The generic target locator is navigation/audit context, not the only referential link.

## Audit

AuditLog is append-only with actor/effective actor, action, safe entity type/id, branch/property context, request/correlation/causation IDs, reason, timestamp, IP/session metadata where allowed, and size-limited/redacted JSON before/after or change summary. It never stores secrets, binaries, or full sensitive documents.

Protected mutation and mandatory audit insert share a transaction. Audit indexes support entity, actor, branch, and time lookups; time partitioning is a future volume option.
