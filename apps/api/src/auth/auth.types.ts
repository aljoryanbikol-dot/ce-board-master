/**
 * @file auth.types.ts
 * @module Auth
 *
 * TypeScript type definitions for the authentication module.
 *
 * These types describe:
 * - JWT payload shapes (what is encoded inside access/refresh tokens)
 * - Authenticated request shape (req.user after JwtAuthGuard)
 * - Token operation results
 * - Role and permission shapes for RBAC
 *
 * All types are strict (no implicit `any`) per Project Constitution Article XIV.
 */
import type { SubscriptionTier } from '../common/types';

// ── JWT Payload Types ──────────────────────────────────────────────────────────

/**
 * The payload encoded inside a JWT access token (RS256).
 *
 * Kept deliberately small — only the fields needed for:
 * - Identity resolution (sub)
 * - Authorization decisions (role, subscriptionTier)
 * - Token type validation (type)
 *
 * Sensitive data (password hash, phone, etc.) is NEVER in a JWT.
 */
export interface JwtAccessPayload {
  /** JWT subject — the authenticated user's UUID */
  sub: string;
  /** User's email (for display/logging — not for lookups) */
  email: string;
  /** Role slug: 'free_user' | 'subscriber' | 'content_admin' | 'super_admin' */
  role: string;
  /** Subscription tier for frontend feature gating */
  subscriptionTier: SubscriptionTier;
  /** Discriminates access vs refresh tokens */
  type: 'access';
  /** JWT issued-at (set automatically by @nestjs/jwt) */
  iat?: number;
  /** JWT expiry (set automatically by @nestjs/jwt) */
  exp?: number;
}

/**
 * The payload encoded inside a JWT refresh token (RS256).
 *
 * Contains only the minimum fields needed to issue a new access token.
 * The full user record is reloaded from the database on each refresh.
 */
export interface JwtRefreshPayload {
  /** JWT subject — the authenticated user's UUID */
  sub: string;
  /** Token family identifier for refresh token rotation tracking */
  family: string;
  /** Discriminates access vs refresh tokens */
  type: 'refresh';
  iat?: number;
  exp?: number;
}

// ── Authenticated Request User ────────────────────────────────────────────────

/**
 * The shape of `req.user` after JwtAuthGuard validates the access token.
 *
 * Populated by JwtStrategy.validate() and made available to:
 * - @CurrentUser() decorator in controller methods
 * - Guards (RolesGuard, SubscriptionGuard)
 * - Interceptors and filters that need user context
 */
export interface AuthenticatedUser {
  /** The user's UUID (primary key from the `users` table) */
  id: string;
  /** User's email address */
  email: string;
  /** Role slug — used by RolesGuard */
  role: string;
  /** Subscription tier — used by SubscriptionGuard */
  subscriptionTier: SubscriptionTier;
}

// ── Token Operation Results ───────────────────────────────────────────────────

/**
 * Result of generating a new token pair (access + refresh).
 * Returned by TokenService.generateTokenPair().
 */
export interface TokenPair {
  /** Signed JWT access token (short-lived, 15 minutes) */
  accessToken: string;
  /** Raw refresh token value (before hashing, given to client once only) */
  rawRefreshToken: string;
  /** Access token expiry in seconds from now */
  expiresIn: number;
}

/**
 * Result of validating a refresh token from the cookie.
 * Returned by TokenService.validateRefreshToken().
 */
export interface RefreshTokenValidation {
  /** Whether the token is valid and not revoked */
  isValid: boolean;
  /** The user ID from the token record, if valid */
  userId?: string;
  /** The database record ID (to revoke and replace) */
  tokenId?: string;
}

// ── RBAC Types ────────────────────────────────────────────────────────────────

/**
 * Shape of the permission data cached in Redis for RBAC checks.
 * Cached under key: `roles:permissions:{roleSlug}`
 *
 * Format matches role_permissions → permissions table joins.
 */
export interface CachedRolePermissions {
  roleSlug: string;
  permissions: string[]; // Array of permission slugs: ['content:questions:publish', ...]
  cachedAt: string;       // ISO timestamp — for staleness auditing
}

/**
 * Token type discriminant union.
 * Used by TokenService to avoid passing wrong token type to wrong method.
 */
export type TokenType = 'access' | 'refresh' | 'email_verify' | 'password_reset';

/**
 * Subscription tier requirement levels for @RequiresTier() decorator.
 * Maps to SubscriptionTier but adds 'none' for public endpoints.
 */
export type TierRequirement = SubscriptionTier | 'none';
