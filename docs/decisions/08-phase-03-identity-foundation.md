# Decision 08 — Phase 3 Identity Foundation

## Status

Accepted for Phase 3.

## Decisions

- Use Argon2id with a 12-character practical minimum rather than composition rules.
- Use random opaque bearer tokens backed by hashed, revocable PostgreSQL session rows.
- Permit multiple sessions and revoke them on account suspension/disable; password reset revokes all.
- Keep employee records independent from user accounts so employment can precede system access.
- Treat an employee’s access mode, normalized branch assignments, and role-assignment branch scopes as separate authorization inputs.
- Seed roles as configurable permission collections; no role name is an authorization shortcut.
- Keep audit logs and approval decisions append-oriented at the database layer.
- Seed one generic maker-checker proof policy only; future business approval policies remain deferred.

## Consequences

Every future module must use backend permissions plus object scope. The Phase 3 browser token transport is replaceable without changing session semantics. No department hierarchy was invented, and no owner, property, lease, payment, or accounting behavior was added.
