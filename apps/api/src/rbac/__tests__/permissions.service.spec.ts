/**
 * @file permissions.service.spec.ts
 * @module Rbac/Tests
 *
 * Unit tests for PermissionsService.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { PermissionsService } from '../services/permissions.service';

const mockPrisma = {
  permission: {
    findUnique: vi.fn(),
    findMany:   vi.fn(),
    create:     vi.fn(),
    update:     vi.fn(),
  },
};

const mockCache = {
  remember:         vi.fn().mockImplementation((_k: string, _t: number, f: () => unknown) => f()),
  del:              vi.fn().mockResolvedValue(undefined),
  get:              vi.fn().mockResolvedValue(null),
  set:              vi.fn().mockResolvedValue(undefined),
  invalidatePattern: vi.fn().mockResolvedValue(undefined),
};

const fakePerm = {
  id: 'perm-001', name: 'Create Questions', slug: 'questions.create',
  module: 'questions', description: 'Create questions.', isActive: true, createdAt: new Date(),
};

const build = () => new PermissionsService(mockPrisma as any, mockCache as any);

describe('PermissionsService', () => {
  let service: PermissionsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = build();
  });

  describe('create()', () => {
    it('should create a new permission', async () => {
      mockPrisma.permission.findUnique.mockResolvedValue(null);
      mockPrisma.permission.create.mockResolvedValue(fakePerm);

      const result = await service.create({
        name: 'Create Questions', slug: 'questions.create', module: 'questions',
      });
      expect(result.slug).toBe('questions.create');
      expect(mockPrisma.permission.create).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException on duplicate slug', async () => {
      mockPrisma.permission.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(
        service.create({ name: 'Dup', slug: 'questions.create', module: 'questions' }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.permission.create).not.toHaveBeenCalled();
    });

    it('should invalidate list cache after creation', async () => {
      mockPrisma.permission.findUnique.mockResolvedValue(null);
      mockPrisma.permission.create.mockResolvedValue(fakePerm);
      await service.create({ name: 'X', slug: 'x.y', module: 'x' });
      expect(mockCache.del).toHaveBeenCalledWith('permissions:all');
    });
  });

  describe('findById()', () => {
    it('should return permission by id', async () => {
      mockPrisma.permission.findUnique.mockResolvedValue(fakePerm);
      const result = await service.findById('perm-001');
      expect(result.id).toBe('perm-001');
    });

    it('should throw NotFoundException for unknown id', async () => {
      mockPrisma.permission.findUnique.mockResolvedValue(null);
      const { NotFoundException } = await import('@nestjs/common');
      await expect(service.findById('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll()', () => {
    it('should use cache.remember for default query', async () => {
      mockPrisma.permission.findMany.mockResolvedValue([fakePerm]);
      const result = await service.findAll({ limit: 50 });
      expect(result).toHaveLength(1);
      expect(mockCache.remember).toHaveBeenCalled();
    });

    it('should bypass cache when module filter applied', async () => {
      mockPrisma.permission.findMany.mockResolvedValue([fakePerm]);
      await service.findAll({ module: 'questions', limit: 50 });
      // cache.remember should NOT be called for filtered queries
      expect(mockCache.remember).not.toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    it('should update permission fields', async () => {
      mockPrisma.permission.findUnique.mockResolvedValue(fakePerm);
      mockPrisma.permission.update.mockResolvedValue({ ...fakePerm, name: 'Updated' });
      const result = await service.update('perm-001', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('should invalidate all user perm caches when deactivating', async () => {
      mockPrisma.permission.findUnique.mockResolvedValue(fakePerm);
      mockPrisma.permission.update.mockResolvedValue({ ...fakePerm, isActive: false });
      await service.update('perm-001', { isActive: false });
      expect(mockCache.invalidatePattern).toHaveBeenCalledWith('rbac:perms:user:*');
    });

    it('should NOT invalidate user caches for non-deactivation updates', async () => {
      mockPrisma.permission.findUnique.mockResolvedValue(fakePerm);
      mockPrisma.permission.update.mockResolvedValue({ ...fakePerm, name: 'New' });
      await service.update('perm-001', { name: 'New' });
      expect(mockCache.invalidatePattern).not.toHaveBeenCalled();
    });
  });
});
