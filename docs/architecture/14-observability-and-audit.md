# Observability and Audit

## Operational observability

Emit structured logs with timestamp, severity, service/process, environment, request/job ID, correlation/causation ID, module, safe actor ID, and error code. Do not log secrets, full documents, screening contents, or sensitive financial fields.

Metrics cover API latency/error rate, PostgreSQL pool/query health, Redis/BullMQ depth/age/failures, outbox lag, worker duration, external provider results, file scans, reconciliation exceptions, posting failures, and projection freshness. Distributed tracing is optional initially; correlation across HTTP, transaction outbox, and jobs is mandatory.

Alerts are actionable and severity-routed. Health endpoints distinguish liveness from readiness. Dashboards expose business-critical exception queues without turning metrics into financial truth.

## Audit architecture

Audit is append-only evidence separate from operational logs. Sensitive actions publish audit records in the same transaction as the protected change when atomic evidence is required. Records include effective actor/system identity, action, target, time, branch/object scope, request/correlation ID, reason, approval/override reference, and safe before/after or change summary.

Authentication, authorization failures, scope/role changes, financial posting/reversal, approvals, payout account changes, contract signing/versioning, partition/branch transfer, file access/sharing, exports, impersonation, and emergency overrides are audited.

Audit access/export is restricted and itself audited. Tamper evidence, retention, redaction, and legal hold are policy-driven. Audit logs never replace domain transition history or accounting journals.
