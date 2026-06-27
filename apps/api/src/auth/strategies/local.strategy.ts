/**
 * @file local.strategy.ts
 * @module Auth/Strategies
 *
 * Passport local strategy — validates email/password credentials.
 *
 * This strategy is called by LocalAuthGuard on POST /auth/login.
 * It delegates credential verification to AuthService.validateCredentials().
 *
 * The local strategy reads from the request body fields named
 * 'email' and 'password' (configured via usernameField / passwordField).
 *
 * Flow:
 * 1. LocalAuthGuard activates this strategy
 * 2. Passport extracts email + password from req.body
 * 3. validate() calls AuthService.validateCredentials()
 * 4. On success: req.user = returned AuthenticatedUser
 * 5. AuthController.login() then calls TokenService.generateTokenPair()
 *
 * Lockout checking is performed in AuthController BEFORE LocalAuthGuard
 * activates this strategy, to avoid the overhead of Argon2 verification
 * when the account is already locked.
 */
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../services/auth.service';
import { LOCAL_STRATEGY, AUTH_ERROR_CODES } from '../auth.constants';
import type { AuthenticatedUser } from '../auth.types';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, LOCAL_STRATEGY) {
  private readonly logger = new Logger(LocalStrategy.name);

  constructor(private readonly authService: AuthService) {
    super({
      // Map passport's default 'username' field to 'email'
      usernameField: 'email',
      passwordField: 'password',
    });
  }

  /**
   * Called by Passport with the extracted email and password.
   * Return value becomes req.user.
   *
   * @throws UnauthorizedException if credentials are invalid
   */
  async validate(email: string, password: string): Promise<AuthenticatedUser> {
    const user = await this.authService.validateCredentials(email, password);

    if (!user) {
      // validateCredentials returns null for invalid credentials
      // (It throws for suspended/unverified accounts directly)
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Incorrect email or password.',
      });
    }

    return user;
  }
}
