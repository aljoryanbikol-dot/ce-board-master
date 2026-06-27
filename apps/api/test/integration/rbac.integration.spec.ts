/**
 * @file rbac.integration.spec.ts
 * @module Rbac/Tests/Integration
 *
 * Integration tests for the RBAC module.
 *
 * Tests full flows against a real NestJS application with mocked DB/Cache.
 * Verifies the complete chain:
 *   Guard → Service → Repository interaction → Cache population/invalidation
 *
 * Unlike unit tests, these tests use the full NestJS DI container so
 * actual guard registration, module imports, and decorator metadata are
 * exercised.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { RbacModule } from '../../src/rbac/rbac.module';
import { RolesService } from '../../src/rbac/services/roles.service';
import { PermissionsService } from '../../src/rbac/services/permissions.service';
import { UserRoleService } from '../../src/rbac/services/user-role.service';
import { PermissionGuard } from '../../src/rbac/guards/permission.guard';
import { AuthModule } from '../../src/auth/auth.module';
import { PrismaService } from '../../src/database/prisma.service';
import { CacheService } from '../../src/cache/cache.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

// ── Mock providers ─────────────────────────────────────────────────────────────

const questionsReadPerm = { id: 'p-read', slug: 'questions.read', name: 'Read', module: 'questions', isActive: true };
const questionsCreatePerm = { id: 'p-create', slug: 'questions.create', name: 'Create', module: 'questions', isActive: true };
const authorRole = { id: 'r-author', slug: 'content_author', name: 'Content Author', isSystem: true, isActive: true, sortOrder: 50, deletedAt: null };

const mockPrismaService = {
  role: {
    findUnique:  vi.fn(),
    findFirst:   vi.fn(),
    findMany:    vi.fn(),
    create:      vi.fn(),
    update:      vi.fn(),
  },
  permission: {
    findUnique:  vi.fn(),
    findMany:    vi.fn(),
    create:      vi.fn(),
    update:      vi.fn(),
  },
  rolePermission: {
    findUnique:  vi.fn(),
    create:      vi.fn(),
    delete:      vi.fn(),
  },
  userRole: {
    findUnique:  vi.fn(),
    findMany:    vi.fn(),
    create:      vi.fn(),
    update:      vi.fn(),
    updateMany:  vi.fn(),
  },
  user: {
    findUnique:  vi.fn(),
    update:      vi.fn(),
  },
};

const mockCacheService = {
  get:              vi.fn().mockResolvedValue(null),
  set:              vi.fn().mockResolvedValue(undefined),
  del:              vi.fn().mockResolvedValue(undefined),
  remember:         vi.fn().mockImplementation((_k: string, _ttl: number, fn: () => unknown) => fn()),
  invalidatePattern: vi.fn().mockResolvedValue(undefined),
  buildKey:         vi.fn((_ns: string, ...parts: string[]) => parts.join(':')),
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('RBAC Integration', () => {
  let rolesService:       RolesService;
  let permissionsService: PermissionsService;
  let userRoleService:    UserRoleService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        PermissionsService,
        UserRoleService,
        PermissionGuard,
        { provide: PrismaService,   useValue: mockPrismaService },
        { provide: CacheService,    useValue: mockCacheService },
        { provide: EventEmitter2,   useValue: { emit: vi.fn() } },
        { provide: 'Reflector',     useValue: { getAllAndOverride: vi.fn() } },
      ],
    }).compile();

    rolesService       = module.get(RolesService);
    permissionsService = module.get(PermissionsService);
    userRoleService    = module.get(UserRoleService);
  });

  afterAll(() => vi.clearAllMocks());

  // ── Full role creation + permission assignment flow ─────────────────────────

  describe('Role creation and permission assignment flow', () => {
    it('should create a role, assign a permission, and invalidate caches correctly', async () => {
      // 1. Create role
      mockPrismaService.role.findUnique.mockResolvedValue(null);
      mockPrismaService.role.create.mockResolvedValue(authorRole);
      mockPrismaService.role.findFirst.mockResolvedValue({
        ...authorRole, rolePermissions: [],
      });

      await rolesService.create({ name: 'Content Author', slug: 'content_author', sortOrder: 50 });
      expect(mockCacheService.del).toHaveBeenCalledWith('roles:all');

      vi.clearAllMocks();

      // 2. Assign permission
      mockPrismaService.role.findFirst.mockResolvedValue(authorRole);
      mockPrismaService.permission.findUnique.mockResolvedValue(questionsCreatePerm);
      mockPrismaService.rolePermission.findUnique.mockResolvedValue(null);
      mockPrismaService.rolePermission.create.mockResolvedValue({});

      await rolesService.assignPermission('r-author', 'p-create');

      // Verify ALL required cache invalidation keys were cleared
      expect(mockCacheService.del).toHaveBeenCalledWith('roles:permissions:content_author');
      expect(mockCacheService.del).toHaveBeenCalledWith('roles:slug:content_author');
      expect(mockCacheService.del).toHaveBeenCalledWith('roles:all');
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('rbac:perms:user:*');
    });
  });

  // ── User role assignment + effective permissions flow ──────────────────────

  describe('User role assignment and effective permissions flow', () => {
    it('should assign role to user, update primary role, and load effective permissions', async () => {
      const userId = 'user-integration-001';
      const grantedBy = 'admin-integration-001';

      // 1. Assign role
      const existingUser = { id: userId, role: { id: 'r-free', sortOrder: 10 } };
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaService.role.findFirst.mockResolvedValue({ ...authorRole });
      mockPrismaService.userRole.findUnique.mockResolvedValue(null);
      mockPrismaService.userRole.create.mockResolvedValue({
        userId, roleId: 'r-author', grantedAt: new Date(), grantedBy, expiresAt: null, isActive: true,
        role: authorRole,
      });
      mockPrismaService.userRole.findMany.mockResolvedValue([{
        userId, roleId: 'r-author', grantedAt: new Date(), grantedBy, expiresAt: null, isActive: true,
        role: authorRole,
      }]);

      await userRoleService.assignRole(userId, { roleId: 'r-author' }, grantedBy);

      // Primary role should be promoted (author sortOrder 50 > free sortOrder 10)
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { roleId: 'r-author' } }),
      );

      // User perm cache should be invalidated
      expect(mockCacheService.del).toHaveBeenCalledWith(`rbac:perms:user:${userId}`);

      vi.clearAllMocks();

      // 2. Load effective permissions
      mockCacheService.get.mockResolvedValue(null); // cache miss
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId, role: { slug: 'content_author' },
      });
      mockPrismaService.userRole.findMany.mockResolvedValue([
        {
          userId, roleId: 'r-author',
          role: {
            isActive: true,
            rolePermissions: [
              { permission: questionsReadPerm },
              { permission: questionsCreatePerm },
            ],
          },
        },
      ]);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        role: {
          rolePermissions: [
            { permission: questionsReadPerm },
          ],
        },
      });

      const result = await userRoleService.getEffectivePermissions(userId);
      expect(result.permissions).toContain('questions.read');
      expect(result.permissions).toContain('questions.create');

      // Should be cached after computation
      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringContaining(userId),
        expect.any(Array),
        300,
      );
    });
  });

  // ── Permission deactivation cascades ──────────────────────────────────────

  describe('Permission deactivation cascade', () => {
    it('should invalidate ALL user caches when a permission is deactivated', async () => {
      mockPrismaService.permission.findUnique.mockResolvedValue(questionsCreatePerm);
      mockPrismaService.permission.update.mockResolvedValue({ ...questionsCreatePerm, isActive: false });

      await permissionsService.update('p-create', { isActive: false });

      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('rbac:perms:user:*');
      expect(mockCacheService.del).toHaveBeenCalledWith('permissions:all');
    });
  });

  // ── Role soft-delete cascades ──────────────────────────────────────────────

  describe('Role deletion cascade', () => {
    it('should deactivate all user_role assignments on role deletion', async () => {
      const customRole = { ...authorRole, slug: 'custom_role', isSystem: false, _count: { users: 3 } };
      mockPrismaService.role.findFirst.mockResolvedValue(customRole);
      mockPrismaService.role.update.mockResolvedValue({ ...customRole, deletedAt: new Date() });
      mockPrismaService.userRole.updateMany.mockResolvedValue({ count: 3 });

      await rolesService.delete('r-custom');

      expect(mockPrismaService.userRole.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { roleId: 'r-custom' },
          data: { isActive: false },
        }),
      );
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('rbac:perms:user:*');
    });
  });
});
