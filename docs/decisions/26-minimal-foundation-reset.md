# Minimal foundation reset

## Decision

Local/dev databases may be wiped to a minimal foundation:

- one company
- one **Head Office** (`HQ`) branch
- nine operational roles with permission grants
- Super Admin (`EMP-0001`) + three Head Office agents (`EMP-0002`–`EMP-0004`)
- no properties, leads, leases, finance transactions, or portal demo data

Demo sample data is optional via `SEED_DEMO=1`.

## Roles

1. Super Admin
2. Branch Manager
3. Property Manager
4. Leasing / Rental Agent
5. Sales Agent
6. Maintenance / Operations Officer
7. Finance Officer
8. Construction / Development Officer
9. Reception / Staff

## How to run

```bash
# From repo root, with Postgres up:
Get-Content scripts/reset-minimal-foundation.sql | docker exec -i rerms-foundation-postgres-1 psql -U rerms -d rerms
pnpm db:seed
```
