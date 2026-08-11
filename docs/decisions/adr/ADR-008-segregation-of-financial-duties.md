# ADR-008: Segregation of Financial Duties

## Status

Accepted — 8 August 2026.

## Context

Owner payouts, refunds, reversals, deposit deductions, write-offs, expenses, and payout-destination changes can misdirect or conceal money if one user controls preparation, approval, and execution. Static roles alone cannot express action, amount, branch, or conflict conditions.

## Decision

Sensitive financial operations support configurable segregation among creation/preparation, review/approval, and finalization/execution. A user should not normally perform every stage of the same sensitive transaction. Policies may vary by action and amount, and exceptions require explicit rules, reasons, enhanced audit, and compensating control.

## Rationale

Segregation reduces fraud and error, protects owner and tenant funds, and makes approval authority demonstrable while allowing controlled adaptation to branch staffing.

## Consequences

- Approval policy is a first-class shared capability.
- Transaction creator, approver, executor, beneficiary/conflict, amount, and destination-change history matter.
- Small branches need approved compensating controls rather than silent bypass.
- Approval history remains immutable even when requests expire, are rejected, or are delegated.

## Alternatives considered

- Trust privileged roles to self-approve: rejected due to fraud and error risk.
- Hard-code two-person approval for every amount: rejected because actions and risk thresholds differ.
- Audit after the fact without preventive controls: rejected because money may already be lost.

## Risks

- Poorly chosen thresholds can either block operations or permit material self-dealing.
- Delegation can recreate conflicts if not checked.
- Emergency exceptions can become routine bypasses.

## Implementation implications

- Approval policies support action, amount, scope, stage, and conflict rules.
- Domain validation remains mandatory after approval.
- Payout-account changes are separated from payout approval/execution and may impose holds.
- Sensitive actions and exceptions produce tamper-resistant audit events.
- Exact thresholds, conflict matrix, delegation, emergency rules, and compensating controls remain business decisions.
