/**
 * @file profiles.service.spec.ts
 * @module Profiles/Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProfileService } from '../services/profiles.service';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const dbProfile = {
  userId: 'user-001', firstName: 'Juan', lastName: 'DC', displayName: 'Juan DC',
  avatarUrl: null, bio: null, phoneNumber: null, gender: null, dateOfBirth: null,
  school: 'Mapua', graduationYear: 2020, prcRegistrationNo: null, examTargetDate: null,
  preferredLanguage: 'en', timezone: 'Asia/Manila', theme: 'system', studyGoalHours: 2,
  notificationsEmail: true, notificationsPush: true, version: 1,
  createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-06-26T08:00:00Z'),
};

const mockPrisma = {
  userProfile: {
    findUnique: vi.fn(),
    create:     vi.fn(),
    update:     vi.fn(),
  },
  user: { findFirst: vi.fn(), findUnique: vi.fn() },
};

const mockCache = {
  get:               vi.fn().mockResolvedValue(null),
  set:               vi.fn().mockResolvedValue(undefined),
  del:               vi.fn().mockResolvedValue(undefined),
  invalidatePattern: vi.fn().mockResolvedValue(undefined),
};

const mockEventEmitter = { emit: vi.fn() };

const build = () =>
  new ProfileService(mockPrisma as any, mockCache as any, mockEventEmitter as any);

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('ProfileService', () => {
  let service: ProfileService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = build();
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'juan@example.com', username: 'juan' });
  });

  // ── getOwnProfile ─────────────────────────────────────────────────────────

  describe('getOwnProfile()', () => {
    it('should return profile detail', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue(dbProfile);
      const result = await service.getOwnProfile('user-001');
      expect(result.userId).toBe('user-001');
      expect(result.email).toBe('juan@example.com');
      expect(result.theme).toBe('system');
    });

    it('should return cached profile on hit', async () => {
      const cached = { userId: 'user-001', email: 'c@c.com' };
      mockCache.get.mockResolvedValue(cached);
      const result = await service.getOwnProfile('user-001');
      expect(result).toBe(cached);
      expect(mockPrisma.userProfile.findUnique).not.toHaveBeenCalled();
    });

    it('should lazily create a profile if none exists', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue(null);
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-001' });
      mockPrisma.userProfile.create.mockResolvedValue(dbProfile);

      const result = await service.getOwnProfile('user-001');
      expect(mockPrisma.userProfile.create).toHaveBeenCalled();
      expect(result.userId).toBe('user-001');
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue(null);
      mockPrisma.user.findFirst.mockResolvedValue(null);
      await expect(service.getOwnProfile('ghost')).rejects.toThrow(NotFoundException);
    });

    it('should cache the profile after load', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue(dbProfile);
      await service.getOwnProfile('user-001');
      expect(mockCache.set).toHaveBeenCalled();
    });
  });

  // ── updateProfile ─────────────────────────────────────────────────────────

  describe('updateProfile()', () => {
    beforeEach(() => {
      mockPrisma.userProfile.findUnique.mockResolvedValue(dbProfile);
      mockPrisma.userProfile.update.mockResolvedValue({ ...dbProfile, bio: 'New bio', version: 2 });
    });

    it('should update profile fields and increment version', async () => {
      const result = await service.updateProfile('user-001', { bio: 'New bio' });
      expect(result.bio).toBe('New bio');
      const updateCall = mockPrisma.userProfile.update.mock.calls[0][0];
      expect(updateCall.data.version).toEqual({ increment: 1 });
    });

    it('should throw VERSION_CONFLICT on stale version', async () => {
      const err = await service.updateProfile('user-001', { bio: 'x', version: 0 }).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect((err.getResponse() as any).code).toBe('VERSION_CONFLICT');
    });

    it('should pass when version matches', async () => {
      await expect(service.updateProfile('user-001', { bio: 'ok', version: 1 })).resolves.toBeDefined();
    });

    it('should convert date strings to Date objects', async () => {
      await service.updateProfile('user-001', { dateOfBirth: '1998-05-12' });
      const updateCall = mockPrisma.userProfile.update.mock.calls[0][0];
      expect(updateCall.data.dateOfBirth).toBeInstanceOf(Date);
    });

    it('should invalidate caches and emit event', async () => {
      await service.updateProfile('user-001', { bio: 'x' });
      expect(mockCache.del).toHaveBeenCalledWith('profiles:detail:user-001');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('profile.updated', expect.anything());
    });
  });

  // ── updateAvatar ──────────────────────────────────────────────────────────

  describe('updateAvatar()', () => {
    beforeEach(() => {
      mockPrisma.userProfile.findUnique.mockResolvedValue(dbProfile);
      mockPrisma.userProfile.update.mockResolvedValue({ ...dbProfile, avatarUrl: 'https://cdn/x.webp', version: 2 });
    });

    it('should set the avatar URL', async () => {
      const result = await service.updateAvatar('user-001', { avatarUrl: 'https://cdn/x.webp' });
      expect(result.avatarUrl).toBe('https://cdn/x.webp');
    });

    it('should invalidate the user detail cache too', async () => {
      await service.updateAvatar('user-001', { avatarUrl: 'https://cdn/x.webp' });
      expect(mockCache.del).toHaveBeenCalledWith('users:detail:user-001');
    });
  });

  // ── updatePreferences ─────────────────────────────────────────────────────

  describe('updatePreferences()', () => {
    beforeEach(() => {
      mockPrisma.userProfile.findUnique.mockResolvedValue(dbProfile);
      mockPrisma.userProfile.update.mockResolvedValue({ ...dbProfile, theme: 'dark', version: 2 });
    });

    it('should update theme preference', async () => {
      const result = await service.updatePreferences('user-001', { theme: 'dark' });
      expect(result.theme).toBe('dark');
    });

    it('should update notification preferences', async () => {
      mockPrisma.userProfile.update.mockResolvedValue({ ...dbProfile, notificationsPush: false, version: 2 });
      const result = await service.updatePreferences('user-001', { notificationsPush: false });
      expect(result.notificationsPush).toBe(false);
    });

    it('should emit profile.updated event with changed keys', async () => {
      await service.updatePreferences('user-001', { theme: 'dark', timezone: 'UTC' });
      const emitCall = mockEventEmitter.emit.mock.calls[0][1];
      expect(emitCall.changes).toContain('theme');
      expect(emitCall.changes).toContain('timezone');
    });
  });
});
