#!/usr/bin/env bash
# =============================================================================
# CE Board Master — PostgreSQL restore
# =============================================================================
# Restores a dump produced by db-backup.sh. Verifies the sha256 checksum first.
# This is destructive against the TARGET database — confirm the target before use.
#
# Required env:
#   TARGET_DATABASE_URL          where to restore INTO
#   BACKUP_S3_BUCKET             source bucket
# Args:
#   $1  backup key (e.g. ceboardmaster-20260627T030000Z.dump)
#
# Usage:  ./db-restore.sh ceboardmaster-20260627T030000Z.dump
# =============================================================================
set -euo pipefail

: "${TARGET_DATABASE_URL:?TARGET_DATABASE_URL is required}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required}"
KEY="${1:?Pass the backup key as the first argument}"
PREFIX="${BACKUP_S3_PREFIX:-db-backups}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "[restore] Downloading ${KEY}…"
aws s3 cp "s3://${BACKUP_S3_BUCKET}/${PREFIX}/${KEY}" "${TMP}/${KEY}" --only-show-errors
aws s3 cp "s3://${BACKUP_S3_BUCKET}/${PREFIX}/${KEY}.sha256" "${TMP}/${KEY}.sha256" --only-show-errors || true

if [ -f "${TMP}/${KEY}.sha256" ]; then
  echo "[restore] Verifying checksum…"
  EXPECTED="$(cat "${TMP}/${KEY}.sha256")"
  ACTUAL="$(sha256sum "${TMP}/${KEY}" | awk '{print $1}')"
  [ "$EXPECTED" = "$ACTUAL" ] || { echo "[restore] CHECKSUM MISMATCH — aborting." >&2; exit 1; }
  echo "[restore] Checksum OK."
fi

echo "[restore] WARNING: restoring into the target database (existing data may be dropped)."
echo "[restore] Target: ${TARGET_DATABASE_URL%%\?*}"
read -r -p "[restore] Type 'RESTORE' to proceed: " CONFIRM
[ "$CONFIRM" = "RESTORE" ] || { echo "[restore] Cancelled."; exit 1; }

# --clean --if-exists drops objects before recreating; -j parallelizes.
pg_restore --clean --if-exists --no-owner --no-privileges --jobs=4 \
  --dbname="${TARGET_DATABASE_URL}" "${TMP}/${KEY}"

echo "[restore] Restore complete. Run a smoke test before serving traffic."
