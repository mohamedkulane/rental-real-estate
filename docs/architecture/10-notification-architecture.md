# Notification Architecture

## Responsibility

The Notifications module converts approved notification intents/events into channel deliveries. It owns templates/versions or references legally governed templates, recipient resolution snapshots, preferences/consent checks, scheduled time, channel attempts, provider IDs, and delivery status. It does not decide domain outcomes.

## Flow

Domain event/command -> notification policy -> intent -> BullMQ delivery job -> provider adapter -> delivery callback/status -> audit/operational metrics.

Supported adapters may include email, SMS, WhatsApp, and in-app. Provider-specific payloads remain behind ports. A template version and locale are recorded for reproducibility.

## Rules

- Transactional/legal notices use approved versioned templates and delivery rules.
- Marketing messages respect consent and opt-out; mandatory service/legal communications follow approved policy.
- Recipient and address are snapshotted at send time without exposing unrelated party data.
- Retries are idempotent and provider callbacks are authenticated/deduplicated.
- Failed delivery creates an exception/task when business action is required.
- Notification success never substitutes for legally required proof unless the approved policy says so.

## Security and scale

Secrets live in secrets management. Message content and contacts are minimized in logs. Branch/object permission governs manual sends and history. Queues isolate provider latency; rate limits and per-provider circuit breakers protect the system.
