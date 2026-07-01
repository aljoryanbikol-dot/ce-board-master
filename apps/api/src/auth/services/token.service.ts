/**
 * @file token.service.ts
 * @module Auth/Services
 *
 * Manages the complete JWT access/refresh token lifecycle.
 *
 * Responsibilities:
 * 1. Generate access + refresh token pairs on authentication
 * 2. Verify access tokens (used by JwtStrategy on every request)
 * 3. Validate and rotate refresh tokens (single-use rotation with reuse detection)
 * 4. Revoke tokens (logout, password change, admin action)
 * 5. Generate one-time tokens for email verification and password reset
 *
 * Token security model (Phase 3B Architecture, Section 5):
 * - Access tokens: short-lived (15 min), RS256-signed JWT, stateless
 * - Refresh tokens: 256-bit random, SHA-256 hashed in DB, httpOnly cookie
 * - Rotation: each /auth/refresh call issues new token + revokes old
 * - Reuse detection: revoked token presented again → revoke ALL user sessions
 *
 * FIX (Audit BUG-2): validateAndRotateRefreshToken now filters by
 * tokenType: 'refresh' to prevent one-time tokens from being presented
 * as refresh tokens.
 *
 * FIX (Audit BUG-5): generateTokenFamily() call removed from
 * createRefreshTokenRecord — the UserAuthToken schema has no family column.
 * Reuse detection correctly uses revokeAllUserTokens (all-device revocation)
 * which is more secure than per-family revocation.
 *
 * @implements ITokenService
 */
import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { AuthConfig } from '../config/auth.config';
import {
  generateSecureToken,
  hashToken,
  calculateExpiry,
  isExpired,
} from '../utils/token.utils';
import {
  JWT_TOKEN_TYPE_ACCESS,
  AUTH_ERROR_CODES,
} from '../auth.constants';
import type {
  AuthenticatedUser,
  JwtAccessPayload,
  TokenPair,
} from '../auth.types';
import { SubscriptionTierResolverService } from './subscription-tier-resolver.service';
import type { ITokenService } from '../auth.interface';
import type { AppEnvironment } from '../../config/configuration';

@Injectable()
export class TokenService implements ITokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly authConfig: AuthConfig,
    private readonly configService: ConfigService<AppEnvironment>,
    private readonly tierResolver: SubscriptionTierResolverService,
  ) {}

  // ── Token Pair Generation ───────────────────────────────────────────────────

  /**
   * Generate a new access + refresh token pair for an authenticated user.
   *
   * The refresh token is:
   * 1. Generated as 256-bit cryptographically secure random bytes
   * 2. SHA-256 hashed
   * 3. Stored in the `user_auth_tokens` table as the hash only — never raw
   * 4. Returned raw to the caller (who places it in an httpOnly cookie)
   *
   * @param user      - Authenticated user (from DB or existing JWT)
   * @param ipAddress - Client IP for security audit
   * @param userAgent - Browser UA for session display in future
   */
  async generateTokenPair(
    user: AuthenticatedUser,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    const [accessToken, { rawToken }] = await Promise.all([
      this.signAccessToken(user),
      this.createRefreshTokenRecord(user.id, ipAddress, userAgent),
    ]);

    this.logger.log({
      message: 'Token pair generated',
      userId: user.id,
      role: user.role,
      subscriptionTier: user.subscriptionTier,
      ipAddress,
    });

    return {
      accessToken,
      rawRefreshToken: rawToken,
      expiresIn: this.authConfig.accessTokenTtl,
    };
  }

  // ── Access Token Verification ───────────────────────────────────────────────

  /**
   * Verify and decode a JWT access token.
   * Called by JwtStrategy on every authenticated request.
   *
   * @throws UnauthorizedException if token is invalid, expired, or wrong type
   */
  async verifyAccessToken(token: string): Promise<JwtAccessPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtAccessPayload>(token, {
        publicKey: this.authConfig.jwtPublicKey,
        algorithms: ['RS256'],
      });

      // Guard against refresh tokens presented as access tokens
      if (payload.type !== JWT_TOKEN_TYPE_ACCESS) {
        throw new UnauthorizedException({
          code: AUTH_ERROR_CODES.UNAUTHORIZED,
          message: 'Invalid token type.',
        });
      }

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.UNAUTHORIZED,
        message: 'Invalid or expired access token.',
      });
    }
  }

  // ── Refresh Token Rotation ──────────────────────────────────────────────────

  /**
   * Validate a refresh token and issue a new token pair (rotation).
   *
   * FIX: Now filters by tokenType: 'refresh' so that email_verify or
   * password_reset tokens cannot be presented as refresh tokens.
   *
   * Rotation security model:
   * 1. Hash the raw token from the cookie
   * 2. Look up hash in user_auth_tokens WHERE tokenType = 'refresh'
   * 3. Not found → REFRESH_TOKEN_INVALID
   * 4. Found but is_revoked = TRUE → reuse detected (token theft signal)
   *    → Revoke ALL tokens for this user → force full re-authentication
   * 5. Found and valid → mark old revoked → issue new pair
   *
   * @throws UnauthorizedException on invalid, expired, or reused token
   */
  async validateAndRotateRefreshToken(
    rawToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    const tokenHash = hashToken(rawToken);

    // FIX: Filter by tokenType 'refresh' — prevents one-time tokens
    // (email_verify, password_reset) from being accepted as refresh tokens
    const tokenRecord = await this.prisma.userAuthToken.findFirst({
      where: {
        tokenHash,
        tokenType: 'refresh',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            status: true,
            isActive: true,
            isVerified: true,
            deletedAt: true,
            role: { select: { slug: true } },
          },
        },
      },
    });

    // Token not found in database (never existed or wrong type)
    if (!tokenRecord) {
      this.logger.warn('Refresh token not found (wrong type or never existed)', {
        tokenHash: tokenHash.slice(0, 8) + '...',
      });
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.REFRESH_TOKEN_INVALID,
        message: 'Invalid refresh token. Please log in again.',
      });
    }

    // Token already revoked → REUSE DETECTED (possible token theft signal)
    if (tokenRecord.isRevoked) {
      this.logger.error('Refresh token reuse detected — revoking all user sessions', {
        userId: tokenRecord.userId,
        tokenId: tokenRecord.id,
        ipAddress,
      });
      // Revoke ALL tokens: more secure than per-family revocation
      await this.revokeAllUserTokens(tokenRecord.userId);
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.REFRESH_TOKEN_REUSE,
        message: 'Security alert: please log in again on all your devices.',
      });
    }

    // Token expired
    if (isExpired(tokenRecord.expiresAt)) {
      this.logger.log('Refresh token expired', { userId: tokenRecord.userId });
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.REFRESH_TOKEN_INVALID,
        message: 'Refresh token has expired. Please log in again.',
      });
    }

    // Verify user account is still active
    const user = tokenRecord.user;
    if (!user.isActive || user.status !== 'active' || user.deletedAt !== null) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.ACCOUNT_SUSPENDED,
        message: 'Your account is not active.',
      });
    }

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      role: user.role.slug,
      subscriptionTier: await this.resolveSubscriptionTier(user.id),
    };

    // Atomically revoke the old token before issuing the new pair
    await this.prisma.userAuthToken.update({
      where: { id: tokenRecord.id },
      data: { isRevoked: true, revokedAt: new Date() },
    });

    const newPair = await this.generateTokenPair(authenticatedUser, ipAddress, userAgent);

    this.logger.log({
      message: 'Refresh token rotated',
      userId: user.id,
      ipAddress,
    });

    return newPair;
  }

  // ── Token Revocation ────────────────────────────────────────────────────────

  /**
   * Revoke a single refresh token (logout from current device).
   * Idempotent — revoking an already-revoked token is a no-op.
   */
  async revokeRefreshToken(rawToken: string): Promise<void> {
    const tokenHash = hashToken(rawToken);

    const updated = await this.prisma.userAuthToken.updateMany({
      where: { tokenHash, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });

    if (updated.count === 0) {
      this.logger.debug('Revoke called on already-revoked or non-existent refresh token');
    }
  }

  /**
   * Revoke all active refresh tokens for a user (logout all devices).
   * Called on password change, password reset, and refresh-token reuse detection.
   *
   * @returns Number of sessions revoked
   */
  async revokeAllUserTokens(userId: string): Promise<number> {
    const result = await this.prisma.userAuthToken.updateMany({
      where: { userId, isRevoked: false, tokenType: 'refresh' },
      data: { isRevoked: true, revokedAt: new Date() },
    });

    this.logger.log({
      message: 'All user refresh tokens revoked',
      userId,
      count: result.count,
    });

    return result.count;
  }

  // ── One-Time Tokens ─────────────────────────────────────────────────────────

  /**
   * Generate a single-use, time-limited token for email verification (24h)
   * or password reset (1h). Token is SHA-256 hashed before storage.
   *
   * @param userId - The user's UUID
   * @param type   - 'email_verify' (24h) | 'password_reset' (1h)
   * @returns Raw token (embed in the email link; never store raw)
   */
  async generateOneTimeToken(
    userId: string,
    type: 'email_verify' | 'password_reset',
  ): Promise<string> {
    const rawToken  = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);

    const ttlSeconds = type === 'email_verify' ? 86_400 : 3_600;
    const expiresAt  = calculateExpiry(ttlSeconds);
    const tokenType  = type === 'email_verify' ? 'email_verify' : 'password_reset';

    await this.prisma.userAuthToken.create({
      data: {
        userId,
        tokenHash,
        tokenType,
        expiresAt,
        isRevoked: false,
      },
    });

    this.logger.log({ message: `One-time ${type} token generated`, userId });

    return rawToken;
  }

  /**
   * Validate and consume a one-time token (marking it as used).
   *
   * @param rawToken - Raw token from the email link query parameter
   * @param type     - Expected token type (prevents cross-type attacks)
   * @returns The userId if valid
   * @throws UnauthorizedException if invalid, expired, or already used
   */
  async consumeOneTimeToken(
    rawToken: string,
    type: 'email_verify' | 'password_reset',
  ): Promise<string> {
    const tokenHash = hashToken(rawToken);
    const tokenType = type === 'email_verify' ? 'email_verify' : 'password_reset';

    const tokenRecord = await this.prisma.userAuthToken.findFirst({
      where: { tokenHash, tokenType, isRevoked: false },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException({
        code: type === 'email_verify' ? 'VERIFY_TOKEN_INVALID' : 'RESET_TOKEN_INVALID',
        message: 'This link is invalid or has already been used.',
      });
    }

    if (isExpired(tokenRecord.expiresAt)) {
      throw new UnauthorizedException({
        code: type === 'email_verify' ? 'VERIFY_TOKEN_INVALID' : 'RESET_TOKEN_INVALID',
        message: 'This link has expired. Please request a new one.',
      });
    }

    // Consume (revoke) — single-use guarantee
    await this.prisma.userAuthToken.update({
      where: { id: tokenRecord.id },
      data: { isRevoked: true, revokedAt: new Date() },
    });

    return tokenRecord.userId;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /** Sign a JWT access token for the given user. */
  private async signAccessToken(user: AuthenticatedUser): Promise<string> {
    const payload: Omit<JwtAccessPayload, 'iat' | 'exp'> = {
      sub: user.id,
      email: user.email,
      role: user.role,
      subscriptionTier: user.subscriptionTier,
      type: JWT_TOKEN_TYPE_ACCESS,
    };

    return this.jwtService.signAsync(payload, {
      privateKey: this.authConfig.jwtPrivateKey,
      algorithm: 'RS256',
      expiresIn: this.authConfig.accessTokenTtl,
    });
  }

  /**
   * Create a refresh token DB record and return the raw token.
   *
   * FIX (Audit BUG-5): Removed generateTokenFamily() — UserAuthToken schema
   * has no family column. Reuse detection revokes all user tokens, which
   * is more secure than per-family revocation.
   */
  private async createRefreshTokenRecord(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ rawToken: string; tokenHash: string }> {
    const rawToken  = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = calculateExpiry(this.authConfig.refreshTokenTtl);

    await this.prisma.userAuthToken.create({
      data: {
        userId,
        tokenHash,
        tokenType: 'refresh',
        expiresAt,
        isRevoked: false,
        ipAddress,
        userAgent,
      },
    });

    return { rawToken, tokenHash };
  }

  /** Resolve subscription tier for the given user from their live subscription (Sprint 3.3). */
  private async resolveSubscriptionTier(
    userId: string,
  ): Promise<'free' | 'basic' | 'pro'> {
    return this.tierResolver.resolve(userId);
  }
}
