# Party Model

`Party` is the company-level identity root. It is not branch-owned and has one typed Person or Organization profile. Common contacts and addresses belong to Party so future business roles do not duplicate identity data.

Owner is an `OwnerProfile` keyed by Party. Tenant, Applicant, Vendor, and Guarantor workflows have not started. Contact values use versioned AES-256-GCM encryption at rest; a domain-separated HMAC-SHA-256 search index supports matching without plaintext comparison. Party list responses expose masked contacts, full values require `party.contact.read` in the authorized scope, ciphertext is never returned, and audit snapshots omit contact values.

Arbitrary identification metadata is not accepted by the API. Identity-document binaries must use approved object storage and stronger authorization when a future phase introduces that workflow.
