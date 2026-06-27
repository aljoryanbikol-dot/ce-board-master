/**
 * @file users-profiles.integration.spec.ts
 * @module Users+Profiles/Tests/Integration
 *
 * Integration tests exercising UsersService + ProfileService through the
 * NestJS DI container with mocked Prisma/Cache/Events.
 *
 * Validates cross-service behaviour:
 * - Profile update invalidates the user detail + list caches
 * - User soft-delete revokes sessions
 * - Optimistic locking end-to-end
 * - Audit events emitted on every mutation
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../../src/users/services/users.service';
import { ProfileService } from '../../src/profiles/services/profiles.service';
import { PrismaService } from '../../src/database/prisma.service';
import { CacheService } from '../../src/cache/cache.service';
import { UserRoleService } from '../../src/rbac/services/user-role.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

const dbUser = {
  id: 'user-001', email: 'juan@example.com', username: 'juan', status: 'active',
  isVerified: true, isActive: true, lastLoginAt: null, lastLoginIp: null,
  createdAt: new Date(), updatedAt: new Date(), version: 0,
  role: { slug: 'subscriber' },
  profile: { firstName: 'Juan', lastName: 'DC', displayName: 'Juan DC', avatarUrl: null },
};

const dbProfile = {
  userId: 'user-001', firstName: 'Juan', lastName: 'DC', displayName: 'Juan DC',
  avatarUrl: null, bio: null, phoneNumber: null, gender: null, dateOfBirth: null,
  school: null, graduationYear: null, prcRegistrationNo: null, examTargetDate: null,
  preferredLanguage: 'en', timezone: 'Asia/Manila', theme: 'system', studyGoalHours: null,
  notificationsEmail: true, notificationsPush: true, version: 0,
  createdAt: new Date(), updatedAt: new Date(),
};

const mockPrisma = {
  user: {
    findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(),
    count: vi.fn(), update: vi.fn(),
  },
  userProfile: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  userAuthToken: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
};

const cacheStore = new Map<string, unknown>();
const mockCache = {
  get: vi.fn(async (k: string) => cacheStore.get(k) ?? null),
  set: vi.fn(async (k: string, v: unknown) => { cacheStore.set(k, v); }),
  del: vi.fn(async (k: string) => { cacheStore.delete(k); }),
  invalidatePattern: vi.fn(async (pattern: string) => {
    const prefix = pattern.replace('*', '');
    for (const key of cacheStore.keys()) if (key.startsWith(prefix)) cacheStore.delete(key);
  }),
};

const mockUserRoleService = { hasPermission: vi.fn().mockResolvedValue(true) };
const emitted: { event: string; payload: unknown }[] = [];
const mockEventEmitter = { emit: vi.fn((event: string, payload: unknown) => { emitted.push({ event, payload }); return true; }) };

describe('Users + Profiles Integration', () => {
  let usersService: UsersService;
  let profileService: ProfileService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        ProfileService,
        { provide: PrismaService,    useValue: mockPrisma },
        { provide: CacheService,     useValue: mockCache },
        { provide: UserRoleService,  useValue: mockUserRoleService },
        { provide: EventEmitter2,    useValue: mockEventEmitter },
      ],
    }).compile();

    usersService   = module.get(UsersService);
    profileService = module.get(ProfileService);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    cacheStore.clear();
    emitted.length = 0;
    mockUserRoleService.hasPermission.mockResolvedValue(true);
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'juan@example.com', username: 'juan' });
  });

  it('profile update should invalidate the user detail cache populated by UsersService', async () => {
    // 1. Admin reads user → populates users:detail:user-001 cache
    mockPrisma.user.findFirst.mockResolvedValue(dbUser);
    const admin = { id: 'admin-001', email: 'a@b.com', role: 'admin', subscriptionTier: 'free' as const };
    await usersService.findById('user-001', admin);
    expect(cacheStore.has('users:detail:user-001')).toBe(true);

    // 2. User updates own profile → should invalidate users:detail:user-001
    mockPrisma.userProfile.findUnique.mockResolvedValue(dbProfile);
    mockPrisma.userProfile.update.mockResolvedValue({ ...dbProfile, displayName: 'New Name', version: 1 });
    await profileService.updateProfile('user-001', { displayName: 'New Name' });

    expect(cacheStore.has('users:detail:user-001')).toBe(false);
  });

  it('full update flow: optimistic locking blocks stale writes', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'user-001', version: 5, username: 'juan', role: { slug: 'subscriber' },
    });
    const admin = { id: 'admin-001', email: 'a@b.com', role: 'admin', subscriptionTier: 'free' as const };

    // Stale version 3 vs current 5 → conflict
    await expect(
      usersService.update('user-001', { status: 'suspended', version: 3 }, admin),
    ).rejects.toThrow();
  });

  it('soft-delete should revoke sessions and emit USER_DELETED', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-001', role: { slug: 'subscriber' } });
    mockPrisma.user.update.mockResolvedValue({});
    const admin = { id: 'admin-001', email: 'a@b.com', role: 'admin', subscriptionTier: 'free' as const };

    await usersService.softDelete('user-001', admin);

    expect(mockPrisma.userAuthToken.updateMany).toHaveBeenCalled();
    expect(emitted.some((e) => e.event === 'user.deleted')).toBe(true);
  });

  it('preferences update emits profile.updated with correct change keys', async () => {
    mockPrisma.userProfile.findUnique.mockResolvedValue(dbProfile);
    mockPrisma.userProfile.update.mockResolvedValue({ ...dbProfile, theme: 'dark', version: 1 });

    await profileService.updatePreferences('user-001', { theme: 'dark' });

    const profileEvent = emitted.find((e) => e.event === 'profile.updated');
    expect(profileEvent).toBeDefined();
    expect((profileEvent!.payload as { changes: string[] }).changes).toContain('theme');
  });
});
