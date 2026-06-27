/**
 * @file permission.guard.ts
 * @module Rbac/Guards
 *
 * PermissionGuard — fine-grained permission enforcement.
 *
 * Execution position: after JwtAuthGuard and RolesGuard.
 * JwtAuthGuard populates req.user. RolesGuard filters by role slug.
 * PermissionGuard resolves the user's effective permission set and
 * verifies ALL required permissions are present.
 *
 * Authorization flow:
 * 1. Read @Permissions() metadata from the route handler
 * 2. If no @Permissions() → allow (no permission requirement)
 * 3. If req.user.role === 'super_admin' → bypass (immediate allow)
 * 4. Load effective permissions from Redis (or DB on cache miss)
 * 5. Verify ALL required permissions are in the effective set
 * 6. Deny with 403 FORBIDDEN_PERMISSION if any required permission missing
 *
 * Cache strategy:
 * Effective permissions are cached per-user with a 5-minute TTL.
 * Cache key: rbac:perms:user:{userId}
 * Invalidated by UserRoleService and RolesService on any mutation.
 *
 * Performance characteristics:
 * - Cache HIT: ~1ms (Redis round-trip only)
 * - Cache MISS: ~5-15ms (DB join: user_roles → roles → role_permissions)
 * - Super admin: ~0ms (bypass before any I/O)
 *
 * @see @Permissions() decorator — rbac/decorators/permissions.decorator.ts
 * @see UserRoleService.getEffectivePermissions()
 */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CacheService } from '../../cache/cache.service';
import { PrismaService } from '../../database/prisma.service';
import {
  PERMISSIONS_KEY,
  ROLE_SLUGS,
  USER_PERM_CACHE_PREFIX,
  USER_PERM_CACHE_TTL,
} from '../rbac.constants';
import { RbacErrors } from '../rbac.errors';
import type { AuthenticatedUser } from '../../auth/auth.types';

@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly cache: CacheService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // ── 1. Read required permissions from decorator metadata ──────────────────
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Permissions() — pass through
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
      url: string;
    }>();

    const user = request.user;

    // Guard should never run without req.user (JwtAuthGuard runs first)
    if (!user) {
      this.logger.error('PermissionGuard: req.user missing — JwtAuthGuard should have rejected');
      throw RbacErrors.forbiddenPermission(requiredPermissions);
    }

    // ── 2. Super admin bypass ─────────────────────────────────────────────────
    if (user.role === ROLE_SLUGS.SUPER_ADMIN) {
      return true;
    }

    // ── 3. Load effective permissions ─────────────────────────────────────────
    const effectivePermissions = await this.loadEffectivePermissions(user.id);

    // ── 4. Verify ALL required permissions present (AND semantics) ─────────────
    const missing = requiredPermissions.filter(
      (perm) => !effectivePermissions.has(perm),
    );

    if (missing.length > 0) {
      this.logger.warn({
        message: 'PermissionGuard: access denied',
        userId: user.id,
        userRole: user.role,
        required: requiredPermissions,
        missing,
        path: request.url,
      });
      throw RbacErrors.forbiddenPermission(missing);
    }

    return true;
  }

  /**
   * Load the effective permission set for a user.
   *
   * Cache HIT → return immediately.
   * Cache MISS → load from DB (user_roles → roles → role_permissions), cache result.
   *
   * Uses Set<string> for O(1) membership checks across potentially hundreds
   * of permissions.
   *
   * @param userId - The authenticated user's UUID
   * @returns Set of permission slugs the user currently holds
   */
  private async loadEffectivePermissions(userId: string): Promise<Set<string>> {
    const cacheKey = `${USER_PERM_CACHE_PREFIX}${userId}`;

    // Try cache first
    const cached = await this.cache.get<string[]>(cacheKey);
    if (cached !== null) {
      return new Set(cached);
    }

    // Cache miss — load from DB
    const permissions = await this.computePermissionsFromDb(userId);
    const permArray = Array.from(permissions);

    // Cache the result
    await this.cache.set(cacheKey, permArray, USER_PERM_CACHE_TTL);

    this.logger.debug({
      message: 'PermissionGuard: permission cache miss — loaded from DB',
      userId,
      count: permArray.length,
    });

    return permissions;
  }

  /**
   * Compute effective permissions from the database.
   *
   * Loads all active user_roles → joins to role_permissions → collects permission slugs.
   * Results are deduplicated via Set (a user with two roles that share a permission
   * gets the permission once).
   */
  private async computePermissionsFromDb(userId: string): Promise<Set<string>> {
    const userRoles = await this.prisma.userRole.findMany({
      where: {
        userId,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        role: {
          select: {
            isActive: true,
            rolePermissions: {
              include: {
                permission: { select: { slug: true, isActive: true } },
              },
            },
          },
        },
      },
    });

    const permissions = new Set<string>();

    for (const userRole of userRoles) {
      if (!userRole.role.isActive) continue;

      for (const rp of userRole.role.rolePermissions) {
        if (rp.permission.isActive) {
          permissions.add(rp.permission.slug);
        }
      }
    }

    // Also include permissions from the user's primary role (users.role_id)
    // This handles users who were not yet backfilled into user_roles
    const primaryUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: { select: { slug: true, isActive: true } },
              },
            },
          },
        },
      },
    });

    if (primaryUser?.role) {
      for (const rp of primaryUser.role.rolePermissions) {
        if (rp.permission.isActive) {
          permissions.add(rp.permission.slug);
        }
      }
    }

    return permissions;
  }
}
