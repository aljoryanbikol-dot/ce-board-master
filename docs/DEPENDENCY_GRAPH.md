# CE Board Master — Dependency Graph

**Version:** 1.0.0 (production)
**Generated:** 2026-06-27

This document maps the workspace package graph and the key external dependency
stack for each package in the consolidated production monorepo.

---

## 1. Workspace graph (internal packages)

The internal dependency graph is **acyclic**. `config` is the leaf base that
`types` and `utils` extend; the web app consumes the shared contract packages;
the API is self-contained (owns its own internal types).

```
                    @ce-board-master/config
                  (shared tsconfig base — leaf)
                       ▲              ▲
                       │ extends      │ extends
          ┌────────────┘              └────────────┐
  @ce-board-master/types              @ce-board-master/utils
  (shared API contract types)         (pure shared helpers)
                       ▲              ▲
                       │ workspace:*  │ workspace:*
                       └──────┬───────┘
                              │
                      @ce-board/web                @ce-board-master/api
                   (Next.js 15 frontend)        (NestJS/Fastify backend)
                                                 (no internal workspace deps)
```

| Package | Directory | Internal deps |
|---------|-----------|---------------|
| `@ce-board-master/api` | `apps/api` | — |
| `@ce-board/web` | `apps/web` | `@ce-board-master/types`, `@ce-board-master/utils` |
| `@ce-board-master/types` | `packages/types` | `@ce-board-master/config` |
| `@ce-board-master/utils` | `packages/utils` | `@ce-board-master/config` |
| `@ce-board-master/config` | `packages/config` | — |

---

## 2. Backend stack — `@ce-board-master/api`

**Framework:** `@nestjs/core@^10.4.15`, `@nestjs/common@^10.4.15`, `@nestjs/platform-fastify@^10.4.15`, `fastify@^4.28.1`

**HTTP & security:** `@fastify/helmet@^11.1.1`, `@fastify/compress@^7.0.3`, `@fastify/cookie@^9.4.0`, `@nestjs/throttler@^6.3.0`

**Database:** `@prisma/client@^6.1.0`, `prisma@^6.1.0`

**Cache & queue:** `@nestjs/cache-manager@^3.1.3`, `cache-manager@^6.4.3`, `keyv@^5.6.0`, `@keyv/redis@^4.6.0`, `@nestjs/bullmq@^10.2.3`, `bullmq@^5.35.0`, `ioredis@^5.4.1`

**Auth:** `@nestjs/jwt@^10.2.0`, `@nestjs/passport@^10.0.3`, `passport@^0.7.0`, `passport-jwt@^4.0.1`, `passport-local@^1.0.0`, `passport-custom@^1.1.1`, `passport-google-oauth20@^2.0.0`, `argon2@^0.41.1`

**Validation & docs:** `zod@^3.24.1`, `@nestjs/swagger@^8.1.0`

**Health & events:** `@nestjs/terminus@^10.2.3`, `@nestjs/event-emitter@^2.1.1`

---

## 3. Frontend stack — `@ce-board/web`

**Framework:** `next@15.1.3`, `react@19.0.0`, `react-dom@19.0.0`

**Data & state:** `@tanstack/react-query@^5.62.0`, `zustand@^5.0.2`

**Forms & validation:** `react-hook-form@^7.54.0`, `@hookform/resolvers@^3.9.1`, `zod@^3.24.1`

**UI:** `tailwindcss@^3.4.17`, `class-variance-authority@^0.7.1`, `tailwind-merge@^2.6.0`, `lucide-react@^0.469.0`, `sonner@^1.7.1`, `cmdk@^1.0.4`, `framer-motion@^11.15.0`, `recharts@^2.15.0`, `next-themes@^0.4.4`

**Shared contracts:** `@ce-board-master/types@workspace:*`, `@ce-board-master/utils@workspace:*`

---

## 4. Build orchestration

Turborepo drives the task graph. `build` depends on upstream `^build`, so shared
packages compile before the apps. Cached outputs: `dist/**`, `.next/**`.

```
pnpm build  →  turbo run build
   config ──▶ types ──┐
   config ──▶ utils ──┼──▶ web (.next/)
                       └──▶ (api builds independently → dist/)
```
