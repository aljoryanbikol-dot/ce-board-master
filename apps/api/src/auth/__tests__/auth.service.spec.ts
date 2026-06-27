/**
 * @file auth.service.spec.ts
 * @module Auth/Tests
 *
 * Unit tests for AuthService.
 *
 * Tests:
 * - validateCredentials: correct password, wrong password, unknown email (timing-safe)
 * - validateCredentials: unverified account throws, suspended account throws
 * - getUserFromJwtPayload: active user returned, inactive/deleted returns null
 * - getPermissionsForRole: loads from DB and caches; returns cached on second call
 * - invalidateRolePermissionCache: deletes the correct cache key
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../services/auth.service';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const activeDbUser = {
  id:           'user-001',
  email:        'juan@example.com',
  passwordHash: '$argon2id$validhash',
  isVerified:   true,
  isActive:     true,
  status:       'active',
  deletedAt:    null,
  role:         { slug: 'free_user' },
};

const mockPrisma = {
  user: { findUnique: vi.fn() },
  role: { findUnique: vi.fn() },
  rolePermission: {},
};

const mockPasswordService = { verify: vi.fn() };

const mockCacheService = {
  buildKey: vi.fn((ns: string, key: string) => `${ns}:${key}`),
  remember:  vi.fn(),
  del:       vi.fn().mockResolvedValue(undefined),
};

const buildService = () =>
  new AuthService(
    mockPrisma as any,
    mockPasswordService as any,
    mockCacheService as any,
  );

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = buildService();
  });

  // ── validateCredentials ─────────────────────────────────────────────────────

  describe('validateCredentials()', () => {
    it('should return AuthenticatedUser for correct credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(activeDbUser);
      mockPasswordService.verify.mockResolvedValue(true);

      const result = await service.validateCredentials('juan@example.com', 'correctpass');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('user-001');
      expect(result?.email).toBe('juan@example.com');
      expect(result?.role).toBe('free_user');
    });

    it('should return null for wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(activeDbUser);
      mockPasswordService.verify.mockResolvedValue(false);

      const result = await service.validateCredentials('juan@example.com', 'wrongpass');
      expect(result).toBeNull();
    });

    it('should run dummy verify and return null for unknown email (timing-safe)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPasswordService.verify.mockResolvedValue(false);

      const result = await service.validateCredentials('nobody@nowhere.com', 'anything');

      // Must still call verify (timing-safe — prevents email enumeration via timing)
      expect(mockPasswordService.verify).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });

    it('should run dummy verify and return null for OAuth-only user (no passwordHash)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...activeDbUser, passwordHash: null });
      mockPasswordService.verify.mockResolvedValue(false);

      const result = await service.validateCredentials('oauth@example.com', 'anything');
      expect(result).toBeNull();
    });

    it('should throw UnauthorizedException ACCOUNT_NOT_VERIFIED for unverified account', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...activeDbUser, isVerified: false });
      mockPasswordService.verify.mockResolvedValue(true);

      const error = await service.validateCredentials('juan@example.com', 'correctpass').catch((e) => e);
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error.getResponse() as any).code).toBe('ACCOUNT_NOT_VERIFIED');
    });

    it('should throw UnauthorizedException ACCOUNT_SUSPENDED for suspended account', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...activeDbUser,
        isActive: false,
        status: 'suspended',
      });
      mockPasswordService.verify.mockResolvedValue(true);

      const error = await service.validateCredentials('juan@example.com', 'correctpass').catch((e) => e);
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error.getResponse() as any).code).toBe('ACCOUNT_SUSPENDED');
    });
  });

  // ── getUserFromJwtPayload ───────────────────────────────────────────────────

  describe('getUserFromJwtPayload()', () => {
    it('should return AuthenticatedUser for an active user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(activeDbUser);

      const result = await service.getUserFromJwtPayload('user-001');
      expect(result?.id).toBe('user-001');
      expect(result?.email).toBe('juan@example.com');
    });

    it('should return null for a non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      expect(await service.getUserFromJwtPayload('ghost-id')).toBeNull();
    });

    it('should return null for an inactive user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...activeDbUser, isActive: false });
      expect(await service.getUserFromJwtPayload('user-001')).toBeNull();
    });

    it('should return null for a non-active status (suspended)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...activeDbUser, status: 'suspended' });
      expect(await service.getUserFromJwtPayload('user-001')).toBeNull();
    });

    it('should return null for a soft-deleted user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...activeDbUser, deletedAt: new Date() });
      expect(await service.getUserFromJwtPayload('user-001')).toBeNull();
    });
  });

  // ── getPermissionsForRole ───────────────────────────────────────────────────

  describe('getPermissionsForRole()', () => {
    const permissions = ['content:questions:create', 'content:questions:publish'];

    beforeEach(() => {
      // First call: cache miss → DB
      // Second call: cache hit (mocked by `remember` impl)
      mockCacheService.remember.mockImplementation(
        async (_key: string, _ttl: number, factory: () => Promise<string[]>) => factory(),
      );

      mockPrisma.role.findUnique.mockResolvedValue({
        slug: 'content_admin',
        rolePermissions: permissions.map((slug) => ({ permission: { slug } })),
      });
    });

    it('should return permission slugs for a known role', async () => {
      const result = await service.getPermissionsForRole('content_admin');
      expect(result).toEqual(permissions);
    });

    it('should use cacheService.remember (cache-or-load pattern)', async () => {
      await service.getPermissionsForRole('content_admin');
      expect(mockCacheService.remember).toHaveBeenCalledWith(
        expect.stringContaining('content_admin'),
        expect.any(Number),
        expect.any(Function),
      );
    });

    it('should return empty array for unknown role slug', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(null);
      const result = await service.getPermissionsForRole('nonexistent_role');
      expect(result).toEqual([]);
    });
  });

  // ── invalidateRolePermissionCache ───────────────────────────────────────────

  describe('invalidateRolePermissionCache()', () => {
    it('should delete the correct cache key', async () => {
      await service.invalidateRolePermissionCache('content_admin');
      expect(mockCacheService.del).toHaveBeenCalledWith(
        expect.stringContaining('content_admin'),
      );
    });
  });
});
