# API contract template

## Metadata

- Contract ID/version/sub-phase:
- Contract status: DRAFT / APPROVED
- Owner: Agent 4
- Upstream contract versions:
- Approvers and approval SHA/date:
- Consumers and canonical references:

## Endpoint catalog

| Method/path | Purpose | Permission/resource check | Request DTO | Response DTO | Audit |
| ----------- | ------- | ------------------------- | ----------- | ------------ | ----- |
|             |         |                           |             |              |       |

## Command behavior

- Validation and normalization:
- Transaction boundary:
- Capability resolver calls:
- Idempotency/optimistic concurrency:
- Lifecycle/business errors and HTTP mapping:
- Audit/history/outbox behavior:

## Read model behavior

- Complete authorized dataset:
- Case-insensitive search fields:
- Structured filters:
- Cursor format and deterministic stable ordering:
- Pagination boundary semantics:
- Accurate total versus explicitly page-scoped count:
- Query budget, batching, and N+1 assertion:
- Maximum page-size policy (not a completeness workaround):

## Acceptance

- Authorization mapping verified by Agent 3:
- Error/DTO examples:
- Unit/integration/E2E/query-count evidence:
- Open questions/blockers:
- Change log:
