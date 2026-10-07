# Construction Domain Removal

Construction is intentionally removed from the final product. Development is an independent company-owned land workflow and no longer attaches to, imports, reports on, or derives progress from Construction.

The forward migration `20261005120000_remove_construction_domain` logs row counts with PostgreSQL notices before dropping the legacy Construction tables and record-number sequences. Before applying that migration to an environment containing historical rows, run `pnpm exec tsx scripts/backup-legacy-construction.ts` and retain the generated JSON outside the repository. Historical migration files remain as migration history; active schema, runtime code, navigation, seed data, reports, and permissions do not retain the domain.
