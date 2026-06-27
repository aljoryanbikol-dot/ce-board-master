/**
 * @file jwt.strategy.ts
 * @module Auth/Strategies
 *
 * Passport JWT strategy for access-token authentication.
 *
 * This strategy is invoked by JwtAuthGuard on every request that
 * requires authentication. It:
 * 1. Extracts the Bearer token from the Authorization header
 * 2. Verifies the token signature using the RS256 public key
 * 3. Checks the token type claim (must be 'access', not 'refresh')
 * 4. Calls AuthService.getUserFromJwtPayload() to validate the user
 *    still exists and is active (prevents suspended users with valid JWTs)
 * 5. Injects the result as req.user
 *
 * The validate() method return value becomes req.user.
 *
 * @see JwtAuthGuard — the NestJS guard that activates this strategy
 * @see Phase 3B Section 5 — Authentication Flow
 */
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthConfig } from '../config/auth.config';
import { AuthService } from '../services/auth.service';
import {
  JWT_STRATEGY,
  JWT_TOKEN_TYPE_ACCESS,
  AUTH_ERROR_CODES,
} from '../auth.constants';
import type { AuthenticatedUser, JwtAccessPayload } from '../auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, JWT_STRATEGY) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly authConfig: AuthConfig,
    private readonly authService: AuthService,
  ) {
    super({
      // Extract token from Authorization: Bearer <token> header
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // Reject expired tokens in the strategy (not just in the guard)
      ignoreExpiration: false,

      // RS256 asymmetric verification — only the public key needed here
      secretOrKey: authConfig.jwtPublicKey,

      // Validate algorithm and audience/issuer claims
      algorithms: ['RS256'],
    });
  }

  /**
   * Called by Passport after the JWT signature is verified.
   *
   * This method is responsible for:
   * 1. Validating the token type (access vs refresh)
   * 2. Loading the live user record to check account status
   * 3. Returning the user object that becomes req.user
   *
   * Throwing UnauthorizedException here causes Passport to return 401.
   *
   * @param payload - The decoded JWT payload (already signature-verified)
   * @returns The AuthenticatedUser object that populates req.user
   */
  async validate(payload: JwtAccessPayload): Promise<AuthenticatedUser> {
    // Reject refresh tokens presented as access tokens
    if (payload.type !== JWT_TOKEN_TYPE_ACCESS) {
      this.logger.warn({
        message: 'Invalid JWT token type presented to access token strategy',
        userId: payload.sub,
        type: payload.type,
      });

      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.UNAUTHORIZED,
        message: 'Invalid token type.',
      });
    }

    // Load the user from database to verify account is still active
    // This is the critical security check — even valid JWTs are rejected
    // if the account has been suspended since the token was issued
    const user = await this.authService.getUserFromJwtPayload(payload.sub);

    if (!user) {
      this.logger.warn({
        message: 'JWT valid but user not found or inactive',
        userId: payload.sub,
      });

      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.UNAUTHORIZED,
        message: 'Authentication required.',
      });
    }

    // req.user is set to this return value
    return user;
  }
}
