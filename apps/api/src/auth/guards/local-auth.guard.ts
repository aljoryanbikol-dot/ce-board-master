/**
 * @file local-auth.guard.ts
 * @module Auth/Guards
 *
 * Guard that activates the Passport local strategy (email + password).
 *
 * Applied only to: POST /api/v1/auth/login
 *
 * Unlike JwtAuthGuard (global), this guard is explicitly applied to the
 * login endpoint. It reads email + password from the request body,
 * delegates to LocalStrategy.validate(), and populates req.user.
 *
 * The controller then reads req.user to issue JWT tokens.
 *
 * Note: Lockout checking happens in AuthController BEFORE this guard is
 * activated — we check the lockout counter first to skip Argon2 work
 * on locked accounts.
 */
import {
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { LOCAL_STRATEGY, AUTH_ERROR_CODES } from '../auth.constants';
import type { AuthenticatedUser } from '../auth.types';

@Injectable()
export class LocalAuthGuard extends AuthGuard(LOCAL_STRATEGY) {
  private readonly logger = new Logger(LocalAuthGuard.name);

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  handleRequest<TUser extends AuthenticatedUser>(
    err: Error | null,
    user: TUser | false,
    info: { message?: string } | undefined,
    context: ExecutionContext,
  ): TUser {
    if (err) throw err;

    if (!user) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Incorrect email or password.',
      });
    }

    return user;
  }
}
