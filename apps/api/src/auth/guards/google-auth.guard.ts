/**
 * @file google-auth.guard.ts
 * @module Auth/Guards
 *
 * Guard that initiates the Google OAuth 2.0 flow.
 *
 * Applied to:
 * - GET /api/v1/auth/google          → redirects to Google consent screen
 * - GET /api/v1/auth/google/callback → handles the OAuth callback
 *
 * The same guard class is used for both routes:
 * - On the initiation route: Passport redirects to Google automatically
 * - On the callback route: Passport exchanges the code and calls
 *   GoogleStrategy.validate()
 */
import {
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { GOOGLE_STRATEGY } from '../auth.constants';
import type { AuthenticatedUser } from '../auth.types';

@Injectable()
export class GoogleAuthGuard extends AuthGuard(GOOGLE_STRATEGY) {
  private readonly logger = new Logger(GoogleAuthGuard.name);

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  handleRequest<TUser extends AuthenticatedUser>(
    err: Error | null,
    user: TUser | false,
    _info: unknown,
  ): TUser {
    if (err) {
      this.logger.error('Google OAuth callback error', err);
      throw err;
    }

    if (!user) {
      this.logger.warn('Google OAuth returned no user');
      throw err ?? new Error('Google authentication failed.');
    }

    return user;
  }
}
