/**
 * @file google.strategy.ts
 * @module Auth/Strategies
 *
 * Passport Google OAuth 2.0 strategy.
 *
 * Implements the OAuth 2.0 authorization code flow:
 * 1. GET  /auth/google           → redirect to Google consent screen
 * 2. GET  /auth/google/callback  → Google redirects here with auth code
 * 3. Strategy exchanges code for tokens, calls Google userinfo endpoint
 * 4. validate() upserts the OAuth account and returns AuthenticatedUser
 * 5. AuthController issues JWT tokens and sets httpOnly cookie
 *
 * Database design for OAuth:
 * - oauth_accounts table links Google identities to CE Board Master users
 * - One user can have multiple OAuth providers (Google, future: Facebook)
 * - If the Google email matches an existing email/password account,
 *   the OAuth account is linked to the existing user (account linking)
 * - If no matching email exists, a new user is created automatically
 *   (no password set — passwordHash is NULL for OAuth-only users)
 *
 * Scopes requested: profile, email
 * We never request more permissions than needed (data minimisation,
 * Philippine Data Privacy Act compliance, Constitution Article XII).
 *
 * @see Project Constitution Article XII — Privacy Standards (RA 10173)
 * @see Database Phase 2 — OauthAccount model
 */
import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile, type VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { SubscriptionTierResolverService } from '../services/subscription-tier-resolver.service';
import { GOOGLE_STRATEGY } from '../auth.constants';
import type { AuthenticatedUser } from '../auth.types';
import type { AppEnvironment } from '../../config/configuration';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, GOOGLE_STRATEGY) {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(
    private readonly config: ConfigService<AppEnvironment>,
    private readonly prisma: PrismaService,
    private readonly tierResolver: SubscriptionTierResolverService,
  ) {
    super({
      clientID: config.get('GOOGLE_CLIENT_ID', { infer: true }),
      clientSecret: config.get('GOOGLE_CLIENT_SECRET', { infer: true }),
      callbackURL: config.get('GOOGLE_CALLBACK_URL', { infer: true }),
      scope: ['profile', 'email'],
    });
  }

  /**
   * Called after Google redirects back with user profile data.
   *
   * Flow:
   * 1. Extract Google user ID and email from profile
   * 2. Check if oauth_accounts record exists for this Google ID
   * 3. If yes → return existing linked user
   * 4. If no → check if email matches an existing user → link account
   * 5. If no matching email → create new user from Google profile
   *
   * @param accessToken  - Google access token (stored encrypted for future API calls)
   * @param refreshToken - Google refresh token (stored encrypted)
   * @param profile      - Google profile data (name, email, picture)
   * @param done         - Passport callback (done(error, user))
   */
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    try {
      const googleId = profile.id;
      const email = profile.emails?.[0]?.value?.toLowerCase();
      const firstName = profile.name?.givenName ?? 'User';
      const lastName = profile.name?.familyName ?? '';
      const avatarUrl = profile.photos?.[0]?.value;

      if (!email) {
        done(new Error('Google account has no email address.'), undefined);
        return;
      }

      const user = await this.findOrCreateOAuthUser({
        googleId,
        email,
        firstName,
        lastName,
        avatarUrl,
        accessToken,
        refreshToken: refreshToken ?? '',
      });

      done(null, user);
    } catch (error) {
      this.logger.error('Google OAuth validation failed', error);
      done(error instanceof Error ? error : new Error('OAuth error'), undefined);
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async findOrCreateOAuthUser(params: {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    accessToken: string;
    refreshToken: string;
  }): Promise<AuthenticatedUser> {
    const { googleId, email, firstName, lastName, avatarUrl, accessToken, refreshToken } = params;

    // 1. Check for existing OAuth account link
    const existingOAuth = await this.prisma.oauthAccount.findUnique({
      where: { provider_providerUserId: { provider: 'google', providerUserId: googleId } },
      include: { user: { include: { role: { select: { slug: true } } } } },
    });

    if (existingOAuth) {
      // Update tokens (they rotate on each OAuth flow)
      await this.prisma.oauthAccount.update({
        where: { id: existingOAuth.id },
        data: {
          accessTokenEnc: accessToken,   // Production: encrypt with pgcrypto
          refreshTokenEnc: refreshToken,
        },
      });

      const u = existingOAuth.user;
      return {
        id: u.id,
        email: u.email,
        role: u.role.slug,
        subscriptionTier: await this.tierResolver.resolve(u.id),
      };
    }

    // 2. Check if the Google email matches an existing email/password user
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      include: { role: { select: { slug: true } } },
    });

    if (existingUser) {
      // Link this Google account to the existing user
      await this.linkOAuthAccount(existingUser.id, googleId, email, accessToken, refreshToken);

      this.logger.log({
        message: 'Google OAuth linked to existing account',
        userId: existingUser.id,
        email,
      });

      return {
        id: existingUser.id,
        email: existingUser.email,
        role: existingUser.role.slug,
        subscriptionTier: await this.tierResolver.resolve(existingUser.id),
      };
    }

    // 3. Create a new user from Google profile data
    return this.createUserFromGoogle({
      googleId,
      email,
      firstName,
      lastName,
      avatarUrl,
      accessToken,
      refreshToken,
    });
  }

  private async linkOAuthAccount(
    userId: string,
    googleId: string,
    email: string,
    accessToken: string,
    refreshToken: string,
  ): Promise<void> {
    await this.prisma.oauthAccount.create({
      data: {
        userId,
        provider: 'google',
        providerUserId: googleId,
        providerEmail: email,
        accessTokenEnc: accessToken,
        refreshTokenEnc: refreshToken,
        scopes: ['profile', 'email'],
        isActive: true,
      },
    });
  }

  private async createUserFromGoogle(params: {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    accessToken: string;
    refreshToken: string;
  }): Promise<AuthenticatedUser> {
    const { googleId, email, firstName, lastName, avatarUrl, accessToken, refreshToken } = params;

    // Fetch the default role for new users
    const freeRole = await this.prisma.role.findUniqueOrThrow({
      where: { slug: 'free_user' },
    });

    const newUser = await this.prisma.user.create({
      data: {
        email,
        passwordHash: null,        // No password for OAuth-only accounts
        roleId: freeRole.id,
        status: 'active',
        isVerified: true,           // Google email is pre-verified
        isActive: true,
        profile: {
          create: {
            firstName,
            lastName,
            displayName: `${firstName} ${lastName}`.trim(),
            avatarUrl: avatarUrl ?? null,
          },
        },
        oauthAccounts: {
          create: {
            provider: 'google',
            providerUserId: googleId,
            providerEmail: email,
            accessTokenEnc: accessToken,
            refreshTokenEnc: refreshToken,
            scopes: ['profile', 'email'],
            isActive: true,
          },
        },
      },
      include: { role: { select: { slug: true } } },
    });

    this.logger.log({
      message: 'New user created via Google OAuth',
      userId: newUser.id,
      email,
    });

    return {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role.slug,
      subscriptionTier: 'free',
    };
  }
}
