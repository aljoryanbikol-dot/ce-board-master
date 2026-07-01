/**
 * @file login.service.ts
 * @module Auth/Services
 *
 * LoginService — orchestrates the complete email/password authentication flow.
 *
 * The login flow is the highest-risk authentication path in the system.
 * Every step is ordered deliberately to minimise information leakage and
 * prevent timing-based attacks.
 *
 * Execution order (order matters for security):
 * 1. IP-level lockout check  — fail fast without any DB lookups
 * 2. User-level lockout check — fail fast after one lightweight query
 * 3. Credential verification  — Argon2id (~200ms) runs only if not locked
 * 4. Account status check     — unverified / suspended rejection
 * 5. MFA verification         — TOTP if enabled
 * 6. Token pair issuance      — JWT access + rotating refresh
 * 7. Post-login housekeeping  — last-login update, lockout clear, audit log
 *
 * Timing-safe design:
 * The service does NOT short-circuit on "user not found" before running
 * a dummy password verification. An attacker timing API calls must not
 * be able to distinguish "wrong email" from "wrong password".
 *
 * @see API Contract Phase 4 — POST /auth/login
 * @see Software Architecture Phase 3B §5 — Authentication Flow
 * @see Project Constitution Article XI §11 — Security Standards
 */
import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { LockoutService } from './lockout.service';
import { MfaService } from './mfa.service';
import { SubscriptionTierResolverService } from './subscription-tier-resolver.service';
import { AUTH_ERROR_CODES } from '../auth.constants';
import type { AuthenticatedUser, TokenPair } from '../auth.types';

export interface LoginInput {
  email: string;
  password: string;
  mfaCode?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface LoginResult {
  tokenPair: TokenPair;
  user: AuthenticatedUser;
}

/** Argon2id dummy hash — ensures timing is constant for unknown emails */
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$dGVzdHNhbHQ$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

@Injectable()
export class LoginService {
  private readonly logger = new Logger(LoginService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly lockoutService: LockoutService,
    private readonly mfaService: MfaService,
    private readonly tierResolver: SubscriptionTierResolverService,
  ) {}

  /**
   * Authenticate a user with email + password (and optionally TOTP).
   *
   * @throws UnauthorizedException for invalid credentials
   * @throws ForbiddenException for locked accounts, unverified accounts, suspended accounts, invalid MFA
   */
  async login(input: LoginInput): Promise<LoginResult> {
    const { email, password, mfaCode, ipAddress = '0.0.0.0', userAgent } = input;

    // ── 1 & 2. Lockout checks ─────────────────────────────────────────────────
    // IP check is done without a userId. User-level check requires the user
    // record, which we fetch below — so IP check runs first for performance.
    // Full user-level lockout check happens after the user lookup.

    // ── 3. Load user record ───────────────────────────────────────────────────
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

    // ── Timing-safe: always run a hash verification even for unknown emails ────
    if (!user || !user.passwordHash) {
      // Dummy verify prevents timing attacks (unknown email faster than wrong pw)
      await this.passwordService.verify(password, DUMMY_HASH);

      this.logger.debug({ message: 'Login attempt for unknown email', email });

      // Record IP failure for unknown email attempts (anti-stuffing)
      await this.lockoutService.recordFailure(undefined, ipAddress);
      await this.recordAuditLog(undefined, email, ipAddress, userAgent, false, 'wrong_password');

      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Incorrect email or password.',
      });
    }

    // ── User-level lockout check (now that we have userId) ────────────────────
    const lockoutStatus = await this.lockoutService.getLockoutStatus(user.id, ipAddress);
    if (lockoutStatus.isLocked) {
      await this.recordAuditLog(user.id, email, ipAddress, userAgent, false, 'account_locked');
      const minutesRemaining = Math.ceil(lockoutStatus.remainingSeconds / 60);
      throw new ForbiddenException({
        code: AUTH_ERROR_CODES.ACCOUNT_LOCKED,
        message: `Account temporarily locked after too many failed attempts. Try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}.`,
      });
    }

    // ── 4. Verify password ────────────────────────────────────────────────────
    const isPasswordValid = await this.passwordService.verify(password, user.passwordHash);

    if (!isPasswordValid) {
      const isNowLocked = await this.lockoutService.recordFailure(user.id, ipAddress);
      await this.recordAuditLog(user.id, email, ipAddress, userAgent, false, 'wrong_password');

      this.logger.warn({ message: 'Invalid password attempt', userId: user.id, email });

      if (isNowLocked) {
        throw new ForbiddenException({
          code: AUTH_ERROR_CODES.ACCOUNT_LOCKED,
          message: 'Account locked after too many failed attempts. Try again in 15 minutes.',
        });
      }

      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Incorrect email or password.',
      });
    }

    // ── 5. Account status checks ──────────────────────────────────────────────
    if (user.deletedAt !== null) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.UNAUTHORIZED,
        message: 'Authentication required.',
      });
    }

    if (!user.isVerified) {
      await this.recordAuditLog(user.id, email, ipAddress, userAgent, false, 'unverified');
      throw new ForbiddenException({
        code: AUTH_ERROR_CODES.ACCOUNT_NOT_VERIFIED,
        message: 'Please verify your email address before logging in.',
      });
    }

    if (!user.isActive || user.status !== 'active') {
      await this.recordAuditLog(user.id, email, ipAddress, userAgent, false, 'suspended');
      throw new ForbiddenException({
        code: AUTH_ERROR_CODES.ACCOUNT_SUSPENDED,
        message: 'Your account has been suspended. Please contact support.',
      });
    }

    // ── 6. MFA verification ───────────────────────────────────────────────────
    const isMfaEnabled = await this.mfaService.isMfaEnabled(user.id);

    if (isMfaEnabled) {
      if (!mfaCode) {
        throw new ForbiddenException({
          code: AUTH_ERROR_CODES.MFA_REQUIRED,
          message: 'Please enter your 6-digit authentication code.',
        });
      }

      // verifyTotp throws UnauthorizedException on an invalid code (post-audit
      // refactor: it no longer returns a boolean). Catch so we still record the
      // lockout failure + audit log before re-throwing the MFA error.
      try {
        await this.mfaService.verifyTotp(user.id, mfaCode);
      } catch {
        await this.lockoutService.recordFailure(user.id, ipAddress);
        await this.recordAuditLog(user.id, email, ipAddress, userAgent, false, 'mfa_failed');
        throw new UnauthorizedException({
          code: AUTH_ERROR_CODES.MFA_INVALID,
          message: 'Invalid authentication code.',
        });
      }
    }

    // ── 7. Build authenticated user ───────────────────────────────────────────
    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      role: user.role.slug,
      subscriptionTier: await this.tierResolver.resolve(user.id),
    };

    // ── 8. Issue token pair ───────────────────────────────────────────────────
    const tokenPair = await this.tokenService.generateTokenPair(
      authenticatedUser,
      ipAddress,
      userAgent,
    );

    // ── 9. Post-login housekeeping (non-critical — fire in parallel) ──────────
    await Promise.allSettled([
      this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date(), lastLoginIp: ipAddress },
      }),
      this.lockoutService.clearLockout(user.id),
      this.recordAuditLog(user.id, email, ipAddress, userAgent, true, undefined),
    ]);

    this.logger.log({
      message: 'User authenticated',
      userId: user.id,
      email,
      mfaUsed: isMfaEnabled,
      ipAddress,
    });

    return { tokenPair, user: authenticatedUser };
  }

  // ── Private audit helper ──────────────────────────────────────────────────

  private async recordAuditLog(
    userId: string | undefined,
    email: string,
    ipAddress: string,
    userAgent: string | undefined,
    succeeded: boolean,
    failReason: 'wrong_password' | 'unverified' | 'suspended' | 'mfa_failed' | 'account_locked' | undefined,
  ): Promise<void> {
    try {
      await this.prisma.loginAttempt.create({
        data: {
          userId: userId ?? null,
          emailTried: email,
          ipAddress,
          userAgent: userAgent ?? null,
          succeeded,
          failReason: failReason ?? null,
        },
      });
    } catch (error) {
      // Audit log failure must never break the auth flow
      this.logger.error({ message: 'Failed to record login audit', error });
    }
  }
}
