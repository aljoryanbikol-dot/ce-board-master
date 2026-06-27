/**
 * @file users.service.spec.ts
 * @module Users/Tests
 *
 * Unit tests for UsersService.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../services/users.service';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const dbUser = {
  id: 'user-001', email: 'juan@example.com', username: 'juan', status: 'active',
  isVerified: true, isActive: true, lastLoginAt: new Date('2026-06-25T10:00:00Z'),
  lastLoginIp: '1.2.3.4', createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-06-26T08:00:00Z'), version: 2,
  role: { slug: 'subscriber' },
  profile: { firstName: 'Juan', lastName: 'DC', displayName: 'Juan DC', avatarUrl: null },
};

const adminUser = { id: 'admin-001', email: 'a@b.com', role: 'admin', subscriptionTier: 'free' as const };
const selfUser  = { id: 'user-001', email: 'juan@example.com', role: 'subscriber', subscriptionTier: 'free' as const };
const superAdmin = { id: 'sa-001', email: 'sa@b.com', role: 'super_admin', subscriptionTier: 'pro' as const };

const mockPrisma = {
  user: {
    findFirst:  vi.fn(),
    findUnique: vi.fn(),
    findMany:   vi.fn(),
    count:      vi.fn(),
    update:     vi.fn(),
  },
  userAuthToken: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
};

const mockCache = {
  get:               vi.fn().mockResolvedValue(null),
  set:               vi.fn().mockResolvedValue(undefined),
  del:               vi.fn().mockResolvedValue(undefined),
  invalidatePattern: vi.fn().mockResolvedValue(undefined),
};

const mockUserRoleService = {
  hasPermission: vi.fn().mockResolvedValue(true), // admin override granted by default
};

const mockEventEmitter = { emit: vi.fn() };

const build = () =>
  new UsersService(
    mockPrisma as any,
    mockCache as any,
    mockUserRoleService as any,
    mockEventEmitter as any,
  );

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = build();
    mockUserRoleService.hasPermission.mockResolvedValue(true);
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('should return cursor-paginated list', async () => {
      mockPrisma.user.findMany.mockResolvedValue([dbUser]);
      mockPrisma.user.count.mockResolvedValue(1);

      const result = await service.findAll({ limit: 20 });
      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should detect hasMore and set cursor when extra row returned', async () => {
      const rows = Array.from({ length: 21 }, (_, i) => ({ ...dbUser, id: `user-${String(i).padStart(3, '0')}` }));
      mockPrisma.user.findMany.mockResolvedValue(rows);
      mockPrisma.user.count.mockResolvedValue(50);

      const result = await service.findAll({ limit: 20 });
      expect(result.data).toHaveLength(20);
      expect(result.pagination.hasMore).toBe(true);
      expect(result.pagination.cursor).toBe('user-019');
    });

    it('should return cached result on cache hit', async () => {
      const cachedResult = { data: [], pagination: { cursor: null, hasMore: false, total: 0 } };
      mockCache.get.mockResolvedValue(cachedResult);

      const result = await service.findAll({ limit: 20 });
      expect(result).toBe(cachedResult);
      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    });

    it('should cache the result after DB query', async () => {
      mockPrisma.user.findMany.mockResolvedValue([dbUser]);
      mockPrisma.user.count.mockResolvedValue(1);
      await service.findAll({ limit: 20 });
      expect(mockCache.set).toHaveBeenCalled();
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('should return user detail for admin', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(dbUser);
      const result = await service.findById('user-001', adminUser);
      expect(result.id).toBe('user-001');
      expect(result.email).toBe('juan@example.com');
    });

    it('should allow owner to read self without admin permission', async () => {
      mockUserRoleService.hasPermission.mockResolvedValue(false);
      mockPrisma.user.findFirst.mockResolvedValue(dbUser);
      const result = await service.findById('user-001', selfUser);
      expect(result.id).toBe('user-001');
      // ownership short-circuits — hasPermission should not even be consulted
      expect(mockUserRoleService.hasPermission).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException for non-owner without admin permission', async () => {
      mockUserRoleService.hasPermission.mockResolvedValue(false);
      await expect(service.findById('user-001', adminUser)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for unknown user', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      await expect(service.findById('ghost', superAdmin)).rejects.toThrow(NotFoundException);
    });

    it('should bypass ownership check for super_admin', async () => {
      mockUserRoleService.hasPermission.mockResolvedValue(false);
      mockPrisma.user.findFirst.mockResolvedValue(dbUser);
      const result = await service.findById('user-001', superAdmin);
      expect(result.id).toBe('user-001');
    });

    it('should use cache on hit', async () => {
      const cached = { id: 'user-001', email: 'c@c.com' };
      mockCache.get.mockResolvedValue(cached);
      const result = await service.findById('user-001', superAdmin);
      expect(result).toBe(cached);
      expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update()', () => {
    beforeEach(() => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-001', version: 2, username: 'juan', role: { slug: 'subscriber' },
      });
      mockPrisma.user.update.mockResolvedValue(dbUser);
    });

    it('should update user and increment version', async () => {
      const result = await service.update('user-001', { status: 'suspended' }, adminUser);
      expect(result).toBeDefined();
      const updateCall = mockPrisma.user.update.mock.calls[0][0];
      expect(updateCall.data.version).toEqual({ increment: 1 });
    });

    it('should throw VERSION_CONFLICT on stale version', async () => {
      const err = await service.update('user-001', { status: 'active', version: 1 }, adminUser).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect((err.getResponse() as any).code).toBe('VERSION_CONFLICT');
    });

    it('should pass when version matches', async () => {
      const result = await service.update('user-001', { status: 'active', version: 2 }, adminUser);
      expect(result).toBeDefined();
    });

    it('should throw USERNAME_TAKEN when new username exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'other-user' });
      const err = await service.update('user-001', { username: 'taken' }, adminUser).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect((err.getResponse() as any).code).toBe('USERNAME_TAKEN');
    });

    it('should throw CANNOT_MODIFY_SUPERADMIN when admin edits super_admin', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'sa-target', version: 0, username: 'sa', role: { slug: 'super_admin' },
      });
      const err = await service.update('sa-target', { status: 'suspended' }, adminUser).catch((e) => e);
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err.getResponse() as any).code).toBe('CANNOT_MODIFY_SUPERADMIN');
    });

    it('should allow super_admin to modify another super_admin', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'sa-target', version: 0, username: 'sa', role: { slug: 'super_admin' },
      });
      mockPrisma.user.update.mockResolvedValue(dbUser);
      await expect(service.update('sa-target', { status: 'active' }, superAdmin)).resolves.toBeDefined();
    });

    it('should invalidate caches after update', async () => {
      await service.update('user-001', { status: 'active' }, adminUser);
      expect(mockCache.del).toHaveBeenCalledWith('users:detail:user-001');
      expect(mockCache.invalidatePattern).toHaveBeenCalledWith('users:list:*');
    });

    it('should emit USER_UPDATED event with changes', async () => {
      await service.update('user-001', { status: 'active' }, adminUser);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'user.updated',
        expect.objectContaining({ userId: 'user-001', action: 'updated' }),
      );
    });
  });

  // ── softDelete ──────────────────────────────────────────────────────────────

  describe('softDelete()', () => {
    beforeEach(() => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-001', role: { slug: 'subscriber' } });
      mockPrisma.user.update.mockResolvedValue({});
    });

    it('should soft-delete a user and revoke sessions', async () => {
      await service.softDelete('user-001', adminUser);
      const updateCall = mockPrisma.user.update.mock.calls[0][0];
      expect(updateCall.data.deletedAt).toBeInstanceOf(Date);
      expect(updateCall.data.isActive).toBe(false);
      expect(mockPrisma.userAuthToken.updateMany).toHaveBeenCalled();
    });

    it('should throw CANNOT_DELETE_SELF when deleting own account', async () => {
      const err = await service.softDelete('admin-001', adminUser).catch((e) => e);
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err.getResponse() as any).code).toBe('CANNOT_DELETE_SELF');
    });

    it('should throw CANNOT_MODIFY_SUPERADMIN when admin deletes super_admin', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'sa-target', role: { slug: 'super_admin' } });
      const err = await service.softDelete('sa-target', adminUser).catch((e) => e);
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err.getResponse() as any).code).toBe('CANNOT_MODIFY_SUPERADMIN');
    });

    it('should throw NotFoundException for unknown user', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      await expect(service.softDelete('ghost', adminUser)).rejects.toThrow(NotFoundException);
    });

    it('should emit USER_DELETED event', async () => {
      await service.softDelete('user-001', adminUser);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'user.deleted',
        expect.objectContaining({ userId: 'user-001', action: 'deleted' }),
      );
    });
  });
});
