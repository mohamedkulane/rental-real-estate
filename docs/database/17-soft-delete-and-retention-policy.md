# Soft Delete and Retention Policy

## Immutable / never physically delete

Posted journals and lines, financial source links, posted payment allocations/reversals/refunds, deposit transactions, paid/reconciled payout snapshots/attempts, signed LeaseVersion and contract evidence, issued statements, approval decisions, AuditLog, posted utility allocations, and processed outbox identity/payload.

## Archive/deactivate

Company/Branch, Party profiles with legal history, Property, Building, RentableSpace, ServiceEngagement, accounts, reference categories, roles/permissions, vendors, leases, listings, and operational records once activated/referenced. Use lifecycle status and `archivedAt` only where semantically useful; do not add universal `deletedAt`.

## Hard delete allowed

Abandoned unreferenced drafts, expired upload intents/quarantined objects, failed imports before acceptance, and ephemeral projections/cache may be removed under controlled cleanup. Draft deletion is prohibited once legal, financial, approval, audit, or external evidence references it.

## Privacy

Retention, anonymization, and legal hold are data-class/policy driven. Personal fields may be redacted/pseudonymized after retention while required accounting/contract identifiers and totals remain. Deletion never breaks journal, audit, or signed-document evidence.
