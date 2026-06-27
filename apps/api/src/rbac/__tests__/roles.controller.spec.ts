/**
 * @file roles.controller.spec.ts
 * @module Rbac/Tests
 *
 * Unit tests for RolesController and PermissionsController.
 * Guards mocked. Tests delegation to services and response shapes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RolesController }   from '../controllers/roles.controller';
import {
  PermissionsController,
  UserRolesController,
  RbacSelfController,
} from '../controllers/permissions.controller';
import { RolesService }       from '../services/roles.service';
import { PermissionsService } from '../services/permissions.service';
import { UserRoleService }    from '../services/user-role.service';
import { RolesGuard }         from '../../auth/guards/roles.guard';
import { PermissionGuard }    from '../guards/permission.guard';
import { JwtAuthGuard }       from '../../auth/guards/jwt-auth.guard';

// ── Service mocks ──────────────────────────────────────────────────────────────

const mockRolesService = {
  findAll:          vi.fn(),
  findById:         vi.fn(),
  create:           vi.fn(),
  update:           vi.fn(),
  delete:           vi.fn(),
  getRolePermissions: vi.fn(),
  assignPermission: vi.fn(),
  removePermission: vi.fn(),
};

const mockPermissionsService = {
  findAll:   vi.fn(),
  findById:  vi.fn(),
  create:    vi.fn(),
  update:    vi.fn(),
};

const mockUserRoleService = {
  getUserRoles:           vi.fn(),
  assignRole:             vi.fn(),
  removeRole:             vi.fn(),
  getEffectivePermissions: vi.fn(),
  hasPermission:          vi.fn(),
};

const mockAdmin = { id: 'admin-001', email: 'admin@test.com', role: 'super_admin', subscriptionTier: 'pro' };

const fakeRole = {
  id: 'role-001', name: 'Admin', slug: 'admin', isSystem: true,
  isActive: true, sortOrder: 80, permissions: [],
  description: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

const fakePerm = {
  id: 'perm-001', name: 'Create Questions', slug: 'questions.create',
  module: 'questions', description: null, isActive: true, createdAt: new Date().toISOString(),
};

// ── Guard bypass for unit tests ────────────────────────────────────────────────

const allowAll = { canActivate: () => true };

// ── Build test module helper ───────────────────────────────────────────────────

async function buildModule() {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [
      RolesController,
      PermissionsController,
      UserRolesController,
      RbacSelfController,
    ],
    providers: [
      { provide: RolesService,       useValue: mockRolesService },
      { provide: PermissionsService, useValue: mockPermissionsService },
      { provide: UserRoleService,    useValue: mockUserRoleService },
    ],
  })
    .overrideGuard(JwtAuthGuard).useValue(allowAll)
    .overrideGuard(RolesGuard).useValue(allowAll)
    .overrideGuard(PermissionGuard).useValue(allowAll)
    .compile();

  return {
    rolesCtrl:   module.get(RolesController),
    permsCtrl:   module.get(PermissionsController),
    userRolesCtrl: module.get(UserRolesController),
    selfCtrl:    module.get(RbacSelfController),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('RolesController', () => {
  let ctrl: RolesController;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { rolesCtrl } = await buildModule();
    ctrl = rolesCtrl;
  });

  describe('findAll()', () => {
    it('should delegate to RolesService.findAll() and return list', async () => {
      mockRolesService.findAll.mockResolvedValue([fakeRole]);
      const result = await ctrl.findAll();
      expect(result).toHaveLength(1);
      expect(mockRolesService.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne()', () => {
    it('should delegate to RolesService.findById()', async () => {
      mockRolesService.findById.mockResolvedValue(fakeRole);
      const result = await ctrl.findOne('role-001');
      expect(result.id).toBe('role-001');
      expect(mockRolesService.findById).toHaveBeenCalledWith('role-001');
    });

    it('should propagate NotFoundException from service', async () => {
      mockRolesService.findById.mockRejectedValue(new NotFoundException());
      await expect(ctrl.findOne('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('should delegate to RolesService.create() and return new role', async () => {
      const newRole = { ...fakeRole, slug: 'custom_role' };
      mockRolesService.create.mockResolvedValue(newRole);
      const result = await ctrl.create({ name: 'Custom', slug: 'custom_role', sortOrder: 5 });
      expect(result.slug).toBe('custom_role');
    });
  });

  describe('update()', () => {
    it('should delegate to RolesService.update()', async () => {
      mockRolesService.update.mockResolvedValue({ ...fakeRole, name: 'Updated' });
      const result = await ctrl.update('role-001', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });
  });

  describe('remove()', () => {
    it('should delegate to RolesService.delete()', async () => {
      mockRolesService.delete.mockResolvedValue(undefined);
      await ctrl.remove('role-001');
      expect(mockRolesService.delete).toHaveBeenCalledWith('role-001');
    });

    it('should propagate ForbiddenException for system role deletion', async () => {
      mockRolesService.delete.mockRejectedValue(new ForbiddenException({ code: 'ROLE_IS_SYSTEM' }));
      await expect(ctrl.remove('role-001')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('assignPermission()', () => {
    it('should delegate to RolesService.assignPermission() and return message', async () => {
      mockRolesService.assignPermission.mockResolvedValue(undefined);
      const result = await ctrl.assignPermission('role-001', { permissionId: 'perm-001' });
      expect(result.message).toBeDefined();
      expect(mockRolesService.assignPermission).toHaveBeenCalledWith('role-001', 'perm-001');
    });
  });

  describe('removePermission()', () => {
    it('should delegate to RolesService.removePermission()', async () => {
      mockRolesService.removePermission.mockResolvedValue(undefined);
      await ctrl.removePermission('role-001', 'perm-001');
      expect(mockRolesService.removePermission).toHaveBeenCalledWith('role-001', 'perm-001');
    });
  });
});

describe('PermissionsController', () => {
  let ctrl: PermissionsController;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { permsCtrl } = await buildModule();
    ctrl = permsCtrl;
  });

  describe('findAll()', () => {
    it('should return permission list', async () => {
      mockPermissionsService.findAll.mockResolvedValue([fakePerm]);
      const result = await ctrl.findAll({ limit: 50 });
      expect(result).toHaveLength(1);
    });
  });

  describe('create()', () => {
    it('should delegate creation to PermissionsService', async () => {
      mockPermissionsService.create.mockResolvedValue(fakePerm);
      const result = await ctrl.create({ name: 'Create Questions', slug: 'questions.create', module: 'questions' });
      expect(result.slug).toBe('questions.create');
    });
  });

  describe('deactivate()', () => {
    it('should call update with isActive:false', async () => {
      mockPermissionsService.update.mockResolvedValue({ ...fakePerm, isActive: false });
      await ctrl.deactivate('perm-001');
      expect(mockPermissionsService.update).toHaveBeenCalledWith('perm-001', { isActive: false });
    });
  });
});

describe('UserRolesController', () => {
  let ctrl: UserRolesController;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { userRolesCtrl } = await buildModule();
    ctrl = userRolesCtrl;
  });

  it('getUserRoles() delegates to UserRoleService', async () => {
    mockUserRoleService.getUserRoles.mockResolvedValue([]);
    await ctrl.getUserRoles('user-001');
    expect(mockUserRoleService.getUserRoles).toHaveBeenCalledWith('user-001');
  });

  it('assignRole() delegates with grantedBy from CurrentUser', async () => {
    mockUserRoleService.assignRole.mockResolvedValue({ roleSlug: 'admin' });
    await ctrl.assignRole('user-001', { roleId: 'role-001' }, mockAdmin as any);
    expect(mockUserRoleService.assignRole).toHaveBeenCalledWith('user-001', { roleId: 'role-001' }, 'admin-001');
  });

  it('removeRole() delegates to UserRoleService with current user context', async () => {
    mockUserRoleService.removeRole.mockResolvedValue(undefined);
    await ctrl.removeRole('user-001', 'role-001', mockAdmin as any);
    expect(mockUserRoleService.removeRole).toHaveBeenCalledWith('user-001', 'role-001', mockAdmin);
  });
});

describe('RbacSelfController', () => {
  let ctrl: RbacSelfController;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { selfCtrl } = await buildModule();
    ctrl = selfCtrl;
  });

  it('myPermissions() returns effective permissions for current user', async () => {
    const effPerms = { userId: 'user-001', roles: ['subscriber'], permissions: ['questions.read'], isSuperAdmin: false, cachedAt: '' };
    mockUserRoleService.getEffectivePermissions.mockResolvedValue(effPerms);
    const result = await ctrl.myPermissions(mockAdmin as any);
    expect(result.userId).toBe('user-001');
  });

  it('checkPermission() returns hasPermission boolean', async () => {
    mockUserRoleService.hasPermission.mockResolvedValue(true);
    const result = await ctrl.checkPermission(
      mockAdmin as any,
      { permission: 'questions.read' },
    );
    expect(result.hasPermission).toBe(true);
    expect(result.permission).toBe('questions.read');
  });
});
