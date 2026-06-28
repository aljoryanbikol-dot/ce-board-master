# CE Board Master — Production Checklist

**Version:** 1.0.0

A go-live gate covering build, environment, security, deployment, and post-launch.
Tick each item before and right after cut-over.

---

## A. Pre-deploy — Build & Integrity

- [ ] `pnpm install --frozen-lockfile` succeeds (lockfile committed and in sync)
- [ ] `pnpm prisma generate` succeeds (Prisma CLI resolves; client generated)
- [ ] `pnpm prisma migrate deploy` applies all 9 migrations on a clean database
- [ ] `pnpm build` builds every workspace (API `dist/main.js` + web standalone bundle)
- [ ] `pnpm typecheck` is clean (with the generated Prisma client present)
- [ ] `pnpm test` passes (web 43/43; API suites)
- [ ] Workspace links resolve (`@ce-board-master/types`, `@ce-board-master/utils`)

## B. Environment

- [ ] All 8 required backend vars set (see ENVIRONMENT_VARIABLES.md)
- [ ] `DATABASE_URL` points at production PostgreSQL 16 (SSL required)
- [ ] `REDIS_*` point at production Redis (TLS on; `REDIS_TLS=true`)
- [ ] RS256 key pair generated; `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` set (PEM, `\n`)
- [ ] `COOKIE_SECRET` and `ARGON2_PEPPER` are ≥32 chars, unique, strong
- [ ] `CORS_ORIGINS` lists exactly the production web origin(s)
- [ ] `FRONTEND_URL` = the deployed Vercel domain
- [ ] No `.env*` file with real secrets is committed

## C. Security

- [ ] Helmet headers + strict CSP active (verify response headers)
- [ ] HTTPS/TLS enforced end-to-end (Vercel edge + backend host)
- [ ] Refresh token is httpOnly, Secure, SameSite; access token in memory only
- [ ] Rate limiting active (global/auth/public throttlers)
- [ ] Swagger disabled or protected in production (`SWAGGER_ENABLED=false` if public)
- [ ] Secrets stored in the platform's secret manager, not in the repo

## D. Database

- [ ] Migrations are forward-only and reviewed
- [ ] `migration_lock.toml` present (provider = postgresql)
- [ ] Automated backups + PITR enabled (retention ≥ 7 days)
- [ ] Seed run if reference data (roles, permissions, plans) is required

## E. Deployment

- [ ] Frontend deployed to Vercel; `API_PROXY_TARGET` set to the backend URL
- [ ] Backend deployed via `render.yaml` (or container host) and healthy
- [ ] `GET /api/v1/health` returns 200 from the production backend
- [ ] Entrypoint ran migrations on boot (or a migration job did)
- [ ] Frontend ↔ backend reachable: login, refresh, and `/auth/me` succeed
- [ ] Loading screen resolves even if the backend is briefly unavailable (timeout fallback)

## F. Integrations (enable as needed — optional at boot)

- [ ] Anthropic key set → AI tutor + generation active
- [ ] Stripe / PayMongo keys + webhooks set → billing active
- [ ] Google OAuth credentials set → Google sign-in active
- [ ] Resend key set → transactional email sending
- [ ] AWS S3 credentials + bucket set → uploads + backups active

## G. Monitoring & Ops

- [ ] Health checks wired to the platform's uptime monitor
- [ ] Error reporting (Sentry DSN) configured
- [ ] Alert rules active (availability, 5xx rate, p95 latency, auth-failure spike)
- [ ] Log level set appropriately (`LOG_LEVEL=info`, `LOG_PRETTY=false`)
- [ ] Disaster-recovery runbook reviewed (docs/DISASTER_RECOVERY.md)

## H. Post-launch smoke test

- [ ] Register → verify email → login flow works
- [ ] Practice session loads and scores
- [ ] Mock exam starts, autosaves, submits, and scores
- [ ] AI tutor responds (if Anthropic configured)
- [ ] Billing checkout reaches the provider (if payments configured)
- [ ] Admin CMS loads for an admin role

---

**When every applicable box is ticked, CE Board Master is live.**
