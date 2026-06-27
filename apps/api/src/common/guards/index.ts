/**
 * Common Guards — Barrel export.
 * Re-exports all guards for clean imports throughout the codebase.
 */

// Auth guards (Sprint 2.1 + 2.2)
export { JwtAuthGuard }      from '../../auth/guards/jwt-auth.guard';
export { RefreshTokenGuard } from '../../auth/guards/refresh-token.guard';
export { LocalAuthGuard }    from '../../auth/guards/local-auth.guard';
export { GoogleAuthGuard }   from '../../auth/guards/google-auth.guard';
export { RolesGuard }        from '../../auth/guards/roles.guard';

// RBAC guards (Sprint 2.3)
export { PermissionGuard }   from '../../rbac/guards/permission.guard';
