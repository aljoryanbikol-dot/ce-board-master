# Local Development Guide

## Run everything

```bash
pnpm dev
```

Turborepo runs both apps in parallel:

| App | URL | Notes |
|-----|-----|-------|
| API | http://localhost:3001/api/v1 | Swagger UI at `/docs` |
| Web | http://localhost:3000 | proxies `/api/backend/*` → API `/api/v1/*` |

Run a single app:

```bash
pnpm --filter @ce-board-master/api dev
pnpm --filter @ce-board/web dev
```

## How the frontend talks to the backend

The web app calls **`/api/backend/*`**. In dev, `next.config.mjs` rewrites that to
`${API_PROXY_TARGET}/api/v1/*` (default `http://localhost:3001`). In production the
rewrite points at the real API origin (see `apps/web/vercel.json`). This keeps the
browser same-origin, so the httpOnly refresh cookie flows correctly.

The contract is centralized:
- Success envelope: `{ data, meta }`
- Error envelope: `{ error: { code, message, statusCode, … }, meta }`
- Access token: in-memory (RS256, 15 min). Refresh token: rotating httpOnly cookie (30 d).
- The web API client (`apps/web/src/lib/api/client.ts`) unwraps envelopes, throws a
  typed `ApiError`, and performs a single silent refresh + replay on 401.

## Database workflow

```bash
pnpm prisma generate            # after editing schema.prisma
pnpm db:migrate:dev             # create + apply a dev migration (apps/api)
pnpm db:studio                  # open Prisma Studio
pnpm db:seed                    # re-seed reference data
```

Schema lives at `apps/api/prisma/schema.prisma` (78 models, 51 enums). Migrations are
in `apps/api/prisma/migrations/` with a pinned `migration_lock.toml` (provider:
postgresql).

## Quality gates

```bash
pnpm typecheck      # tsc --noEmit across all workspaces
pnpm test           # vitest unit + integration
pnpm test:e2e       # backend e2e (needs Postgres + Redis up)
pnpm lint           # eslint
pnpm format         # prettier --write
```

Turborepo caches task results, so re-runs only rebuild what changed.

## Project conventions

- **Feature-first** modules on both sides (`src/<feature>/…` on the API,
  `src/features/<feature>/…` on the web).
- **Strict TypeScript** everywhere. The web app and shared packages type-check with
  zero errors; the API type-checks clean once `prisma generate` has produced the client.
- **No duplicated UI logic** on the web — `QueryBoundary` and `ResourceTable` centralize
  load/error/empty/data states.
- **No business logic in controllers** on the API — controllers delegate to services.

## Tests

| Suite | Location | Run |
|-------|----------|-----|
| API unit/integration | `apps/api/src/**/__tests__`, `apps/api/test/` | `pnpm --filter @ce-board-master/api test` |
| Web unit/integration | `apps/web/src/**/__tests__` | `pnpm --filter @ce-board/web test` |

## Troubleshooting

- **`@prisma/client` type errors before generating** — run `pnpm prisma generate`. The
  client is generated, not committed.
- **Refresh cookie not set** — ensure `COOKIE_SECRET` is set (≥ 32 chars) and the web
  origin is in `CORS_ORIGINS`.
- **Port already in use** — API defaults to `3001`, web to `3000`; override via `PORT`.
