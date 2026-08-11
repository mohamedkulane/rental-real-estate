# Outbox and Idempotency

`OutboxEvent` stores UUID event ID, module, aggregate type/id/version, event type/version, JSON payload, occurred/available/processed times, attempts, lock/lease fields, and size-limited failure details. It is inserted in the same transaction as domain state. A partial pending index supports dispatch; event ID is globally unique.

`InboxConsumption` has `(consumerName,eventId)` uniqueness so at-least-once consumers apply an event once. Consumer side effects and inbox insert share a transaction where local.

`IdempotencyRecord` protects externally initiated commands and financial writes. Scope + key is unique and stores request hash, status, response/resource reference, expiry, and timestamps. Reuse with a different request hash is rejected. Provider event IDs and payment external references are uniquely scoped by provider/account, not assumed globally unique.

Processed events retain immutable identity/payload; operational retry metadata may change. Poison events enter reviewed failure state rather than being silently dropped.
