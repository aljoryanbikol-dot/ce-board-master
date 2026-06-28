# Installation Guide

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥ 22.0.0 | see `.nvmrc` (`nvm use`) |
| pnpm | ≥ 9.0.0 | `corepack enable && corepack prepare pnpm@latest --activate` |
| Docker + Compose | recent | for local Postgres + Redis |
| PostgreSQL | 16 | local via Docker, or a managed instance |
| Redis | 7 | local via Docker, or a managed instance |
| OpenSSL | any | to generate the RS256 JWT key pair |

## 1. Clone & install

```bash
git clone <repo-url> ce-board-master
cd ce-board-master
corepack enable
pnpm install
```

`pnpm install` resolves the whole workspace (apps + shared packages) and links the
internal packages (`@ce-board-master/types`, `@ce-board-master/utils`,
`@ce-board-master/config`).

> On first install pnpm may print "Ignored build scripts". The repo's
> `pnpm-workspace.yaml` lists these under `onlyBuiltDependencies`; approve them with
> `pnpm approve-builds` (or they auto-build in CI).

## 2. Start the datastores

```bash
pnpm docker:up        # postgres:16 + redis:7 (see docker-compose.yml)
```

Or point the env vars at managed instances instead.

## 3. Environment variables

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Fill in `apps/api/.env`. The critical values:

| Variable | What it is |
|----------|------------|
| `DATABASE_URL` | `postgresql://user:pass@localhost:5432/ceboard?schema=public` |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Redis connection |
| `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` | RS256 key pair (see below) |
| `COOKIE_SECRET` | ≥ 32 chars, signs the refresh-token cookie |
| `ARGON2_PEPPER` | server-side password pepper |
| `CORS_ORIGINS` | comma-separated allowed origins (e.g. `http://localhost:3000`) |

Generate the RS256 key pair:

```bash
openssl genpkey -algorithm RSA -out private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in private.pem -out public.pem
# Put the PEM contents (with literal \n) into JWT_PRIVATE_KEY / JWT_PUBLIC_KEY
```

`apps/web/.env` defaults work for local dev (`API_PROXY_TARGET=http://localhost:3001`).

## 4. Database: client, migrations, seed

```bash
pnpm prisma generate          # generate the typed Prisma client
pnpm prisma migrate deploy    # apply all 9 migrations
pnpm db:seed                  # seed roles, permissions, plans, reference data
```

## 5. Verify

```bash
pnpm typecheck                # every workspace type-checks
pnpm test                     # unit + integration tests
pnpm build                    # build every workspace
```

You're ready. Continue with **LOCAL_DEVELOPMENT.md**.
