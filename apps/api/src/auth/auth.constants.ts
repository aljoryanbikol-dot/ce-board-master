/**
 * @file auth.constants.ts
 * @module Auth
 *
 * Authentication constants for CE Board Master.
 *
 * Centralises every magic value used across the auth module so that:
 * - Changes propagate everywhere automatically
 * - Developers can navigate to all usages via IDE symbol search
 * - Values are documented at their definition site
 *
 * @see Project Constitution Article XI — Security Standards
 * @see API Contract Specification Phase 4, Group 1 — Authentication
 */

// ── Passport strategy identifiers ─────────────────────────────────────────────
/** Strategy name for the JWT access-token guard */
export const JWT_STRATEGY = 'jwt' as const;

/** Strategy name for the JWT refresh-token guard (reads from httpOnly cookie) */
export const JWT_REFRESH_STRATEGY = 'jwt-refresh' as const;

/** Strategy name for Google OAuth 2.0 (implemented in Sprint 2.3) */
export const GOOGLE_STRATEGY = 'google' as const;

/** Strategy name for local email/password authentication */
export const LOCAL_STRATEGY = 'local' as const;

// ── Cookie names ───────────────────────────────────────────────────────────────
/**
 * Name of the httpOnly refresh-token cookie.
 *
 * Security requirements (Constitution Article XI §11):
 * - httpOnly: prevents JavaScript access
 * - Secure: HTTPS-only transmission
 * - SameSite=Strict: CSRF protection
 * - Path restricted to the refresh endpoint only
 */
export const REFRESH_TOKEN_COOKIE = 'refreshToken' as const;

// ── JWT claims ─────────────────────────────────────────────────────────────────
/**
 * Custom claim injected into the JWT payload.
 * Used by JwtStrategy to identify token type and prevent refresh tokens
 * from being used as access tokens.
 */
export const JWT_TOKEN_TYPE_CLAIM = 'type' as const;
export const JWT_TOKEN_TYPE_ACCESS = 'access' as const;
export const JWT_TOKEN_TYPE_REFRESH = 'refresh' as const;

// ── Decorator metadata keys ───────────────────────────────────────────────────
/**
 * Reflection metadata key applied by @Public() decorator.
 * Routes decorated with @Public() skip JWT verification entirely.
 */
export const IS_PUBLIC_KEY = 'isPublic' as const;

/**
 * Reflection metadata key applied by @Roles() decorator.
 * Carries the array of role slugs required to access the route.
 */
export const ROLES_KEY = 'roles' as const;

/**
 * Reflection metadata key applied by @RequiresTier() decorator.
 * Carries the minimum subscription tier required for the route.
 */
export const REQUIRES_TIER_KEY = 'requiresTier' as const;

// ── Token hashing ──────────────────────────────────────────────────────────────
/**
 * SHA-256 algorithm identifier for token hashing.
 * Refresh tokens are stored as SHA-256 hashes — never raw.
 * This ensures a database breach cannot be used to hijack sessions.
 */
export const TOKEN_HASH_ALGORITHM = 'sha256' as const;
export const TOKEN_HASH_ENCODING = 'hex' as const;

// ── Rate-limiting windows ─────────────────────────────────────────────────────
/**
 * Redis key template for the login-attempt counter per user.
 * Used by AuthService to enforce the 5-failure lockout rule.
 * Full key: `auth:lockout:{userId}`
 */
export const LOCKOUT_KEY_PREFIX = 'auth:lockout:' as const;

/**
 * Redis key template for the login-attempt counter per IP address.
 * Used as a secondary protection layer against credential stuffing.
 * Full key: `auth:ip_attempts:{ip}`
 */
export const IP_LOCKOUT_KEY_PREFIX = 'auth:ip_attempts:' as const;

// ── Error codes ───────────────────────────────────────────────────────────────
/**
 * Machine-readable error codes returned in API error responses.
 * Match the codes defined in the API Contract Specification (Phase 4, Group 1).
 * Frontend applications switch on these codes to show appropriate messages.
 */
export const AUTH_ERROR_CODES = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_NOT_VERIFIED: 'ACCOUNT_NOT_VERIFIED',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  MFA_REQUIRED: 'MFA_REQUIRED',
  MFA_INVALID: 'MFA_INVALID',
  REFRESH_TOKEN_MISSING: 'REFRESH_TOKEN_MISSING',
  REFRESH_TOKEN_INVALID: 'REFRESH_TOKEN_INVALID',
  REFRESH_TOKEN_REUSE: 'REFRESH_TOKEN_REUSE',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  SUBSCRIPTION_REQUIRED: 'SUBSCRIPTION_REQUIRED',
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];
