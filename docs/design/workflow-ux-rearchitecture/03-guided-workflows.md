# Guided workflows

## Shared behavior

All workflows provide Back, Continue, Save Draft, Resume Later, and safe Cancel. The stepper shows complete/current/upcoming/skipped states. Validation is near each field. Entity selectors are async, server-backed, case-insensitive, scoped, paginated, and never auto-select the first result.

UX question order may differ from canonical commit order. Every record is created and transitioned only through its owning domain command.

## Onboard Property

### Mode

Ask first: Portfolio registration only; Rental/occupancy setup; External-owner sale authority; or Company-owned asset. This controls steps but never changes Property type.

### Owner

Support existing Owner, existing Party → add Owner profile, new Person/Organization + Owner profile, and authorized Company legal Party reuse. Party is company-level identity; never create an Owner per Branch. New records receive the selected Branch relationship. Organization contact name remains the current bounded field unless a later domain decision creates a representative relationship.

### Ownership and payout

Collect effective-dated ownership and payout entitlement separately. Offer an explicit user-confirmed “copy ownership to payout” action; never assume equality. Show both remaining totals. Activation requires exactly 100% of each, active Owners, and exactly one active operating Branch.

### Property

Collect canonical type, name, location/address, measurements, notes, and operating Branch with business labels. Internally create/reuse a branch-scoped Draft Property before ownership because PropertyOwnership requires a Property ID.

### Structure

Building is optional and determined semantically. Land/direct layouts can skip it. “Configure later” leaves the selected rental/occupancy outcome incomplete, but does not prevent a Portfolio-only Property from activating when its own Branch/ownership/payout/Owner gates pass. Direct Property → RentableSpace remains canonical; no Building is invented.

### Rentable Spaces

Show for rental/occupancy or explicit occupancy configuration. Entire Property creates the canonical whole-property space when required. Multiple Spaces uses recursive topology. Enforce same-Property hierarchy, no cycles, effective dating, version checks, and child area limits.

### Company Service

Optional for Portfolio-only mode. Before creation, a server-owned creation/activation preflight evaluates the requested model, scope, effective dates, active physical state, actual Company ownership, overlaps, authorization, and expected versions using the centralized compatibility policy. The effective-capability resolver is used only after Active/effective Engagements exist. The UI never reproduces the matrix as authority. Sale Brokerage and Company Owned are Property-only; rental models may be Property/Space scoped; Company Owned requires actual Company ownership. Current Phase 5.1 supports model, scope, effective period, notes, and lifecycle—not fee terms or an authorizing-agreement aggregate.

### Documents

Reuse private Document/DocumentVersion only. Show supported Owner/Property/RentableSpace links and current categories. Never present a generic upload as a canonical signed engagement agreement. Drafts retain authorized upload-session references, never binary data or storage keys.

### Review and complete

Show human-readable, per-aggregate readiness. Finalization uses idempotent named commands and expected versions; there is no generic “onboarding active” domain state.

Canonical order:

1. resolve/reuse Party and OwnerProfile;
2. create/reuse Draft Property with Branch;
3. write ownership and payout history;
4. create optional Building/Space topology and measurements;
5. activate Property when its own gate passes and activate each required Space when its own gate passes; Building has no invented transition;
6. create/activate optional Engagement only after its scope is Active;
7. finalize supported Document links/versions;
8. mark the workflow complete after selected outcomes are durable.

Failure preserves a named recoverable checkpoint. It never deletes shared identity or overwrites history.

## Rental Brokerage

1. Owner: reuse/create branches above; exit with one authorized Owner.
2. Property: select an authorized active asset or enter the Property-onboarding subflow; preserve context on return.
3. Rentable Space: select active existing scope, create whole-Property scope where canonical, or configure required topology; cannot continue with invalid/inactive scope.
4. Service: collect only Phase 5.1 model/scope/effective period/notes; run server preflight; create Draft then explicitly activate.
5. Documents: link only supported Owner/Property/Space categories; missing unsupported agreement model is stated, not faked.
6. Review: show owner, asset, space, branch, dates, service state, supported documents; revalidate permissions, versions, overlaps, and capability.

Save after every step. Errors remain on the step with a recoverable explanation. Completion lands on the active Engagement/asset context. It creates no Listing, matching result, Viewing, Application, Reservation, placement, commission, or Full Management.

## Full Management

1. Owner: select/create and verify authorized relationship.
2. Property: select/register; exit only with its own readiness visible.
3. Authority: confirm effective ownership/payout and operating Branch; corrective work uses canonical ownership flow.
4. Spaces: select/configure only scopes intended for management; Portfolio-only Property activation remains independent.
5. Service: create/activate a `FULL_MANAGEMENT` Engagement through server preflight.
6. Documents: supported canonical links/categories only.
7. Review: distinguish ongoing-management authority from brokerage and show every per-domain outcome.

Errors checkpoint; completion lands in active/effective `FULL_MANAGEMENT` Engagement context (or a future explicitly approved read model), not a newly invented “Full Management capability.” It creates no Lease, rent, maintenance, Expense, Owner Statement, or Owner Payout.

## Property Sale

1. Seller: reuse/create authorized Owner; no identity duplication.
2. Property: select/register one Property; no RentableSpace sale target.
3. Ownership: validate effective ownership/payout and selected business date.
4. Authority route: external owner requests Sale Brokerage; Company-owned verifies legal-Party ownership and requests Company Owned.
5. Documents: only supported entity/category links.
6. Review: summarize seller, Property, Branch, ownership evidence, authority route, dates, and limitations; run preflight and version checks.

- External owner requires real ownership plus Sale Brokerage authority.
- Company-owned requires actual Company legal-Party ownership plus Company Owned authority, never self-brokerage.
- Sale targets Property, never RentableSpace.

No Sale Listing, offer, negotiation, SaleDeal, settlement, transfer, commission, or revenue is created.

## CRM contextual integration

One Lead remains canonical with exactly one intent: RENT, BUY, SELL, or CONSTRUCTION_SERVICE. Contextual workspaces are filtered views/prefilled entry points. Separate needs create separate Leads. Party linking is audited and never merges identity. SELL/CONSTRUCTION asset context proves neither title nor authority. “Matching” is only a Phase 5.2 stage label.

CONSTRUCTION_SERVICE ends at CRM intake/conversion summary. Development is unavailable.

## Conditional summary

| Condition | Behavior |
| --- | --- |
| Portfolio-only | Service and Space optional |
| Land/direct layout | Building skipped unless relevant |
| Whole-Property rental | canonical whole-Property Space |
| Multiple occupancy targets | recursive Space builder |
| Joint ownership | separate ownership/payout tables; both 100% at activation |
| Existing Party, no Owner profile | authorized profile addition after duplicate review |
| Company-owned | reuse Company legal Party; verify effective ownership |
| Missing agreement model/category | state limitation; never fake contract semantics |
| Permission/scope changes mid-draft | pause, reauthorize, hide inaccessible values |
