/**
 * @file permissions.decorator.ts
 * @module Rbac/Decorators
 *
 * @Permissions() route decorator — specifies which permission slugs are
 * required to access an endpoint.
 *
 * Semantics: ALL listed permissions are required (AND logic).
 * Super admin role bypasses all permission checks.
 *
 * Usage:
 *   @UseGuards(RolesGuard, PermissionGuard)
 *   @Roles('content_author', 'content_admin')
 *   @Permissions(PERM.QUESTIONS_CREATE)
 *   @Post()
 *   createQuestion() { ... }
 */
import { SetMetadata } from '@nestjs/common';
import { PERMISSIONS_KEY } from '../rbac.constants';
import type { PermissionSlug } from '../rbac.constants';

/**
 * Specify which permissions are required to access this endpoint.
 * ALL listed permissions must be present (AND semantics).
 * @param permissions - One or more permission slugs from PERM constants.
 */
export const Permissions = (
  ...permissions: (PermissionSlug | string)[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSIONS_KEY, permissions);
