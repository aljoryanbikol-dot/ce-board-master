/**
 * @file profiles.service.ts
 * @module Profiles/Services
 *
 * ProfileService — self-service profile management for the authenticated user.
 *
 * Responsibilities:
 * 1. Get own profile (GET /profile)
 * 2. Update own profile info (PATCH /profile) with optimistic locking
 * 3. Update avatar (PATCH /profile/avatar)
 * 4. Update preferences — language, timezone, theme, notifications (PATCH /profile/preferences)
 * 5. Redis cache management
 * 6. Audit logging via EventEmitter
 *
 * Authorization:
 * These endpoints always operate on the CALLER's own profile (req.user.id).
 * There is no cross-user access here — ownership is implicit. Admin access to
 * other users' data goes through UsersService, not ProfileService.
 *
 * Optimistic locking:
 * The UserProfile row has a `version` integer incremented on every update.
 * Update operations may pass the last-read version; a mismatch throws 409.
 *
 * Profile auto-creation:
 * If a user has no profile row yet (edge case for legacy accounts), the
 * service creates one lazily on first read/update.
 */
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { EVENTS } from '../../common/constants';
import {
  PROFILE_CACHE_PREFIX,
  PROFILE_CACHE_TTL,
} from '../profiles.constants';
import { ProfileErrors } from '../profiles.errors';
import type {
  UpdateProfileDto,
  UpdateAvatarDto,
  UpdatePreferencesDto,
} from '../dto/profile.dto';
import type { ProfileDetail } from '../profiles.types';

const PROFILE_SELECT = {
  userId: true, firstName: true, lastName: true, displayName: true,
  avatarUrl: true, bio: true, phoneNumber: true, gender: true, dateOfBirth: true,
  school: true, graduationYear: true, prcRegistrationNo: true, examTargetDate: true,
  preferredLanguage: true, timezone: true, theme: true, studyGoalHours: true,
  notificationsEmail: true, notificationsPush: true, version: true,
  createdAt: true, updatedAt: true,
} as const;

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Get own profile ──────────────────────────────────────────────────────────

  async getOwnProfile(userId: string): Promise<ProfileDetail> {
    const cacheKey = `${PROFILE_CACHE_PREFIX}${userId}`;
    const cached = await this.cache.get<ProfileDetail>(cacheKey);
    if (cached) return cached;

    const profile = await this.loadOrCreateProfile(userId);
    const detail = await this.toDetail(userId, profile);

    await this.cache.set(cacheKey, detail, PROFILE_CACHE_TTL);
    return detail;
  }

  // ── Update profile info ──────────────────────────────────────────────────────

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<ProfileDetail> {
    const existing = await this.loadOrCreateProfile(userId);

    if (dto.version !== undefined && dto.version !== existing.version) {
      throw ProfileErrors.versionConflict();
    }

    const changes = Object.keys(dto).filter((k) => k !== 'version');

    const updated = await this.prisma.userProfile.update({
      where: { userId },
      data: {
        ...(dto.firstName        !== undefined && { firstName:        dto.firstName }),
        ...(dto.lastName         !== undefined && { lastName:         dto.lastName }),
        ...(dto.displayName      !== undefined && { displayName:      dto.displayName }),
        ...(dto.bio              !== undefined && { bio:              dto.bio }),
        ...(dto.phoneNumber      !== undefined && { phoneNumber:      dto.phoneNumber }),
        ...(dto.gender           !== undefined && { gender:           dto.gender }),
        ...(dto.dateOfBirth      !== undefined && { dateOfBirth:      new Date(dto.dateOfBirth) }),
        ...(dto.school           !== undefined && { school:           dto.school }),
        ...(dto.graduationYear   !== undefined && { graduationYear:   dto.graduationYear }),
        ...(dto.prcRegistrationNo !== undefined && { prcRegistrationNo: dto.prcRegistrationNo }),
        ...(dto.examTargetDate   !== undefined && { examTargetDate:   new Date(dto.examTargetDate) }),
        ...(dto.studyGoalHours   !== undefined && { studyGoalHours:   dto.studyGoalHours }),
        version: { increment: 1 },
      },
      select: PROFILE_SELECT,
    });

    await this.invalidateCache(userId);
    this.emitProfileChanged(userId, changes);
    this.logger.log({ message: 'Profile updated', userId, changes });

    return this.toDetail(userId, updated);
  }

  // ── Update avatar ────────────────────────────────────────────────────────────

  async updateAvatar(userId: string, dto: UpdateAvatarDto): Promise<ProfileDetail> {
    await this.loadOrCreateProfile(userId);

    const updated = await this.prisma.userProfile.update({
      where: { userId },
      data:  { avatarUrl: dto.avatarUrl, version: { increment: 1 } },
      select: PROFILE_SELECT,
    });

    await this.invalidateCache(userId);
    this.emitProfileChanged(userId, ['avatarUrl']);
    this.logger.log({ message: 'Avatar updated', userId });

    return this.toDetail(userId, updated);
  }

  // ── Update preferences ───────────────────────────────────────────────────────

  async updatePreferences(userId: string, dto: UpdatePreferencesDto): Promise<ProfileDetail> {
    await this.loadOrCreateProfile(userId);

    const changes = Object.keys(dto).filter((k) => dto[k as keyof UpdatePreferencesDto] !== undefined);

    const updated = await this.prisma.userProfile.update({
      where: { userId },
      data: {
        ...(dto.preferredLanguage  !== undefined && { preferredLanguage:  dto.preferredLanguage }),
        ...(dto.timezone           !== undefined && { timezone:           dto.timezone }),
        ...(dto.theme              !== undefined && { theme:              dto.theme }),
        ...(dto.notificationsEmail !== undefined && { notificationsEmail: dto.notificationsEmail }),
        ...(dto.notificationsPush  !== undefined && { notificationsPush:  dto.notificationsPush }),
        version: { increment: 1 },
      },
      select: PROFILE_SELECT,
    });

    await this.invalidateCache(userId);
    this.emitProfileChanged(userId, changes);
    this.logger.log({ message: 'Preferences updated', userId, changes });

    return this.toDetail(userId, updated);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Load the user's profile, creating an empty one if it does not exist.
   * Handles legacy accounts created before profile rows were guaranteed.
   */
  private async loadOrCreateProfile(userId: string) {
    const existing = await this.prisma.userProfile.findUnique({
      where:  { userId },
      select: PROFILE_SELECT,
    });
    if (existing) return existing;

    // Verify the user actually exists before creating a profile
    const user = await this.prisma.user.findFirst({
      where:  { id: userId, deletedAt: null },
      select: { id: true },
    });
    if (!user) throw ProfileErrors.notFound(userId);

    return this.prisma.userProfile.create({
      data:   { userId },
      select: PROFILE_SELECT,
    });
  }

  private async invalidateCache(userId: string): Promise<void> {
    await this.cache.del(`${PROFILE_CACHE_PREFIX}${userId}`);
    // Also invalidate the user detail cache (display name / avatar appear there)
    await this.cache.del(`users:detail:${userId}`);
    await this.cache.invalidatePattern('users:list:*');
  }

  private emitProfileChanged(userId: string, changes: string[]): void {
    this.eventEmitter.emit(EVENTS.PROFILE_UPDATED, {
      userId, changes, timestamp: new Date().toISOString(),
    });
  }

  private async toDetail(
    userId: string,
    profile: {
      firstName: string | null; lastName: string | null; displayName: string | null;
      avatarUrl: string | null; bio: string | null; phoneNumber: string | null;
      gender: string | null; dateOfBirth: Date | null; school: string | null;
      graduationYear: number | null; prcRegistrationNo: string | null; examTargetDate: Date | null;
      preferredLanguage: string; timezone: string; theme: string; studyGoalHours: number | null;
      notificationsEmail: boolean; notificationsPush: boolean; version: number;
      createdAt: Date; updatedAt: Date;
    },
  ): Promise<ProfileDetail> {
    // Email + username live on the User row — fetch once (cached upstream)
    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { email: true, username: true },
    });

    return {
      userId,
      email:              user?.email ?? '',
      username:           user?.username ?? null,
      firstName:          profile.firstName,
      lastName:           profile.lastName,
      displayName:        profile.displayName,
      avatarUrl:          profile.avatarUrl,
      bio:                profile.bio,
      phoneNumber:        profile.phoneNumber,
      gender:             profile.gender,
      dateOfBirth:        profile.dateOfBirth?.toISOString().split('T')[0] ?? null,
      school:             profile.school,
      graduationYear:     profile.graduationYear,
      prcRegistrationNo:  profile.prcRegistrationNo,
      examTargetDate:     profile.examTargetDate?.toISOString().split('T')[0] ?? null,
      preferredLanguage:  profile.preferredLanguage,
      timezone:           profile.timezone,
      theme:              profile.theme,
      studyGoalHours:     profile.studyGoalHours,
      notificationsEmail: profile.notificationsEmail,
      notificationsPush:  profile.notificationsPush,
      version:            profile.version,
      createdAt:          profile.createdAt.toISOString(),
      updatedAt:          profile.updatedAt.toISOString(),
    };
  }
}
