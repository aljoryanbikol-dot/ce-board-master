/**
 * @file current-user.service.spec.ts
 * @module Auth/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { CurrentUserService } from '../services/current-user.service';

const mockPrisma = { user: { findUnique: vi.fn() } };

const buildService = () => new CurrentUserService(mockPrisma as any);

const mockAuthUser = {
  id: 'user-001', email: 'juan@example.com', role: 'subscriber', subscriptionTier: 'pro',
} as const;

const fullDbUser = {
  id: 'user-001',
  email: 'juan@example.com',
  isVerified: true,
  isActive: true,
  lastLoginAt: new Date('2026-06-25T10:00:00Z'),
  createdAt:   new Date('2026-01-01T00:00:00Z'),
  role:        { slug: 'subscriber' },
  mfaConfig:   { isEnabled: true },
  profile: {
    firstName:          'Juan',
    lastName:           'dela Cruz',
    displayName:        'Juan DC',
    avatarUrl:          'https://cdn.test/avatar.webp',
    school:             'Mapua University',
    examTargetDate:     new Date('2026-08-24'),
    preferredLanguage:  'en',
    timezone:           'Asia/Manila',
    studyGoalHours:     2,
    notificationsEmail: true,
    notificationsPush:  true,
  },
};

describe('CurrentUserService', () => {
  let service: CurrentUserService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = buildService();
    mockPrisma.user.findUnique.mockResolvedValue(fullDbUser);
  });

  describe('getCurrentUser()', () => {
    it('should return a complete user profile', async () => {
      const result = await service.getCurrentUser(mockAuthUser);

      expect(result.id).toBe('user-001');
      expect(result.email).toBe('juan@example.com');
      expect(result.firstName).toBe('Juan');
      expect(result.lastName).toBe('dela Cruz');
      expect(result.displayName).toBe('Juan DC');
      expect(result.school).toBe('Mapua University');
      expect(result.role).toBe('subscriber');
      expect(result.subscriptionTier).toBe('pro'); // from JWT claim
      expect(result.mfaEnabled).toBe(true);
    });

    it('should format examTargetDate as YYYY-MM-DD string', async () => {
      const result = await service.getCurrentUser(mockAuthUser);
      expect(result.examTargetDate).toBe('2026-08-24');
    });

    it('should format timestamps as ISO strings', async () => {
      const result = await service.getCurrentUser(mockAuthUser);
      expect(result.lastLoginAt).toBe('2026-06-25T10:00:00.000Z');
      expect(result.createdAt).toBe('2026-01-01T00:00:00.000Z');
    });

    it('should handle null profile fields gracefully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...fullDbUser,
        profile: null,
        mfaConfig: null,
        lastLoginAt: null,
      });

      const result = await service.getCurrentUser(mockAuthUser);
      expect(result.firstName).toBeNull();
      expect(result.mfaEnabled).toBe(false);
      expect(result.lastLoginAt).toBeNull();
    });

    it('should throw NotFoundException if user not found (race condition)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getCurrentUser(mockAuthUser)).rejects.toThrow(NotFoundException);
    });

    it('should use subscriptionTier from the JWT claim (not DB)', async () => {
      // The DB user doesn't have subscriptionTier — it comes from the JWT
      const proUser = { ...mockAuthUser, subscriptionTier: 'pro' } as const;
      const result = await service.getCurrentUser(proUser);
      expect(result.subscriptionTier).toBe('pro');
    });
  });
});
