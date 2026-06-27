/**
 * @file jwt-refresh.strategy.ts
 * @module Auth/Strategies
 *
 * Passport strategy for refresh-token validation via httpOnly cookie.
 *
 * This strategy differs from the JWT access strategy in two ways:
 * 1. It reads the token from an httpOnly cookie (not the Authorization header)
 * 2. It does NOT verify a JWT signature — the refresh token is an opaque
 *    256-bit random string stored as a SHA-256 hash in the database
 *
 * Used by: RefreshTokenGuard (activated only on POST /auth/refresh endpoint)
 *
 * The validate() method receives the raw token from the cookie and delegates
 * all validation to TokenService.validateAndRotateRefreshToken().
 *
 * @see RefreshTokenGuard
 * @see TokenService.validateAndRotateRefreshToken()
 */
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import type { FastifyRequest } from 'fastify';
import '@fastify/cookie'; // activates FastifyReply.setCookie / FastifyRequest.cookies type augmentation
import { TokenService } from '../services/token.service';
import { JWT_REFRESH_STRATEGY, REFRESH_TOKEN_COOKIE, AUTH_ERROR_CODES } from '../auth.constants';
import type { TokenPair } from '../auth.types';

/**
 * Custom Passport strategy for refresh token validation.
 *
 * Uses `passport-custom` rather than `passport-jwt` because:
 * - The refresh token is NOT a JWT — it's an opaque random string
 * - It lives in an httpOnly cookie, not the Authorization header
 * - Validation involves a database lookup, not JWT signature verification
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, JWT_REFRESH_STRATEGY) {
  private readonly logger = new Logger(JwtRefreshStrategy.name);

  constructor(private readonly tokenService: TokenService) {
    super();
  }

  /**
   * Passport calls this method with the raw Fastify request.
   *
   * Extracts the refresh token from the httpOnly cookie, delegates to
   * TokenService for full validation + rotation, and returns the new
   * token pair. The controller then sets the new cookie and returns
   * the new access token.
   *
   * @param request - Fastify request object (typed for cookie access)
   * @returns New TokenPair if valid, throws if invalid or reused
   */
  async validate(request: FastifyRequest): Promise<TokenPair> {
    const rawToken = (request.cookies as Record<string, string>)[REFRESH_TOKEN_COOKIE];

    if (!rawToken) {
      this.logger.debug('Refresh token cookie missing');
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.REFRESH_TOKEN_MISSING,
        message: 'No refresh token found. Please log in again.',
      });
    }

    // TokenService handles all validation: not revoked, not expired,
    // reuse detection, rotation, and issuing the new pair
    const ipAddress = request.ip;
    const userAgent = request.headers['user-agent'];

    return this.tokenService.validateAndRotateRefreshToken(rawToken, ipAddress, userAgent);
  }
}
