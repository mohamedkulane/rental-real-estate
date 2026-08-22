# Phase 4 operational UX closure decisions

Date: 2026-08-21

## Private Document storage

Phase 4 Document files use the architecture-approved S3-compatible private object store. Browser clients never receive public object URLs or internal storage keys. Upload, inline view, download, metadata update, archive, and immutable new-version operations are mediated by the NestJS API, backend permission checks, effective company/branch scope, and audit logging. MinIO is the local development provider; production may use a compatible private provider without changing the domain contract.

Uploads are validated server-side. The default maximum is 25 MiB and is environment-configurable. Supported PDF, image, text, Word, and Excel MIME declarations must match recognized file signatures. Business display title, sanitized original filename, checksum, and private storage key remain separate fields.

## Amenities Catalog scale

Amenities Catalog is a bounded company administrative reference catalog, not an unbounded operational register. The seed provides ten reference entries, the API returns the complete authorized catalog in stable code order, and client-side catalog filtering is allowed. Property and Rentable Space amenity-assignment workspaces remain focused server-side paginated read models because assignment volume scales with the portfolio. If the catalog becomes user-extensible beyond a bounded administrative set, it must move to server-side search and cursor pagination before that expansion ships.

## Search and selectors

First-class operational registers and aggregate workspaces use server-side case-insensitive search, relevant filters, stable cursor ordering, and backend scope enforcement. Searchable entity selectors query focused endpoints after a 300 ms debounce, preserve an existing selected value, do not auto-select the first result, and expose keyboard/ARIA loading, empty, clear, and error behavior. Small bounded status/type/reference choices remain plain selects without redundant search boxes.

## Business identifiers

New Buildings receive safe forward-only sequence numbers in `BLD-0001` form when callers omit a code. Existing historical codes are preserved. Property, Owner, Party, Branch, Employee, and Rentable Space numbering decisions remain unchanged.
