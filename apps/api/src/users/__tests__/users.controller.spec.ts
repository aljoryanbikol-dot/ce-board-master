/**
 * @file users.controller.spec.ts
 * @module Users/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersController } from '../controllers/users.controller';
import { UsersService } from '../services/users.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

const mockUsersService = {
  findAll:    vi.fn(),
  findById:   vi.fn(),
  update:     vi.fn(),
  softDelete: vi.fn(),
};

const admin = { id: 'admin-001', email: 'a@b.com', role: 'admin', subscriptionTier: 'free' };
const allow = { canActivate: () => true };

async function build() {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [UsersController],
    providers: [{ provide: UsersService, useValue: mockUsersService }],
  })
    .overrideGuard(JwtAuthGuard).useValue(allow)
    .overrideGuard(RolesGuard).useValue(allow)
    .overrideGuard(PermissionGuard).useValue(allow)
    .compile();
  return module.get(UsersController);
}

describe('UsersController', () => {
  let ctrl: UsersController;

  beforeEach(async () => {
    vi.clearAllMocks();
    ctrl = await build();
  });

  describe('findAll()', () => {
    it('should delegate to UsersService.findAll', async () => {
      const list = { data: [], pagination: { cursor: null, hasMore: false, total: 0 } };
      mockUsersService.findAll.mockResolvedValue(list);
      const result = await ctrl.findAll({ limit: 20 });
      expect(result).toBe(list);
      expect(mockUsersService.findAll).toHaveBeenCalledWith({ limit: 20 });
    });
  });

  describe('findOne()', () => {
    it('should delegate with current user for ownership resolution', async () => {
      mockUsersService.findById.mockResolvedValue({ id: 'user-001' });
      await ctrl.findOne('user-001', admin as any);
      expect(mockUsersService.findById).toHaveBeenCalledWith('user-001', admin);
    });

    it('should propagate NotFoundException', async () => {
      mockUsersService.findById.mockRejectedValue(new NotFoundException());
      await expect(ctrl.findOne('ghost', admin as any)).rejects.toThrow(NotFoundException);
    });

    it('should propagate ForbiddenException on ownership failure', async () => {
      mockUsersService.findById.mockRejectedValue(new ForbiddenException());
      await expect(ctrl.findOne('user-001', admin as any)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update()', () => {
    it('should delegate to UsersService.update', async () => {
      mockUsersService.update.mockResolvedValue({ id: 'user-001', status: 'suspended' });
      const result = await ctrl.update('user-001', { status: 'suspended' }, admin as any);
      expect(result.status).toBe('suspended');
      expect(mockUsersService.update).toHaveBeenCalledWith('user-001', { status: 'suspended' }, admin);
    });
  });

  describe('remove()', () => {
    it('should delegate to UsersService.softDelete', async () => {
      mockUsersService.softDelete.mockResolvedValue(undefined);
      await ctrl.remove('user-001', admin as any);
      expect(mockUsersService.softDelete).toHaveBeenCalledWith('user-001', admin);
    });
  });
});
