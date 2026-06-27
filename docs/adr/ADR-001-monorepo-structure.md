# ADR-001: Turborepo Monorepo Structure

**Status:** Accepted  
**Date:** 2026-06-25  
**Authors:** Lead Software Architect  

## Context

CE Board Master needs a codebase structure that:
1. Shares TypeScript types between the backend API and frontend applications
2. Allows independent deployment of API, web app, and admin panel
3. Enables Turborepo's cached builds and affected-package detection
4. Maintains clear boundaries between packages

## Decision

We use a Turborepo monorepo with the following structure:
- `apps/api` — NestJS backend
- `apps/web` — Next.js student frontend
- `apps/admin` — Next.js admin panel  
- `packages/types` — Shared TypeScript types
- `packages/utils` — Shared pure utility functions
- `packages/config` — Shared ESLint/TypeScript base configs

## Consequences

**Positive:**
- Single `pnpm install` sets up entire development environment
- TypeScript type changes in `packages/types` immediately visible in all apps
- Turborepo caches unchanged package builds (CI time reduced 60-80%)
- `--filter` flag deploys individual apps independently

**Negative:**
- Slightly higher complexity for developers unfamiliar with monorepos
- pnpm workspace protocol required for cross-package dependencies

## Alternatives Considered

- **Polyrepo:** Rejected. Type drift between frontend/backend creates bugs.
- **Nx:** Rejected. Turborepo is simpler for our team size.
