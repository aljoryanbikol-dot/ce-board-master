# CE Board Master — Deployment Guide

**Audience:** engineers deploying CE Board Master to staging or production.
**Last updated:** 2026-06-27 (Sprint 4.1)

This guide covers two supported topologies:
- **A. Managed cloud (recommended):** Web on Vercel, API on a container host, managed PostgreSQL + Redis, S3 + CloudFront.
- **B. Self-hosted (single host / VPS / staging):** the full stack via `docker-compose.prod.yml` behind nginx.

---

## 0. Prerequisites
- Node 22, pnpm 9, Docker 24+ with Buildx.
- A domain (`ceboardmaster.ph`) with DNS you control (Cloudflare or Route53).
- Provisioned secrets in a secrets manager (see `infrastructure/production/.env.production.example` for the full list).
- TLS: managed (Vercel/Cloudflare/ALB) or Let's Encrypt certs for nginx.

---

## A. Managed cloud deployment

### A1. Database (PostgreSQL 16)
1. Provision a managed instance (RDS / Neon / Supabase) in `ap-southeast-1`.
2. Enable automated backups + PITR; set retention ≥ 7 days.
3. Create the app role and database; capture `DATABASE_URL` (pooled) and a direct URL for migrations.
4. Restrict inbound to the API's security group / IP allowlist; require `sslmode=require`.

### A2. Redis 7
1. Provision managed Redis (ElastiCache / Upstash) with TLS + auth.
2. Set `maxmemory-policy allkeys-lru`; capture `REDIS_HOST/PORT/PASSWORD` and set `REDIS_TLS=true`.

### A3. Object storage + CDN
1. Create an S3 bucket for user uploads/assets (versioning on, SSE-AES256, public access blocked).
2. Front it with CloudFront; set `CDN_DOMAIN=https://cdn.ceboardmaster.ph`.
3. Create a backup bucket in a second region for `files-backup.sh`.

### A4. API (container)
1. CI builds and pushes `ghcr.io/<repo>/api:<sha>` (see `deploy-production.yml`).
2. Deploy to your container host (ECS Fargate / Fly.io / Render / Kubernetes). Provide all env vars from the template via the secrets manager — **never** bake secrets into the image.
3. The container runs `prisma migrate deploy` on boot (toggle with `RUN_MIGRATIONS_ON_START`); for stricter control, set it to `false` and run the migration job from CI.
4. Point the load balancer health check at `/api/v1/health`. Run ≥ 2 replicas behind the LB.
5. Terminate TLS at the LB; forward `X-Forwarded-*`.

### A5. Web (Vercel)
1. Import the repo; set the project root to `apps/web` (build/install commands come from `vercel.json`).
2. Set env: `NEXT_PUBLIC_API_URL=/api/backend`, and update the `vercel.json` rewrite destination to your API origin (`https://api.ceboardmaster.ph`).
3. Region: `sin1` (Singapore — closest to PH).
4. Connect the production domain; Vercel manages TLS.

### A6. DNS
- `ceboardmaster.ph` → Vercel (web).
- `api.ceboardmaster.ph` → API load balancer.
- `cdn.ceboardmaster.ph` → CloudFront.
- Use a low TTL (60s) during launch for fast rollback.

---

## B. Self-hosted (docker-compose)

```bash
# 1. Configure secrets
cp infrastructure/production/.env.production.example .env.production
$EDITOR .env.production            # fill in every CHANGE_ME / blank

# 2. TLS certs for nginx
#    Place fullchain.pem + privkey.pem in infrastructure/docker/nginx/certs/
#    (Let's Encrypt: certbot certonly --standalone -d ceboardmaster.ph)

# 3. Build & start
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d

# 4. Verify
docker compose -f docker-compose.prod.yml ps           # all healthy
curl -fsS https://ceboardmaster.ph/api/v1/health        # 200 OK
```

The API container applies migrations on boot. Postgres and Redis use named volumes (`pgdata`, `redisdata`) — back these up per the DR runbook.

---

## C. Migrations
- Forward-only. `prisma migrate deploy` applies pending migrations idempotently.
- Always take a backup before a production migration (the production workflow does this automatically).
- For destructive schema changes, use the expand/contract pattern across two releases to keep zero downtime.

---

## D. Rollback
- **Web (Vercel):** `vercel rollback` (the production workflow auto-rolls-back on smoke-test failure) or promote a previous deployment in the dashboard.
- **API:** redeploy the previous image tag (`ghcr.io/<repo>/api:<previous-sha>`). Images are immutable and SHA-tagged.
- **Database:** never auto-rollback schema; restore from backup only as a last resort (see DR runbook). Prefer a forward fix.

---

## E. Post-deploy verification
Run the **Deployment checklist** in `docs/LAUNCH_CHECKLIST.md`: health endpoints green, login + a write path working, payments webhook reachable, no error spike, dashboards green.
