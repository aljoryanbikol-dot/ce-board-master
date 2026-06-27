/**
 * @file auth.service.ts
 * @module Auth/Services
 *
 * Core authentication service — provides Passport strategy support and RBAC.
 *
 * Responsibilities:
 * 1. validateCredentials()         — called by LocalStrategy (legacy Passport hook)
 * 2. getUserFromJwtPayload()       — called by JwtStrategy on every authenticated request
 * 3. getPermissionsForRole()       — called by RolesGuard, Redis-cached (24h)
 * 4. invalidateRolePermissionCache() — called by AdminModule on role changes
 *
 * Note on LocalStrategy / LocalAuthGuard:
 * In this architecture LoginService.login() is the primary authentication path.
 * LocalStrategy.validate() (which calls validateCredentials()) is registered as
 * a Passport strategy but is not activated on any endpoint — LocalAuthGuard
 * is not placed on POST /auth/login. Both are kept for forward-compatibility
 * (e.g. a future OAuth2-resource-server pattern) and are clearly documented
 * as unused. They can be safely removed in a future cleanup sprint.
 *
 * FIX (Audit BUG-3): Removed unused import of CachedRolePermissions.
 *
 * @implements IAuthService
 */
import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CacheService, CacheNamespace, CacheTTL } from '../../cache/cache.service';
import { PasswordService } from './password.service';
import type { AuthenticatedUser } from '../auth.types';
import type { IAuthService } from '../auth.interface';
import { AUTH_ERROR_CODES } from '../auth.constants';

/** Argon2id dummy hash used in validateCredentials to maintain timing parity */
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$dGVzdHNhbHQ$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

@Injectable()
export class AuthService implements IAuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly cacheService: CacheService,
  ) {}

  // ── Credential Validation (for LocalStrategy) ──────────────────────────────

  /**
   * Validate email + password credentials.
   *
   * Called by: LocalStrategy.validate()
   * Note: LocalStrategy is registered but not active on any current endpoint.
   * Returns null (Passport convention) if credentials are invalid.
   *
   * Timing-safe: always runs Argon2id even for unknown emails.
   *
   * @param email    - Submitted email (already lowercased by Zod schema)
   * @param password - Plain-text password from the login request
   */
  async validateCredentials(
    email: string,
    password: string,
  ): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        isVerified: true,
        isActive: true,
        status: true,
        deletedAt: true,
        role: { select: { slug: true } },
      },
    });

    // Unknown email: run dummy verify for timing parity
    if (!user || !user.passwordHash) {
      await this.passwordService.verify(password, DUMMY_HASH);
      this.logger.debug({ message: 'validateCredentials: unknown email', email });
      return null;
    }

    const isValid = await this.passwordService.verify(password, user.passwordHash);
    if (!isValid) {
      this.logger.warn({ message: 'validateCredentials: wrong password', userId: user.id });
      return null;
    }

    if (!user.isVerified) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.ACCOUNT_NOT_VERIFIED,
        message: 'Please verify your email address before logging in.',
      });
    }

    if (!user.isActive || user.status !== 'active' || user.deletedAt !== null) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.ACCOUNT_SUSPENDED,
        message: 'Your account has been suspended. Please contact support.',
      });
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role.slug,
      subscriptionTier: 'free', // Sprint 2.5: resolve from subscriptions table
    };
  }

  // ── JWT Strategy Support ───────────────────────────────────────────────────

  /**
   * Load the full user record from the JWT `sub` claim.
   *
   * Called by: JwtStrategy.validate() on every authenticated request.
   * Re-validates account status — suspended accounts are rejected even
   * with a valid JWT within its 15-minute window.
   *
   * @param userId - The UUID from the JWT `sub` claim
   * @returns AuthenticatedUser if account is active, null otherwise
   */
  async getUserFromJwtPayload(userId: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        isActive: true,
        isVerified: true,
        status: true,
        deletedAt: true,
        role: { select: { slug: true } },
      },
    });

    if (!user)                         return null;
    if (!user.isActive)                return null;
    if (user.status !== 'active')      return null;
    if (user.deletedAt !== null)       return null;

    return {
      id: user.id,
      email: user.email,
      role: user.role.slug,
      subscriptionTier: 'free', // Sprint 2.5: enrich from subscriptions table
    };
  }

  // ── RBAC Permission Loading ────────────────────────────────────────────────

  /**
   * Load and cache role permissions for RolesGuard.
   * Cached in Redis with a 24-hour TTL.
   * Cache is invalidated via invalidateRolePermissionCache() on role changes.
   *
   * @param roleSlug - Role slug (e.g. 'content_admin')
   * @returns Array of permission slugs (e.g. ['content:questions:publish'])
   */
  async getPermissionsForRole(roleSlug: string): Promise<string[]> {
    const cacheKey = this.cacheService.buildKey(CacheNamespace.ROLES, roleSlug);

    return this.cacheService.remember<string[]>(
      cacheKey,
      CacheTTL.ROLES,
      async () => {
        const role = await this.prisma.role.findUnique({
          where: { slug: roleSlug },
          include: {
            rolePermissions: {
              include: { permission: { select: { slug: true } } },
            },
          },
        });

        if (!role) {
          this.logger.warn({ message: 'Unknown role slug in permission lookup', roleSlug });
          return [];
        }

        const permissions = role.rolePermissions.map((rp) => rp.permission.slug);

        this.logger.debug({
          message: 'Role permissions loaded from DB and cached',
          roleSlug,
          permissionCount: permissions.length,
        });

        return permissions;
      },
    );
  }

  /**
   * Invalidate the cached permissions for a role.
   * Called by AdminModule when role permissions are modified.
   */
  async invalidateRolePermissionCache(roleSlug: string): Promise<void> {
    const cacheKey = this.cacheService.buildKey(CacheNamespace.ROLES, roleSlug);
    await this.cacheService.del(cacheKey);
    this.logger.log({ message: 'Role permission cache invalidated', roleSlug });
  }
}
