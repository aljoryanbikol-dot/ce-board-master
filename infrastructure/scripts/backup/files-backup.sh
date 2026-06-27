#!/usr/bin/env bash
# =============================================================================
# CE Board Master — Object storage (S3) backup / replication
# =============================================================================
# Syncs the primary asset bucket to a backup bucket (ideally cross-region) for
# durability beyond S3's native redundancy. Run on a schedule.
#
# Required env:
#   ASSETS_S3_BUCKET       primary bucket (user uploads, generated assets)
#   BACKUP_FILES_S3_BUCKET destination bucket (cross-region recommended)
# Usage:  ./files-backup.sh
# =============================================================================
set -euo pipefail
: "${ASSETS_S3_BUCKET:?ASSETS_S3_BUCKET is required}"
: "${BACKUP_FILES_S3_BUCKET:?BACKUP_FILES_S3_BUCKET is required}"

echo "[files] Syncing s3://${ASSETS_S3_BUCKET} → s3://${BACKUP_FILES_S3_BUCKET}"
# --delete keeps the mirror exact; remove it to make the backup append-only.
aws s3 sync "s3://${ASSETS_S3_BUCKET}" "s3://${BACKUP_FILES_S3_BUCKET}" \
  --sse AES256 --only-show-errors
echo "[files] Sync complete at $(date -u +%FT%TZ)."
