/**
 * @file refresh-token.guard.ts
 * @module Auth/Guards
 *
 * Guard that activates the JWT refresh strategy.
 *
 * Used exclusively on: POST /api/v1/auth/refresh
 *
 * Unlike JwtAuthGuard (which is global), this guard is applied only to
 * the refresh endpoint. It reads the refresh token from the httpOnly
 * cookie and delegates to JwtRefreshStrategy for full validation.
 *
 * The guard intentionally does NOT check @Public() — the refresh endpoint
 * always requires a valid refresh token (the refresh cookie is the auth
 * mechanism, not a Bearer JWT).
 *
 * @see JwtRefreshStrategy
 */
import {
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { JWT_REFRESH_STRATEGY, AUTH_ERROR_CODES } from '../auth.constants';
import type { TokenPair } from '../auth.types';

@Injectable()
export class RefreshTokenGuard extends AuthGuard(JWT_REFRESH_STRATEGY) {
  private readonly logger = new Logger(RefreshTokenGuard.name);

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Always activate the refresh strategy — no @Public() bypass
    return super.canActivate(context);
  }

  handleRequest<TUser extends TokenPair>(
    err: Error | null,
    user: TUser | false,
    _info: unknown,
    context: ExecutionContext,
  ): TUser {
    if (err) throw err;

    if (!user) {
      this.logger.debug({
        message: 'Refresh token authentication failed',
        path: context.switchToHttp().getRequest<{ url: string }>().url,
      });

      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.REFRESH_TOKEN_INVALID,
        message: 'Invalid or missing refresh token. Please log in again.',
      });
    }

    return user;
  }
}
