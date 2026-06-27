/**
 * @file auth.interface.ts
 * @module Auth
 *
 * Interfaces that define contracts between auth module components.
 *
 * Using interfaces (not classes) for:
 * - Swappable implementations (e.g. replace PasswordService hashing algo)
 * - Testability (mock implementations in unit tests)
 * - Separation of contract from implementation
 *
 * NestJS DI tokens for these interfaces are defined in auth.constants.ts.
 */
import type { AuthenticatedUser, JwtAccessPayload, TokenPair } from './auth.types';

// ── IPasswordService ──────────────────────────────────────────────────────────

/**
 * Contract for password hashing and verification.
 *
 * Implementation: PasswordService (uses Argon2id with pepper)
 * Security spec: Constitution Article XI §11, argon2id parameters
 */
export interface IPasswordService {
  /**
   * Hash a plain-text password using Argon2id.
   * Automatically applies the pepper from configuration.
   * @param plaintext - The raw password to hash
   * @returns The Argon2id hash string (includes algorithm params)
   */
  hash(plaintext: string): Promise<string>;

  /**
   * Verify a plain-text password against a stored Argon2id hash.
   * Timing-safe comparison — always takes the same time regardless of match.
   * @param plaintext - The raw password to check
   * @param hash - The stored Argon2id hash
   * @returns true if the password matches, false otherwise
   */
  verify(plaintext: string, hash: string): Promise<boolean>;

  /**
   * Check whether a password meets the platform's strength requirements.
   * Requirements (from API Contract): min 8 chars, 1 uppercase, 1 number, 1 special.
   * @param password - The password to validate
   * @returns Object with isValid flag and specific failure messages
   */
  validateStrength(password: string): PasswordStrengthResult;
}

/** Result of password strength validation */
export interface PasswordStrengthResult {
  isValid: boolean;
  errors: string[];
}

// ── ITokenService ─────────────────────────────────────────────────────────────

/**
 * Contract for JWT access/refresh token lifecycle management.
 *
 * Implementation: TokenService (uses @nestjs/jwt with RS256)
 * Security spec: Constitution Article XI §11 (RS256, rotating refresh tokens)
 */
export interface ITokenService {
  /**
   * Generate a new access token + refresh token pair for a user.
   * The refresh token is stored (hashed) in the database.
   * @param user - The authenticated user (from database or JWT claim)
   * @param ipAddress - Client IP for security audit
   * @param userAgent - Browser UA string for session display
   * @returns Token pair including raw refresh token (send to client once, never store raw)
   */
  generateTokenPair(
    user: AuthenticatedUser,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TokenPair>;

  /**
   * Verify and decode a JWT access token.
   * @param token - The raw JWT string from Authorization header
   * @returns Decoded payload if valid, throws UnauthorizedException if not
   */
  verifyAccessToken(token: string): Promise<JwtAccessPayload>;

  /**
   * Validate a refresh token from the cookie.
   * Checks: exists in DB, not revoked, not expired.
   * @param rawToken - The raw refresh token from the httpOnly cookie
   * @returns The userId if valid, throws if invalid or reused (rotation attack)
   */
  validateAndRotateRefreshToken(
    rawToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TokenPair>;

  /**
   * Revoke a single refresh token (logout from current device).
   * @param rawToken - The raw refresh token from the httpOnly cookie
   */
  revokeRefreshToken(rawToken: string): Promise<void>;

  /**
   * Revoke all refresh tokens for a user (logout from all devices).
   * Called on password change.
   * @param userId - The user's UUID
   * @returns Number of sessions revoked
   */
  revokeAllUserTokens(userId: string): Promise<number>;

  /**
   * Generate a single-use, time-limited secure token for email verification
   * or password reset. Token is hashed before storage.
   * @param userId - The user's UUID
   * @param type - 'email_verify' | 'password_reset'
   * @returns The raw token (to be sent in the email link)
   */
  generateOneTimeToken(
    userId: string,
    type: 'email_verify' | 'password_reset',
  ): Promise<string>;

  /**
   * Validate and consume a one-time token. Token is marked revoked on use.
   * @param rawToken - The raw token from the email link
   * @param type - Expected token type
   * @returns The userId if valid, throws if invalid/expired/already used
   */
  consumeOneTimeToken(
    rawToken: string,
    type: 'email_verify' | 'password_reset',
  ): Promise<string>;
}

// ── IAuthService ──────────────────────────────────────────────────────────────

/**
 * Contract for the core authentication service.
 *
 * AuthService orchestrates PasswordService, TokenService, and PrismaService.
 * It owns all authentication business logic.
 *
 * Note: Login/register/logout endpoints are NOT implemented in Sprint 2.1.
 * This interface defines the full contract that Sprint 2.2 will fulfil.
 */
export interface IAuthService {
  /**
   * Validate user credentials for the local Passport strategy.
   * Returns the user if valid, null if invalid (Passport convention).
   * @param email - The submitted email address
   * @param password - The submitted plain-text password
   */
  validateCredentials(
    email: string,
    password: string,
  ): Promise<AuthenticatedUser | null>;

  /**
   * Look up a user by their ID for the JWT Passport strategy.
   * Called on every authenticated request by JwtStrategy.validate().
   * @param userId - The user UUID from the JWT `sub` claim
   * @returns The authenticated user or null if not found / suspended
   */
  getUserFromJwtPayload(
    userId: string,
  ): Promise<AuthenticatedUser | null>;

  /**
   * Load and cache role permissions for RolesGuard.
   * Permissions are cached in Redis with a 24-hour TTL.
   * @param roleSlug - The role slug (e.g. 'content_admin')
   * @returns Array of permission slugs granted to this role
   */
  getPermissionsForRole(roleSlug: string): Promise<string[]>;
}
