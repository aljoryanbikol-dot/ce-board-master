/**
 * @file current-user.service.ts
 * @module Auth/Services
 *
 * CurrentUserService — loads a rich view of the currently authenticated user.
 *
 * The JWT payload carries only the minimal claims needed for auth decisions
 * (id, email, role, subscriptionTier). The GET /auth/me endpoint returns
 * the full user object including profile fields, timestamps, and account status.
 *
 * This service joins Users + UserProfiles + Roles in a single query,
 * returning a denormalised response shape that the frontend dashboard
 * can consume directly without further API calls.
 *
 * It does NOT use the JWT claims directly — it re-reads from the database.
 * This ensures the response always reflects the current database state
 * (e.g. a recent name change shows immediately).
 *
 * @see API Contract Phase 4 — GET /auth/me
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../auth.types';

export interface CurrentUserResponse {
  id: string;
  email: string;
  firstName:        string | null;
  lastName:         string | null;
  displayName:      string | null;
  avatarUrl:        string | null;
  school:           string | null;
  examTargetDate:   string | null;
  preferredLanguage: string;
  timezone:          string;
  studyGoalHours:   number | null;
  notificationsEmail: boolean;
  notificationsPush:  boolean;
  role:             string;
  subscriptionTier: string;
  isVerified:       boolean;
  isActive:         boolean;
  mfaEnabled:       boolean;
  lastLoginAt:      string | null;
  createdAt:        string;
}

@Injectable()
export class CurrentUserService {
  private readonly logger = new Logger(CurrentUserService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Load the full user profile for the authenticated user.
   *
   * @param user - Authenticated user from JwtAuthGuard (req.user)
   * @returns Rich user object with profile fields
   */
  async getCurrentUser(user: AuthenticatedUser): Promise<CurrentUserResponse> {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        isVerified: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        role: {
          select: { slug: true },
        },
        profile: {
          select: {
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
            school: true,
            examTargetDate: true,
            preferredLanguage: true,
            timezone: true,
            studyGoalHours: true,
            notificationsEmail: true,
            notificationsPush: true,
          },
        },
        mfaConfig: {
          select: { isEnabled: true },
        },
      },
    });

    if (!dbUser) {
      // This should not happen — JwtAuthGuard already verified the user exists.
      // Guard against race condition (user deleted between guard and here).
      this.logger.error({ message: 'getCurrentUser: user not found after JWT validation', userId: user.id });
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User account not found.',
      });
    }

    const profile = dbUser.profile;

    return {
      id: dbUser.id,
      email: dbUser.email,
      firstName:         profile?.firstName        ?? null,
      lastName:          profile?.lastName         ?? null,
      displayName:       profile?.displayName      ?? null,
      avatarUrl:         profile?.avatarUrl        ?? null,
      school:            profile?.school           ?? null,
      examTargetDate:    profile?.examTargetDate?.toISOString().split('T')[0] ?? null,
      preferredLanguage: profile?.preferredLanguage ?? 'en',
      timezone:          profile?.timezone          ?? 'Asia/Manila',
      studyGoalHours:    profile?.studyGoalHours    ?? null,
      notificationsEmail: profile?.notificationsEmail ?? true,
      notificationsPush:  profile?.notificationsPush  ?? true,
      role:             dbUser.role.slug,
      subscriptionTier: user.subscriptionTier,   // From JWT (enriched in Sprint 2.5)
      isVerified:       dbUser.isVerified,
      isActive:         dbUser.isActive,
      mfaEnabled:       dbUser.mfaConfig?.isEnabled ?? false,
      lastLoginAt:      dbUser.lastLoginAt?.toISOString() ?? null,
      createdAt:        dbUser.createdAt.toISOString(),
    };
  }
}
