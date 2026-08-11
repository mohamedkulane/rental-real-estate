# Technology Versions

| Component              | Version | Policy                             |
| ---------------------- | ------: | ---------------------------------- |
| Node.js                | 22.17.1 | Project LTS runtime                |
| pnpm                   | 11.16.0 | Workspace package manager          |
| TypeScript             |   5.9.3 | Strict compilation                 |
| Next.js                |  16.3.0 | Web App Router                     |
| React / React DOM      |  19.2.8 | Web runtime                        |
| NestJS                 | 11.1.28 | REST API framework                 |
| Prisma / Prisma Client |  6.19.3 | Exact-match ORM toolchain          |
| PostgreSQL             |    17.6 | Local and CI database              |
| Redis                  |   8.2.1 | Local and CI cache/queue transport |
| BullMQ                 |   6.0.9 | Queue infrastructure only          |
| Argon2                 |  0.45.1 | Argon2id password hashing          |
| Zod                    |   4.4.3 | Environment and shared validation  |
| TanStack Query         | 5.101.4 | Client server-state foundation     |
| Tailwind CSS           |   4.3.3 | Styling foundation                 |
| Vitest                 |  4.1.10 | Test runner                        |

Versions are pinned in package manifests and container image tags. Framework upgrades require an explicit architecture decision and full gate rerun.
