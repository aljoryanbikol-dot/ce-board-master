/**
 * Common Types — Shared TypeScript types used across the API.
 *
 * These types are used throughout the application for:
 * - API response shapes
 * - Pagination structures
 * - Authenticated request extension
 * - Common domain types
 */

// ── API Response Types ────────────────────────────────────────────────────────

/**
 * Standard API success response envelope.
 * All controller responses are wrapped in this by TransformInterceptor.
 */
export interface ApiResponse<T> {
  data: T;
  meta: {
    timestamp: string;
    requestId: string;
    pagination?: PaginationMeta;
  };
}

/**
 * Standard API error response envelope.
 * All errors are shaped by GlobalExceptionFilter.
 */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    statusCode: number;
    field?: string;
    details?: Array<{ field: string; message: string }>;
  };
  meta: {
    timestamp: string;
    requestId: string;
  };
}

// ── Pagination ────────────────────────────────────────────────────────────────

/**
 * Cursor-based pagination metadata (per API Contract, Phase 4).
 * Never use offset/page-number pagination — see ADR-009.
 */
export interface PaginationMeta {
  cursor?: string;
  hasMore: boolean;
  total?: number;
}

/**
 * Paginated response from service layer — unwrapped by TransformInterceptor.
 * Controllers return this; the interceptor lifts pagination into meta.
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

/**
 * Cursor pagination query parameters.
 * Extend this in module-specific query DTOs.
 */
export interface CursorPaginationQuery {
  cursor?: string;
  limit?: number;
}

// ── Authenticated Request ─────────────────────────────────────────────────────

/**
 * Authenticated user payload extracted from JWT by JwtAuthGuard.
 * Available on req.user after authentication.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  subscriptionTier: 'free' | 'basic' | 'pro';
}

/**
 * Express/Fastify request with authenticated user.
 * Used for type-safe access to req.user in controllers and guards.
 */
export interface AuthenticatedRequest {
  id?: string;
  user: AuthenticatedUser;
}

// ── Domain Types ──────────────────────────────────────────────────────────────

/** Subscription tier values — mirrors database SubscriptionTier enum */
export type SubscriptionTier = 'free' | 'basic' | 'pro';

/** Question difficulty codes */
export type DifficultyCode = 1 | 2 | 3;

/** CE exam day values */
export type ExamDay = 1 | 2;

/** Traffic-light performance classification */
export type StrengthLevel = 'green' | 'amber' | 'red';

/**
 * Calculate strength level from accuracy rate.
 * green ≥ 80%, amber 65–79%, red < 65%
 * (per UX Specification Phase 5, Analytics Dashboard)
 */
export function getStrengthLevel(accuracyRate: number): StrengthLevel {
  if (accuracyRate >= 0.80) return 'green';
  if (accuracyRate >= 0.65) return 'amber';
  return 'red';
}
