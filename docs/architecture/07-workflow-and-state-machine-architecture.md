# Workflow and State-Machine Architecture

## Pattern

Each lifecycle is owned by its domain module. Commands name transitions, validate allowed source state, authorization, guards, and expected version, then persist state + history + outbox atomically. Generic workflow/approval infrastructure coordinates tasks but never owns domain truth.

## Recommended states

| Aggregate                  | States                                                                                                                                                                           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ServiceEngagement          | `DRAFT -> REVIEW -> APPROVED -> ACTIVE -> SUSPENDED -> TERMINATING -> ENDED`; `REJECTED/CANCELLED` before activation                                                             |
| RentableSpace availability | derived `UNAVAILABLE/PREPARING/AVAILABLE/HELD/OCCUPIED/RENTED_EXTERNAL/RETIRED`; derived from readiness, blocks, possession, brokerage and lifecycle facts                       |
| Listing                    | `DRAFT -> REVIEW -> PUBLISHED -> PAUSED -> EXPIRED/UNPUBLISHED/ARCHIVED`                                                                                                         |
| Lead                       | `NEW -> ASSIGNED -> CONTACTED -> QUALIFIED -> ACTIVE_OPPORTUNITY -> CONVERTED/LOST`                                                                                              |
| Viewing                    | `REQUESTED -> SCHEDULED -> CONFIRMED -> COMPLETED`; alternatives `RESCHEDULED/CANCELLED/NO_SHOW`                                                                                 |
| Application                | `DRAFT -> SUBMITTED -> VERIFYING -> UNDER_REVIEW -> APPROVED/REJECTED/WITHDRAWN/EXPIRED`                                                                                         |
| Reservation                | `PENDING -> ACTIVE -> CONVERTED`; alternatives `EXPIRED/CANCELLED/RELEASED`                                                                                                      |
| Lease                      | `DRAFT -> REVIEW -> APPROVED -> SIGNING -> SIGNED -> PENDING_POSSESSION -> ACTIVE -> NOTICE/HOLDOVER -> ENDED`; explicit `AMENDED/RENEWED/EXTENDED/TERMINATED/CANCELLED` records |
| Payment                    | `CAPTURED -> VERIFYING -> VERIFIED -> POSTED -> PARTIALLY_ALLOCATED/FULLY_ALLOCATED`; `REJECTED/REVERSED/REFUNDED` via explicit transactions                                     |
| Deposit                    | account lifecycle `OPEN -> HELD -> SETTLEMENT_PENDING -> DISPUTED/PARTIALLY_SETTLED -> SETTLED/CLOSED`; movements are immutable transaction types                                |
| OwnerPayout                | `DRAFT -> REVIEW -> APPROVED -> QUEUED -> PROCESSING -> PAID -> RECONCILED`; alternatives `HELD/REJECTED/FAILED/CANCELLED`, failed may retry                                     |
| MaintenanceRequest         | `SUBMITTED -> TRIAGED -> APPROVAL/QUOTATION -> ASSIGNED -> IN_PROGRESS -> VERIFICATION -> CLOSED`; `CANCELLED/REOPENED` controlled                                               |
| WorkOrder                  | `DRAFT -> APPROVAL -> ISSUED -> ACCEPTED -> IN_PROGRESS -> COMPLETED -> VERIFIED -> CLOSED`; `CANCELLED/DISPUTED` controlled                                                     |
| Expense                    | `DRAFT -> SUBMITTED -> REVIEW -> APPROVED -> POSTED -> PAID/RECONCILED`; `REJECTED/CANCELLED/REVERSED` controlled                                                                |
| Approval                   | `REQUESTED -> PENDING -> APPROVED/REJECTED/EXPIRED/WITHDRAWN`; delegation creates history, not replacement                                                                       |

## Lease semantics

`agreementDate`, `leaseStartDate`, `possessionDate`, and `leaseEndDate` are distinct. Reservations block normal availability but do not create occupancy. MVP occupancy is exclusive and overlapping active possession intervals are prohibited. Expiry may transition to `HOLDOVER`; it never silently creates a new lease. Waivers are explicit records and never delete charges.

## Side effects

Synchronous side effects required for invariants occur in the command transaction. Notifications, scheduled follow-ups, projections, and integrations react after commit. Every transition records actor/system principal, reason, timestamp, source/target state, policy version, and correlation ID.

See lifecycle diagrams in `diagrams/`.
