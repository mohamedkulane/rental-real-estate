# Security Architecture

## Principles

Deny by default, least privilege, defense in depth, secure defaults, immutable evidence, purpose-limited data, and no trust in client-side validation.

## Identity and session security

Use strong password hashing, short-lived secure sessions/tokens with rotation/revocation, secure reset/invite tokens, and MFA for privileged roles. High-risk actions may require re-authentication. Session/device history and security events are visible to authorized administrators.

## Application security

- Validate every REST input with explicit DTO/Zod-compatible contracts and domain validation.
- Enforce role + branch + object authorization in backend application boundaries.
- Apply CSRF protection where cookie sessions are used; strict CORS and security headers.
- Rate-limit authentication, public inquiries, uploads, and sensitive commands.
- Use parameterized persistence, output encoding, and safe error responses.
- Idempotency protects payment/provider writes; signatures protect webhooks.

## Data and secrets

TLS in transit; encryption at rest for database/storage; field-level protection for payout/bank/identity secrets where threat analysis requires it. Secrets are injected from protected environment/secret storage, never source control. Logs and queues exclude credentials and unnecessary personal data.

## Files and supply chain

Private object storage, short-lived URLs, file signature/size/MIME checks, malware scanning, and approved public-media promotion. CI scans dependencies, images, secrets, and vulnerabilities; builds immutable images and records provenance.

## Legal configuration

Contract/notice templates, notice periods, deposit/late-fee policies, signature requirements, and termination workflows are versioned configuration with approval/effective dates. Architecture does not hard-code jurisdiction rules.

## Verification

Threat model high-risk flows; test cross-scope authorization, OWASP classes, uploads, webhooks, financial idempotency, session revocation, and backup access. Security incidents follow audited response and credential/session revocation procedures.
