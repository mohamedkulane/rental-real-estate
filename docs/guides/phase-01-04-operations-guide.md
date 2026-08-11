# Rental Operations — Phase 1–4 User Guide

## 1. What the system is

Rental Operations is an internal system for one real-estate company operating through multiple branches. It is not a public multi-tenant SaaS product. Staff see only the branches and actions explicitly authorized for their employee account.

The first four phases provide the technical foundation, secure staff access, company organization, and portfolio structure needed before leasing and finance are added.

## 2. Navigation in plain language

| Navigation group | Purpose                                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Overview         | A quick operational summary of authorized branches, employees, owners, Properties, RentableSpaces, and recent activity. |
| Company setup    | Company details and operating branches.                                                                                 |
| Team & access    | Employees, login accounts, business roles, and readable capabilities.                                                   |
| Portfolio        | Owners, Properties, RentableSpaces, amenities, and supporting people or organizations.                                  |
| Oversight        | Audit evidence for sensitive and administrative actions.                                                                |
| Preferences      | Company-wide Settings such as business identity, currency, timezone, phone, and email.                                  |

The active page is highlighted. Cross-page links preserve the requested destination, so selecting Properties opens the Property registry rather than a generic portfolio landing page.

## 3. Signing in and sessions

1. Open the login page.
2. Enter the authorized staff email and password.
3. Select **Sign in**.
4. The system checks the account, employee status, server-side session, roles, capabilities, and branch scope.
5. If the session expires or is revoked, sign in again. Technical session identifiers are never shown in the interface.

Administrators manage login status under **Team & access → User accounts**. Suspending or disabling an account ends its active sessions.

## 4. Phase-by-phase operating model

### Phase 1 — Database and data architecture

Phase 1 has no normal staff page. It establishes PostgreSQL, Prisma, migrations, effective-dated records, database constraints, and immutable-history boundaries. Staff experience its protections indirectly whenever the system rejects overlapping, incomplete, or historically destructive changes.

### Phase 2 — Project foundation

Phase 2 has no business CRUD page. It provides the Next.js web application, NestJS API, configuration validation, PostgreSQL connectivity, Redis/BullMQ readiness, health checks, error handling, and shared TypeScript foundations.

### Phase 3 — Identity, organization, access, and governance

#### Overview

- Shows truthful counts derived from currently implemented Phase 3–4 data.
- Loads dashboard datasets only when Overview is opened; other pages no longer wait for all dashboard requests.
- Shows recent authorized activity without exposing raw internal identifiers.

#### Company

- View company identity, timezone, and status.
- Authorized administrators can update the display name and reporting timezone.
- Use **Settings** for the fuller company-preferences form.

#### Branches

- Search by branch name, code, email, or phone.
- Filter by Active or Inactive.
- **Add branch** creates an operating location; the `BR-001` style number is generated automatically.
- The row menu provides View, Edit, Activate, and Deactivate.
- Branch history is preserved; branches are not hard-deleted.

#### Employees

- Opens on active staff so suspended integration accounts do not dominate daily work.
- Search by name, number, job title, or login email.
- Filter Active staff, All staff, login-restricted accounts, or inactive employment.
- **Add employee** creates the staff record and can optionally create a login account; the `EMP-0001` number is generated automatically.
- Row actions provide View, Edit, Assign role, Activate, and Deactivate.
- Employee detail shows current branches, roles, employment data, and login state.
- Deactivation preserves history, disables the attached login, and revokes active sessions.

#### User accounts

- Opens as a compact, searchable account table rather than expanding every session into the list.
- Each row shows the human employee name, email, access scope, account status, and active-session count.
- Select **View account** to open one focused detail panel with the employee link, branch scope, roles, and the first 10 sessions.
- Authorized administrators can activate, suspend, or disable the account and revoke an individual session with a required reason.
- The main list and the session history both use 10-record pagination.

#### Roles & permissions

- Replaces the unclear “Access & Governance” wording with business language.
- **Add role** creates an understandable business role.
- Roles can be renamed, activated, or deactivated.
- **Manage capabilities** shows readable capability labels grouped by Organization, Identity, Portfolio, and Governance.
- Capabilities can be added or removed; removal requires a reason.
- Role codes and assignment history remain stable even when the display name changes.

#### Audit log

- Shows sensitive and administrative activity in the user’s authorized scope.
- Records actor, action, record type, time, branch context, reason, and safe before/after evidence.
- Passwords, tokens, authorization headers, and secrets are excluded.

#### Settings

- Updates legal name, display name, phone, email, default currency, and reporting timezone.
- Shows where account/session security is managed.
- Uses the approved navy, white, emerald, and Montserrat product design.
- Saving requires company-update permission and creates audit evidence.

### Phase 4 — Parties, owners, Properties, and RentableSpaces

#### People & organizations

- Opens directly as a readable table; records are visible without first selecting another item.
- Search and filter by human name, Party number, type, contact, and status.
- Shows 10 records per page with Previous and Next controls.
- **Add person or organization** creates the shared Party identity with an automatic `PTY-0001` style number.
- Row actions provide View, Edit, Activate, and Deactivate without exposing internal UUID values.
- Dropdowns show the person or organization name, business number, and type.

#### Owners

- Opens as a searchable, filterable table with 10 owners per page.
- Shows owner number, human Party name, type, communication preference, and lifecycle status.
- **Add owner** links an existing Party through a readable name-based selector and generates the `OWN-0001` number automatically.
- Row actions provide View and Edit; status changes preserve history rather than deleting the owner.

#### Properties

- Opens as a professional table-first Property registry.
- Summary cards show All, Active, Draft, and Inactive/Retired totals.
- Search by name, code, city, address, or branch.
- Filter by branch, physical Property type, and lifecycle status.
- **Add property** creates a Draft through a focused drawer and generates the `PROP-0001` number automatically.
- Each row shows Property identity, code, operating branch, physical type, RentableSpace count, and status.
- Row actions provide View details, Edit, Change status, and Discard draft when safe.
- Detail tabs show Overview, RentableSpaces, ownership summary, and the route to audit activity.
- Activation requires a current operating branch and exact 100% active ownership and payout entitlement.
- A used or historical Property is made Inactive or Retired, never hard-deleted.

#### Rentable spaces

- RentableSpace is the canonical future occupancy target; Property and Building are not lease targets.
- Opens as a responsive table with Space, Property, Type, Parent, Area, Status, and Actions columns.
- Shows 10 spaces per page and filters by Property.
- Add a space with type, name, optional parent, measurement, and specialization data; the `SPC-0001` number is generated automatically.
- Advanced actions support effective-dated measurement correction, hierarchy changes, atomic partitioning, amenities, and retirement.
- Parent-child area, unit, same-Property, overlap, and cycle rules are enforced in service and database boundaries.

#### Amenities

- Opens as an administrator-managed catalog table with 10 records per page.
- Search by amenity name or code and filter Active or Inactive entries.
- **Add amenity** registers a reusable catalog item.
- Row actions provide Edit, Activate, and Deactivate.
- Assignment counts show how many Properties and RentableSpaces currently use each amenity.
- Only Active amenities are offered in new assignment forms.

## 5. Safe CRUD reference

| Record          |           Create | Read |                  Update | Lifecycle / delete behavior                                                |
| --------------- | ---------------: | ---: | ----------------------: | -------------------------------------------------------------------------- |
| Company         | Seeded singleton |  Yes |                     Yes | Activate/deactivate only through authorized company policy.                |
| Branch          |              Yes |  Yes |                     Yes | Activate/deactivate; no hard delete.                                       |
| Employee        |              Yes |  Yes |                     Yes | Activate/deactivate; login disabled and sessions revoked on deactivation.  |
| User account    |              Yes |  Yes |                  Status | Active, Suspended, Disabled; sessions revocable.                           |
| Role            |              Yes |  Yes |           Rename/status | Activate/deactivate; capability grant/revoke; no destructive history loss. |
| Party           |              Yes |  Yes |                     Yes | Active/inactive; no destructive delete of shared identity.                 |
| Owner           |              Yes |  Yes |                     Yes | Prospective, Active, Suspended, Inactive.                                  |
| Property        |            Draft |  Yes |                     Yes | Active, Inactive, Retired; only unused Draft may be discarded.             |
| RentableSpace   |              Yes |  Yes | Effective-dated actions | Retire; measurements and hierarchy preserved historically.                 |
| Amenity catalog |              Yes |  Yes |                     Yes | Activate/deactivate; assignment is managed on Property or RentableSpace.   |
| Audit log       |        Automatic |  Yes |                      No | Append-oriented evidence; never user-deleted.                              |

## 6. Permissions and branch scope

Seeing a button in the browser is never sufficient authorization. Every API mutation checks the required capability in the backend. Branch operations also check the actual target branch. Company-wide access widens object scope only when the user also has the required capability.

If an operation is unavailable:

1. Confirm the employee is active.
2. Confirm the login account is Active.
3. Confirm the employee has a current branch assignment.
4. Confirm the business role is active and assigned for the correct branch or company level.
5. Confirm the role contains the required readable capability.

## 7. Status and deletion guidance

- Use **Inactive** when the record should stop normal operational use but may return later.
- Use **Retired** when a Property or RentableSpace has reached the end of its physical lifecycle.
- Use **Suspended** for temporary login or owner restrictions.
- Use **Disabled** for login accounts that must not authenticate.
- Use **Discard draft** only for an unused Property setup mistake. The backend decides whether deletion is safe.

## 8. Performance behavior

- API reads are cached briefly per authenticated session.
- Mutations clear the relevant cache before reloading the current page.
- Dashboard data is deferred unless Overview is opened.
- Property lists return table fields and counts only; ownership, spaces, amenities, and history load when details are opened.
- Independent dependency requests run in parallel.
- Drawers preserve page context and avoid loading every edit form into the main list layout.

## 9. Troubleshooting

- **Could not reach the service:** confirm the API is running on the configured URL and Docker services are healthy.
- **Session expired:** sign in again.
- **No permission:** ask an authorized administrator to review the employee’s current branch and role assignment.
- **Property cannot activate:** complete current branch, active owners, 100% ownership, and 100% payout entitlement.
- **Draft cannot be discarded:** it is not Draft or already has dependent Phase 4 business records; change status instead.

## 10. List behavior and readable data

- Operational list pages show at most 10 records at a time and provide consistent Previous/Next pagination.
- Parties, Owners, Properties, RentableSpaces, Amenities, Branches, Employees, User accounts, Roles, Permissions, and Audit activity follow this list rule.
- Internal UUIDs are retained in the backend for safe relationships but are not used as user-facing labels.
- Selectors display a readable name plus a business code or number when disambiguation is needed.
- Demonstration fixtures use realistic human and business names. The normalization utility at `scripts/normalize-demo-data.ts` can repair legacy test-looking labels without deleting records.

## 11. Where capabilities are registered

Capabilities are controlled system definitions, not free-text items created by an administrator.

1. The approved catalog is declared in `prisma/seed.ts`.
2. Database setup stores those definitions in the `permissions` table.
3. The backend exposes the authorized catalog through `GET /api/v1/permissions`.
4. The Roles page lets an administrator grant or remove an approved capability from a business role.
5. Those role-to-capability links are stored in `role_permissions` and enforced again by the backend on every protected request.

To add a genuinely new system capability, a developer must add it to the controlled seed/catalog, connect it to the relevant backend policy, test it, and deploy the database update. This prevents accidental or meaningless permissions from being invented in the UI.

## 12. Automatic record numbers

Users do not type internal record numbers during creation. The backend allocates the next number inside the same database transaction: Branch `BR-001`, Employee `EMP-0001`, Party `PTY-0001`, Owner `OWN-0001`, Property `PROP-0001`, and RentableSpace `SPC-0001`. PostgreSQL sequences make concurrent creation safe. Branch selectors show branch names only; generated codes remain available in tables, reports, and audit evidence.
