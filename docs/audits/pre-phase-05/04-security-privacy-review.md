# Security and privacy review

## Authentication

- Passwords remain Argon2id hashes.
- Login creates a random opaque server session; only its hash is persisted.
- Browser transport is an HttpOnly, SameSite=Strict cookie scoped to `/api`; production also sets Secure.
- CORS admits only the configured frontend origin, with localhost/127.0.0.1 aliases only outside production.
- Logout, password change, suspension, disabling, and administrator revocation remain immediately authoritative in the database.
- Session activity writes are throttled; permission and role scope are resolved from current database state so stale browser claims do not grant access.
- Login and reset requests are Redis-limited by separate opaque HMAC buckets built from IP plus normalized identity.
- Reset tokens are never returned in production and require an explicit default-off switch in test/development.

## Platform hardening

Helmet sets a restrictive API CSP, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, no-referrer, nosniff, cross-origin policies, and HSTS. Express technology disclosure is disabled. Swagger is unavailable unless explicitly enabled and is always unavailable in production.

## Party privacy

- Directory responses return masked contacts and exclude ciphertext/search hashes.
- Full contact detail requires `party.contact.read` in the authorized object scope.
- Cross-branch object access is enforced in the backend.
- Arbitrary identification secrets are rejected by DTO whitelist validation.
- Contact encryption is versioned AES-256-GCM. A key ring supports controlled decryption during rotation.
- Lookup uses a dedicated, stable, domain-separated HMAC-SHA-256 secret; rate-limiting uses another dedicated secret.
- Audit snapshots do not contain passwords, reset tokens, contact plaintext, encryption keys, cookies, or authorization headers.

## Residual risk

No unresolved CRITICAL or HIGH security/privacy finding remains. Key rotation requires an operator-controlled re-encryption/backfill deployment step before retiring an old decryption key; ADR 12 and environment documentation retain this requirement.
