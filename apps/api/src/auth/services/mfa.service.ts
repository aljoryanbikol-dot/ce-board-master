/**
 * @file mfa.service.ts
 * @module Auth/Services
 *
 * TOTP-based Multi-Factor Authentication service.
 *
 * Implements RFC 6238 TOTP via the `speakeasy` library. Compatible with
 * Google Authenticator, Authy, 1Password, and any RFC 6238 authenticator app.
 *
 * MFA flow (API Contract Phase 4, Group 1):
 * 1. POST /auth/mfa/setup    → generate secret + QR data
 * 2. User scans QR in authenticator app
 * 3. POST /auth/mfa/verify   → verify first code, enable MFA
 * 4. All future logins require mfaCode in request body
 * 5. DELETE /auth/mfa        → disable MFA (requires current TOTP)
 *
 * Security:
 * - TOTP secrets stored server-side (production: AES-256 via pgcrypto)
 * - Backup codes: 8 single-use codes, SHA-256 hashed before storage
 * - Shown once only — user must save them; cannot be retrieved after
 *
 * FIX (Audit Refactoring): verifyTotp() and verifyBackupCode() now throw
 * UnauthorizedException on failure instead of returning false. This removes
 * the if(!isValid) branching from the controller, making it a pure adapter.
 *
 * @see Database Architecture Phase 2 — MfaConfig model
 * @see Project Constitution Article XI §11 — MFA for admin roles
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as speakeasy from 'speakeasy';
import { PrismaService } from '../../database/prisma.service';
import { generateSecureToken, hashToken } from '../utils/token.utils';
import { AUTH_ERROR_CODES } from '../auth.constants';

export interface MfaSetupResult {
  qrCodeUrl: string;
  secret: string;
  backupCodes: string[];
}

const BACKUP_CODE_COUNT = 8;
const BACKUP_CODE_BYTES = 6;
const TOTP_WINDOW        = 1; // ±30 second clock drift tolerance

@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);
  private readonly issuer = 'CE Board Master';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a new TOTP secret and backup codes for a user.
   * Does NOT enable MFA — requires a successful verifyTotp() call first.
   */
  async setupMfa(userId: string, userEmail: string): Promise<MfaSetupResult> {
    const { base32: secret, otpauth_url } = speakeasy.generateSecret({
      name:   `${this.issuer}:${userEmail}`,
      issuer: this.issuer,
      length: 20,
    });

    const rawBackupCodes    = Array.from({ length: BACKUP_CODE_COUNT }, () =>
      generateSecureToken(BACKUP_CODE_BYTES).toUpperCase(),
    );
    const hashedBackupCodes = rawBackupCodes.map((c) => hashToken(c));

    await this.prisma.mfaConfig.upsert({
      where:  { userId },
      create: {
        userId,
        method:        'totp',
        totpSecretEnc: secret,
        backupCodes:   hashedBackupCodes,
        isEnabled:     false,
      },
      update: {
        totpSecretEnc: secret,
        backupCodes:   hashedBackupCodes,
        isEnabled:     false,
      },
    });

    this.logger.log({ message: 'MFA setup initiated', userId });

    return {
      qrCodeUrl: otpauth_url ?? `otpauth://totp/${this.issuer}:${userEmail}?secret=${secret}&issuer=${this.issuer}`,
      secret,
      backupCodes: rawBackupCodes,
    };
  }

  /**
   * Verify a TOTP code and, if this is the setup verification, enable MFA.
   *
   * FIX: Now throws UnauthorizedException on failure so the controller
   * can delegate unconditionally without if(!isValid) branching.
   *
   * Called by:
   * - POST /auth/mfa/verify (setup confirmation — first code)
   * - POST /auth/login (on every login when MFA is enabled, via LoginService)
   *
   * @throws BadRequestException  if MFA is not configured
   * @throws UnauthorizedException if the TOTP code is invalid
   */
  async verifyTotp(userId: string, totpCode: string): Promise<void> {
    const mfaConfig = await this.getMfaConfig(userId);

    if (!mfaConfig.totpSecretEnc) {
      throw new BadRequestException({
        code: 'MFA_NOT_SETUP',
        message: 'MFA has not been set up for this account.',
      });
    }

    const isValid = speakeasy.totp.verify({
      secret:   mfaConfig.totpSecretEnc,
      encoding: 'base32',
      token:    totpCode,
      window:   TOTP_WINDOW,
    });

    if (!isValid) {
      this.logger.warn({ message: 'Invalid TOTP code', userId });
      throw new UnauthorizedException({
        code:    AUTH_ERROR_CODES.MFA_INVALID,
        message: 'Invalid authentication code.',
      });
    }

    // Enable MFA on first successful verification (setup flow)
    if (!mfaConfig.isEnabled) {
      await this.prisma.mfaConfig.update({
        where: { userId },
        data:  { isEnabled: true, enabledAt: new Date(), lastUsedAt: new Date() },
      });
      this.logger.log({ message: 'MFA enabled', userId });
    } else {
      await this.prisma.mfaConfig.update({
        where: { userId },
        data:  { lastUsedAt: new Date() },
      });
    }
  }

  /**
   * Verify a backup code (single-use).
   *
   * FIX: Now throws UnauthorizedException on failure.
   *
   * @throws UnauthorizedException if the backup code is invalid or already used
   */
  async verifyBackupCode(userId: string, rawCode: string): Promise<void> {
    const mfaConfig = await this.getMfaConfig(userId);
    const codeHash  = hashToken(rawCode.toUpperCase());

    if (!mfaConfig.backupCodes.includes(codeHash)) {
      throw new UnauthorizedException({
        code:    AUTH_ERROR_CODES.MFA_INVALID,
        message: 'Invalid or already-used backup code.',
      });
    }

    // Remove consumed code (single-use guarantee)
    const remaining = mfaConfig.backupCodes.filter((c) => c !== codeHash);
    await this.prisma.mfaConfig.update({
      where: { userId },
      data:  { backupCodes: remaining },
    });

    this.logger.warn({
      message: 'MFA backup code used',
      userId,
      remainingCodes: remaining.length,
    });
  }

  /**
   * Disable MFA for a user.
   * The caller (controller) must call verifyTotp() BEFORE calling this method
   * to confirm the user has access to their current authenticator.
   */
  async disableMfa(userId: string): Promise<void> {
    await this.prisma.mfaConfig.update({
      where: { userId },
      data:  { isEnabled: false, totpSecretEnc: null, backupCodes: [] },
    });
    this.logger.log({ message: 'MFA disabled', userId });
  }

  /**
   * Check if MFA is enabled for a user.
   * Used by LoginService to determine if a TOTP challenge is required.
   */
  async isMfaEnabled(userId: string): Promise<boolean> {
    const config = await this.prisma.mfaConfig.findUnique({
      where:  { userId },
      select: { isEnabled: true },
    });
    return config?.isEnabled ?? false;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async getMfaConfig(userId: string) {
    const config = await this.prisma.mfaConfig.findUnique({ where: { userId } });
    if (!config) {
      throw new BadRequestException({
        code:    'MFA_NOT_SETUP',
        message: 'MFA has not been configured for this account.',
      });
    }
    return config;
  }
}
