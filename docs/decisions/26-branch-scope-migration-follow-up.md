# Branch Scope Migration Follow-up

Agreement workflows preserve current branch authorization by checking the record branch and the principal's authorized branch set. They do not require the customer and property to share an identical branch.

Several legacy operational tables still require a non-null `branchId`. This prevents a fully company-wide record from being represented without choosing a branch at persistence time. This batch does not assign an HQ branch as a substitute and does not expand the branch schema.

The follow-up migration must define explicit company-wide ownership semantics for those tables, backfill only from auditable source data, and retain branch-scoped employee denial for records outside authorized scope.
