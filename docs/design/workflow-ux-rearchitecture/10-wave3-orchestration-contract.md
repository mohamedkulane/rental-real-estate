# Wave 3 Property Onboarding Orchestration Contract

Status: APPROVED FOR WAVE 3 IMPLEMENTATION

## Boundary

Property Onboarding coordinates existing Party, OwnerProfile, Property,
PropertyOwnership, Building, RentableSpace, ServiceEngagement, and Document
commands. It does not replace those aggregates and it creates no Unit, Lead,
Listing, SaleDeal, Lease, Finance, Maintenance, ConstructionProject, or
DevelopmentProject model.

## Lifecycle and steps

`DRAFT → IN_PROGRESS → READY_TO_COMPLETE → COMPLETING → COMPLETED` and
`DRAFT|IN_PROGRESS|FAILED → CANCELLED`; `COMPLETING → FAILED` is retryable.
The ordered steps are Owner/Party, Ownership,
Property Details, Building/Structure (conditional), Rentable Spaces
(conditional), Company Service (conditional), Documents (optional), and Review.
The server returns the authoritative current step and skips inapplicable steps.

## Typed draft envelope

Each draft has a workflow id, type (`PROPERTY_ONBOARDING`), company id, branch
scope, creator, status, current step, integer version, timestamps, typed references
through a controlled `WorkflowCanonicalReference` link table (`workflowId`,
`entityType`, `entityId`, `step`, `expectedVersion`) to canonical entities, and a versioned
discriminated payload. Payload variants are step-specific DTOs validated by the
API; arbitrary keys and unknown versions are rejected. Payloads are minimized
and encrypted at rest; raw contact data, document content/metadata, storage
keys, and upload binaries are never stored in the envelope. Canonical ids are
references only—canonical truth remains in the domain tables.

## Authorization and isolation

Every read, mutation, resume, cancel, and completion re-evaluates company and
current branch authorization using the existing permission service and explicit
conjunctions (`workflow.draft.read/update/cancel/complete` plus the next domain
command). BRANCH principals are limited to the stored branch; MULTI_BRANCH is
limited to the intersection of authorized branches; COMPANY_WIDE still cannot
cross company boundaries. A hidden navigation action is never an authorization
boundary. Branch transfer or permission loss makes the draft unavailable until
reauthorized; no cross-company reference is accepted and selectors redact
unauthorized records.

## Version safety and recovery

Draft updates require the client version and atomically increment it. A stale
version returns a conflict with the latest version and never overwrites data.
Save/retry is safe after network failure. Cancel is an audited state transition
and never deletes canonical records already created.

## Completion and idempotency

Completion requires an idempotency key bound to the workflow and caller, with a
durable uniqueness constraint on `(workflowId, callerId, idempotencyKey)` and a
defined retention/expiry policy. A replay with the same key but a different
request hash is rejected as an idempotency conflict; an expired key cannot be
reused for completion. The server validates prerequisites before each
canonical command. Each domain command owns its own short transaction and emits
an auditable checkpoint; the orchestrator never holds a cross-aggregate
transaction open. A later failure preserves valid checkpoints and marks the
workflow `FAILED` with a safe retry step. The completion record stores resulting
canonical ids and returns the same result for a repeated key or completed
workflow only after re-checking caller, company, and branch authorization.
External document storage uses an outbox/compensating state; no
transaction spans object storage.

## Audit and failure recovery

Create, update, resume, cancel, completion request, completion success, and
completion failure emit audit events with correlation id and actor. Document
storage uses the existing private object-storage and versioning services; an
unfinalized upload is recoverable and cannot make the workflow appear complete.
Failures leave the draft resumable or explicitly failed with a retry-safe
status; already committed canonical writes remain valid and are referenced by
the draft. Each retry is idempotent and never duplicates a canonical record.
The draft stores a per-reference expected-version snapshot; a changed canonical
record returns a typed stale-conflict naming the affected step and preserves the
draft for correction. Document uploads use an explicit upload-session id and
reconciliation status; a timed-out session is retried or abandoned without
marking the workflow complete.

## UI interaction contract

The wizard always exposes Back, Continue, Save Draft, Resume Later, and safe
Cancel. Continue validates only the current step and persists a checkpoint;
Back never discards data. Incomplete Work lists workflow name, current step,
last-updated time, and authorized branch/context with Continue and Cancel. It
has loading, empty, error, and permission-loss states. Resume reauthorizes the
workflow before rendering. Stale version conflicts retain local edits and
offer reload/merge-or-cancel; duplicate completion shows the existing result.
Dialogs/sheets fit 390px, trap focus, support Escape, restore focus, expose
visible keyboard focus, and respect reduced-motion preferences.

## Required review evidence

Before implementation: independent Domain and Security PASS, zero Critical/High.
Implementation must add unit, integration, E2E, authorization, stale-version,
concurrency, duplicate-completion, retry, branch-isolation, and recovery tests.

## Review approval evidence

- Independent Security/scope review: PASS, 2026-09-04; zero Critical/High.
- Independent Domain/QA review: PASS, 2026-09-04; zero Critical/High.
- Independent UX-content review: PASS, 2026-09-04; zero Critical/High.
- Permission seed/migration ownership: Database/Security contract owners;
  implementation adds only the four `workflow.draft.*` permissions through the
  governed seed/migration path.
