# Draft, resume, and orchestration strategy

## Status

This is a design contract, not an approved schema. Draft/resume is a new backend/security concern and requires Domain, Security, Database, and API approval before implementation.

## Durable workflow envelope

The proposed workflow record contains: company, selected Branch, workflow type, lifecycle status, current step, creator/assignee, optimistic version, expiry/abandonment policy, last activity, idempotency key, audit correlation ID, and links to canonical records already created. This is not an unbounded generic JSON engine: each workflow+step has a discriminated, typed, versioned schema that rejects unknown fields. Payload is minimized and encrypted where sensitive. It never stores binary files, storage keys, passwords, or a duplicate canonical Party/Owner/Property record.

Suggested states are `DRAFT`, `IN_PROGRESS`, `BLOCKED`, `COMPLETING`, `COMPLETED`, `CANCELLED`, and `EXPIRED`, subject to domain approval. Workflow status coordinates progress; it does not replace aggregate lifecycle truth.

## Save and resume

1. Validate the typed step payload and authorization.
2. Persist a new optimistic version plus audit event.
3. Return a durable resume locator, never sensitive content in a URL.
4. On resume, reauthenticate, reauthorize company/Branch/object access, reload canonical records, and detect stale versions.
5. If access or capability changed, enter a precise blocked state and preserve authorized work.

Browser local storage is not the system of record. At most it may hold a nonsensitive display preference after Security approval.

Audit/outbox/log records use an allowlist: workflow ID/type, step, status/version, actor, Branch, correlation ID, timestamps, and controlled reason code. They exclude raw step payload, contact/identity values, free text, document metadata/content, and search terms.

## Finalization

Finalization is idempotent under one durable key. Two tabs cannot complete twice. Each domain command owns its transaction, invariants, history, outbox, and audit. The orchestrator checkpoints after every durable command and retries safely. A long database transaction across documents and multiple aggregates is prohibited.

Before each command, recheck expected version, permission/scope, canonical uniqueness, business date, ownership totals, topology constraints, and Service capability. When a later command fails, retain valid canonical work and show the exact resume point; never compensate by deleting shared identity or historical records.

## Cancel and expiry

Cancel stops future orchestration. It does not erase Party/Owner or valid shared data. A Draft Property may be discarded only under existing dependency guards; otherwise it remains a safe Draft. Engagement cancellation/archive and upload cleanup use their own domain policies. Expiry is audited and never silently finalizes or deletes canonical records.

## Duplicate prevention

- normalized server search for name, phone, email, organization/registration data;
- explicit possible-duplicate warning and authorized comparison;
- uniqueness and conflict constraints remain database authority;
- Party reuse is preferred; no automatic merge;
- an existing Party can gain one Owner profile through an authorized idempotent command;
- retries reuse canonical IDs already linked in the workflow.

## Required failure tests

Cover network interruption, stale version, permission revocation, Branch reassignment, duplicate submission, two-tab completion, overlapping Engagement activation, business-date rollover, upload-finalized/domain-failed, topology race, expired draft, and worker retry. Audit records across commands share one correlation ID.
