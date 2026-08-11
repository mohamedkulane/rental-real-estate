# Background Jobs and Events

## Event model

Use in-process domain/application events and a PostgreSQL transactional outbox. The source command writes business state and outbox records in one transaction. An outbox dispatcher publishes retryable work to BullMQ after commit. Kafka and external event infrastructure are prohibited for this architecture.

## Event catalog

Core events include `ServiceEngagementActivated`, `ServiceEngagementEnded`, `RentableSpaceBecameAvailable`, `RentableSpaceHeld`, `LeaseActivated`, `LeaseExpired`, `LeaseEnteredHoldover`, `PaymentPosted`, `PaymentReversed`, `DepositReceived`, `DepositDisputed`, `OwnerPayoutApproved`, `OwnerPayoutPaid`, `OwnerPayoutFailed`, `MaintenanceCompleted`, `BrokerageDealClosed`, `PropertyBranchTransferred`, and `AccountingPeriodClosed`.

Events carry event ID, version, aggregate ID/version, occurred-at, correlation/causation, actor/system context, and minimal payload. Consumers load authoritative data through allowed module queries if needed.

## Job families

- recurring charge and escalation generation;
- reservation expiry and listing/availability updates;
- lease, land-review, notice, and renewal alerts;
- payout execution/retry and provider-status checks;
- notifications and delivery reconciliation;
- outbox dispatch and dead-letter recovery;
- report/export and read-model projection;
- file malware scan/preview processing;
- reconciliation/import processing; and
- retention/archive tasks under approved policy.

## Reliability rules

- Every job has an idempotency/deduplication key and bounded retry policy.
- Jobs call public application commands; no direct table writes.
- Exponential backoff and dead-letter queues handle persistent failures.
- Business failures are not blindly retried.
- Queue payloads exclude secrets and large documents.
- Scheduling uses company timezone while occurrences store UTC and business date.
- Operators can inspect, retry, or cancel jobs under permission and audit controls.

## Ordering and consistency

Do not assume global ordering. Use aggregate version and consumer idempotency. Financial posting remains synchronous/transactional when user confirmation depends on it; the queue handles only external execution or follow-up. Read models and notifications may lag and expose freshness timestamps.
