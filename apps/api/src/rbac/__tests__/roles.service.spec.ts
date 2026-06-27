/**
 * @file roles.service.spec.ts
 * @module Rbac/Tests
 *
 * Unit tests for RolesService.
 * All DB and cache interactions mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RolesService } from '../services/roles.service';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const systemRole = { id: 'role-001', name: 'Super Admin', slug: 'super_admin', description: null,
  isSystem: true, isActive: true, sortOrder: 100, createdAt: new Date(), updatedAt: new Date(),
  deletedAt: null, rolePermissions: [] };

const customRole = { id: 'role-002', name: 'Custom Role', slug: 'custom_role', description: 'desc',
  isSystem: false, isActive: true, sortOrder: 5, createdAt: new Date(), updatedAt: new Date(),
  deletedAt: null, rolePermissions: [] };

const mockPrisma = {
  role: {
    findUnique:  vi.fn(),
    findFirst:   vi.fn(),
    findMany:    vi.fn(),
    create:      vi.fn(),
    update:      vi.fn(),
  },
  userRole:       { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
  rolePermission: {
    findUnique: vi.fn(),
    create:     vi.fn().mockResolvedValue({}),
    delete:     vi.fn().mockResolvedValue({}),
  },
  permission:     { findUnique: vi.fn() },
};

const mockCache = {
  remember:         vi.fn().mockImplementation((_k: string, _t: number, f: () => unknown) => f()),
  del:              vi.fn().mockResolvedValue(undefined),
  invalidatePattern: vi.fn().mockResolvedValue(undefined),
};

const build = () => new RolesService(mockPrisma as any, mockCache as any);

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('RolesService', () => {
  let service: RolesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = build();
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('should create a new custom role', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(null);
      mockPrisma.role.create.mockResolvedValue(customRole);
      mockPrisma.role.findFirst.mockResolvedValue(customRole);

      const result = await service.create({ name: 'Custom Role', slug: 'custom_role', sortOrder: 5 });
      expect(result.slug).toBe('custom_role');
      expect(mockPrisma.role.create).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException on duplicate slug', async () => {
      mockPrisma.role.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(service.create({ name: 'Dup', slug: 'super_admin', sortOrder: 0 }))
        .rejects.toThrow(ConflictException);
    });

    it('should NOT hash or process the slug — stored as-is (lowercased by DTO)', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(null);
      mockPrisma.role.create.mockResolvedValue({ ...customRole, slug: 'my_role' });
      mockPrisma.role.findFirst.mockResolvedValue({ ...customRole, slug: 'my_role' });
      await service.create({ name: 'My Role', slug: 'my_role', sortOrder: 0 });
      const createCall = mockPrisma.role.create.mock.calls[0][0];
      expect(createCall.data.slug).toBe('my_role');
    });
  });

  // ── findAll ─────────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('should return roles list via cache.remember()', async () => {
      mockPrisma.role.findMany.mockResolvedValue([
        { ...systemRole, _count: { rolePermissions: 24 } },
      ]);
      const result = await service.findAll();
      expect(result).toHaveLength(1);
      expect(result[0]?.permissionCount).toBe(24);
      expect(mockCache.remember).toHaveBeenCalled();
    });
  });

  // ── update ──────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('should update a non-system role', async () => {
      mockPrisma.role.findFirst
        .mockResolvedValueOnce(customRole) // existence check
        .mockResolvedValueOnce({ ...customRole, name: 'Updated', rolePermissions: [] }); // findById
      mockPrisma.role.update.mockResolvedValue({ ...customRole, name: 'Updated' });

      const result = await service.update('role-002', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('should throw ForbiddenException when renaming a system role', async () => {
      mockPrisma.role.findFirst.mockResolvedValue(systemRole);
      await expect(service.update('role-001', { name: 'New Name' })).rejects.toThrow(ForbiddenException);
    });

    it('should allow updating sortOrder on a system role', async () => {
      mockPrisma.role.findFirst
        .mockResolvedValueOnce(systemRole)
        .mockResolvedValueOnce({ ...systemRole, sortOrder: 99, rolePermissions: [] });
      mockPrisma.role.update.mockResolvedValue({ ...systemRole, sortOrder: 99 });
      const result = await service.update('role-001', { sortOrder: 99 });
      expect(result.sortOrder).toBe(99);
    });

    it('should throw NotFoundException for unknown id', async () => {
      mockPrisma.role.findFirst.mockResolvedValue(null);
      await expect(service.update('ghost', {})).rejects.toThrow(NotFoundException);
    });
  });

  // ── delete ──────────────────────────────────────────────────────────────────

  describe('delete()', () => {
    it('should soft-delete a custom role', async () => {
      mockPrisma.role.findFirst.mockResolvedValue({ ...customRole, _count: { users: 0 } });
      mockPrisma.role.update.mockResolvedValue({});

      await service.delete('role-002');
      expect(mockPrisma.role.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
    });

    it('should throw ForbiddenException for system role', async () => {
      mockPrisma.role.findFirst.mockResolvedValue({ ...systemRole, _count: { users: 2 } });
      await expect(service.delete('role-001')).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for unknown role', async () => {
      mockPrisma.role.findFirst.mockResolvedValue(null);
      await expect(service.delete('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // ── assignPermission ────────────────────────────────────────────────────────

  describe('assignPermission()', () => {
    const perm = { id: 'perm-001', slug: 'questions.create', isActive: true };

    it('should assign permission to role', async () => {
      mockPrisma.role.findFirst.mockResolvedValue(customRole);
      mockPrisma.permission.findUnique.mockResolvedValue(perm);
      mockPrisma.rolePermission.findUnique.mockResolvedValue(null);

      await service.assignPermission('role-002', 'perm-001');
      expect(mockPrisma.rolePermission.create).toHaveBeenCalled();
    });

    it('should throw ConflictException when already assigned', async () => {
      mockPrisma.role.findFirst.mockResolvedValue(customRole);
      mockPrisma.permission.findUnique.mockResolvedValue(perm);
      mockPrisma.rolePermission.findUnique.mockResolvedValue({ roleId: 'role-002', permissionId: 'perm-001' });

      await expect(service.assignPermission('role-002', 'perm-001')).rejects.toThrow(ConflictException);
    });

    it('should invalidate permission caches after assignment', async () => {
      mockPrisma.role.findFirst.mockResolvedValue(customRole);
      mockPrisma.permission.findUnique.mockResolvedValue(perm);
      mockPrisma.rolePermission.findUnique.mockResolvedValue(null);

      await service.assignPermission('role-002', 'perm-001');
      expect(mockCache.del).toHaveBeenCalledWith(expect.stringContaining('roles:permissions'));
      expect(mockCache.invalidatePattern).toHaveBeenCalledWith('rbac:perms:user:*');
    });
  });

  // ── removePermission ────────────────────────────────────────────────────────

  describe('removePermission()', () => {
    it('should remove permission from role', async () => {
      mockPrisma.role.findFirst.mockResolvedValue(customRole);
      mockPrisma.rolePermission.findUnique.mockResolvedValue({ roleId: 'role-002', permissionId: 'perm-001' });

      await service.removePermission('role-002', 'perm-001');
      expect(mockPrisma.rolePermission.delete).toHaveBeenCalled();
    });
  });
});
