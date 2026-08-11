# Role and Permission Analysis

## Authorization model

Static role checks are insufficient. Each backend decision should evaluate:

`action + resource type + resource relationship + organization scope + assignment scope + record state + amount/approval limit + conflict-of-duty rules`

The system has one company boundary, but multiple internal and external scopes:

- company-wide;
- branch;
- portfolio;
- property/rentable-space assignment;
- workflow/task assignment;
- owner relationship;
- tenant/application/lease relationship; and
- vendor work-order relationship.

Company-wide access must be explicitly granted; it must not arise merely from holding a role with the same name in one branch.

## Role observations

- **Super Admin:** should manage configuration/access and inspect audit data, but financial posting is not implicit. Break-glass access requires reason, time limit, and enhanced audit.
- **General Manager:** company-wide visibility does not automatically imply unrestricted finance, sensitive screening, or security administration.
- **Branch Manager:** branch scope needs rules for records spanning branches, transfers, central accounts, and jointly managed portfolios.
- **Property Manager:** access should follow current assignment while preserving limited historical access only where operationally required.
- **Leasing Agent:** needs prospect/listing access but not unrestricted owner identity, bank data, screening details, ledgers, or internal risk notes.
- **Accountant:** can post finance within scope but should not automatically approve own payouts/refunds/write-offs or alter access rules.
- **Maintenance Coordinator/Inspector:** require restricted property/contact/evidence access; financial and identity fields should be minimized.
- **Customer Service:** should see service-relevant information, not full contracts, screening, bank, or internal finance.
- **Owner:** object-level access by verified ownership/representation and effective dates, including multi-owner privacy rules.
- **Tenant/applicant:** only own application, contract, balance, payments, notices, and requests, with co-tenant disclosure rules.
- **Vendor:** only assigned jobs, approved contact/access details, quotation/invoice/evidence, and permitted status changes.

## Sensitive action families

Separate permissions and approvals are needed for:

- role/scope/approval-policy changes;
- viewing/exporting IDs, screening, bank, or payout data;
- ownership and payout-destination changes;
- property/space activation, partition, merge, retirement, and override;
- application decision and screening evidence access;
- lease approval, waiver, signature finalization, termination, and voiding;
- financial posting, reversal, refund, write-off, adjustment, period close/reopen;
- deposit deduction/refund;
- expense/vendor onboarding/bill approval;
- owner statement approval and payout execution;
- emergency maintenance override;
- audit-log access/export;
- bulk exports, imports, and document downloads; and
- external-user impersonation or support access.

## Segregation of duties

The source's "where staffing permits" wording is too weak for material finance. Minimum enforceable conflicts should include:

- creator cannot finally approve own material payout/refund/expense/write-off;
- payout-destination changer cannot approve or execute payment to that destination during hold;
- vendor creator/change approver cannot alone approve a material bill to that vendor;
- payment posting and reconciliation should be separated or require compensating review;
- access administrator cannot grant themselves durable financial authority without independent approval;
- period-close approver cannot silently alter closed transactions; and
- emergency override actor cannot complete the subsequent exception review.

Small-branch exceptions need named compensating controls, not silent relaxation.

## Branch and cross-scope risks

- Owner, tenant, vendor, and account records may relate to multiple branches; duplicating parties per branch creates inconsistent identity and financial risk.
- A central finance team may need cross-branch transaction access but not operational notes or screening records.
- Property transfer between branches must effective-date access and reporting without rewriting historical branch attribution.
- Shared bank accounts and company-wide sequences need central controls while transactions retain branch/cost-center dimensions.
- Search, exports, dashboards, notifications, background jobs, and file URLs must apply the same object-level scope as detail APIs.

## Portal and document controls

Portal visibility must be field/document-classification based and relationship checked. Entity association alone is unsafe. Signed URLs should be short-lived and authorized when issued. Internal notes, screening evidence, other owners' payout data, co-tenants' private data, vendor internal evaluation, and audit details remain private by default.

## Audit expectations

Audit events should capture actor and effective identity, action/command, entity, request/correlation ID, timestamp, source/IP/session, scope, reason, approval reference, and safe before/after data. Secret values and full sensitive documents should not be copied into logs. Audit access and export are themselves audited.

## Decisions required

Business approval is needed for the branch/portfolio inheritance model, central-team roles, cross-branch party access, role stacking, delegation, temporary coverage, approval thresholds, small-branch compensating controls, owner-representative powers, co-tenant visibility, vendor access, and break-glass procedure.
