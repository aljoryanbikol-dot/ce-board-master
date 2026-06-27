/**
 * @file permission.guard.spec.ts
 * @module Rbac/Tests
 *
 * Unit tests for PermissionGuard.
 *
 * Tests cover:
 * - No @Permissions() → always pass
 * - super_admin → bypass all checks
 * - Cache HIT → use cached permissions, no DB query
 * - Cache MISS → load from DB, cache result
 * - All required permissions present → pass
 * - Any required permission missing → 403 FORBIDDEN_PERMISSION
 * - No req.user → 403
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from '../guards/permission.guard';
import { PERMISSIONS_KEY } from '../rbac.constants';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockReflector = { getAllAndOverride: vi.fn() };

const mockCache = {
  get: vi.fn(),
  set: vi.fn().mockResolvedValue(undefined),
};

const mockPrisma = {
  userRole: { findMany: vi.fn() },
  user:     { findUnique: vi.fn() },
};

const build = () =>
  new PermissionGuard(
    mockReflector as unknown as Reflector,
    mockCache as any,
    mockPrisma as any,
  );

// ── Context factory ────────────────────────────────────────────────────────────

const makeCtx = (user: object | undefined, url = '/test'): ExecutionContext =>
  ({
    getHandler: vi.fn().mockReturnValue({}),
    getClass:   vi.fn().mockReturnValue({}),
    switchToHttp: vi.fn().mockReturnValue({
      getRequest: vi.fn().mockReturnValue({ user, url }),
    }),
  }) as unknown as ExecutionContext;

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('PermissionGuard', () => {
  let guard: PermissionGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = build();
  });

  describe('no @Permissions() decoration', () => {
    it('should return true when no permissions required', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);
      const result = await guard.canActivate(makeCtx({}));
      expect(result).toBe(true);
    });

    it('should return true for empty permissions array', async () => {
      mockReflector.getAllAndOverride.mockReturnValue([]);
      const result = await guard.canActivate(makeCtx({}));
      expect(result).toBe(true);
    });
  });

  describe('super_admin bypass', () => {
    it('should return true immediately for super_admin without any cache/DB lookup', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(['questions.create']);
      const superAdmin = { id: 'sa-001', role: 'super_admin' };

      const result = await guard.canActivate(makeCtx(superAdmin));

      expect(result).toBe(true);
      // Verify no I/O was performed
      expect(mockCache.get).not.toHaveBeenCalled();
      expect(mockPrisma.userRole.findMany).not.toHaveBeenCalled();
    });
  });

  describe('cache HIT path', () => {
    it('should use cached permissions without DB query', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(['questions.create']);
      mockCache.get.mockResolvedValue(['questions.create', 'questions.read']);

      const user = { id: 'user-001', role: 'content_author' };
      const result = await guard.canActivate(makeCtx(user));

      expect(result).toBe(true);
      expect(mockPrisma.userRole.findMany).not.toHaveBeenCalled();
    });

    it('should deny (403) when cached permissions do not include required', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(['system.manage']);
      mockCache.get.mockResolvedValue(['questions.read']);

      const user = { id: 'user-001', role: 'subscriber' };

      await expect(guard.canActivate(makeCtx(user))).rejects.toThrow(ForbiddenException);
    });
  });

  describe('cache MISS path', () => {
    beforeEach(() => {
      mockCache.get.mockResolvedValue(null); // cache miss
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-001',
        role: { rolePermissions: [] },
      });
    });

    it('should load from DB and cache result on miss', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(['questions.read']);
      mockPrisma.userRole.findMany.mockResolvedValue([
        {
          role: {
            isActive: true,
            rolePermissions: [
              { permission: { slug: 'questions.read', isActive: true } },
              { permission: { slug: 'analytics.view', isActive: true } },
            ],
          },
        },
      ]);

      const user = { id: 'user-001', role: 'subscriber' };
      const result = await guard.canActivate(makeCtx(user));

      expect(result).toBe(true);
      expect(mockPrisma.userRole.findMany).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('user-001'),
        expect.arrayContaining(['questions.read']),
        300,
      );
    });

    it('should deny (403) when DB permissions do not include required', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(['roles.manage']);
      mockPrisma.userRole.findMany.mockResolvedValue([
        {
          role: {
            isActive: true,
            rolePermissions: [
              { permission: { slug: 'questions.read', isActive: true } },
            ],
          },
        },
      ]);

      const user = { id: 'user-001', role: 'subscriber' };
      await expect(guard.canActivate(makeCtx(user))).rejects.toThrow(ForbiddenException);
    });

    it('should require ALL listed permissions (AND semantics)', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(['questions.create', 'blueprints.manage']);
      mockPrisma.userRole.findMany.mockResolvedValue([
        {
          role: {
            isActive: true,
            rolePermissions: [
              { permission: { slug: 'questions.create', isActive: true } },
              // blueprints.manage is missing
            ],
          },
        },
      ]);

      const user = { id: 'user-001', role: 'content_author' };
      await expect(guard.canActivate(makeCtx(user))).rejects.toThrow(ForbiddenException);
    });

    it('should pass when ALL required permissions are present', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(['questions.create', 'blueprints.manage']);
      mockPrisma.userRole.findMany.mockResolvedValue([
        {
          role: {
            isActive: true,
            rolePermissions: [
              { permission: { slug: 'questions.create', isActive: true } },
              { permission: { slug: 'blueprints.manage', isActive: true } },
            ],
          },
        },
      ]);

      const user = { id: 'user-001', role: 'content_author' };
      const result = await guard.canActivate(makeCtx(user));
      expect(result).toBe(true);
    });

    it('should exclude inactive permissions', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(['system.manage']);
      mockPrisma.userRole.findMany.mockResolvedValue([
        {
          role: {
            isActive: true,
            rolePermissions: [
              { permission: { slug: 'system.manage', isActive: false } }, // inactive
            ],
          },
        },
      ]);

      const user = { id: 'user-001', role: 'admin' };
      await expect(guard.canActivate(makeCtx(user))).rejects.toThrow(ForbiddenException);
    });
  });

  describe('missing req.user', () => {
    it('should throw ForbiddenException when req.user is missing', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(['questions.read']);
      await expect(guard.canActivate(makeCtx(undefined))).rejects.toThrow(ForbiddenException);
    });
  });

  describe('error code', () => {
    it('should return FORBIDDEN_PERMISSION code in the exception', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(['permissions.manage']);
      mockCache.get.mockResolvedValue([]);

      const user = { id: 'user-001', role: 'subscriber' };
      const error = await guard.canActivate(makeCtx(user)).catch((e) => e);
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error.getResponse() as { code: string }).code).toBe('FORBIDDEN_PERMISSION');
    });
  });
});
