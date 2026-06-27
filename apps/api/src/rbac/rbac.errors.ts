/**
 * @file rbac.errors.ts
 * @module Rbac
 *
 * Typed exception factories for RBAC-specific errors.
 *
 * Centralising error construction ensures consistent error codes, HTTP status
 * codes, and messages across all RBAC services. Guards and controllers throw
 * these directly — never raw strings.
 */
import { ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { RBAC_ERROR_CODES } from './rbac.constants';

export const RbacErrors = {
  forbiddenPermission: (required: string[]) =>
    new ForbiddenException({
      code:    RBAC_ERROR_CODES.FORBIDDEN_PERMISSION,
      message: `Access denied. Required permission(s): ${required.join(', ')}.`,
    }),

  forbiddenResource: () =>
    new ForbiddenException({
      code:    RBAC_ERROR_CODES.FORBIDDEN_RESOURCE,
      message: 'Access denied. You do not own this resource.',
    }),

  roleNotFound: (id: string) =>
    new NotFoundException({
      code:    RBAC_ERROR_CODES.ROLE_NOT_FOUND,
      message: `Role not found: ${id}`,
    }),

  permissionNotFound: (id: string) =>
    new NotFoundException({
      code:    RBAC_ERROR_CODES.PERMISSION_NOT_FOUND,
      message: `Permission not found: ${id}`,
    }),

  roleIsSystem: () =>
    new ForbiddenException({
      code:    RBAC_ERROR_CODES.ROLE_IS_SYSTEM,
      message: 'System roles cannot be deleted or renamed.',
    }),

  duplicateAssignment: () =>
    new ConflictException({
      code:    RBAC_ERROR_CODES.DUPLICATE_ASSIGNMENT,
      message: 'This role is already assigned to the user.',
    }),

  selfDemotion: () =>
    new ForbiddenException({
      code:    RBAC_ERROR_CODES.SELF_DEMOTION,
      message: 'You cannot remove your own super_admin role.',
    }),
} as const;
