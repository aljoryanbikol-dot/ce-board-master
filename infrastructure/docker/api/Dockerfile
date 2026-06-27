# =============================================================================
# CE Board Master — API (NestJS) Dockerfile — Multi-stage Production Build
# =============================================================================
# Production-finalized build for Sprint 4.1. Supersedes the dev-oriented
# infrastructure/docker/Dockerfile.api with: pinned pnpm, an entrypoint that
# runs `prisma migrate deploy` before boot (idempotent), and a non-root runtime.
#
# Stage 1: deps     — install api workspace deps (cached on lockfile)
# Stage 2: builder  — prisma generate + nest build
# Stage 3: runner   — minimal runtime, non-root, healthchecked
# Build context = monorepo root.
# =============================================================================

# ── Stage 1: dependencies ────────────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl python3 make g++
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY pnpm-workspace.yaml package.json turbo.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/config/package.json ./packages/config/
RUN pnpm install --frozen-lockfile --filter @ce-board-master/api...

# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY pnpm-workspace.yaml package.json turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN pnpm db:generate && pnpm build

# Prune dev dependencies for a lean runtime node_modules.
RUN pnpm prune --prod || true

# ── Stage 3: runner ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
LABEL org.opencontainers.image.title="CE Board Master API"
LABEL org.opencontainers.image.description="NestJS backend for the PRC CE Licensure reviewer"
RUN apk add --no-cache openssl dumb-init wget && rm -rf /var/cache/apk/*
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
WORKDIR /app
ENV NODE_ENV=production PORT=3001

COPY --from=builder --chown=nestjs:nodejs /app/apps/api/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma ./prisma
COPY --chown=nestjs:nodejs infrastructure/docker/api/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER nestjs
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/v1/health || exit 1

ENTRYPOINT ["dumb-init", "--", "./entrypoint.sh"]
CMD ["node", "dist/main"]
