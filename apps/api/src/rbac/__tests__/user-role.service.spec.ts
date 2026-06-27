/**
 * @file user-role.service.spec.ts
 * @module Rbac/Tests
 *
 * Unit tests for UserRoleService.
 * Covers role assignment, removal, effective permissions, ownership assertion.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserRoleService } from '../services/user-role.service';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const freeUserRole  = { id: 'role-free', slug: 'free_user',  name: 'Free User',  sortOrder: 10 };
const adminRole     = { id: 'role-admin', slug: 'admin',     name: 'Admin',      sortOrder: 80 };
const superAdminRole= { id: 'role-sa',   slug: 'super_admin',name: 'Super Admin',sortOrder: 100};

const activeUser = {
  id: 'user-001', role: freeUserRole,
};

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    update:     vi.fn().mockResolvedValue({}),
  },
  userRole: {
    findUnique: vi.fn(),
    findMany:   vi.fn(),
    create:     vi.fn().mockResolvedValue({}),
    update:     vi.fn().mockResolvedValue({}),
  },
};

const mockCache = {
  get:              vi.fn().mockResolvedValue(null),
  set:              vi.fn().mockResolvedValue(undefined),
  del:              vi.fn().mockResolvedValue(undefined),
  invalidatePattern: vi.fn().mockResolvedValue(undefined),
};

const mockEventEmitter = { emit: vi.fn() };

const build = () =>
  new UserRoleService(mockPrisma as any, mockCache as any, mockEventEmitter as any);

const authUser = (id = 'user-001', role = 'admin') =>
  ({ id, email: 'a@b.com', role, subscriptionTier: 'free' as const });

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('UserRoleService', () => {
  let service: UserRoleService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = build();
  });

  // ── assignRole ──────────────────────────────────────────────────────────────

  describe('assignRole()', () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...activeUser });
      mockPrisma.userRole.findUnique.mockResolvedValue(null); // not yet assigned
    });

    it('should assign a role to a user', async () => {
      const result = await service.assignRole(
        'user-001',
        { roleId: adminRole.id },
        'admin-001',
      );
      expect(mockPrisma.userRole.create).toHaveBeenCalled();
      expect(mockCache.del).toHaveBeenCalledWith(
        expect.stringContaining('user-001'),
      );
    });

    it('should emit ROLE_CHANGED event on assignment', async () => {
      await service.assignRole('user-001', { roleId: adminRole.id }, 'admin-001');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'role.changed',
        expect.objectContaining({ userId: 'user-001', action: 'assigned' }),
      );
    });

    it('should throw ConflictException if role already active', async () => {
      mockPrisma.userRole.findUnique.mockResolvedValue({
        userId: 'user-001', roleId: adminRole.id, isActive: true,
      });
      await expect(
        service.assignRole('user-001', { roleId: adminRole.id }, 'admin-001'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException for unknown user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.assignRole('ghost', { roleId: adminRole.id }, 'admin-001'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reactivate a previously removed assignment', async () => {
      mockPrisma.userRole.findUnique.mockResolvedValue({
        userId: 'user-001', roleId: adminRole.id, isActive: false,
      });
      await service.assignRole('user-001', { roleId: adminRole.id }, 'admin-001');
      expect(mockPrisma.userRole.update).toHaveBeenCalled();
      expect(mockPrisma.userRole.create).not.toHaveBeenCalled();
    });

    it('should set expiresAt when provided', async () => {
      await service.assignRole(
        'user-001',
        { roleId: adminRole.id, expiresAt: '2030-01-01T00:00:00Z' },
        'admin-001',
      );
      const createCall = mockPrisma.userRole.create.mock.calls[0][0];
      expect(createCall.data.expiresAt).toBeInstanceOf(Date);
    });
  });

  // ── removeRole ──────────────────────────────────────────────────────────────

  describe('removeRole()', () => {
    const adminUser = authUser('admin-001', 'super_admin');

    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-001' });
      mockPrisma.userRole.findUnique.mockResolvedValue({
        userId: 'user-001', roleId: 'role-admin', isActive: true,
        role: { slug: 'admin', name: 'Admin' },
      });
      mockPrisma.userRole.findMany.mockResolvedValue([]);
    });

    it('should remove a role from a user', async () => {
      await service.removeRole('user-001', 'role-admin', adminUser);
      expect(mockPrisma.userRole.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
    });

    it('should throw ForbiddenException on self-demotion from super_admin', async () => {
      mockPrisma.userRole.findUnique.mockResolvedValue({
        userId: 'admin-001', roleId: 'role-sa', isActive: true,
        role: { slug: 'super_admin' },
      });

      await expect(
        service.removeRole('admin-001', 'role-sa', authUser('admin-001', 'super_admin')),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if role not assigned', async () => {
      mockPrisma.userRole.findUnique.mockResolvedValue(null);
      await expect(
        service.removeRole('user-001', 'role-ghost', adminUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── getEffectivePermissions ────────────────────────────────────────────────

  describe('getEffectivePermissions()', () => {
    const questionsRead = { id: 'p1', slug: 'questions.read', isActive: true };
    const analyticsView = { id: 'p2', slug: 'analytics.view', isActive: true };

    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-001', role: { slug: 'subscriber' },
      });
      mockPrisma.userRole.findMany.mockResolvedValue([
        {
          userId: 'user-001', roleId: 'role-sub',
          role: {
            isActive: true,
            rolePermissions: [
              { permission: questionsRead },
              { permission: analyticsView },
            ],
          },
        },
      ]);
    });

    it('should compute effective permissions from all active roles', async () => {
      const result = await service.getEffectivePermissions('user-001');
      expect(result.permissions).toContain('questions.read');
      expect(result.permissions).toContain('analytics.view');
    });

    it('should cache the result', async () => {
      await service.getEffectivePermissions('user-001');
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('user-001'),
        expect.any(Array),
        300,
      );
    });

    it('should return cached result on second call', async () => {
      mockCache.get.mockResolvedValueOnce(['questions.read']);
      const result = await service.getEffectivePermissions('user-001');
      expect(result.permissions).toEqual(['questions.read']);
      // DB should not be queried for userRole when cache hits
      // (Note: user lookup still runs once to get role slug)
    });

    it('should mark super_admin as isSuperAdmin=true', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-sa', role: { slug: 'super_admin' },
      });
      mockPrisma.userRole.findMany.mockResolvedValue([]);
      const result = await service.getEffectivePermissions('user-sa');
      expect(result.isSuperAdmin).toBe(true);
    });

    it('should deduplicate permissions from overlapping roles', async () => {
      // Two roles, both have questions.read
      mockPrisma.userRole.findMany.mockResolvedValue([
        { userId: 'user-001', role: { isActive: true, rolePermissions: [{ permission: questionsRead }] } },
        { userId: 'user-001', role: { isActive: true, rolePermissions: [{ permission: questionsRead }, { permission: analyticsView }] } },
      ]);

      const result = await service.getEffectivePermissions('user-001');
      const readCount = result.permissions.filter((p) => p === 'questions.read').length;
      expect(readCount).toBe(1); // deduplicated
    });

    it('should not include inactive permissions', async () => {
      mockPrisma.userRole.findMany.mockResolvedValue([
        {
          userId: 'user-001',
          role: {
            isActive: true,
            rolePermissions: [
              { permission: { id: 'p3', slug: 'system.manage', isActive: false } },
              { permission: questionsRead },
            ],
          },
        },
      ]);

      const result = await service.getEffectivePermissions('user-001');
      expect(result.permissions).not.toContain('system.manage');
      expect(result.permissions).toContain('questions.read');
    });
  });

  // ── assertOwnership ────────────────────────────────────────────────────────

  describe('assertOwnership()', () => {
    const resource = { id: 'q-001', authorId: 'user-001', title: 'Test Question' };

    it('should pass for resource owner', async () => {
      await expect(
        service.assertOwnership(resource, authUser('user-001'), { ownerField: 'authorId' }),
      ).resolves.not.toThrow();
    });

    it('should pass for super_admin regardless of ownership', async () => {
      await expect(
        service.assertOwnership(
          resource,
          authUser('admin-sa', 'super_admin'),
          { ownerField: 'authorId' },
        ),
      ).resolves.not.toThrow();
    });

    it('should pass when user holds bypass permission', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'admin-001', role: { slug: 'admin' } });
      mockPrisma.userRole.findMany.mockResolvedValue([
        {
          role: {
            isActive: true,
            rolePermissions: [{ permission: { slug: 'questions.manage', isActive: true } }],
          },
        },
      ]);
      mockCache.get.mockResolvedValue(null); // cache miss

      await expect(
        service.assertOwnership(
          resource,
          authUser('admin-001', 'admin'),
          { ownerField: 'authorId', adminPermission: 'questions.manage' },
        ),
      ).resolves.not.toThrow();
    });

    it('should throw ForbiddenException for non-owner without bypass', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-999', role: { slug: 'free_user' } });
      mockPrisma.userRole.findMany.mockResolvedValue([]);
      mockCache.get.mockResolvedValue(null);

      await expect(
        service.assertOwnership(resource, authUser('user-999'), { ownerField: 'authorId' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
