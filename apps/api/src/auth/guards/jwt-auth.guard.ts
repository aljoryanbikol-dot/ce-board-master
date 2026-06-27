/**
 * @file jwt-auth.guard.ts
 * @module Auth/Guards
 *
 * The primary authentication guard for CE Board Master API.
 *
 * Applied globally via AppModule (all routes are protected by default).
 * Routes decorated with @Public() skip JWT verification.
 *
 * Request flow:
 * 1. Guard checks for @Public() decorator → if present, allow through
 * 2. Guard activates JwtStrategy → Passport extracts + verifies JWT
 * 3. JwtStrategy.validate() loads the user and populates req.user
 * 4. If any step fails → 401 Unauthorized (via GlobalExceptionFilter)
 *
 * Default-deny security model:
 * Every endpoint requires authentication UNLESS decorated with @Public().
 * This is safer than opt-in authentication (where forgetting @UseGuards()
 * would leave an endpoint unprotected).
 *
 * @see @Public() decorator — how to mark a route as unauthenticated
 * @see JwtStrategy — the Passport strategy that validates the token
 */
import {
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY, JWT_STRATEGY, AUTH_ERROR_CODES } from '../auth.constants';

@Injectable()
export class JwtAuthGuard extends AuthGuard(JWT_STRATEGY) {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private readonly reflector: Reflector) {
    super();
  }

  /**
   * Determine whether this request should be authenticated.
   *
   * Check order:
   * 1. Is the route or its controller decorated with @Public()?
   *    → If yes, allow the request through without any JWT verification
   * 2. Otherwise, delegate to the parent AuthGuard(JWT_STRATEGY)
   *    → Passport will call JwtStrategy.validate()
   */
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Check for @Public() on the method or the controller class
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Delegate to Passport JWT strategy
    return super.canActivate(context);
  }

  /**
   * Override handleRequest to customise the error thrown on authentication failure.
   *
   * Passport calls this with err and user:
   * - If strategy threw: err is set, user is false
   * - If strategy returned null: err is null, user is false
   * - If strategy returned a user: err is null, user is the AuthenticatedUser
   */
  handleRequest<TUser>(
    err: Error | null,
    user: TUser | false,
    info: { message?: string } | undefined,
    context: ExecutionContext,
  ): TUser {
    if (err) {
      // Re-throw errors from JwtStrategy (e.g. ACCOUNT_SUSPENDED)
      throw err;
    }

    if (!user) {
      // Token missing, malformed, or expired
      const message = info?.message ?? 'Authentication required.';
      this.logger.debug({
        message: 'JWT authentication failed',
        reason: message,
        path: context.switchToHttp().getRequest<{ url: string }>().url,
      });

      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.UNAUTHORIZED,
        message: 'Authentication required.',
      });
    }

    return user;
  }
}
