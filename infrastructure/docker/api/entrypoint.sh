#!/bin/sh
# =============================================================================
# API container entrypoint.
# Applies pending Prisma migrations (idempotent, safe on every boot), then
# hands off to the CMD (the Node server) via exec so signals propagate.
#
# RUN_MIGRATIONS_ON_START=false disables auto-migrate (e.g. when a dedicated
# migration job owns schema changes in the deploy pipeline).
# =============================================================================
set -e

if [ "${RUN_MIGRATIONS_ON_START:-true}" = "true" ]; then
  echo "[entrypoint] Applying database migrations (prisma migrate deploy)…"
  node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma || {
    echo "[entrypoint] Migration failed — refusing to start." >&2
    exit 1
  }
  echo "[entrypoint] Migrations up to date."
else
  echo "[entrypoint] RUN_MIGRATIONS_ON_START=false — skipping migrations."
fi

echo "[entrypoint] Starting API…"
exec "$@"
