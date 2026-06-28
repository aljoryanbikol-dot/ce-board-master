/**
 * @file register.service.ts
 * @module Auth/Services
 *
 * RegisterService — owns the complete user registration business flow.
 *
 * Extracted from the controller per Clean Architecture principles:
 * the controller is a thin HTTP adapter; all business logic lives here.
 *
 * Responsibilities:
 * 1. Guard against duplicate email (fast-fail before Argon2id)
 * 2. Hash password with Argon2id + pepper
 * 3. Resolve the default role from the database
 * 4. Persist user + profile in a single atomic transaction
 * 5. Generate an email-verification one-time token
 * 6. Enqueue the verification email (fire-and-forget via BullMQ)
 *
 * Transactional safety:
 * User + UserProfile creation are wrapped in a Prisma transaction.
 * If profile creation fails, the user row is also rolled back — the
 * database never contains a user without a profile.
 *
 * @see API Contract Phase 4 — POST /auth/register
 * @see Project Constitution Article XI §11 — Security Standards
 * @see Project Constitution Article V §5 — Student Trust
 */
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { EmailService } from './email.service';
import type { RegisterDto } from '../auth.dto';
import type { AppEnvironment } from '../../config/configuration';

export interface RegisterResult {
  userId: string;
  email: string;
  message: string;
}

@Injectable()
export class RegisterService {
  private readonly logger = new Logger(RegisterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService<AppEnvironment>,
  ) {}

  /**
   * Register a new CE Board Master account.
   *
   * @param dto      - Validated registration payload
   * @param ipAddress - Client IP address (stored for audit)
   * @returns userId, email, and instructional message
   */
  async register(dto: RegisterDto, ipAddress?: string): Promise<RegisterResult> {
    const { firstName, lastName, email, password, examTargetDate, school } = dto;

    // When email delivery isn't configured yet, AUTH_AUTO_VERIFY lets accounts
    // be usable immediately (created active + verified, no verification email).
    // Flip this off once real verification emails are wired up.
    const autoVerify = this.config.get('AUTH_AUTO_VERIFY', { infer: true }) === true;

    // ── 1. Duplicate-email guard ──────────────────────────────────────────────
    // Check BEFORE hashing to avoid ~200ms Argon2 work on duplicate requests.
    // Lookup by email (unique index) is sub-millisecond.
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      this.logger.warn({ message: 'Registration rejected — email already exists', email });
      throw new ConflictException({
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'An account with this email address already exists.',
        field: 'email',
      });
    }

    // ── 2. Hash password ──────────────────────────────────────────────────────
    // Argon2id with pepper — ~200ms intentional delay.
    const passwordHash = await this.passwordService.hash(password);

    // ── 3. Resolve default role ───────────────────────────────────────────────
    const role = await this.prisma.role.findUnique({ where: { slug: 'free_user' } });
    if (!role) {
      this.logger.error('Default role "free_user" not found — database not seeded');
      throw new InternalServerErrorException({
        code: 'CONFIGURATION_ERROR',
        message: 'Server configuration error. Please contact support.',
      });
    }

    // ── 4. Create user + profile atomically ───────────────────────────────────
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          roleId: role.id,
          // 'pending' → 'active' after email verification; 'active' immediately
          // when auto-verify is enabled (no email step).
          status: autoVerify ? 'active' : 'pending',
          isVerified: autoVerify,
          isActive: true,
          lastLoginIp: ipAddress ?? null,
        },
        select: { id: true, email: true },
      });

      await tx.userProfile.create({
        data: {
          userId: newUser.id,
          firstName,
          lastName,
          displayName: `${firstName} ${lastName}`.trim(),
          school: school ?? null,
          examTargetDate: examTargetDate ? new Date(examTargetDate) : null,
        },
      });

      return newUser;
    });

    // ── 5. Generate + dispatch verification email ─────────────────────────────
    // Token generated AFTER the transaction commits — avoids orphaned tokens
    // if the transaction rolls back. Skipped entirely when auto-verify is on.
    if (!autoVerify) {
      try {
        const rawToken = await this.tokenService.generateOneTimeToken(user.id, 'email_verify');
        await this.emailService.sendVerificationEmail(email, firstName, rawToken);
      } catch (emailError) {
        // Log but do NOT roll back the registration — the user can resend later
        this.logger.error({
          message: 'Failed to send verification email after registration',
          userId: user.id,
          error: emailError instanceof Error ? emailError.message : 'unknown',
        });
      }
    }

    this.logger.log({ message: 'User registered', userId: user.id, email, ipAddress, autoVerify });

    return {
      userId: user.id,
      email: user.email,
      message: autoVerify
        ? 'Account created. You can now sign in.'
        : 'Account created. Please check your email to verify your address.',
    };
  }
}
