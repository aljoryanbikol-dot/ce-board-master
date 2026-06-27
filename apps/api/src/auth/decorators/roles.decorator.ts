/**
 * @file roles.decorator.ts
 * @module Auth/Decorators
 *
 * @Roles() route decorator — specifies which role slugs can access an endpoint.
 *
 * Sprint 2.3 update: RoleSlug type widened to include 5 new roles:
 * admin, content_author, reviewer.
 * Existing callers using old slugs are unaffected (union extension is additive).
 *
 * Usage:
 * @UseGuards(RolesGuard, PermissionGuard)
 * @Roles('content_author', 'content_admin')
 * @Permissions(PERM.QUESTIONS_CREATE)
 * @Post()
 * createQuestion() { ... }
 *
 * Note: super_admin bypasses ALL role checks in RolesGuard automatically.
 * Note: For permission-level checks, use @Permissions() from rbac module.
 */
import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from '../auth.constants';

/**
 * All role slugs in the system.
 * Sprint 2.3: Widened from 4 to 7 slugs.
 */
export type RoleSlug =
  | 'free_user'
  | 'subscriber'
  | 'content_admin'
  | 'super_admin'
  // Sprint 2.3 new roles:
  | 'admin'
  | 'content_author'
  | 'reviewer';

/**
 * Specify which roles are permitted to access this endpoint.
 * User must hold AT LEAST ONE of the listed roles.
 */
export const Roles = (...roles: RoleSlug[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
