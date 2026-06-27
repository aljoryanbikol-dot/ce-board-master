# CE Board Master

> Premium Philippine PRC Civil Engineering Licensure Examination Reviewer Platform

A production-grade, full-stack monorepo: a NestJS (Fastify) modular-monolith API and a
Next.js 15 frontend, sharing typed contracts, backed by PostgreSQL + Redis, and built to
serve 100k+ examinees with practice, full mock boards, an AI tutor, progress analytics,
billing, and a complete admin CMS.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | pnpm workspaces + Turborepo |
| Backend | NestJS 10 (Fastify), TypeScript (strict), Prisma 6 + PostgreSQL 16, Redis 7 (cache + BullMQ), Argon2, RS256 JWT |
| Frontend | Next.js 15 (App Router), React 19, Tailwind, shadcn/ui, TanStack Query, Zustand, React Hook Form + Zod, Recharts |
| Shared | `@ce-board-master/types`, `@ce-board-master/utils`, `@ce-board-master/config` |
| Infra | Docker (multi-stage), Docker Compose, nginx, Vercel, GitHub Actions |

## What's inside

- **Authentication & RBAC** — register/verify/login, RS256 access + rotating httpOnly refresh cookie, MFA (TOTP), 7 roles, granular permissions.
- **Question Bank & Admin CMS** — authoring, multi-stage editorial review, knowledge base, formula library, learning objectives, blueprints, misconceptions.
- **AI Generation Engine** — grounded question/explanation generation behind a provider seam.
- **Student Learning Platform** — dashboard, adaptive practice, progress/mastery analytics, planner, achievements, bookmarks, history.
- **Mock Examination Engine** — full board simulations with timing, autosave, pause/resume, scoring, review, analytics.
- **AI Tutor** — grounded chat, explanations, progressive hints, step-by-step solutions, formula help, coaching — all citation-backed.
- **Billing, Subscription & Payments** — plans, subscription lifecycle, invoices, provider-abstracted payments + webhooks.

---

## Repository layout

```
ce-board-master/
├── apps/
│   ├── api/                 # NestJS (Fastify) backend — 26 modules, 41 controllers
│   │   ├── prisma/          # schema.prisma (78 models, 51 enums) + 9 migrations + seed
│   │   └── src/             # feature modules (auth, rbac, student, exams, ai-tutor, …)
│   └── web/                 # Next.js 15 frontend — student + admin portals
│       └── src/             # app/ (route groups), components/, features/, lib/
├── packages/
│   ├── types/               # @ce-board-master/types — shared API contract types
│   ├── utils/               # @ce-board-master/utils — pure shared helpers
│   └── config/              # @ce-board-master/config — shared tsconfig base
├── infrastructure/
│   ├── docker/              # api + web Dockerfiles, nginx, redis, postgres
│   ├── monitoring/          # alert + uptime rules
│   ├── production/          # .env.production.example
│   └── scripts/backup/      # db/file backup + restore
├── docs/                    # deployment, operations, DR, launch checklist, ADRs
├── .github/workflows/       # ci, deploy-staging, deploy-production, release
├── docker-compose.yml       # local dev stack (postgres + redis)
├── docker-compose.prod.yml  # self-hostable production topology
├── turbo.json               # task pipeline
└── pnpm-workspace.yaml
```

## Workspace dependency graph

```
@ce-board-master/config
        ▲           ▲
        │           │
@ce-board-master/types   @ce-board-master/utils
        ▲           ▲
        └─────┬─────┘
              │
        @ce-board/web            @ce-board-master/api
        (Next.js frontend)       (NestJS backend — standalone)
```

Acyclic. The backend owns its own internal types; the frontend consumes the shared
contract packages, which extend the shared TS config.

---

## Quick start

```bash
# 1. Install
pnpm install

# 2. Bring up Postgres + Redis (local)
pnpm docker:up

# 3. Configure env (copy and fill)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 4. Generate the Prisma client + apply migrations + seed
pnpm prisma generate
pnpm prisma migrate deploy
pnpm db:seed

# 5. Run everything
pnpm dev
#   API → http://localhost:3001/api/v1   (Swagger at /docs)
#   Web → http://localhost:3000
```

See **[docs/INSTALLATION.md](docs/INSTALLATION.md)**, **[docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md)**,
and **[docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)** for full guides.

## Common scripts (root)

| Script | Action |
|--------|--------|
| `pnpm dev` | Run all apps in watch mode |
| `pnpm build` | Build every workspace via Turborepo |
| `pnpm typecheck` | Type-check every workspace |
| `pnpm test` | Run all unit/integration tests |
| `pnpm lint` / `pnpm format` | Lint / format |
| `pnpm prisma generate` | Generate the Prisma client |
| `pnpm prisma migrate deploy` | Apply migrations (production) |
| `pnpm db:seed` | Seed reference data |
| `pnpm docker:up` / `docker:down` | Local Postgres + Redis |

## Deploy in four commands

The repository is deployable immediately after:

```bash
pnpm install
pnpm prisma generate
pnpm prisma migrate deploy
pnpm build
```

---

## License

UNLICENSED — proprietary. © CE Board Master.
