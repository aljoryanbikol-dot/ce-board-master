/**
 * @file roles.guard.ts
 * @module Auth/Guards
 *
 * RBAC guard — enforces role-based access control on protected endpoints.
 *
 * Execution order: JwtAuthGuard → RolesGuard
 * JwtAuthGuard runs first and populates req.user. RolesGuard then
 * reads req.user.role and checks whether it is in the required roles list.
 *
 * Usage in controllers:
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles('content_admin', 'super_admin')
 * @Get('/admin/questions')
 * listAllQuestions() { ... }
 *
 * Permission checking vs role checking:
 * - @Roles() checks role SLUGS (coarse-grained: is this user a content_admin?)
 * - Permission checking (via AuthService.getPermissionsForRole()) is finer-grained
 *   and is used for specific admin actions within a role
 *
 * Super admin bypass:
 * Super admins have access to all endpoints regardless of @Roles() decoration.
 * This is intentional — super_admin is the platform operator role.
 *
 * @see @Roles() decorator in auth/decorators/roles.decorator.ts
 * @see AuthService.getPermissionsForRole()
 */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, AUTH_ERROR_CODES } from '../auth.constants';
import type { AuthenticatedUser } from '../auth.types';

/** The super_admin role slug bypasses all role checks */
const SUPER_ADMIN_SLUG = 'super_admin';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get the required roles from @Roles() decorator metadata
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() decorator — endpoint has no role restriction beyond authentication
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    // No user on request — JwtAuthGuard should have caught this already
    if (!user) {
      this.logger.error('RolesGuard reached without req.user — JwtAuthGuard should have rejected first');
      throw new ForbiddenException({
        code: AUTH_ERROR_CODES.UNAUTHORIZED,
        message: 'Authentication required.',
      });
    }

    // Super admins bypass all role restrictions
    if (user.role === SUPER_ADMIN_SLUG) {
      return true;
    }

    // Check if the user's role is in the required roles list
    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      this.logger.warn({
        message: 'Access denied — insufficient role',
        userId: user.id,
        userRole: user.role,
        requiredRoles,
        path: context.switchToHttp().getRequest<{ url: string }>().url,
      });

      throw new ForbiddenException({
        code: AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        message: 'You do not have permission to access this resource.',
      });
    }

    return true;
  }
}
