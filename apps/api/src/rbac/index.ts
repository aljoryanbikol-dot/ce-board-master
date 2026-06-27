/**
 * @file index.ts
 * @module Rbac
 *
 * RBAC module barrel export — Sprint 2.3 complete.
 *
 * Public API for consumers of the RBAC module:
 * - Other feature modules use PermissionGuard and @Permissions()
 * - UsersModule uses UserRoleService.assertOwnership()
 * - AdminModule uses RolesService and PermissionsService for audit views
 */

// Module
export { RbacModule } from './rbac.module';

// Services
export { RolesService }       from './services/roles.service';
export { PermissionsService } from './services/permissions.service';
export { UserRoleService }    from './services/user-role.service';

// Guard
export { PermissionGuard } from './guards/permission.guard';

// Decorators
export { Permissions }   from './decorators/permissions.decorator';
export { ResourceOwner } from './decorators/resource-owner.decorator';

// Constants (for use in other modules)
export {
  PERM,
  ROLE_SLUGS,
  PERMISSIONS_KEY,
  RESOURCE_OWNER_KEY,
  USER_PERM_CACHE_PREFIX,
  USER_PERM_CACHE_TTL,
  type PermissionSlug,
  type RoleSlug,
} from './rbac.constants';

// Types
export type {
  RoleDetail,
  RoleSummary,
  PermissionDetail,
  PermissionSummary,
  UserRoleAssignment,
  EffectivePermissionsResult,
  ResourceOwnerMeta,
} from './rbac.types';

// Errors (for use in service-layer ownership checks)
export { RbacErrors } from './rbac.errors';
