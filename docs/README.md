# Project documentation

All project documentation lives under this folder so application source code remains easy to navigate.

## Folder map

- `analysis/` — source analysis and discovered contradictions.
- `architecture/` — system boundaries, modules, and technical architecture.
- `database/` — ERD, Prisma, migration, and data-integrity design.
- `decisions/` — approved decisions and implementation assumptions.
- `design/` — UI/UX design system and design QA evidence.
- `domain/` — business terminology and domain rules.
- `governance/` — audit, approvals, and segregation-of-duties rules.
- `guides/` — operator, developer, and system usage guides.
- `phases/` — phase scope, gates, and completion reports.
- `security/` — authentication, authorization, and branch-scope rules.

## Maintenance rule

Do not place reports or design notes in the repository root. Put each document in the matching folder above and link it from the relevant phase or decision record.

This folder is intentionally excluded from Git pushes for this local project. If documentation needs controlled publishing later, use a separate private documentation repository or explicitly revise the ignore policy.
