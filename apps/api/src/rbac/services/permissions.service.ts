/**
 * @file permissions.service.ts
 * @module Rbac/Services
 *
 * PermissionsService — CRUD for the permissions catalog.
 *
 * Responsibilities:
 * - Create, read, update, deactivate permissions
 * - List permissions (filterable by module)
 * - Invalidate all-permissions cache on mutation
 *
 * The permissions catalog is essentially immutable in production — permissions
 * are seeded at deploy time and rarely changed. Write operations are restricted
 * to super_admin via the PermissionsController.
 *
 * Cache strategy:
 * - 'permissions:all' cached at 1h TTL
 * - Invalidated on any CRUD mutation
 */
import {
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import {
  ALL_PERMS_CACHE_KEY,
  ADMIN_LIST_CACHE_TTL,
} from '../rbac.constants';
import { RbacErrors } from '../rbac.errors';
import type {
  CreatePermissionDto,
  ListPermissionsQueryDto,
  UpdatePermissionDto,
} from '../dto/permission.dto';
import type { PermissionDetail } from '../rbac.types';

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ── Create ────────────────────────────────────────────────────────────────

  async create(dto: CreatePermissionDto): Promise<PermissionDetail> {
    // Verify slug uniqueness
    const existing = await this.prisma.permission.findUnique({
      where: { slug: dto.slug },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_PERMISSION_SLUG',
        message: `A permission with slug '${dto.slug}' already exists.`,
        field: 'slug',
      });
    }

    const permission = await this.prisma.permission.create({
      data: { ...dto, isActive: true },
    });

    await this.invalidateListCache();

    this.logger.log({ message: 'Permission created', slug: dto.slug, id: permission.id });

    return this.toDetail(permission);
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  async findById(id: string): Promise<PermissionDetail> {
    const perm = await this.prisma.permission.findUnique({ where: { id } });
    if (!perm) throw RbacErrors.permissionNotFound(id);
    return this.toDetail(perm);
  }

  async findBySlug(slug: string): Promise<PermissionDetail> {
    const perm = await this.prisma.permission.findUnique({ where: { slug } });
    if (!perm) throw RbacErrors.permissionNotFound(slug);
    return this.toDetail(perm);
  }

  async findAll(query: ListPermissionsQueryDto): Promise<PermissionDetail[]> {
    // Only use cache for the default "all active" query (no module filter, no cursor)
    if (!query.module && query.isActive !== false && !query.cursor) {
      return this.cache.remember<PermissionDetail[]>(
        ALL_PERMS_CACHE_KEY,
        ADMIN_LIST_CACHE_TTL,
        () => this.loadAllFromDb(query),
      );
    }
    return this.loadAllFromDb(query);
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdatePermissionDto): Promise<PermissionDetail> {
    const existing = await this.prisma.permission.findUnique({ where: { id } });
    if (!existing) throw RbacErrors.permissionNotFound(id);

    const updated = await this.prisma.permission.update({
      where: { id },
      data:  dto,
    });

    await this.invalidateListCache();

    // If permission deactivated: invalidate all user permission caches
    if (dto.isActive === false) {
      await this.cache.invalidatePattern('rbac:perms:user:*');
      this.logger.warn({ message: 'Permission deactivated — all user perm caches cleared', id, slug: existing.slug });
    }

    this.logger.log({ message: 'Permission updated', id });
    return this.toDetail(updated);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async loadAllFromDb(query: ListPermissionsQueryDto): Promise<PermissionDetail[]> {
    const permissions = await this.prisma.permission.findMany({
      where: {
        ...(query.module   && { module:   query.module }),
        ...(typeof query.isActive === 'boolean' && { isActive: query.isActive }),
        ...(query.cursor   && { id: { gt: query.cursor } }),
      },
      orderBy: [{ module: 'asc' }, { slug: 'asc' }],
      take: query.limit,
    });
    return permissions.map(this.toDetail);
  }

  private async invalidateListCache(): Promise<void> {
    await this.cache.del(ALL_PERMS_CACHE_KEY);
    // Also invalidate roles:all since it embeds permission counts
    await this.cache.del('roles:all');
  }

  private toDetail(perm: {
    id: string; name: string; slug: string; module: string;
    description: string | null; isActive: boolean; createdAt: Date;
  }): PermissionDetail {
    return {
      id:          perm.id,
      name:        perm.name,
      slug:        perm.slug,
      module:      perm.module,
      description: perm.description,
      isActive:    perm.isActive,
      createdAt:   perm.createdAt.toISOString(),
    };
  }
}
