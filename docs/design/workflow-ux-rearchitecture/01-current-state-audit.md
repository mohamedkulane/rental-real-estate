# Current-state audit

## Scope and evidence

This is the design-only first run required by the Guided Workflows specification. It audits the committed product at `b27e97e`, active Phase 5.2 worktrees, canonical documentation, Prisma contracts, and frontend source. No production application code was changed.

Runtime visual capture could not be accepted: local development processes did not expose ports 3000/3001 through the available Windows capture session. This is therefore a source- and contract-backed audit, not a claim of completed visual or accessibility validation. Valid screenshots at 1440, 768, and 390 remain a mandatory implementation gate.

## Current product surface

| Area | Current route/surface | Primary UI | Current role |
| --- | --- | --- | --- |
| Authentication | `/login` | Login form | Staff access |
| Dashboard / administration | `/admin?section=...` | console and dedicated directories | Company, branches, team, roles, audit |
| Portfolio | `/portfolio?section=...&view=...` | Portfolio console | Canonical registers and aggregate workspaces |
| Property detail | `/portfolio/properties/[propertyId]` | tabbed detail | Record operations |
| Building detail | `/portfolio/buildings/[buildingId]` | detail workspace | Structure and Add Rentable Space |
| Rentable Space detail | `/portfolio/rentable-spaces/[spaceId]` | tabbed detail | Physical-space operations |
| Commercial | `/commercial/service-engagements` | register + dialogs | Phase 5.1 service authority |
| Engagement detail | `/commercial/service-engagements/[engagementId]` | detail + actions | Lifecycle/history |
| CRM | active Phase 5.2 worktree only | Lead/activity/follow-up pages | In progress; not durable PASS |

The shell groups Dashboard, Organization, Team & Access, Portfolio, Commercial, and Oversight. Portfolio exposes Parties, Owners, Properties, Rentable Spaces, Amenities, and technically useful child registers. Forms and drawers exist across Party, Owner, Property, Ownership, Building, Space, Document, Amenity, Branch, Employee, User, Role, and Service Engagement surfaces.

## Strengths

- Permission-filtered navigation, mobile open/close, active states, and keyboard focus exist.
- Phase 4 advanced registers are retained with focused server-backed read models.
- Record details are separate from quick preview and list pages.
- Searchable selectors are opt-in and exclude status selectors. The shared component normally filters rendered children locally; only callers with `onSearchChange` are server-backed.
- Phase 5.1 centralizes service compatibility/capability policy.

## Friction

- The product is organized primarily by canonical entity, not employee task.
- There is no global `+ Start New` launcher or durable Incomplete Work area.
- Onboarding spans multiple registers, with no shared progress or recoverable checkpoint.
- Existing-record reuse is not an end-to-end duplicate-prevention path.
- Rental Brokerage and Full Management are service-model values in one register, not distinct business entry points.
- “Service Engagement” and “PropertyOwnership” are correct internal terms but poor first questions for many employees.
- The Document contract currently links Owner, Property, or RentableSpace and supports its approved categories; it is not a signed Service Engagement agreement system.
- Phase 5.2 directly edits shared shell/navigation code, so production changes now would conflict with active CRM work.

## Traceable interface inventory

| Surface | Route/source | Creation/actions | Keep/change disposition |
| --- | --- | --- | --- |
| Dashboard + company/admin | `/admin`; `admin-console.tsx`; company, branch, employee, user, role, settings pages | multiple focused forms/drawers for create/update/status/session/role/permission | Keep daily/admin workspaces; Dashboard should become a real overview rather than conceptually equal `/admin` |
| Party Register | `/portfolio?section=parties`; `party-directory.tsx` | Add Person/Organization, edit, activate/deactivate, contact/branch relationships, details in custom drawers | Keep Advanced Record; wrap normal creation in Owner/Property workflows |
| Owner Register | `/portfolio?section=owners`; `owner-directory.tsx`, `ownership-workflow.tsx` | Add Owner role, owner detail, owned Properties, documents, ownership history | Keep Advanced Record; make reuse a guided branch |
| Property Register | `/portfolio?section=properties`; `property-registry.tsx` | add/edit/lifecycle/quick preview; custom drawers | Keep Advanced Record; guided onboarding becomes preferred creation |
| Property contextual workspaces | Property register views/detail tabs; `property-operations.tsx`, `property-detail-workspace.tsx` | Buildings, Ownership, Amenities, Documents, Branch Assignments, Activity | Keep contextual; do not promote to top-level registers without proven task need |
| Building detail | `/portfolio/buildings/[buildingId]`; `building-detail-workspace.tsx` | edit/retire, Add Rentable Space, zero-space action | Keep contextual detail |
| Rentable Space Register | `/portfolio?section=spaces`; `rentable-space-operations.tsx` | add/update/partition/reparent/measurements/profiles/amenities/documents/retirement | Keep Advanced Record/detail; guided workflow creates only selected topology |
| Space detail | `/portfolio/rentable-spaces/[spaceId]` | contextual tabs/actions | Keep |
| Amenities Catalog | `/portfolio?section=amenities` | catalog create/update | Keep Advanced Record |
| Service Engagement Register | `/commercial/service-engagements`; `engagement-register.tsx` | create dialog, filters, lifecycle transition dialog | Keep Advanced Commercial register; workflows use business wording |
| Service Engagement detail | `/commercial/service-engagements/[engagementId]`; `engagement-detail.tsx` | edit/activate/deactivate/cancel and history | Keep |
| Phase 5.2 CRM routes | `/crm`, `/crm/leads`, `/crm/leads/new`, `/crm/leads/[leadId]`, `/crm/leads/[leadId]/edit`, `/crm/pipeline`, `/crm/follow-ups`, `/crm/lead-sources` in `p5-02-web` | Lead create/edit, activity, follow-up, assignment/reassignment, Branch transfer, Party link, intent correction, source management | Active worktree only; preserve one Lead and integrate after durable PASS |

### Administration form/dialog inventory

| Surface/source | Forms and dialogs |
| --- | --- |
| Company Profile / `admin-console.tsx` company section | company detail/update drawer |
| Branch directory / `branch-directory.tsx` | add Branch, edit Branch, activate/deactivate actions |
| Employee directory / `employee-directory.tsx` | add/update Employee, access mode and Branch assignment, role assignment/removal, lifecycle actions |
| User Account directory / `user-account-directory.tsx` | account create/link, status update, session inspection/revocation workflow |
| Roles & Permissions / `role-manager.tsx` | create/edit role, assign/remove permission, lifecycle actions, grouped permission detail |
| Settings / `settings-panel.tsx` | supported organization/system settings form |
| Audit Log / admin console audit section | server-backed inspection/filtering; no create form |

Current sidebar entries are Dashboard; Organization (Company Profile, Branches); Team & Access (Employees, User Accounts, Roles & Permissions); Portfolio (Parties, Owners, Properties, Rentable Spaces, Amenities Catalog); Commercial (Service Engagements → Engagement Register); Oversight (Audit Log). Phase 5.2 proposes CRM navigation in the active web worktree. There are no current ConstructionProject or DevelopmentProject routes and none should be added.

### Repeated selector inventory

| Selector | Current behavior | Requirement |
| --- | --- | --- |
| Owner Party search (`owner-directory.tsx`) | server-backed search | preserve scope/pagination/no auto-select |
| Ownership Owner search (`ownership-workflow.tsx`) | server-backed search | preserve; add duplicate awareness |
| Space Property/Building/Parent (`portfolio-console.tsx`) | server-backed caller search | preserve context and pagination |
| Engagement Property/Space (`engagement-register.tsx`) | server-backed caller search | preserve resolver/preflight separation |
| status/type/access/category/role catalogs | finite rendered options, locally filtered only where appropriate | no search for short status/category lists |
| other entity selectors using rendered children | not proven server-backed by shared component alone | audit caller-by-caller before reuse; migrate large/entity data to async APIs |

### Source-visible accessibility/responsive risks

Party/Owner/Property custom drawers declare dialog semantics but do not visibly centralize Escape handling, focus trap, initial focus, or trigger-focus restoration. The mobile shell has open/close labels but the same focus-management gap. Detail tabs are a strength: tab roles, roving `tabIndex`, and controlled horizontal scrolling are present. Phase 5.2 `CommandDialog` uses native `<dialog>` and viewport bounds. These are source observations, not completed runtime accessibility evidence.

### Navigation exposure classification

Durable now: `/admin`, `/portfolio`, `/commercial/service-engagements`. In progress: the Phase 5.2 CRM routes above. Rental Brokerage, Full Management, and Sale are currently Service Engagement models—not operational workspaces. SELL and CONSTRUCTION_SERVICE are CRM intents only. Commercial currently adds a parent for one child register. No known fake future route is currently exposed; all proposed destinations remain hidden until backed by passed read models/actions.

## Current-state friction matrix

| Task | Current path | Approx. transitions | Problem | Target workflow | Target steps |
| --- | --- | ---: | --- | --- | ---: |
| Onboard owner-held Property | Dashboard → Portfolio/Party Register → Add Person/Org + submit → Owner Register → Add Owner + submit → Property Register → Add Property + submit → Property detail/Ownership + submit → optional structure/space + submit → Commercial/Engagement Register → Create + submit → document tab/upload | 9 navigation transitions + 6–9 submissions | Requires domain sequencing knowledge | `+ Start New → Onboard Property` | 6–8 conditional |
| Add existing Party as Owner | Party inspect → Owner register → role | 2–4 | Duplicate risk; unclear conversion | Owner step: existing Party → Owner profile | 1 branch |
| Configure joint ownership | Property → Ownership | 2–3 | Ownership and payout may be confused | Ownership & payout step | 1 |
| Add Rentable Space | Property/Building → detail → Add Space | 2–4 | Context can be lost | Contextual or guided Space step | 1–3 |
| Start rental brokerage | Resolve owner/asset → Engagement register | 4–8 | Mixed with ongoing management | `+ Start New → Rental Brokerage` | 6 |
| Start full management | Same entity-first path | 4–8 | Business difference hidden in enum | `+ Start New → Full Management` | 7 |
| Prepare Property sale | Ownership/property → Engagement | 3–6 | External vs company-owned authority unclear | `+ Start New → Property Sale` | 6 |
| Create/work Lead | Phase 5.2 CRM pages | 1–3 | Context views must not duplicate Lead | `+ Start New → Add Lead` | intent-aware |
| Attach documents | Find correct aggregate/detail | 2–4 | Employee must know link/category | contextual Documents step | 1 |
| Resume interrupted setup | Reconstruct across registers | unbounded | No durable checkpoint | Incomplete Work | 1 resume |

## Terminology map

| Internal | User-facing |
| --- | --- |
| Party | Person or Organization; “Party Register” only in Advanced Records |
| OwnerProfile | Owner profile |
| PropertyOwnership | Ownership |
| RentableSpace | Rentable Space, or contextual Apartment/Shop/Whole Property |
| ServiceEngagement | Company Service / Service Authority; advanced register keeps canonical name |
| CONSTRUCTION_SERVICE | Construction service enquiry |
| raw enum/status | mapped sentence/title case |

## Findings

- Critical: 0.
- High: entity-first onboarding; no durable resume; unsafe Phase 5.2 overlap; no approved orchestration contract.
- Medium: palette-source conflict; technical terminology; distributed duplicate awareness; visual evidence outstanding.

The target design closes the structural findings. Visual and interactive acceptance remains gated until implementation.
