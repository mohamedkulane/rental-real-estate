# Authorization

Authorization is deny-by-default and backend authoritative. Protected NestJS controllers use a session guard, permission metadata, a permission guard, and object-level service checks. Frontend navigation reflects permissions only for usability.

Permissions use capability names such as `identity.user.suspend` and `organization.branch.update`. Roles are configurable collections of permissions; no protected operation relies on a role-name comparison. Active effective-dated employee-role assignments aggregate permissions for the current request.

The complete decision is:

```text
authenticated ACTIVE account
AND required permission
AND employee resource scope
AND role grant branch scope
AND any operation-specific integrity or approval rule
```

`SUPER_ADMIN` is seeded with broad permissions but has no hidden bypass. It remains subject to authentication, audit, maker-checker, validation, and database constraints. Role creation, permission grants/revocations, and role assignment changes are audited.
