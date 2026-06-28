# =============================================================================
# CE Board Master — API (NestJS) Dockerfile — Multi-stage Production Build
# =============================================================================
# Build context = monorepo root.
#
# Stage 1: deps     — install full workspace deps for the api (cached on lockfile)
# Stage 2: builder  — prisma generate + nest build
# Stage 3: deployer — `pnpm deploy` → a self-contained, symlink-free node_modules
# Stage 4: runner   — minimal runtime, non-root, healthchecked
#
# Why `pnpm deploy`: pnpm's normal node_modules is a symlink farm into the store.
# Copying apps/api/node_modules alone yields broken links at runtime. `pnpm deploy`
# materializes a flat, production node_modules with real files — safe to COPY.
# prisma is a runtime dependency (the entrypoint runs `migrate deploy`), so it is
# retained by --prod and present in the runner.
# =============================================================================

# ── Stage 1: dependencies ────────────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl python3 make g++
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY pnpm-workspace.yaml package.json turbo.json pnpm-lock.yaml .npmrc* ./
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
COPY pnpm-workspace.yaml package.json turbo.json pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/api ./apps/api
# Generate the Prisma client (downloads engines) + compile the Nest app.
RUN pnpm --filter @ce-board-master/api exec prisma generate
RUN pnpm --filter @ce-board-master/api run build

# ── Stage 3: deploy (self-contained prod node_modules) ───────────────────────
FROM node:22-alpine AS deployer
RUN apk add --no-cache openssl
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY --from=builder /app ./
# Produce a flat, symlink-free production bundle for the api at /app/deploy.
RUN pnpm --filter @ce-board-master/api deploy --prod /app/deploy
# Bring the generated Prisma client into the deployed node_modules (it lives in
# the builder's store-linked path; copy the materialized client + engines).
RUN mkdir -p /app/deploy/node_modules/.prisma \
  && cp -R /app/apps/api/node_modules/.prisma/* /app/deploy/node_modules/.prisma/ 2>/dev/null || true \
  && cp -R /app/node_modules/.prisma/* /app/deploy/node_modules/.prisma/ 2>/dev/null || true

# ── Stage 4: runner ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
LABEL org.opencontainers.image.title="CE Board Master API"
LABEL org.opencontainers.image.description="NestJS backend for the PRC CE Licensure reviewer"
RUN apk add --no-cache openssl dumb-init wget && rm -rf /var/cache/apk/*
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
WORKDIR /app
ENV NODE_ENV=production PORT=3001

COPY --from=deployer --chown=nestjs:nodejs /app/deploy/node_modules ./node_modules
COPY --from=deployer --chown=nestjs:nodejs /app/deploy/dist ./dist
COPY --from=deployer --chown=nestjs:nodejs /app/deploy/prisma ./prisma
COPY --chown=nestjs:nodejs infrastructure/docker/api/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER nestjs
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/v1/health || exit 1

ENTRYPOINT ["dumb-init", "--", "./entrypoint.sh"]
CMD ["node", "dist/main"]
