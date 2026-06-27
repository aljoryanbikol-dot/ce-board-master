/**
 * @file resource-owner.decorator.ts
 * @module Rbac/Decorators
 *
 * @ResourceOwner() decorator — documents which field on a resource identifies
 * its owner, and optionally which permission bypasses the ownership check.
 *
 * This is a DOCUMENTATION + SERVICE-LAYER decorator. It does NOT enforce
 * ownership in the guard — ownership checks are database-backed and belong
 * in the service layer, not in guards (guards are stateless).
 *
 * Service layer pattern (enforced in RbacService.assertOwnership()):
 *   1. PermissionGuard verifies the user holds the required permission
 *   2. Service loads the resource from DB
 *   3. Service calls RbacService.assertOwnership(resource, user, meta)
 *   4. If user.id !== resource[ownerField] AND user lacks adminPermission → 403
 *
 * Usage:
 *   @Permissions(PERM.QUESTIONS_UPDATE)
 *   @ResourceOwner({ ownerField: 'authorId', adminPermission: PERM.QUESTIONS_MANAGE })
 *   @Patch(':id')
 *   async update(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
 *     return this.questionsService.update(id, body, user);
 *   }
 *
 * In the service:
 *   const question = await this.prisma.question.findUniqueOrThrow({ where: { id } });
 *   await this.rbacService.assertOwnership(question, user, {
 *     ownerField: 'authorId',
 *     adminPermission: PERM.QUESTIONS_MANAGE,
 *   });
 */
import { SetMetadata } from '@nestjs/common';
import { RESOURCE_OWNER_KEY } from '../rbac.constants';
import type { ResourceOwnerMeta } from '../rbac.types';

/**
 * Mark an endpoint as requiring resource ownership (or an admin bypass permission).
 * Enforcement is performed in the service layer via RbacService.assertOwnership().
 */
export const ResourceOwner = (meta: ResourceOwnerMeta): MethodDecorator & ClassDecorator =>
  SetMetadata(RESOURCE_OWNER_KEY, meta);
