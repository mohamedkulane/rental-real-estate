# Authentication

The system uses first-party email/password authentication. Emails are normalized to lowercase. Passwords use Argon2id with library-managed salts, 64 MiB memory, three iterations, and parallelism one. The accepted length is 12-128 characters.

Login requires an ACTIVE user and employee. Invalid credentials and inactive accounts receive the same generic response. Redis-backed limits apply to login and password-reset requests using opaque IP/identity buckets.

Password reset tokens contain 256 random bits, are stored only as SHA-256 digests, expire, and are single-use. A raw development token is returned only when `EXPOSE_DEVELOPMENT_RESET_TOKEN=true` in a non-production environment; the default is false and production can never expose it. Production uses an out-of-band delivery adapter.

Passwords, hashes, tokens, and sensitive contact values are excluded from API responses, audit snapshots, and structured logs. OAuth, SSO, social login, and magic links are not part of the completed phases.
