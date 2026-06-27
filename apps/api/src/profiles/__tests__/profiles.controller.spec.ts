/**
 * @file profiles.controller.spec.ts
 * @module Profiles/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ProfileController } from '../controllers/profiles.controller';
import { ProfileService } from '../services/profiles.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

const mockProfileService = {
  getOwnProfile:     vi.fn(),
  updateProfile:     vi.fn(),
  updateAvatar:      vi.fn(),
  updatePreferences: vi.fn(),
};

const user = { id: 'user-001', email: 'juan@example.com', role: 'subscriber', subscriptionTier: 'free' };
const allow = { canActivate: () => true };

async function build() {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [ProfileController],
    providers: [{ provide: ProfileService, useValue: mockProfileService }],
  })
    .overrideGuard(JwtAuthGuard).useValue(allow)
    .overrideGuard(RolesGuard).useValue(allow)
    .overrideGuard(PermissionGuard).useValue(allow)
    .compile();
  return module.get(ProfileController);
}

describe('ProfileController', () => {
  let ctrl: ProfileController;

  beforeEach(async () => {
    vi.clearAllMocks();
    ctrl = await build();
  });

  it('getProfile() delegates to service with current user id', async () => {
    mockProfileService.getOwnProfile.mockResolvedValue({ userId: 'user-001' });
    await ctrl.getProfile(user as any);
    expect(mockProfileService.getOwnProfile).toHaveBeenCalledWith('user-001');
  });

  it('updateProfile() delegates to service', async () => {
    mockProfileService.updateProfile.mockResolvedValue({ userId: 'user-001', bio: 'new' });
    const result = await ctrl.updateProfile(user as any, { bio: 'new' });
    expect(result.bio).toBe('new');
    expect(mockProfileService.updateProfile).toHaveBeenCalledWith('user-001', { bio: 'new' });
  });

  it('updateAvatar() delegates to service', async () => {
    mockProfileService.updateAvatar.mockResolvedValue({ userId: 'user-001', avatarUrl: 'https://x/y.webp' });
    const result = await ctrl.updateAvatar(user as any, { avatarUrl: 'https://x/y.webp' });
    expect(result.avatarUrl).toBe('https://x/y.webp');
  });

  it('updatePreferences() delegates to service', async () => {
    mockProfileService.updatePreferences.mockResolvedValue({ userId: 'user-001', theme: 'dark' });
    const result = await ctrl.updatePreferences(user as any, { theme: 'dark' });
    expect(result.theme).toBe('dark');
    expect(mockProfileService.updatePreferences).toHaveBeenCalledWith('user-001', { theme: 'dark' });
  });
});
