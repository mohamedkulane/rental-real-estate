# Migration Notes

- Do not run or generate migrations from this review package.
- Finalize model/column mappings before creating the production Prisma schema.
- Use Prisma migrations for mapped tables/FKs/enums and reviewed companion SQL for extensions, checks, exclusions, partial indexes, deferred triggers, and immutability.
- Never use `db push` in production; it may omit or disturb native controls.
- Migration CI must apply from empty database, upgrade from previous release, run constraint/concurrency tests, and detect schema drift including native SQL.
- Backfills are restartable/idempotent and separate schema expansion from data validation and constraint validation.
- Add NOT NULL/validated constraints only after existing rows pass checks.
- Import legacy Unit records as canonical RentableSpace identities with preserved source mappings.
- Opening finance data enters through approved balanced journals and reconciled subledger opening records.
- UUIDv7 generation mechanism must be chosen for the deployed PostgreSQL/runtime version before production schema promotion.
