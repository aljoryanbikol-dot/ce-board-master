/**
 * Common Decorators — Barrel export.
 * Re-exports all custom NestJS decorators for clean imports.
 */

// Auth decorators (Sprint 2.1 + 2.2)
export { CurrentUser }    from '../../auth/decorators/current-user.decorator';
export { Public }         from '../../auth/decorators/public.decorator';
export { Roles }          from '../../auth/decorators/roles.decorator';
export { RequiresTier }   from '../../auth/decorators/requires-tier.decorator';

// RBAC decorators (Sprint 2.3)
export { Permissions }    from '../../rbac/decorators/permissions.decorator';
export { ResourceOwner }  from '../../rbac/decorators/resource-owner.decorator';
