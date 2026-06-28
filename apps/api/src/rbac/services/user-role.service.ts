/**
 * @file user-role.service.ts
 * @module Rbac/Services
 *
 * UserRoleService — manages multi-role assignment for users and computes
 * effective permission sets.
 *
 * Responsibilities:
 * 1. Assign and remove roles from users
 * 2. List a user's current active roles
 * 3. Compute effective permissions (union of all active roles)
 * 4. Invalidate per-user permission cache on role changes
 * 5. Publish 'role.changed' event for downstream consumers
 * 6. Assert resource ownership (service-layer enforcement)
 *
 * Design decision — primary vs extended roles:
 * users.role_id (JWT fast-path) is the user's primary/display role.
 * user_roles is the source of truth for permission evaluation.
 * When a role is assigned, it is written to user_roles.
 * When the new role is "higher" (more sortOrder), the primary role_id
 * is also updated so the JWT claim reflects the highest role.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import {
  USER_PERM_CACHE_PREFIX,
  USER_PERM_CACHE_TTL,
  ROLE_SLUGS,
} from '../rbac.constants';
import { RbacErrors } from '../rbac.errors';
import type { AssignRoleToUserDto } from '../dto/role.dto';
import type {
  UserRoleAssignment,
  EffectivePermissionsResult,
  ResourceOwnerMeta,
} from '../rbac.types';
import type { AuthenticatedUser } from '../../auth/auth.types';
import { EVENTS } from '../../common/constants';

@Injectable()
export class UserRoleService {
  private readonly logger = new Logger(UserRoleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Assign role ────────────────────────────────────────────────────────────

  /**
   * Assign a role to a user.
   *
   * Writes to user_roles. If the role's sortOrder is higher than the
   * user's current primary role, also updates users.role_id.
   *
   * @param targetUserId - UUID of the user receiving the role
   * @param dto          - { roleId, expiresAt? }
   * @param grantedBy    - UUID of the admin performing the assignment
   */
  async assignRole(
    targetUserId: string,
    dto: AssignRoleToUserDto,
    grantedBy: string,
  ): Promise<UserRoleAssignment> {
    // Verify user and role exist
    const [user, role] = await Promise.all([
      this.prisma.user.findUnique({
        where:   { id: targetUserId },
        include: { role: { select: { sortOrder: true } } },
      }),
      this.prisma.role.findFirst({
        where: { id: dto.roleId, deletedAt: null, isActive: true },
      }),
    ]);

    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: `User ${targetUserId} not found.` });
    if (!role) throw RbacErrors.roleNotFound(dto.roleId);

    // Check for existing assignment (upsert — reactivate if previously removed)
    const existing = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId: targetUserId, roleId: dto.roleId } },
    });

    if (existing?.isActive) throw RbacErrors.duplicateAssignment();

    if (existing) {
      // Reactivate previous assignment
      await this.prisma.userRole.update({
        where: { userId_roleId: { userId: targetUserId, roleId: dto.roleId } },
        data: {
          isActive:  true,
          grantedBy,
          grantedAt: new Date(),
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        },
      });
    } else {
      await this.prisma.userRole.create({
        data: {
          userId:    targetUserId,
          roleId:    dto.roleId,
          grantedBy,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        },
      });
    }

    // Promote primary role if new role has higher sortOrder
    if (role.sortOrder > (user.role?.sortOrder ?? 0)) {
      await this.prisma.user.update({
        where: { id: targetUserId },
        data:  { roleId: dto.roleId },
      });
    }

    await this.invalidateUserCache(targetUserId);
    this.emitRoleChanged(targetUserId, 'assigned', role.slug);

    this.logger.log({
      message:   'Role assigned to user',
      targetUserId,
      roleSlug:  role.slug,
      grantedBy,
    });

    return this.toAssignment({ userId: targetUserId, roleId: dto.roleId, role, grantedAt: new Date(), grantedBy, expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null, isActive: true });
  }

  // ── Remove role ────────────────────────────────────────────────────────────

  /**
   * Remove (deactivate) a role from a user.
   *
   * Prevents removing super_admin from oneself (self-demotion protection).
   * After removal, demotes primary role_id to next highest active role.
   */
  async removeRole(
    targetUserId: string,
    roleId: string,
    requestingUser: AuthenticatedUser,
  ): Promise<void> {
    const [user, assignment] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true },
      }),
      this.prisma.userRole.findUnique({
        where:   { userId_roleId: { userId: targetUserId, roleId } },
        include: { role: { select: { slug: true } } },
      }),
    ]);

    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: `User ${targetUserId} not found.` });
    if (!assignment || !assignment.isActive) throw RbacErrors.roleNotFound(roleId);

    // Prevent self-demotion from super_admin
    if (requestingUser.id === targetUserId && assignment.role.slug === ROLE_SLUGS.SUPER_ADMIN) {
      throw RbacErrors.selfDemotion();
    }

    await this.prisma.userRole.update({
      where: { userId_roleId: { userId: targetUserId, roleId } },
      data:  { isActive: false },
    });

    // Demote primary role to next highest remaining active role
    await this.recalculatePrimaryRole(targetUserId);

    await this.invalidateUserCache(targetUserId);
    this.emitRoleChanged(targetUserId, 'removed', assignment.role.slug);

    this.logger.log({ message: 'Role removed from user', targetUserId, roleId });
  }

  // ── List user roles ────────────────────────────────────────────────────────

  async getUserRoles(userId: string): Promise<UserRoleAssignment[]> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: `User ${userId} not found.` });

    const userRoles = await this.prisma.userRole.findMany({
      where:   { userId, isActive: true },
      include: { role: { select: { id: true, slug: true, name: true } } },
      orderBy: { grantedAt: 'desc' },
    });

    return userRoles.map(
      (ur: {
        userId: string; roleId: string;
        role: { id?: string; slug: string; name: string };
        grantedAt: Date; grantedBy: string | null;
        expiresAt: Date | null; isActive: boolean;
      }) => this.toAssignment({ ...ur, expiresAt: ur.expiresAt ?? null }),
    );
  }

  // ── Effective permissions ──────────────────────────────────────────────────

  /**
   * Compute the effective permission set for a user.
   *
   * Union of all active role permissions. Cached for 5 minutes.
   * This is the canonical source — PermissionGuard also calls this
   * path (via its own DB query) but this method adds the response shape.
   */
  async getEffectivePermissions(userId: string): Promise<EffectivePermissionsResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: { select: { slug: true } } },
    });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: `User ${userId} not found.` });

    const isSuperAdmin = user.role?.slug === ROLE_SLUGS.SUPER_ADMIN;

    const cacheKey = `${USER_PERM_CACHE_PREFIX}${userId}`;

    // Try cache first
    const cachedPerms = await this.cache.get<string[]>(cacheKey);
    if (cachedPerms !== null) {
      return {
        userId,
        roles:        await this.getActiveRoleSlugs(userId),
        permissions:  cachedPerms,
        isSuperAdmin,
        cachedAt:     new Date().toISOString(),
      };
    }

    // Compute from DB
    const userRoles = await this.prisma.userRole.findMany({
      where: {
        userId,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: { select: { slug: true, isActive: true } } },
            },
          },
        },
      },
    });

    const permSet = new Set<string>();
    const roleSlugs: string[] = [];

    for (const ur of userRoles) {
      if (!ur.role.isActive) continue;
      roleSlugs.push(ur.role.slug);
      for (const rp of ur.role.rolePermissions) {
        if (rp.permission.isActive) permSet.add(rp.permission.slug);
      }
    }

    const permissions = Array.from(permSet);
    await this.cache.set(cacheKey, permissions, USER_PERM_CACHE_TTL);

    return {
      userId,
      roles:        roleSlugs,
      permissions,
      isSuperAdmin,
      cachedAt:     new Date().toISOString(),
    };
  }

  // ── Check single permission ────────────────────────────────────────────────

  async hasPermission(userId: string, permissionSlug: string): Promise<boolean> {
    const result = await this.getEffectivePermissions(userId);
    if (result.isSuperAdmin) return true;
    return result.permissions.includes(permissionSlug);
  }

  // ── Resource ownership assertion ───────────────────────────────────────────

  /**
   * Assert that a user owns a resource OR holds the bypass permission.
   *
   * Called from service methods that handle owned resources.
   * Throws ForbiddenException if neither condition is met.
   *
   * @param resource  - The loaded resource object (must have ownerField as string property)
   * @param user      - Currently authenticated user
   * @param meta      - { ownerField, adminPermission? }
   */
  async assertOwnership(
    resource: Record<string, unknown>,
    user: AuthenticatedUser,
    meta: ResourceOwnerMeta,
  ): Promise<void> {
    // Super admin always passes
    if (user.role === ROLE_SLUGS.SUPER_ADMIN) return;

    const ownerId = resource[meta.ownerField];

    // Owner passes
    if (ownerId === user.id) return;

    // Check bypass permission if specified
    if (meta.adminPermission) {
      const hasAdmin = await this.hasPermission(user.id, meta.adminPermission);
      if (hasAdmin) return;
    }

    throw RbacErrors.forbiddenResource();
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async getActiveRoleSlugs(userId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where:   { userId, isActive: true },
      include: { role: { select: { slug: true } } },
    });
    return userRoles.map((ur: { role: { slug: string } }) => ur.role.slug);
  }

  private async recalculatePrimaryRole(userId: string): Promise<void> {
    const activeRoles = await this.prisma.userRole.findMany({
      where:   { userId, isActive: true },
      include: { role: { select: { id: true, sortOrder: true } } },
      orderBy: { role: { sortOrder: 'desc' } },
    });

    if (activeRoles.length > 0 && activeRoles[0]) {
      await this.prisma.user.update({
        where: { id: userId },
        data:  { roleId: activeRoles[0].role.id },
      });
    }
  }

  private async invalidateUserCache(userId: string): Promise<void> {
    await this.cache.del(`${USER_PERM_CACHE_PREFIX}${userId}`);
  }

  private emitRoleChanged(
    userId: string,
    action: 'assigned' | 'removed',
    roleSlug: string,
  ): void {
    this.eventEmitter.emit(EVENTS.ROLE_CHANGED, { userId, action, roleSlug });
  }

  private toAssignment(data: {
    userId:    string;
    roleId:    string;
    role:      { id?: string; slug: string; name: string };
    grantedAt: Date;
    grantedBy: string | null;
    expiresAt: Date | null;
    isActive:  boolean;
  }): UserRoleAssignment {
    return {
      userId:    data.userId,
      roleId:    data.roleId,
      roleName:  data.role.name,
      roleSlug:  data.role.slug,
      grantedAt: data.grantedAt.toISOString(),
      grantedBy: data.grantedBy ?? null,
      expiresAt: data.expiresAt?.toISOString() ?? null,
      isActive:  data.isActive,
    };
  }
}
