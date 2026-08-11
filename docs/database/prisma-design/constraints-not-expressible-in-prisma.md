# Constraints Not Expressible Directly in Prisma

| Rule                                               | PostgreSQL strategy                                                                                                   |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Exclusive possession must not overlap              | GiST exclusion on `rentable_space_id` and `tstzrange(possession_from,possession_to,'[)')`, partial to blocking states |
| Incompatible ServiceEngagement overlap/inheritance | Scope-level GiST exclusions plus deferred trigger resolving property/space hierarchy and compatibility matrix         |
| Effective ownership/entitlement overlap and totals | GiST exclusion for duplicate owner intervals; deferred trigger for percentage totals at interval boundaries           |
| RentableSpace version/parent temporal consistency  | GiST exclusions, recursive cycle check trigger, same-property and version-coverage trigger                            |
| Child area not above parent                        | Deferred statement/constraint trigger evaluating all changed effective boundaries under parent-scoped lock            |
| Posted journal balance                             | Deferred constraint trigger summing signed lines per journal/currency before commit                                   |
| Scoped external payment uniqueness                 | Partial unique functional index on provider/account scope + normalized reference for verified/posted rows             |
| Immutable posted financial records                 | BEFORE UPDATE/DELETE triggers with tightly scoped allowed operational columns where needed                            |
| Immutable signed contract versions                 | BEFORE UPDATE/DELETE trigger once `signed_at` is non-null                                                             |
| Outbox/inbox idempotency                           | Unique event ID; unique `(consumer_name,event_id)`; partial pending index                                             |
| Journal source exactly one                         | CHECK counting non-null typed source FKs equals one                                                                   |
| Effective ranges and percentages                   | CHECK constraints and generated/range expressions                                                                     |

Application validation remains necessary for friendly errors, but cannot replace these authoritative controls.
