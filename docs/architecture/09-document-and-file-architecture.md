# Document and File Architecture

## Ownership split

Object storage owns binary content. The Documents module owns metadata: document ID, entity link, type/classification, version, object key, size/MIME/hash, scan state, effective/expiry dates, creator, signature evidence, retention/legal hold, and shareability.

## Upload flow

1. Backend authorizes upload intent and issues a constrained upload target.
2. Client uploads to quarantine/pending storage.
3. Backend/worker validates size, MIME/signature, hash, and malware scan.
4. A finalize command creates an immutable document version and links it to its domain record.
5. Failed/abandoned uploads expire and are cleaned safely.

Private downloads require fresh backend authorization and short-lived signed URLs. Public listing media is copied/promoted only after explicit approval and never shares the private object key.

## Signed contracts

Draft generations are versioned. Final signed artifacts, signer evidence, timestamps, provider references, and content hash are immutable. Amendments and renewals create linked document/contract versions rather than overwrite. Domain modules own legal lifecycle; Documents owns binary integrity and access.

## Security and operations

- Encrypt in transit and at rest; object storage is private-by-default.
- Use non-guessable object keys unrelated to user filenames.
- Sanitize filenames for display and block executable/unsupported types.
- Avoid sensitive metadata in logs/queues.
- Audit sensitive upload, download, sharing, signature, replacement, and retention actions.
- Back up/version objects consistently with database recovery objectives.
- Retention/anonymization/legal-hold policies are versioned configuration, not hard-coded jurisdiction rules.

## Scaling

Direct client uploads/downloads avoid API bandwidth bottlenecks. Preview/virus processing is asynchronous. Database queries operate on metadata; binary content is never stored in PostgreSQL.
