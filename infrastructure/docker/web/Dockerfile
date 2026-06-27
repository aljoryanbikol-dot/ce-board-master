# =============================================================================
# CE Board Master — Web (Next.js) Dockerfile — Multi-stage Production Build
# =============================================================================
# Stage 1: deps     — install workspace dependencies (cached on lockfile)
# Stage 2: builder  — produce the Next.js standalone output
# Stage 3: runner   — minimal runtime image, non-root, healthchecked
#
# Requires next.config.mjs `output: 'standalone'` (set in Sprint 4.1).
# Final image runs `node server.js` from the standalone bundle — no pnpm,
# no full node_modules, no source. Build context = monorepo root.
# =============================================================================

# ── Stage 1: dependencies ────────────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Workspace manifests first (layer caching).
COPY pnpm-workspace.yaml package.json turbo.json pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/config/package.json ./packages/config/
RUN pnpm install --frozen-lockfile --filter @ce-board/web...

# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY pnpm-workspace.yaml package.json turbo.json ./
COPY packages ./packages
COPY apps/web ./apps/web

# Build-time public env (baked into the client bundle). Override at build.
ARG NEXT_PUBLIC_API_URL=/api/backend
ARG NEXT_PUBLIC_APP_NAME="CE Board Master"
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME} \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production
WORKDIR /app/apps/web
RUN pnpm build

# ── Stage 3: runner ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
LABEL org.opencontainers.image.title="CE Board Master Web"
LABEL org.opencontainers.image.description="Next.js frontend for the PRC CE Licensure reviewer"
RUN apk add --no-cache dumb-init wget && rm -rf /var/cache/apk/*
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0

# Standalone server + static assets + public dir.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/login || exit 1

ENTRYPOINT ["dumb-init", "--"]
# The standalone server entry is apps/web/server.js (monorepo tracing).
CMD ["node", "apps/web/server.js"]
