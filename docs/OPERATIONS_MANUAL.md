# CE Board Master — Operations Manual

**Audience:** on-call engineers and operators. **Last updated:** 2026-06-27.

## 1. System overview
- **Web** — Next.js 15 (Vercel or container). Stateless. Proxies `/api/backend/*` → API.
- **API** — NestJS modular monolith. Stateless; horizontally scalable behind a load balancer. Health: `/api/v1/health` (basic) and `/api/v1/health/detailed` (DB/memory/disk).
- **PostgreSQL 16** — system of record. **Redis 7** — cache, queues, sessions.
- **S3 + CloudFront** — assets/uploads. **Stripe/PayMongo/Xendit** — payments. **Anthropic** — AI tutor/generation. **Resend** — email.

## 2. Observability
- **Logs:** structured JSON via pino (the API logs request id, user id where present, latency). Ship to your aggregator (Datadog / Loki / CloudWatch). `LOG_LEVEL=info`, `LOG_PRETTY=false` in prod.
- **Metrics:** request rate/latency/errors, DB pool, Redis memory, queue depth. Health indicators feed the `ce_health_status` gauges referenced by alerts.
- **Errors:** wire `SENTRY_DSN` for exception capture; group by release (`APP_VERSION`).
- **Tracing:** `OTEL_EXPORTER_OTLP_ENDPOINT` for distributed traces (optional).
- **Alerts:** `infrastructure/monitoring/alerts.yml`; uptime in `uptime-checks.yml`.

## 3. Routine operations
- **Deploy:** push to `develop` → staging; merge to `main` → production (manual approval gate on the `production` environment). See the deployment guide.
- **Scale:** increase API replicas behind the LB; Postgres/Redis scale via the managed tier. The app is stateless, so scale out freely.
- **Rotate secrets:** update in the secrets manager, then restart the API (rolling). JWT key rotation: add the new public key to the verifier set before switching the signer (overlap window).
- **Cache:** safe to flush Redis cache DB (`REDIS_DB_CACHE`) — it repopulates. Do **not** flush the session/queue DBs casually.

## 4. Common runbooks

### api-down
1. Check the LB target health and the container platform's task status.
2. `GET /api/v1/health/detailed` (from an allowlisted host) to see which dependency is red.
3. If DB: check connections/CPU on the managed instance; if Redis: check memory/evictions.
4. Roll back to the previous image if a recent deploy correlates. Restart unhealthy tasks.

### high-error-rate
1. Identify the failing route/release from logs + error reporter.
2. If tied to a deploy → roll back the API image and/or `vercel rollback` the web.
3. If a dependency (payments/AI/email) → check that provider's status; the app degrades gracefully where designed (queues retry).

### database-slow / connections-high
1. Inspect slow queries; confirm the pooler is in front of Postgres.
2. Lower app `connection_limit` if saturating; scale the DB tier.
3. Kill runaway queries only as a last resort.

### payment-webhook-failures
1. Check the provider dashboard for delivery errors and the API logs for signature failures.
2. Verify `*_WEBHOOK_SECRET` matches the provider; replay missed webhooks from the provider.
3. Reconcile subscription state once flowing again.

### redis-memory-high
1. Confirm `allkeys-lru` is set; check for unbounded keys.
2. Flush the cache DB if needed; scale the Redis tier.

## 5. Maintenance windows
- Prefer zero-downtime (expand/contract migrations, rolling deploys). If a window is required, announce it, set a status banner, and keep it inside low-traffic hours (PH time).

## 6. Security operations
- Review audit logs (`/admin/audit-logs`) for anomalies.
- Rotate credentials on any suspected exposure; invalidate sessions via `logout-all` paths.
- Keep dependencies patched (CI security job + Dependabot/Renovate).

## 7. Backups & DR
- Daily DB backup (`db-backup.sh`) + managed PITR; daily object-storage sync (`files-backup.sh`).
- Monthly restore drill; quarterly DR game-day. Full procedures in `docs/DISASTER_RECOVERY.md`.
