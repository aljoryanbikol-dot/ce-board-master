# CE Board Master — Production Documentation

The index for running CE Board Master in production. Start here.

## What's here
| Document | Purpose |
|----------|---------|
| `DEPLOYMENT_GUIDE.md` | How to deploy to staging/production (managed cloud or self-hosted). |
| `OPERATIONS_MANUAL.md` | Day-2 operations: monitoring, scaling, runbooks. |
| `DISASTER_RECOVERY.md` | Backup inventory, restore procedures, RPO/RTO, DR drills. |
| `LAUNCH_CHECKLIST.md` | Environment / security / performance / deployment / go-live checklists. |

## Infrastructure layout
```
infrastructure/
├── docker/
│   ├── api/Dockerfile           # production API image (multi-stage, non-root)
│   ├── api/entrypoint.sh        # migrate-then-serve entrypoint
│   ├── web/Dockerfile           # production Next.js image (standalone output)
│   ├── nginx/nginx.conf         # TLS termination, reverse proxy, edge rate limiting
│   ├── Dockerfile.api           # (existing dev/build image — retained)
│   ├── postgres/ · redis/       # engine configs (existing)
├── production/
│   └── .env.production.example  # full env contract (copy → .env.production)
├── monitoring/
│   ├── alerts.yml               # Prometheus/Datadog-mappable alert rules
│   └── uptime-checks.yml        # synthetic/uptime checks
└── scripts/backup/
    ├── db-backup.sh · db-restore.sh
    └── files-backup.sh

docker-compose.prod.yml          # self-hosted production topology
apps/web/vercel.json             # Vercel (managed web) configuration

.github/workflows/
├── ci.yml                       # lint/typecheck/test/build/security (existing)
├── deploy-staging.yml           # develop → staging
├── deploy-production.yml        # main → production (gated, auto-rollback)
└── release.yml                  # vX.Y.Z tag → images + GitHub Release
```

## Topologies
- **Managed (recommended):** Vercel (web) + container API + managed Postgres/Redis + S3/CloudFront.
- **Self-hosted:** `docker-compose.prod.yml` behind nginx on a single host/VPS (also used for staging).

## Security posture (summary)
HTTPS + HSTS everywhere; strict CSP and security headers (Next.js config + nginx); httpOnly/Secure refresh cookie with the access token in memory; CORS allowlist; rate limiting at the edge and in the API; secrets only in a secrets manager; DB/Redis on private networking; non-root containers; image scanning in CI.

## Architecture invariants (unchanged in 4.1)
Sprint 4.1 is infrastructure-only. No application feature was modified. The backend remains the frozen NestJS modular monolith (Sprints 1–3.3); the frontend remains the Sprint 4.0 Next.js app. The two production-integration edits are additive and config-level: `next.config.mjs` gains `output: 'standalone'` + security headers.
