# Automatic record numbering

Date: 2026-08-10

## Decision

Staff-facing create forms do not ask users to invent internal record numbers. PostgreSQL sequences generate the following identifiers inside the same transaction that creates the business record:

| Record        | Format      |
| ------------- | ----------- |
| Branch        | `BR-001`    |
| Employee      | `EMP-0001`  |
| Party         | `PTY-0001`  |
| Owner         | `OWN-0001`  |
| Property      | `PROP-0001` |
| Building      | `BLD-0001`  |
| RentableSpace | `SPC-0001`  |

Existing API clients may temporarily provide their own number for backward compatibility. When the number is omitted, the backend always generates it. Database uniqueness constraints remain authoritative.

Branch dropdowns display the branch name only. The generated branch code remains available in tables, reports, audit evidence, and backend relationships, but it is not used as the primary selector label.

## Rationale

- Removes avoidable user decisions and validation errors.
- Prevents concurrent users from receiving the same number.
- Keeps identifiers stable after names change.
- Preserves compatibility with existing Phase 3–4 automated tests and integrations.
