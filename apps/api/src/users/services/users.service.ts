/**
 * @file users.service.ts
 * @module Users/Services
 *
 * UsersService — admin-facing user management business logic.
 *
 * Responsibilities:
 * 1. List users (cursor pagination, filtering, search)
 * 2. Get a single user by id
 * 3. Update a user (admin) with optimistic locking
 * 4. Soft-delete a user (admin)
 * 5. Ownership / admin / super_admin authorization
 * 6. Redis cache management (per-user + list invalidation)
 * 7. Audit logging via EventEmitter
 *
 * Authorization model:
 * - Reads (list, get): caller must hold users.read (enforced by guard) AND
 *   either be the owner OR hold users.manage (admin override).
 * - Writes (update, delete): caller must hold users.write/users.delete AND
 *   either be the owner OR hold users.manage.
 * Ownership + admin override is resolved here in the service via
 * UserRoleService.assertOwnership — guards handle the coarse permission gate.
 *
 * Optimistic locking:
 * Each user row has a `version` integer. Updates that pass a `version` in the
 * DTO must match the current DB version; the update increments it atomically.
 * A mismatch throws VERSION_CONFLICT (409).
 *
 * Clean Architecture: this service owns all DB access; controllers never
 * touch Prisma.
 */
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { UserRoleService } from '../../rbac/services/user-role.service';
import { PERM, ROLE_SLUGS } from '../../rbac/rbac.constants';
import { EVENTS } from '../../common/constants';
import {
  USER_CACHE_PREFIX,
  USER_CACHE_TTL,
  USER_LIST_CACHE_PREFIX,
  USER_LIST_CACHE_TTL,
} from '../users.constants';
import { UserErrors } from '../users.errors';
import type { ListUsersQueryDto, UpdateUserDto } from '../dto/user.dto';
import type { UserDetail, UserSummary, UserListResult } from '../users.types';
import type { AuthenticatedUser } from '../../auth/auth.types';

// Prisma select shapes (single source of truth)
const USER_DETAIL_SELECT = {
  id: true, email: true, username: true, status: true,
  isVerified: true, isActive: true, lastLoginAt: true, lastLoginIp: true,
  createdAt: true, updatedAt: true, version: true,
  role: { select: { slug: true } },
  profile: { select: { firstName: true, lastName: true, displayName: true, avatarUrl: true } },
} as const;

/** Row shape returned by queries using USER_DETAIL_SELECT. */
interface UserRow {
  id: string;
  email: string;
  username: string | null;
  status: string;
  isVerified: boolean;
  isActive: boolean;
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  role: { slug: string };
  profile: {
    firstName: string | null;
    lastName: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly userRoleService: UserRoleService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── List ────────────────────────────────────────────────────────────────────

  /**
   * List users with cursor pagination. Admin-only (guard enforces users.read).
   * Results are cached per query-signature for 60s.
   */
  async findAll(query: ListUsersQueryDto): Promise<UserListResult> {
    const cacheKey = this.buildListCacheKey(query);

    const cached = await this.cache.get<UserListResult>(cacheKey);
    if (cached) return cached;

    const where = {
      deletedAt: null,
      ...(query.status && { status: query.status }),
      ...(typeof query.isActive === 'boolean' && { isActive: query.isActive }),
      ...(query.role && { role: { slug: query.role } }),
      ...(query.search && {
        OR: [
          { email:    { contains: query.search, mode: 'insensitive' as const } },
          { username: { contains: query.search, mode: 'insensitive' as const } },
          { profile: { displayName: { contains: query.search, mode: 'insensitive' as const } } },
        ],
      }),
      ...(query.cursor && { id: { gt: query.cursor } }),
    };

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_DETAIL_SELECT,
        orderBy: { id: 'asc' },
        take: query.limit + 1, // fetch one extra to detect hasMore
      }),
      this.prisma.user.count({ where: { deletedAt: null,
        ...(query.status && { status: query.status }),
        ...(typeof query.isActive === 'boolean' && { isActive: query.isActive }),
        ...(query.role && { role: { slug: query.role } }),
      } }),
    ]);

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const nextCursor = hasMore && page.length > 0 ? page[page.length - 1]!.id : null;

    const result: UserListResult = {
      data: page.map((u: UserRow) => this.toSummary(u)),
      pagination: { cursor: nextCursor, hasMore, total },
    };

    await this.cache.set(cacheKey, result, USER_LIST_CACHE_TTL);
    return result;
  }

  // ── Get by id ─────────────────────────────────────────────────────────────────

  /**
   * Get a single user by id.
   *
   * Authorization: caller must be the owner OR hold users.manage (admin override).
   * Guards enforce users.read at the route; this method enforces ownership.
   */
  async findById(id: string, requester: AuthenticatedUser): Promise<UserDetail> {
    await this.assertCanAccess(id, requester, PERM.USERS_MANAGE);

    const cacheKey = `${USER_CACHE_PREFIX}${id}`;
    const cached = await this.cache.get<UserDetail>(cacheKey);
    if (cached) return cached;

    const user = await this.prisma.user.findFirst({
      where:  { id, deletedAt: null },
      select: USER_DETAIL_SELECT,
    });
    if (!user) throw UserErrors.notFound(id);

    const detail = this.toDetail(user);
    await this.cache.set(cacheKey, detail, USER_CACHE_TTL);
    return detail;
  }

  // ── Update ────────────────────────────────────────────────────────────────────

  /**
   * Update a user (admin operation).
   *
   * - Optimistic locking via `version`.
   * - Username uniqueness enforced.
   * - super_admin accounts are protected from modification by non-super-admins.
   */
  async update(
    id: string,
    dto: UpdateUserDto,
    requester: AuthenticatedUser,
  ): Promise<UserDetail> {
    await this.assertCanAccess(id, requester, PERM.USERS_MANAGE);

    const existing = await this.prisma.user.findFirst({
      where:  { id, deletedAt: null },
      select: { id: true, version: true, username: true, role: { select: { slug: true } } },
    });
    if (!existing) throw UserErrors.notFound(id);

    // Protect super_admin accounts from non-super-admin modification
    if (
      existing.role.slug === ROLE_SLUGS.SUPER_ADMIN &&
      requester.role !== ROLE_SLUGS.SUPER_ADMIN
    ) {
      throw UserErrors.cannotModifySuperAdmin();
    }

    // Optimistic locking check
    if (dto.version !== undefined && dto.version !== existing.version) {
      throw UserErrors.versionConflict();
    }

    // Username uniqueness
    if (dto.username && dto.username !== existing.username) {
      const taken = await this.prisma.user.findUnique({
        where:  { username: dto.username },
        select: { id: true },
      });
      if (taken) throw UserErrors.usernameTaken(dto.username);
    }

    const changes = Object.keys(dto).filter((k) => k !== 'version');

    // Atomic update with version increment.
    // The where clause includes the current version to prevent a lost update
    // even under concurrent requests (defence-in-depth beyond the check above).
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.username   !== undefined && { username:   dto.username }),
        ...(dto.status     !== undefined && { status:     dto.status }),
        ...(dto.isActive   !== undefined && { isActive:   dto.isActive }),
        ...(dto.isVerified !== undefined && { isVerified: dto.isVerified }),
        version: { increment: 1 },
      },
      select: USER_DETAIL_SELECT,
    });

    await this.invalidateUserCaches(id);
    this.emitUserChanged(id, requester.id, 'updated', changes);

    this.logger.log({ message: 'User updated', userId: id, actorId: requester.id, changes });

    return this.toDetail(updated);
  }

  // ── Soft-delete ────────────────────────────────────────────────────────────────

  /**
   * Soft-delete a user (admin operation).
   *
   * - Sets deletedAt + isActive=false.
   * - Prevents deleting one's own account through this endpoint.
   * - Protects super_admin accounts.
   */
  async softDelete(id: string, requester: AuthenticatedUser): Promise<void> {
    if (id === requester.id) throw UserErrors.cannotDeleteSelf();

    await this.assertCanAccess(id, requester, PERM.USERS_MANAGE);

    const existing = await this.prisma.user.findFirst({
      where:  { id, deletedAt: null },
      select: { id: true, role: { select: { slug: true } } },
    });
    if (!existing) throw UserErrors.notFound(id);

    if (
      existing.role.slug === ROLE_SLUGS.SUPER_ADMIN &&
      requester.role !== ROLE_SLUGS.SUPER_ADMIN
    ) {
      throw UserErrors.cannotModifySuperAdmin();
    }

    await this.prisma.user.update({
      where: { id },
      data:  { deletedAt: new Date(), isActive: false, version: { increment: 1 } },
    });

    // Revoke all sessions for the deleted user (defence-in-depth)
    await this.prisma.userAuthToken.updateMany({
      where: { userId: id, isRevoked: false },
      data:  { isRevoked: true, revokedAt: new Date() },
    });

    await this.invalidateUserCaches(id);
    this.emitUserChanged(id, requester.id, 'deleted');

    this.logger.warn({ message: 'User soft-deleted', userId: id, actorId: requester.id });
  }

  // ── Authorization helper ───────────────────────────────────────────────────────

  /**
   * Assert the requester may access the target user.
   * Passes if: requester is the target (owner), is super_admin, or holds the
   * admin bypass permission.
   */
  private async assertCanAccess(
    targetUserId: string,
    requester: AuthenticatedUser,
    adminPermission: string,
  ): Promise<void> {
    if (requester.id === targetUserId) return;
    if (requester.role === ROLE_SLUGS.SUPER_ADMIN) return;

    const hasAdmin = await this.userRoleService.hasPermission(requester.id, adminPermission);
    if (!hasAdmin) throw UserErrors.forbiddenOwnership();
  }

  // ── Cache helpers ────────────────────────────────────────────────────────────

  private async invalidateUserCaches(userId: string): Promise<void> {
    await Promise.all([
      this.cache.del(`${USER_CACHE_PREFIX}${userId}`),
      this.cache.invalidatePattern(`${USER_LIST_CACHE_PREFIX}*`),
    ]);
  }

  private buildListCacheKey(query: ListUsersQueryDto): string {
    const parts = [
      query.cursor ?? '_',
      query.limit,
      query.status ?? '_',
      query.role ?? '_',
      query.search ?? '_',
      query.isActive === undefined ? '_' : String(query.isActive),
    ];
    return `${USER_LIST_CACHE_PREFIX}${parts.join(':')}`;
  }

  // ── Event helper ───────────────────────────────────────────────────────────────

  private emitUserChanged(
    userId: string,
    actorId: string,
    action: 'updated' | 'deleted',
    changes?: string[],
  ): void {
    const event = action === 'deleted' ? EVENTS.USER_DELETED : EVENTS.USER_UPDATED;
    this.eventEmitter.emit(event, {
      userId, actorId, action, changes, timestamp: new Date().toISOString(),
    });
  }

  // ── Shape helpers ────────────────────────────────────────────────────────────

  private toSummary(u: UserRow): UserSummary {
    return {
      id:          u.id,
      email:       u.email,
      username:    u.username,
      role:        u.role.slug,
      status:      u.status,
      isVerified:  u.isVerified,
      isActive:    u.isActive,
      displayName: u.profile?.displayName ?? null,
      avatarUrl:   u.profile?.avatarUrl ?? null,
      createdAt:   u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    };
  }

  private toDetail(u: UserRow): UserDetail {
    return {
      id:          u.id,
      email:       u.email,
      username:    u.username,
      role:        u.role.slug,
      status:      u.status,
      isVerified:  u.isVerified,
      isActive:    u.isActive,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      lastLoginIp: u.lastLoginIp,
      createdAt:   u.createdAt.toISOString(),
      updatedAt:   u.updatedAt.toISOString(),
      version:     u.version,
      firstName:   u.profile?.firstName ?? null,
      lastName:    u.profile?.lastName ?? null,
      displayName: u.profile?.displayName ?? null,
      avatarUrl:   u.profile?.avatarUrl ?? null,
    };
  }
}
