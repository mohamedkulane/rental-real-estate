# Web feature structure

The web app is organized by business feature so a developer can locate a page without reading one large components folder.

- `features/auth/` — sign-in and authentication UI.
- `features/admin/admin-console.tsx` — admin route orchestration, data loading, and section selection.
- `features/admin/pages/` — branches, employees, roles, user accounts, and settings pages.
- `features/portfolio/portfolio-console.tsx` — portfolio route orchestration and section selection.
- `features/portfolio/pages/` — parties, owners, properties, and amenities pages.
- `features/portfolio/portfolio-actions.tsx` — scoped rentable-space and related portfolio workflows.
- `components/shared/` — reusable shell, loading/status UI, and pagination.
- `lib/` — API client, permission helpers, and presentation helpers.

## Development rule

Add a new business screen inside its feature `pages/` folder. Keep route consoles focused on navigation, permission-aware data loading, and composing page components. Put reusable visual building blocks in `components/shared/`; do not copy them into individual pages.
