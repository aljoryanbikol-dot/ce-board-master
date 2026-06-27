/**
 * @file logout.service.ts
 * @module Auth/Services
 *
 * LogoutService — manages session termination for individual and all-device logout.
 *
 * Two logout modes (per API Contract Phase 4 §1):
 *
 * 1. Single-device logout (POST /auth/logout):
 *    Revokes only the refresh token from the current request's cookie.
 *    The access token remains valid until its natural 15-minute expiry
 *    (stateless JWT — cannot be invalidated without a token blacklist).
 *    The UI immediately removes the access token from memory and
 *    redirects to the login page; the remaining validity window is
 *    an acceptable trade-off for the performance gain of stateless auth.
 *
 * 2. All-device logout (POST /auth/logout-all):
 *    Revokes ALL active refresh tokens for the user.
 *    Used after password changes, suspicious activity detection, or
 *    when a user reports their account has been compromised.
 *
 * Idempotency: both operations are safe to call multiple times.
 * Revoking an already-revoked or non-existent token is a no-op.
 */
import { Injectable, Logger } from '@nestjs/common';
import { TokenService } from './token.service';
import type { AuthenticatedUser } from '../auth.types';

export interface LogoutResult {
  sessionsRevoked: number;
}

@Injectable()
export class LogoutService {
  private readonly logger = new Logger(LogoutService.name);

  constructor(private readonly tokenService: TokenService) {}

  /**
   * Revoke the refresh token from the current request cookie.
   *
   * @param rawRefreshToken - Raw token value from the httpOnly cookie (may be undefined if already cleared)
   * @param user - The authenticated user (for logging)
   */
  async logoutCurrentDevice(
    rawRefreshToken: string | undefined,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (rawRefreshToken) {
      await this.tokenService.revokeRefreshToken(rawRefreshToken);
    }

    this.logger.log({
      message: 'User logged out (current device)',
      userId: user.id,
    });
  }

  /**
   * Revoke ALL active refresh tokens for a user — signs out every device.
   *
   * @param user - The authenticated user
   * @returns Number of sessions revoked
   */
  async logoutAllDevices(user: AuthenticatedUser): Promise<LogoutResult> {
    const sessionsRevoked = await this.tokenService.revokeAllUserTokens(user.id);

    this.logger.log({
      message: 'User logged out (all devices)',
      userId: user.id,
      sessionsRevoked,
    });

    return { sessionsRevoked };
  }
}
