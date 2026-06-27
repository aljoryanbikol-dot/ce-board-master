# CE Board Master — Disaster Recovery Runbook

**Owner:** Platform on-call · **Last reviewed:** 2026-06-27

## Objectives
- **RPO (Recovery Point Objective): ≤ 24h** for the database via daily backups; ≤ 5 min if PITR (point-in-time recovery) is enabled on the managed database.
- **RTO (Recovery Time Objective): ≤ 1h** to restore service from backups.

## Backup inventory
| Asset | Mechanism | Frequency | Location | Retention |
|-------|-----------|-----------|----------|-----------|
| PostgreSQL | `db-backup.sh` (pg_dump -Fc) + managed PITR | Daily + continuous WAL | S3 (SSE-AES256) + RDS snapshots | 30 days |
| Object storage (uploads/assets) | `files-backup.sh` (S3 sync, cross-region) | Daily | Backup bucket (other region) | Versioned |
| Secrets | Secrets manager (versioned) | On change | AWS Secrets Manager / Doppler | All versions |
| Infrastructure | This repo (IaC, compose, Dockerfiles) | On commit | Git | Full history |

## Scenarios & procedures

### 1. Database corruption / accidental data loss
1. Identify the last known-good backup key (`aws s3 ls`).
2. Provision a fresh database instance (do **not** restore over the live one first).
3. `TARGET_DATABASE_URL=... ./infrastructure/scripts/backup/db-restore.sh <key>` (verifies checksum).
4. Run smoke tests (`/api/v1/health`, login, a read + a write).
5. Repoint the app's `DATABASE_URL`, redeploy, verify, then decommission the bad instance.
- If PITR is available, prefer restoring to a timestamp just before the incident.

### 2. Region / availability-zone outage
1. Promote the cross-region read replica (or restore the latest snapshot in the standby region).
2. Bring up API + web in the standby region (compose or managed deploy).
3. Update DNS (Cloudflare/Route53) to the standby load balancer; low TTL (60s) makes this fast.
4. Verify health; communicate status.

### 3. Full platform rebuild (worst case)
1. Provision infra (managed Postgres, Redis, S3, CDN) from the deployment guide.
2. Restore the database (procedure 1) and object storage (`files-backup.sh` target → primary).
3. Load secrets from the secrets manager.
4. Deploy API (runs `prisma migrate deploy` on boot) and web.
5. Smoke test the launch checklist, then cut DNS over.

## Verification cadence
- **Monthly restore drill:** restore the latest backup into a scratch database, run smoke tests, record the wall-clock RTO. A backup is not real until a restore has been proven.
- **Quarterly DR game-day:** exercise the region-failover procedure end to end.

## Contacts & escalation
- Primary on-call → Platform lead → Engineering manager. Keep the current rotation in the team runbook / PagerDuty.
