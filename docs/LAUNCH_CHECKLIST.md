# CE Board Master — Launch Readiness Checklists

**Last updated:** 2026-06-27 (Sprint 4.1). Work top to bottom; every box must be checked before public launch.

---

## 1. Environment checklist
- [ ] All env vars from `infrastructure/production/.env.production.example` set in the prod secrets manager (no `CHANGE_ME`/blanks).
- [ ] `NODE_ENV=production` on API and web.
- [ ] `DATABASE_URL` uses the pooler + `sslmode=require`; a direct URL exists for migrations.
- [ ] `REDIS_TLS=true`, Redis auth set, `allkeys-lru` policy.
- [ ] RS256 JWT keypair generated and stored as secrets (not in the repo).
- [ ] `COOKIE_SECRET` is long and random; distinct per environment.
- [ ] `CORS_ORIGINS` lists only the production web origins.
- [ ] `SWAGGER_ENABLED=false` (or IP-restricted).
- [ ] `NEXT_PUBLIC_API_URL` + `vercel.json` rewrite point at the prod API origin.
- [ ] Staging mirrors production config (parity) with its own secrets.

## 2. Security checklist
- [ ] HTTPS enforced everywhere; HTTP redirects to HTTPS; HSTS preload set.
- [ ] Security headers present on web responses (CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy) — verify with a header scan.
- [ ] CSP reviewed against the app (no console CSP violations on key flows).
- [ ] Cookies: refresh token is `httpOnly`, `Secure`, `SameSite` set; access token stays in memory.
- [ ] CORS verified: cross-origin requests from non-allowlisted origins are blocked.
- [ ] Rate limiting verified at the edge (nginx/Vercel) **and** in the API (auth routes stricter).
- [ ] Secrets only in the secrets manager; none in the repo, images, or logs.
- [ ] DB/Redis reachable only from the API (security groups / private networking).
- [ ] Dependency audit clean (CI `security` job, Trivy image scan) with no unresolved highs/criticals.
- [ ] Admin portal gated by role; non-admins bounced; audit logging on.
- [ ] Payment webhook signature verification enabled for every provider in use.

## 3. Performance checklist
- [ ] Web: production build succeeds; First Load JS within budget; images/fonts optimized.
- [ ] CDN in front of static assets; cache headers correct.
- [ ] API: ≥ 2 replicas behind the LB; autoscaling configured.
- [ ] DB: connection pooling in place; indexes verified for hot queries; slow-query logging on.
- [ ] Redis caching effective (hit rate observed in staging load test).
- [ ] Load test passed at target concurrency (p95 latency < 1s, error rate < 1%).
- [ ] Reduced-motion + Lighthouse a11y/perf spot-checked on key pages.

## 4. Deployment checklist
- [ ] CI green on the release commit (lint, typecheck, tests, build, security).
- [ ] API image built, SHA-tagged, pushed to GHCR with SBOM + provenance.
- [ ] Pre-migration DB backup taken (automatic in the prod workflow).
- [ ] `prisma migrate deploy` applied cleanly.
- [ ] Web deployed to Vercel production (or container); previous deployment retained for rollback.
- [ ] Post-deploy smoke test passed (API health, web `/login`, one read + one write).
- [ ] Rollback path tested at least once (image redeploy + `vercel rollback`).

## 5. Monitoring & ops checklist
- [ ] Logs shipping to the aggregator; dashboards built (rate/latency/errors, DB, Redis, queues).
- [ ] Error reporter (Sentry) receiving events, grouped by release.
- [ ] Alerts wired (`alerts.yml`) to the on-call channel/pager; tested with a synthetic trigger.
- [ ] Uptime/synthetic checks live (`uptime-checks.yml`) from ≥ 2 regions.
- [ ] SSL-expiry alert configured (≥ 21 days notice).
- [ ] On-call rotation + escalation path published.

## 6. Backups & DR checklist
- [ ] Daily DB backup job scheduled and verified (one successful run + checksum present).
- [ ] PITR enabled on the managed DB.
- [ ] Daily object-storage sync to the cross-region backup bucket.
- [ ] A restore drill completed successfully into a scratch DB; RTO recorded.
- [ ] DR runbook reviewed; RPO/RTO targets agreed.

## 7. Production go-live checklist
- [ ] DNS cut over with low TTL; propagation confirmed.
- [ ] Domain + TLS valid (no mixed content, valid chain).
- [ ] Email deliverability verified (SPF/DKIM/DMARC; a real verification + reset email received).
- [ ] Payment flows tested end to end in live mode with a real low-value transaction, then refunded.
- [ ] AI tutor responds and stays within `AI_TUTOR_DAILY_LIMIT`.
- [ ] Legal/compliance pages live (terms, privacy) if required for launch.
- [ ] Status page / comms ready; rollback decision-maker identified.
- [ ] Post-launch monitoring window staffed for the first hours.

---

**Sign-off:** Engineering lead ☐ · Product ☐ · On-call ☐ — date: ____________
