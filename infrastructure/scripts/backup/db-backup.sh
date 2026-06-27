#!/usr/bin/env bash
# =============================================================================
# CE Board Master — PostgreSQL backup
# =============================================================================
# Takes a compressed custom-format dump and uploads it to S3 with a timestamped
# key. Designed to run from cron / a scheduled task / an ECS scheduled job.
#
# Required env:
#   DATABASE_URL                 postgres connection string
#   BACKUP_S3_BUCKET             s3 bucket name (without s3://)
# Optional env:
#   BACKUP_S3_PREFIX             key prefix (default: db-backups)
#   BACKUP_RETENTION_DAYS        prune S3 objects older than N days (default: 30)
#   AWS_REGION                   default ap-southeast-1
#
# Usage:  ./db-backup.sh
# =============================================================================
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required}"
PREFIX="${BACKUP_S3_PREFIX:-db-backups}"
RETENTION="${BACKUP_RETENTION_DAYS:-30}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="ceboardmaster-${TS}.dump"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "[backup] Dumping database → ${FILE}"
# Custom format (-Fc) = compressed + supports parallel restore (pg_restore -j).
pg_dump --format=custom --no-owner --no-privileges --compress=9 \
  --file="${TMP}/${FILE}" "${DATABASE_URL}"

SIZE="$(du -h "${TMP}/${FILE}" | cut -f1)"
echo "[backup] Dump complete (${SIZE}). Uploading to s3://${BACKUP_S3_BUCKET}/${PREFIX}/${FILE}"

# Server-side encryption at rest (AES256).
aws s3 cp "${TMP}/${FILE}" "s3://${BACKUP_S3_BUCKET}/${PREFIX}/${FILE}" \
  --sse AES256 --only-show-errors

# Write a checksum alongside for integrity verification on restore.
sha256sum "${TMP}/${FILE}" | awk '{print $1}' > "${TMP}/${FILE}.sha256"
aws s3 cp "${TMP}/${FILE}.sha256" "s3://${BACKUP_S3_BUCKET}/${PREFIX}/${FILE}.sha256" \
  --sse AES256 --only-show-errors

echo "[backup] Pruning backups older than ${RETENTION} days…"
CUTOFF="$(date -u -d "${RETENTION} days ago" +%Y%m%dT%H%M%SZ 2>/dev/null || date -u -v-"${RETENTION}"d +%Y%m%dT%H%M%SZ)"
aws s3 ls "s3://${BACKUP_S3_BUCKET}/${PREFIX}/" | awk '{print $4}' | while read -r key; do
  [ -z "$key" ] && continue
  stamp="$(echo "$key" | sed -E 's/ceboardmaster-([0-9TZ]+)\..*/\1/')"
  if [ "$stamp" \< "$CUTOFF" ]; then
    aws s3 rm "s3://${BACKUP_S3_BUCKET}/${PREFIX}/${key}" --only-show-errors
    echo "[backup] Pruned ${key}"
  fi
done

echo "[backup] Done."
