# Employee and business Party separation

## Status

Accepted on 2026-08-11.

## Decision

An Employee keeps an internal Party row only as an implementation identity for shared naming, branch linkage, and audit references. That internal row is not a business Party and must not appear in the People & organizations directory, Party search results, Owner candidate lists, or portfolio ownership workflows.

Employee identity rows use an internal `STF-<employee UUID>` key and do not consume the `PTY-####` business record-number sequence. Employee numbers remain the human-facing staff identifiers.

An Employee-linked Party cannot receive an OwnerProfile. Conversely, an existing Owner Party cannot later be linked to an Employee. The API and PostgreSQL both enforce this invariant.

## Editable Party fields

Party number and Party kind are stable identifiers and remain read-only after creation. Authorized users may update the display/legal name, active status, typed Person or Organization profile, contact points, and addresses. Contact replacement remains encrypted at rest and audit evidence records only counts and non-sensitive metadata.

## Consequences

- Employee records remain managed only from Employees.
- Owners are selected only from business Parties.
- Existing internal employee Party keys are migrated without deleting employee, user, role, session, branch, or audit history.
- Direct attempts to read or update an Employee through Party endpoints are rejected.
