/**
 * @ce-board-master/types — Shared TypeScript types.
 *
 * Types exported from this package are shared between:
 * - apps/api (NestJS backend)
 * - apps/web (Next.js frontend)
 * - apps/admin (Next.js admin panel)
 *
 * This eliminates type drift between frontend and backend.
 * API response types defined here match the API Contract Specification.
 *
 * Note: This package exports types only — no runtime code.
 * Do not add dependencies with side effects.
 */

// Re-export all shared types
export * from './api-responses';
export * from './domain';
export * from './enums';
