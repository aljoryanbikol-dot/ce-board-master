/**
 * @file roles.service.ts
 * @module Rbac/Services
 *
 * RolesService — CRUD for roles and role-permission assignments.
 *
 * Responsibilities:
 * 1. Create, read, update, soft-delete roles
 * 2. Assign and remove permissions from roles
 * 3. List roles with permission counts
 * 4. Invalidate Redis caches on every mutation
 *
 * Cache invalidation contract:
 * - Any role mutation → invalidate 'roles:all', 'roles:slug:{slug}'
 * - Any permission assignment mutation → additionally invalidate
 *   'roles:permissions:{slug}' (AuthService cache) and 'rbac:perms:user:*'
 *
 * The cache key 'roles:permissions:{slug}' is shared with AuthService.
 * Sprint 2.3 adds the RBAC module's own cache invalidation call to keep
 * both caches consistent.
 */
import {
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import {
  ALL_ROLES_CACHE_KEY,
  ROLE_CACHE_PREFIX,
  ADMIN_LIST_CACHE_TTL,
  ROLE_SLUGS,
} from '../rbac.constants';
import { RbacErrors } from '../rbac.errors';
import type {
  CreateRoleDto,
  UpdateRoleDto,
} from '../dto/role.dto';
import type { RoleDetail, RoleSummary, PermissionSummary } from '../rbac.types';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ── Create ─────────────────────────────────────────────────────────────────

  async create(dto: CreateRoleDto): Promise<RoleDetail> {
    // Check for duplicate slug
    const existing = await this.prisma.role.findUnique({
      where: { slug: dto.slug },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_ROLE_SLUG',
        message: `A role with slug '${dto.slug}' already exists.`,
        field: 'slug',
      });
    }

    const role = await this.prisma.role.create({
      data: {
        name:        dto.name,
        slug:        dto.slug,
        description: dto.description ?? null,
        sortOrder:   dto.sortOrder ?? 0,
        isSystem:    false,   // Only seeds can create system roles
        isActive:    true,
      },
    });

    await this.invalidateListCaches();

    this.logger.log({ message: 'Role created', slug: dto.slug, id: role.id });
    return this.findById(role.id);
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  async findAll(): Promise<RoleSummary[]> {
    return this.cache.remember<RoleSummary[]>(
      ALL_ROLES_CACHE_KEY,
      ADMIN_LIST_CACHE_TTL,
      async () => {
        const roles = await this.prisma.role.findMany({
          where:   { deletedAt: null },
          orderBy: { sortOrder: 'desc' },
          include: { _count: { select: { rolePermissions: true } } },
        });
        return roles.map((r) => ({
          id:              r.id,
          name:            r.name,
          slug:            r.slug,
          isSystem:        r.isSystem,
          isActive:        r.isActive,
          sortOrder:       r.sortOrder,
          permissionCount: r._count.rolePermissions,
        }));
      },
    );
  }

  async findById(id: string): Promise<RoleDetail> {
    const role = await this.prisma.role.findFirst({
      where: { id, deletedAt: null },
      include: {
        rolePermissions: {
          include: {
            permission: {
              select: { id: true, slug: true, name: true, module: true },
            },
          },
          orderBy: { permission: { module: 'asc' } },
        },
      },
    });

    if (!role) throw RbacErrors.roleNotFound(id);

    return this.toDetail(role);
  }

  async findBySlug(slug: string): Promise<RoleDetail> {
    const cacheKey = `${ROLE_CACHE_PREFIX}${slug}`;

    return this.cache.remember<RoleDetail>(
      cacheKey,
      ADMIN_LIST_CACHE_TTL,
      async () => {
        const role = await this.prisma.role.findFirst({
          where: { slug, deletedAt: null },
          include: {
            rolePermissions: {
              include: {
                permission: {
                  select: { id: true, slug: true, name: true, module: true },
                },
              },
            },
          },
        });
        if (!role) throw RbacErrors.roleNotFound(slug);
        return this.toDetail(role);
      },
    );
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateRoleDto): Promise<RoleDetail> {
    const existing = await this.prisma.role.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw RbacErrors.roleNotFound(id);

    if (dto.hasOwnProperty('name') && existing.isSystem) {
      throw RbacErrors.roleIsSystem();
    }

    const updated = await this.prisma.role.update({
      where: { id },
      data: {
        ...(dto.name        !== undefined && { name:      dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.sortOrder   !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive    !== undefined && { isActive:  dto.isActive }),
      },
    });

    await this.invalidateRoleCaches(existing.slug);
    this.logger.log({ message: 'Role updated', id });

    return this.findById(updated.id);
  }

  // ── Soft-delete ────────────────────────────────────────────────────────────

  async delete(id: string): Promise<void> {
    const role = await this.prisma.role.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw RbacErrors.roleNotFound(id);
    if (role.isSystem) throw RbacErrors.roleIsSystem();
    if (role.slug === ROLE_SLUGS.SUPER_ADMIN) throw RbacErrors.roleIsSystem();

    await this.prisma.role.update({
      where: { id },
      data:  { deletedAt: new Date(), isActive: false },
    });

    // Deactivate all user_roles assignments for this role
    await this.prisma.userRole.updateMany({
      where: { roleId: id },
      data:  { isActive: false },
    });

    await this.invalidateRoleCaches(role.slug);
    await this.cache.invalidatePattern('rbac:perms:user:*');

    this.logger.warn({ message: 'Role soft-deleted', id, slug: role.slug });
  }

  // ── Permission assignment ──────────────────────────────────────────────────

  async assignPermission(roleId: string, permissionId: string): Promise<void> {
    // Verify role and permission exist
    const [role, permission] = await Promise.all([
      this.prisma.role.findFirst({ where: { id: roleId, deletedAt: null } }),
      this.prisma.permission.findUnique({ where: { id: permissionId } }),
    ]);

    if (!role) throw RbacErrors.roleNotFound(roleId);
    if (!permission) throw RbacErrors.permissionNotFound(permissionId);

    // Check for existing assignment
    const existing = await this.prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId, permissionId } },
    });
    if (existing) throw RbacErrors.duplicateAssignment();

    await this.prisma.rolePermission.create({
      data: { roleId, permissionId },
    });

    await this.invalidatePermissionCaches(role.slug);

    this.logger.log({
      message: 'Permission assigned to role',
      roleSlug:  role.slug,
      permSlug:  permission.slug,
    });
  }

  async removePermission(roleId: string, permissionId: string): Promise<void> {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, deletedAt: null },
    });
    if (!role) throw RbacErrors.roleNotFound(roleId);

    const assignment = await this.prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId, permissionId } },
    });
    if (!assignment) throw RbacErrors.permissionNotFound(permissionId);

    await this.prisma.rolePermission.delete({
      where: { roleId_permissionId: { roleId, permissionId } },
    });

    await this.invalidatePermissionCaches(role.slug);

    this.logger.log({
      message: 'Permission removed from role',
      roleId,
      permissionId,
    });
  }

  async getRolePermissions(roleId: string): Promise<PermissionSummary[]> {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, deletedAt: null },
      include: {
        rolePermissions: {
          include: {
            permission: { select: { id: true, slug: true, name: true, module: true } },
          },
          orderBy: { permission: { module: 'asc' } },
        },
      },
    });

    if (!role) throw RbacErrors.roleNotFound(roleId);

    return role.rolePermissions.map((rp) => rp.permission);
  }

  // ── Private cache helpers ──────────────────────────────────────────────────

  private async invalidateListCaches(): Promise<void> {
    await Promise.all([
      this.cache.del(ALL_ROLES_CACHE_KEY),
    ]);
  }

  private async invalidateRoleCaches(slug: string): Promise<void> {
    await Promise.all([
      this.cache.del(ALL_ROLES_CACHE_KEY),
      this.cache.del(`${ROLE_CACHE_PREFIX}${slug}`),
    ]);
  }

  private async invalidatePermissionCaches(roleSlug: string): Promise<void> {
    await Promise.all([
      // AuthService cache
      this.cache.del(`roles:permissions:${roleSlug}`),
      // RbacModule role cache
      this.cache.del(`${ROLE_CACHE_PREFIX}${roleSlug}`),
      this.cache.del(ALL_ROLES_CACHE_KEY),
      // All user effective permission caches
      this.cache.invalidatePattern('rbac:perms:user:*'),
    ]);

    this.logger.debug({
      message: 'Permission caches invalidated for role',
      roleSlug,
    });
  }

  // ── Shape helpers ──────────────────────────────────────────────────────────

  private toDetail(role: {
    id: string; name: string; slug: string; description: string | null;
    isSystem: boolean; isActive: boolean; sortOrder: number;
    createdAt: Date; updatedAt: Date;
    rolePermissions: { permission: PermissionSummary }[];
  }): RoleDetail {
    return {
      id:          role.id,
      name:        role.name,
      slug:        role.slug,
      description: role.description,
      isSystem:    role.isSystem,
      isActive:    role.isActive,
      sortOrder:   role.sortOrder,
      createdAt:   role.createdAt.toISOString(),
      updatedAt:   role.updatedAt.toISOString(),
      permissions: role.rolePermissions.map((rp) => rp.permission),
    };
  }
}
