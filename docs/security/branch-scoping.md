# Branch Scoping

Employee access mode is explicit: `BRANCH`, `MULTI_BRANCH`, or `COMPANY_WIDE`. Branch memberships are normalized effective-dated rows; identifiers are never stored as comma-separated text or as an authorization-only JSON list.

A branch operation requires two independently evaluated facts:

1. The employee can access the branch through an active branch assignment, or has explicit `COMPANY_WIDE` access.
2. The required permission comes from an active role assignment scoped to that branch or from an explicitly company-level role assignment.

This prevents combining a permission granted in Hodan with an unrelated employee assignment in Wadajir. A powerful role does not imply company-wide access, and company-wide access without the permission is also insufficient. List queries are restricted to the authorized branch set, while individual-resource operations repeat the object-level check.
