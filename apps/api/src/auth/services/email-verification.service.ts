/**
 * @file email-verification.service.ts
 * @module Auth/Services
 *
 * EmailVerificationService — manages email address verification tokens.
 *
 * Responsibilities:
 * 1. Verify an email address using a one-time token from the email link
 * 2. Activate the user account upon successful verification
 * 3. Resend the verification email (rate-limited at the transport layer)
 *
 * Security design:
 * - Tokens are 256-bit cryptographically random values (generateSecureToken)
 * - Only the SHA-256 hash is stored in the database (hashToken)
 * - Tokens are single-use: consumeOneTimeToken marks them revoked on use
 * - Tokens expire after 24 hours
 * - The resend flow generates a NEW token each time (old tokens stay
 *   revoked — they were never revoked, but a new one is now the active one)
 *
 * Account enumeration protection on resend:
 * Resending always returns 200 regardless of whether the email is registered,
 * matching the same anti-enumeration pattern as forgot-password.
 *
 * @see API Contract Phase 4 — POST /auth/verify-email, POST /auth/resend-verification
 */
import {
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TokenService } from './token.service';
import { EmailService } from './email.service';

export interface VerifyEmailResult {
  message: string;
}

export interface ResendVerificationResult {
  message: string;
}

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Validate and consume an email verification token, then activate the account.
   *
   * Throws:
   * - UnauthorizedException from consumeOneTimeToken if token invalid/expired/used
   * - ConflictException if the account is already verified
   *
   * @param token - Raw token from the verification email link query parameter
   */
  async verifyEmail(token: string): Promise<VerifyEmailResult> {
    // consumeOneTimeToken throws UnauthorizedException on invalid/expired/used token
    const userId = await this.tokenService.consumeOneTimeToken(token, 'email_verify');

    // Check if already verified (idempotency guard)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isVerified: true, email: true },
    });

    if (user?.isVerified) {
      this.logger.debug({ message: 'Email already verified', userId });
      throw new ConflictException({
        code: 'ALREADY_VERIFIED',
        message: 'This email address has already been verified.',
      });
    }

    // Activate the account
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isVerified: true,
        status: 'active',
      },
    });

    this.logger.log({
      message: 'Email verified — account activated',
      userId,
      email: user?.email,
    });

    return { message: 'Email verified successfully. You may now log in.' };
  }

  /**
   * Resend the verification email.
   *
   * Account enumeration protection:
   * Always returns 200 with the same message regardless of whether the
   * email is registered or whether the account needs verification.
   * This prevents attackers from determining which emails are registered.
   *
   * @param email - Email address to resend verification to
   */
  async resendVerification(email: string): Promise<ResendVerificationResult> {
    const SAFE_RESPONSE: ResendVerificationResult = {
      message: 'If this email is registered and unverified, a new verification link has been sent.',
    };

    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          isVerified: true,
          isActive: true,
          profile: { select: { firstName: true } },
        },
      });

      // Only send if: user exists AND not yet verified AND account is active
      if (!user || user.isVerified || !user.isActive) {
        return SAFE_RESPONSE;
      }

      const rawToken = await this.tokenService.generateOneTimeToken(user.id, 'email_verify');
      await this.emailService.sendVerificationEmail(
        email,
        user.profile?.firstName ?? 'User',
        rawToken,
      );

      this.logger.log({ message: 'Verification email resent', userId: user.id, email });
    } catch (error) {
      // Swallow ALL errors — never expose internal state
      this.logger.error({
        message: 'Failed during resend-verification',
        email,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }

    return SAFE_RESPONSE;
  }
}
