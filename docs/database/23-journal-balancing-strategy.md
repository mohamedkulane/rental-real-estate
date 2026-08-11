# Journal Balancing Strategy

## Decision

A DRAFT JournalEntry may be incomplete while prepared inside a controlled workflow. A POSTED JournalEntry must have at least two lines and sum to exactly zero in transaction currency; reporting-currency amounts must also balance when populated. Posted entries and lines are immutable.

## Application validation and ordering

1. Authorize the typed posting request and validate source/idempotency/period.
2. Begin one database transaction.
3. Insert DRAFT JournalEntry, all JournalLines, source link, and required subledger changes.
4. Validate account posting permission, consistent currency/rate, nonzero lines, and zero sum using Decimal arithmetic.
5. Set JournalEntry to POSTED and write the outbox/audit evidence.
6. Commit; a deferred PostgreSQL constraint trigger independently verifies balance and period eligibility at transaction end.

No user-visible success occurs before commit.

## PostgreSQL enforcement

A `DEFERRABLE INITIALLY DEFERRED` constraint trigger runs when JournalEntry status becomes POSTED or its lines change. It rejects missing lines, nonzero sums, invalid posting accounts, or a period that disallows that posting class. Deferral permits lines to be inserted in any order within the same transaction but never permits an unbalanced commit.

## Reversals and periods

Reversal creates a new POSTED entry with opposite lines and `reversalOfId`; it never edits the original. CLOSED/LOCKED periods cannot receive ordinary postings. Corrections post to an eligible OPEN or policy-authorized SOFT_CLOSED period with source-period reference. A LOCKED period is never reopened by application code.

Tests must prove application and database rejection independently, including concurrent and direct-SQL attempts.
