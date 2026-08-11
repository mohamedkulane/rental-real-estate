# UUID Strategy

## Decision

Use RFC 9562 UUIDv7-compatible identifiers for application-created primary keys. IDs carry no business meaning; staff-facing record numbers remain separate fields with scoped uniqueness.

## Generation

The reviewed `uuidv7` implementation in `@rerms/shared` generates identifiers immediately before aggregate creation. The first 48 bits contain Unix epoch milliseconds, version bits are `7`, and RFC variant bits are set correctly. Random bits come from Node cryptographic randomness.

Existing UUIDv4 rows remain valid and are not rewritten. PostgreSQL columns remain `uuid`. Clients never supply trusted primary keys for protected commands.

## Verification

Unit tests verify UUID format, version, variant, timestamp ordering, and uniqueness. Database constraints remain responsible for primary-key uniqueness under concurrency.
