REAL ESTATE RENTAL COMPANY MANAGEMENT SYSTEM
UI/UX Design System & Product Interface Standards
Version 1.0 — Approved Product Design Direction
Purpose: define a consistent, clean, professional, human-readable interface standard for every screen of the system. This document is the default visual and usability specification for developers, Codex, designers, QA, and future product phases.
CORE RULE: A feature is not complete if it works technically but is confusing, raw, or difficult to use.

1. Product Design Principles
   Clarity first: Users should understand what they are seeing and what action to take without technical knowledge.
   Business language, not database language: Show 'Company Wide', not COMPANY_WIDE; show '34 Permissions', not raw JSON permission arrays.
   Progressive disclosure: Show summaries first; technical or advanced detail appears in drawers, modals, expandable sections, or dedicated admin views.
   Consistency: The same status, action, button type, spacing, form pattern, and terminology must look and behave the same everywhere.
   Safe actions: Financial, destructive, security, and approval actions must be visually distinct and require confirmation where appropriate.
   Responsive by default: Every core workflow must remain usable on laptop, tablet, and mobile-sized screens.
   Accessible by default: Color alone must never communicate critical meaning; pair color with text, icon, or badge label.
2. Official Color System
   Recommended visual direction: deep navy for trust and structure, emerald for primary business actions and successful states, and warm/slate neutrals for a calm enterprise interface. This is the default system palette unless the company later provides a formal brand identity.
   2.1 Core Brand Colors
   Token / Name HEX Primary Use
   Primary Navy / brand-900 #0F172A Sidebar, strong headings, top-level navigation, high-emphasis dark surfaces
   Primary Navy / brand-800 #1E293B Hover/secondary dark surfaces, cards on dark areas
   Emerald / primary-600 #059669 Primary buttons, selected states, active controls, key positive business actions
   Emerald / primary-700 #047857 Primary hover/pressed state
   Emerald / primary-50 #ECFDF5 Soft success/selected background
   Accent Blue / info-600 #2563EB Links, informational states, secondary emphasis
   Canvas / surface-0 #FFFFFF Main card and form surfaces
   App Background / surface-50 #F8FAFC Application page background
   Border / slate-200 #E2E8F0 Card/table/form borders
   Primary Text / slate-900 #0F172A Main body and headings
   Secondary Text / slate-600 #475569 Descriptions, metadata, helper text
   Muted Text / slate-400 #94A3B8 Placeholders and low-priority metadata
   2.2 Semantic Status Colors
   Meaning Foreground Soft Background Use
   Success / Active #047857 #ECFDF5 Paid, Active, Completed, Approved, Healthy
   Information #1D4ED8 #EFF6FF Informational alerts, neutral system notices
   Warning #B45309 #FEF3C7 Expiring, Pending Review, Needs Attention
   Danger #B91C1C #FEF2F2 Overdue, Failed, Suspended, Rejected, destructive confirmations
   Neutral #475569 #F1F5F9 Draft, Archived, Inactive, not-yet-processed
   2.3 Color Usage Rules
   • Primary Emerald is for the most important positive action on a screen. Do not make every button green.
   • Danger red is reserved for destructive, failed, overdue, blocked, or security-sensitive states.
   • Warning amber should not be used as decoration; it means action or attention is required.
   • Blue is informational and may be used for links, neutral calls-to-action, and information banners.
   • Never communicate state using color alone. Always include a readable label such as 'Overdue' or 'Approved'.
   • Avoid large areas of saturated color. Enterprise screens should remain calm and data-focused.
   • Do not introduce new arbitrary colors without updating this design system.
3. Typography
   Default font: Inter when available in the web product; fallback stack: system-ui, Segoe UI, Arial, sans-serif.
   Style Size Weight Usage
   Page Title 28–32 px 700 Top page heading
   Section Heading 20–24 px 600–700 Major section within a page
   Card Title 16–18 px 600 Cards, panels, drawers
   Body 14–16 px 400 Default readable content
   Label 13–14 px 500–600 Form labels and table headers
   Caption / Metadata 12–13 px 400–500 Timestamps, secondary details
4. Spacing, Radius & Elevation
   Use an 8px spacing rhythm. Common spacing tokens: 4, 8, 12, 16, 24, 32, 40, 48 px.
   Token Value Use
   radius-sm 6px Inputs, badges
   radius-md 8px Buttons, small cards
   radius-lg 12px Primary cards, modals
   radius-xl 16px Large summary panels
   shadow-sm Subtle Dropdowns, small elevation
   shadow-md Moderate Modal/dialog only; avoid heavy card shadows
5. Application Layout
   Desktop default: left navigation sidebar + top utility header + scrollable content canvas. The interface should prioritize workspace density without appearing crowded.
   • Sidebar width: approximately 240–264px expanded; optional compact state around 72–80px.
   • Top header: 56–64px. Contains page context, search if useful, notifications, and user menu.
   • Content max-width should remain comfortable for forms; wide data tables may use the full content area.
   • Page padding: 24–32px desktop, 16–20px tablet, 12–16px mobile.
   • Important page actions belong in a stable top-right action area.
6. Navigation & Information Architecture
   Sidebar groups should reflect business work, not database tables.
   Navigation Group Contains
   Overview Dashboard / operational summary
   Commercial Leads, Listings, later Viewings & Applications
   Portfolio Owners, Properties, Buildings, Rentable Spaces
   Leasing Reservations, Contracts, Renewals, Move-in/out when implemented
   Finance Charges, Payments, Deposits, Owner Accounting when implemented
   Operations Maintenance, Vendors, Inspections
   Administration Company, Branches, Employees, Roles, Permissions, Audit
7. Core UI Components
   Buttons: Primary, Secondary, Ghost, Destructive. One clear primary action per task area.
   Cards: Use for summaries and grouped business information; avoid wrapping every single field in a card.
   Badges: Statuses should use semantic background + readable label.
   Tabs: Use for logically related detail views such as Property: Overview / Spaces / Ownership / Documents / Activity.
   Drawers: Best for viewing/editing secondary details without losing page context.
   Modals: Use for focused confirmation or short forms, not large multi-step workflows.
   Tooltips: Explain unfamiliar icons or abbreviated values; never hide essential instructions only in a tooltip.
   Toasts: Confirm successful actions; errors requiring action should also remain visible near the affected area.
8. Buttons & Action Hierarchy
   Type Visual Example Rule
   Primary Emerald filled Create Property Most important positive action
   Secondary White / border Export, Add Note Useful but not primary
   Ghost No strong container Back, Cancel Low-emphasis action
   Destructive Red filled/soft Suspend User, Delete Draft Requires clear destructive intent
9. Forms
   • Labels must remain visible above fields; do not rely on placeholder text as the only label.
   • Group long forms into meaningful sections such as Basic Information, Location, Ownership, and Documents.
   • Required fields must be obvious but not visually noisy.
   • Show validation errors next to the field and include a summary only for complex forms.
   • Use proper control types: date picker for dates, currency input for money, searchable select for large datasets.
   • Disable irrelevant fields rather than showing residential fields for land or commercial spaces.
   • Do not display database enum strings directly. Convert RENT_COLLECTION_ONLY to 'Rent Collection Only'.
   • Save actions should show loading state and prevent accidental duplicate submission.
10. Tables & Data-Dense Screens
    • Tables must use concise, business-readable columns; hide internal UUIDs by default.
    • Support pagination for large datasets.
    • Provide search/filter controls relevant to the page; avoid generic filter overload.
    • Keep row actions in a compact menu when more than 2–3 actions exist.
    • Sticky table headers are recommended for long lists.
    • Use right alignment for numeric financial amounts.
    • Use tabular numerals for money and totals.
    • Show empty states with a clear next action rather than an empty white table.
    • On mobile, convert complex tables to stacked records/cards or a horizontally scrollable controlled layout.
11. Status Badge Standard
    Status Family Example Labels Visual
    Positive Active, Paid, Approved, Completed Emerald
    Attention Pending, Expiring Soon, Under Review Amber
    Negative Failed, Rejected, Overdue, Suspended Red
    Informational Processing, Assigned, Scheduled Blue
    Neutral Draft, Archived, Inactive, Cancelled Slate
12. Dashboard Design
    Dashboards should answer business questions, not simply display every metric available. Prioritize 4–6 high-value KPIs above the fold, followed by operational queues and trends.
    • KPI cards: title, value, change/context, optional small icon. Avoid rainbow card colors.
    • Charts: use restrained palette; primary series emerald/blue, secondary neutral slate.
    • Alerts: overdue or urgent items belong in dedicated attention panels.
    • Operational lists: 'Follow-ups Due', 'Expiring Engagements', 'Vacant Spaces', etc.
    • Do not use decorative charts when a compact table communicates the information better.
13. Detail Page Pattern
    Recommended pattern for Owner, Property, RentableSpace, Lead, Employee, and future Lease records:
    • Header: human-readable name/code + status badge + primary actions.
    • Summary strip: 3–6 key facts.
    • Tabs: Overview / related business sections / Documents / Activity.
    • Timeline/activity: important lifecycle changes and audited business events.
    • Danger zone: destructive/deactivation actions separated at the bottom or in a protected settings area.
14. Raw Technical Data — Prohibited in Normal UI
    The following must normally be hidden from business users:
    • Internal UUIDs
    • Session IDs
    • Raw permission arrays
    • Database field names
    • Raw JSON payloads
    • Backend enum strings
    • Stack traces
    • Database errors
    • Token values
    • Internal queue/job IDs
    Preferred display example:
    Avoid Use instead
    Permissions: ["portfolio.property.read", "portfolio.space.update", ...] Permissions: 34 permissions [View Permissions]
15. Financial UI Standards
    • Money must show currency consistently, e.g. $1,250.00 or USD 1,250.00 according to product setting.
    • Positive/negative accounting meaning must not rely solely on green/red; include labels and signs.
    • Payment status, verification status, and allocation status must be visually distinct.
    • Manual payment workflows must clearly show Recorded By, Verified By, Payment Method, Reference, and Proof where applicable.
    • Posted financial records should show 'Posted' and become read-only in normal UI; corrections use reversal/adjustment actions.
    • Dangerous finance actions require explicit confirmation and reason.
16. Icons
    Use Lucide icons consistently. Icons support meaning; they do not replace labels for important actions.
    • Recommended icon size: 16–20px for controls, 20–24px for navigation, up to 28px for KPI cards.
    • Avoid mixing icon libraries unless necessary.
    • Do not use decorative icons in every table cell.
    • Destructive actions use an appropriate warning/trash icon plus text.
17. Responsive Behavior
    Viewport Behavior Priority
    Desktop ≥1280px Expanded sidebar, multi-column forms, full data tables Maximum productivity
    Laptop 1024–1279px Compact sidebar optional, 2-column forms Primary target
    Tablet 768–1023px Collapsed sidebar/drawer, reduced columns Touch-friendly usability
    Mobile <768px Drawer navigation, stacked forms/cards, simplified tables Core workflows remain possible
18. Accessibility Standards
    • Target WCAG 2.1 AA contrast where practical.
    • Keyboard access for primary workflows.
    • Visible focus rings on interactive elements.
    • Every form control has an associated label.
    • Icons used as buttons require accessible names.
    • Status meaning is conveyed with text plus color/icon.
    • Error messages must explain the problem and how to fix it.
    • Do not use text smaller than 12px for essential information.
19. Light & Dark Mode
    Light mode is the primary design target for the business application. Dark mode may be supported, but it must use token-based colors rather than separate arbitrary styles.
    Token Light Dark
    App background #F8FAFC #020617
    Surface #FFFFFF #0F172A
    Primary text #0F172A #F8FAFC
    Secondary text #475569 #CBD5E1
    Border #E2E8F0 #334155
    Primary action #059669 #10B981
20. Loading, Empty, Error & Success States
    • Loading: use skeletons for data-heavy pages and button spinners for short actions.
    • Empty: explain why the list is empty and provide the next logical action.
    • Error: human-readable message, retry action where useful, correlation ID only in expandable technical detail if support needs it.
    • Success: brief toast plus visible updated state; do not rely on toast alone for critical financial results.
21. Permissions & Access UI
    Access control screens must translate technical permissions into grouped business capabilities. Do not show a single long raw permission array.
    • Group permissions by domain: Organization, Identity, Portfolio, CRM, Finance, Governance.
    • Show count in lists, e.g. '34 Permissions'.
    • Use a drawer/modal for detailed permission review.
    • Show access scope as 'Company Wide', 'Multiple Branches', or a human-readable branch list.
    • Internal User ID / Session ID should be hidden unless a dedicated technical-support view is opened.
22. Language & Microcopy
    • Use short, direct business language.
    • Prefer 'Create Property' over 'Submit Entity'.
    • Prefer 'Suspend User' over 'Set status to SUSPENDED'.
    • Confirm destructive actions with consequence-focused copy.
    • Avoid unexplained abbreviations.
    • Dates, currencies, phone numbers, and area units must follow configured locale/business rules.
23. Motion & Feedback
    • Animations should be subtle and usually 150–250ms.
    • Use motion for state transition clarity, not decoration.
    • Avoid large page animations that slow operational workflows.
    • Respect reduced-motion preferences where possible.
24. Frontend Implementation Rules for Codex
    • Use design tokens/CSS variables for colors; do not scatter hard-coded hex colors throughout components.
    • Use reusable primitives for Button, Input, Select, Badge, Card, Table, Dialog, Drawer, EmptyState, PageHeader, and StatusBadge.
    • Use shadcn/ui as a component foundation, then apply this product design system consistently.
    • Do not expose raw API responses directly in UI.
    • Map enums and technical values through presentation helpers.
    • Every list page must include loading, empty, error, and populated states.
    • Every form must include validation, pending state, success feedback, and safe error handling.
    • All new frontend work must be responsive before the phase can pass.
    • Do not introduce page-specific colors that conflict with semantic tokens.
25. UI/UX Phase Gate Checklist
    ☐ Consistent use of official color tokens
    ☐ No raw UUID/JSON/enum strings visible to normal users
    ☐ Clear page title and action hierarchy
    ☐ Responsive desktop/tablet/mobile behavior
    ☐ Readable tables and form layouts
    ☐ Loading state present
    ☐ Empty state present
    ☐ Error state present
    ☐ Success feedback present
    ☐ Accessible labels and focus behavior
    ☐ Status colors include text labels
    ☐ Destructive actions clearly distinguished
    ☐ No horizontal overflow except controlled data tables
    ☐ Frontend permissions reflected for usability while backend remains authoritative
    ☐ Visual review completed at common screen sizes

UI/UX REVIEW: PASS is required before any frontend-containing phase can receive PHASE GATE: PASS. 26. Quick Token Reference
Token HEX Use
--background #F8FAFC App background
--surface #FFFFFF Cards/forms
--foreground #0F172A Primary text
--muted-foreground #475569 Secondary text
--border #E2E8F0 Borders
--primary #059669 Primary action
--primary-hover #047857 Primary hover
--info #2563EB Information/link
--warning #D97706 Attention
--danger #DC2626 Destructive/error
--success #059669 Success
