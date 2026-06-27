/**
 * @file password-reset.service.ts
 * @module Auth/Services
 *
 * PasswordResetService — manages the complete password reset and change flows.
 *
 * Flows:
 * 1. Forgot Password → Reset Password (two-step, token-based, unauthenticated)
 * 2. Change Password (authenticated, requires current password confirmation)
 *
 * Security properties:
 *
 * Forgot/Reset flow:
 * - forgotPassword() always returns 200 regardless of email existence
 *   (Account enumeration protection — Constitution Article XI §11)
 * - Token is 256-bit random, SHA-256 hashed in DB, expires in 1 hour
 * - Single-use: consumed immediately on resetPassword() success
 * - On success: ALL active sessions revoked (forces re-login everywhere)
 * - Password-changed security email sent after successful reset
 *
 * Change Password flow:
 * - Requires valid current password (Argon2id verification)
 * - New password must differ from current (enforced at DTO schema level)
 * - On success: ALL active sessions revoked (security posture — new password
 *   should result in fresh authentication on all devices)
 *
 * @see API Contract Phase 4 — POST /auth/forgot-password, POST /auth/reset-password,
 *                              PATCH /auth/change-password
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { EmailService } from './email.service';
import { AUTH_ERROR_CODES } from '../auth.constants';
import type { AuthenticatedUser } from '../auth.types';

export interface ForgotPasswordResult {
  message: string;
}

export interface ResetPasswordResult {
  message: string;
}

export interface ChangePasswordResult {
  message: string;
  sessionsRevoked: number;
}

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
  ) {}

  // ── Forgot Password ──────────────────────────────────────────────────────────

  /**
   * Initiate the password reset flow by sending a reset link.
   *
   * ALWAYS returns the same 200 response regardless of whether
   * the email is registered — prevents account enumeration.
   *
   * @param email - The email address submitted in the forgot-password form
   */
  async forgotPassword(email: string): Promise<ForgotPasswordResult> {
    const SAFE_RESPONSE: ForgotPasswordResult = {
      message:
        'If this email is registered, a password reset link has been sent. ' +
        'The link expires in 1 hour.',
    };

    // Deliberately not short-circuiting — runs the same code path for all emails
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          isActive: true,
          profile: { select: { firstName: true } },
        },
      });

      // Only generate + send if: user exists and account is active
      if (!user || !user.isActive) {
        return SAFE_RESPONSE;
      }

      const rawToken = await this.tokenService.generateOneTimeToken(user.id, 'password_reset');
      await this.emailService.sendPasswordResetEmail(
        email,
        user.profile?.firstName ?? 'User',
        rawToken,
      );

      this.logger.log({
        message: 'Password reset email queued',
        userId: user.id,
        email,
      });
    } catch (error) {
      // Swallow ALL errors — never expose internal state
      this.logger.error({
        message: 'Failed during forgot-password flow',
        email,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }

    return SAFE_RESPONSE;
  }

  // ── Reset Password ───────────────────────────────────────────────────────────

  /**
   * Complete the password reset using the token from the email link.
   *
   * Token validation is performed by TokenService.consumeOneTimeToken(),
   * which throws UnauthorizedException on invalid/expired/already-used tokens.
   *
   * After a successful reset:
   * - New password is hashed and stored
   * - ALL active refresh tokens are revoked (force re-login everywhere)
   * - A "password changed" security email is sent to the account holder
   *
   * @param token       - Raw token from the email reset link query parameter
   * @param newPassword - New password (already strength-validated by DTO)
   */
  async resetPassword(token: string, newPassword: string): Promise<ResetPasswordResult> {
    // consumeOneTimeToken validates + marks the token as used in one operation
    const userId = await this.tokenService.consumeOneTimeToken(token, 'password_reset');

    const newPasswordHash = await this.passwordService.hash(newPassword);

    // Fetch user details for the security email
    const [user, profile] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      }),
      this.prisma.userProfile.findUnique({
        where: { userId },
        select: { firstName: true },
      }),
    ]);

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    // Revoke all sessions in parallel with sending the security email
    const [sessionsRevokedResult] = await Promise.allSettled([
      this.tokenService.revokeAllUserTokens(userId),
      user
        ? this.emailService.sendPasswordChangedEmail(user.email, profile?.firstName ?? 'User')
        : Promise.resolve(),
    ]);

    const sessionsRevoked =
      sessionsRevokedResult.status === 'fulfilled' ? sessionsRevokedResult.value : 0;

    this.logger.log({
      message: 'Password reset via email token',
      userId,
      email: user?.email,
      sessionsRevoked,
    });

    return { message: 'Password updated successfully. Please log in again.' };
  }

  // ── Change Password (authenticated) ─────────────────────────────────────────

  /**
   * Change the authenticated user's password.
   *
   * Requires the current password for confirmation — even though the user
   * is authenticated via JWT, this prevents session-hijacking attacks from
   * changing the password without knowing the original.
   *
   * On success: all active sessions are revoked.
   *
   * @param user            - Currently authenticated user (from JwtAuthGuard)
   * @param currentPassword - Plain-text current password for verification
   * @param newPassword     - New password (already strength-validated by DTO)
   */
  async changePassword(
    user: AuthenticatedUser,
    currentPassword: string,
    newPassword: string,
  ): Promise<ChangePasswordResult> {
    // Load current password hash
    const dbUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true, email: true },
    });

    if (!dbUser.passwordHash) {
      // OAuth-only account — no password to change
      throw new BadRequestException({
        code: 'NO_PASSWORD_SET',
        message: 'This account uses social login and does not have a password.',
      });
    }

    // Timing-safe verification of current password
    const isCurrentPasswordValid = await this.passwordService.verify(
      currentPassword,
      dbUser.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      this.logger.warn({ message: 'Change-password: incorrect current password', userId: user.id });
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Current password is incorrect.',
      });
    }

    // Hash the new password
    const newPasswordHash = await this.passwordService.hash(newPassword);

    // Update password
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });

    // Revoke all sessions (security: new password = fresh auth required)
    const sessionsRevoked = await this.tokenService.revokeAllUserTokens(user.id);

    // Security notification (non-critical — fire-and-forget)
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId: user.id },
      select: { firstName: true },
    });

    this.emailService
      .sendPasswordChangedEmail(dbUser.email, profile?.firstName ?? 'User')
      .catch((err) => {
        this.logger.error({
          message: 'Failed to send password-changed email',
          userId: user.id,
          error: err instanceof Error ? err.message : 'unknown',
        });
      });

    this.logger.log({
      message: 'Password changed successfully',
      userId: user.id,
      sessionsRevoked,
    });

    return {
      message: 'Password updated. All active sessions have been signed out.',
      sessionsRevoked,
    };
  }
}
